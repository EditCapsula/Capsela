import { colorimetrieUtilisable } from "./colorimetrie";
import { morphologyLabel, paletteColorName, styleLabel, type Profile } from "./profile";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import type {
  AvisStyliste,
  CodeErreurAvis,
  ContexteAvis,
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

export type { AvisStyliste };

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
  | { ok: true; analyseId: string; avis: AvisStyliste }
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
    if (corps && corps.ok && estAvis(corps.avis)) return { ok: true, analyseId: corps.analyseId, avis: corps.avis };
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
