import { colorimetrieUtilisable } from "./colorimetrie";
import { lireReconnaissance, type VetementReconnu } from "./reconnaissance";
import { morphologyLabel, paletteColorName, styleLabel, type Profile } from "./profile";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import type {
  AvisStyliste,
  CodeErreurAvis,
  ContexteAvis,
  PieceSuggeree,
  RaisonInexploitable,
  ReponseAvis,
} from "../../supabase/functions/_shared/avisStyliste.ts";

/*
 * AVIS DE STYLISTE — côté app : contexte envoyé, appel de la fonction Edge
 * « stylist-advice », traduction des refus en messages (docs/avis-de-styliste.md
 * sections 9 et 15 ; arbitrages du 25/09/2026).
 *
 * Les types viennent du module serveur (import de type seulement : rien de ce
 * code serveur n'entre dans le bundle de l'app). La validation qui compte est
 * serveur ; l'app vérifie seulement que la réponse a la forme attendue avant
 * de l'afficher.
 */

export type { AvisStyliste, PieceSuggeree };

const noms = (hexes: string[] | undefined) =>
  (hexes ?? []).map((h) => paletteColorName(h)).filter((n): n is string => Boolean(n));

/**
 * Contexte de personnalisation (arbitré, point 13) : style, morphologie
 * DÉCLARÉE si renseignée, palette préférée, colorimétrie analysée — en
 * libellés lisibles, jamais en codes. Aucun nom, email ni identifiant.
 */
export function contexteDepuisProfil(profile: Profile): ContexteAvis {
  const c: ContexteAvis = {};
  const styles = profile.styles.map((id) => styleLabel(id, profile.gender)).filter(Boolean);
  if (styles.length) c.style = styles;
  const morphologie = morphologyLabel(profile.morphology);
  if (morphologie) c.morphologie = morphologie;
  const palette = noms(profile.paletteCouleurs);
  if (palette.length) c.palette = palette;
  if (colorimetrieUtilisable(profile.colorimetrie)) {
    const k = profile.colorimetrie;
    c.colorimetrie = {
      ...(k.libelle ? { saison: k.libelle } : {}),
      ...(noms(k.signature).length ? { signature: noms(k.signature) } : {}),
      ...(noms(k.neutres).length ? { neutres: noms(k.neutres) } : {}),
      ...(noms(k.moderation).length ? { loinDuVisage: noms(k.moderation) } : {}),
    };
  }
  return c;
}

export type ResultatDemande =
  | { ok: true; analyseId: string; avis: AvisStyliste; dressing: PieceSuggeree[]; reconnaissance: VetementReconnu[] }
  | { ok: false; code: CodeErreurAvis | "reseau"; raison?: RaisonInexploitable };

function lireFichierEnDataUrl(fichier: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(String(lecteur.result));
    lecteur.onerror = () => reject(lecteur.error);
    lecteur.readAsDataURL(fichier);
  });
}

/** La réponse a-t-elle la forme d'un avis ? (le serveur l'a déjà validée ; garde-fou d'affichage). */
export function estAvis(v: unknown): v is AvisStyliste {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  const chaines = (x: unknown) => Array.isArray(x) && x.length > 0 && x.every((s) => typeof s === "string" && s.trim());
  return typeof o.overallAssessment === "string" && typeof o.mainAdvice === "string" && chaines(o.strengths) && chaines(o.suggestions);
}

/** Pièces suggérées reçues : identifiants numériques uniquement, 3 au plus (point 5). */
export function piecesSuggerees(v: unknown): PieceSuggeree[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((p): p is PieceSuggeree => !!p && typeof p === "object" && Number.isInteger((p as PieceSuggeree).id) && typeof (p as PieceSuggeree).lien === "string")
    .slice(0, 3);
}

/**
 * Envoie la photo préparée (JPEG, cf. photoAvis.ts) et le contexte. Ne lève
 * jamais. Sans Supabase (mode démo), aucune analyse réelle : erreur réseau.
 */
export async function demanderAvis(fichier: File, contexte: ContexteAvis): Promise<ResultatDemande> {
  if (!isSupabaseConfigured) return { ok: false, code: "reseau" };
  let image: string;
  try {
    image = await lireFichierEnDataUrl(fichier);
  } catch {
    return { ok: false, code: "fichier_invalide" };
  }
  try {
    const { data, error } = await getSupabase().functions.invoke("stylist-advice", { body: { image, contexte } });
    if (error) {
      // Erreur HTTP : le corps porte le code ; erreur réseau ou relais : pas de corps.
      const reponse = (error as { context?: unknown }).context;
      if (reponse instanceof Response) {
        const corps = (await reponse.json().catch(() => null)) as ReponseAvis | null;
        if (corps && corps.ok === false) return { ok: false, code: corps.code, raison: corps.raison };
        return { ok: false, code: reponse.status === 403 ? "non_premium" : "erreur_modele" };
      }
      return { ok: false, code: "reseau" };
    }
    const corps = data as ReponseAvis | null;
    if (corps && corps.ok && estAvis(corps.avis)) {
      return { ok: true, analyseId: corps.analyseId, avis: corps.avis, dressing: piecesSuggerees(corps.dressing), reconnaissance: lireReconnaissance(corps.reconnaissance) };
    }
    return { ok: false, code: "reponse_invalide" };
  } catch {
    return { ok: false, code: "reseau" };
  }
}

/**
 * Message et action pour chaque échec (section 15). Libellés DÉCIDÉS repris
 * tels quels ; propositions de la spec affichées en attendant leur
 * validation (TODO_COPY) ; jamais de message technique brut.
 */
export type Reaction =
  | { action: "gate" }
  | { action: "changer_photo"; message: string }
  | { action: "reessayer"; message: string; sousTexte?: string };

const MESSAGE_ILLISIBLE = "Je n'arrive pas à lire suffisamment ta tenue. Essaie avec une photo plus nette et plus lumineuse."; // [DÉCIDÉ] §15
const MESSAGE_IMPOSSIBLE = "Impossible d'analyser ta tenue pour le moment."; // [DÉCIDÉ] §15
const SOUS_TEXTE_IMPOSSIBLE = "Réessaie dans quelques instants."; // [DÉCIDÉ] §15
// TODO_COPY : propositions de la spec (§15), non validées.
const MESSAGE_SANS_TENUE = "Je ne vois pas de tenue sur cette photo. Essaie avec une photo où ton look est bien visible.";
const MESSAGE_FICHIER = "Ce fichier ne peut pas être utilisé. Choisis une autre photo.";
const MESSAGE_RESEAU = "Connexion interrompue. Vérifie ton réseau et réessaie.";

export function reactionErreur(code: CodeErreurAvis | "reseau", raison?: RaisonInexploitable): Reaction {
  switch (code) {
    case "non_authentifie":
    case "non_premium":
      return { action: "gate" };
    case "photo_inexploitable":
      return { action: "changer_photo", message: raison === "no_garment" ? MESSAGE_SANS_TENUE : MESSAGE_ILLISIBLE };
    case "fichier_invalide":
      return { action: "changer_photo", message: MESSAGE_FICHIER };
    case "reseau":
      return { action: "reessayer", message: MESSAGE_RESEAU };
    // statut_indisponible (Premium invérifiable, arbitré : jamais le Gate),
    // delai_depasse, erreur_modele, reponse_invalide, configuration.
    default:
      return { action: "reessayer", message: MESSAGE_IMPOSSIBLE, sousTexte: SOUS_TEXTE_IMPOSSIBLE };
  }
}

/* ───────── Présentation du résultat (optimisation du parcours, 26/09/2026) ───────── */

/**
 * Les pièces du dressing que le serveur a rattachées à l'avis, rangées là où
 * elles servent : sous le conseil ("mainAdvice") ou sous la suggestion N
 * ("suggestion:N", N à partir de 1). Seules les pièces ENCORE dans le
 * dressing sont gardées (arbitré) ; un lien illisible range la pièce dans
 * `autres`, pour qu'aucune ne disparaisse sans raison.
 */
export function repartirPiecesAvis<T extends { id: number }>(
  pieces: PieceSuggeree[],
  dressing: T[],
  nbSuggestions: number
): { conseil: T[]; parSuggestion: T[][]; autres: T[] } {
  const conseil: T[] = [];
  const parSuggestion: T[][] = Array.from({ length: nbSuggestions }, () => []);
  const autres: T[] = [];
  for (const p of pieces) {
    const piece = dressing.find((d) => d.id === p.id);
    if (!piece) continue;
    const m = /^suggestion:(\d+)$/.exec(p.lien);
    if (p.lien === "mainAdvice") conseil.push(piece);
    else if (m && Number(m[1]) >= 1 && Number(m[1]) <= nbSuggestions) parSuggestion[Number(m[1]) - 1].push(piece);
    else autres.push(piece);
  }
  return { conseil, parSuggestion, autres };
}

/**
 * Ce que l'avis a réellement pris en compte, dit en toutes lettres : SEULES
 * les données envoyées à la styliste (contexteDepuisProfil) — jamais une
 * personnalisation qui n'a pas eu lieu. Vide : la ligne ne s'affiche pas.
 */
export function personnalisationAvis(c: ContexteAvis): string[] {
  const l: string[] = [];
  if (c.style?.length) l.push(`ton style ${c.style[0]}`);
  if (c.morphologie) l.push("ta silhouette");
  if (c.palette?.length || c.colorimetrie) l.push("tes couleurs");
  return l;
}

/**
 * Les temps de l'état d'analyse (V2, 26/09/2026 : des mots, plus des phrases
 * de « checklist technique »). Ils décrivent ce que la styliste regarde
 * réellement (vêtements, couleurs, associations — cf. INSTRUCTIONS) ; « Ton
 * style » et « Tes proportions » ne sont annoncés que si un style ou une
 * morphologie a été envoyé.
 */
export function etapesAnalyse(c: ContexteAvis): string[] {
  return [
    "Silhouette",
    "Couleurs",
    "Associations",
    ...(c.style?.length ? ["Ton style"] : []),
    ...(c.morphologie ? ["Tes proportions"] : []),
  ];
}

/**
 * La phrase éditoriale sous l'état d'analyse. Elle ne promet que ce qui a
 * lieu : « ton style » si un style est envoyé, « ton dressing » si le
 * dressing réel a des pièces — le serveur y cherche alors celles qui
 * appliquent le conseil (choisirPiecesDressing).
 */
export function phraseAnalyse(c: ContexteAvis, aDesPieces: boolean): string {
  const adapte = [c.style?.length ? "à ton style" : null, aDesPieces ? "à ton dressing" : null].filter(Boolean);
  return adapte.length ? `Chaque tenue est unique. Ton avis sera adapté ${adapte.join(" et ")}.` : "Chaque tenue est unique.";
}

/* ───────── « Et maintenant ? » (Avis de styliste V2, 26/09/2026) ───────── */

export type ActionAvis = "porter" | "demain" | "planifier";

/**
 * Une action principale, une secondaire — jamais un mur de boutons. Le
 * contexte ne vient que de ce que l'app sait réellement :
 *   - l'heure locale : en soirée, la tenue sert plutôt demain ;
 *   - la tenue du jour déjà validée comme portée : la remplacer n'a plus de
 *     sens, on propose demain.
 * Sans composition utilisable (pièces reconnues sans socle), aucune action :
 * la section ne montre pas de bouton qui ne mènerait à rien.
 * Pas de cas « Valise » : le parcours valise n'existe pas encore dans
 * l'app (la carte du hub mène à Premium) — aucune action n'y renvoie.
 * ARBITRAGE ÉDITORIAL : la soirée commence à 17 h.
 */
export const HEURE_SOIREE = 17;

export function prioriserActionsAvis(ctx: {
  heure: number;
  tenueDuJourPortee: boolean;
  composable: boolean;
}): { principale: ActionAvis; secondaires: ActionAvis[] } | null {
  if (!ctx.composable) return null;
  if (ctx.heure >= HEURE_SOIREE || ctx.tenueDuJourPortee) return { principale: "demain", secondaires: ["planifier"] };
  return { principale: "porter", secondaires: ["planifier"] };
}
