import { PAL_COULEURS } from "./palCouleurs";

/**
 * COLORIMÉTRIE ET PALETTE CAPSELA.
 *
 * Trois choses vivent ici, et une seule touche la base : le type persisté,
 * le calcul de la palette affichée, et l'interface d'analyse.
 *
 * NOMMAGE EN FRANÇAIS, comme les quarante autres fichiers du dépôt. Le brief
 * proposait `colorPreferences` / `intensityPreference` / `colorimetry` ;
 * arbitré le 25/09/2026 de garder la langue du projet, qui n'a aucun
 * identifiant anglais ailleurs.
 *
 * LES PRÉFÉRENCES RESTENT EN HEX. `paletteHexes()` les passe telles quelles
 * au moteur (capsule.ts, styleCoverage.ts) ; les convertir en noms imposerait
 * une migration des profils et une conversion à chaque appel, pour perdre au
 * passage la distinction entre « Blanc » et « Blanc / écru » que le hex porte
 * sans ambiguïté.
 */

/** Ce que l'analyse rend, ou l'absence d'analyse. Persisté en jsonb. */
export interface Colorimetrie {
  statut: "aucune" | "encours" | "faite" | "erreur";
  /** Clé stable, jamais affichée — ex. "automne_chaud". */
  saison?: string;
  /** Libellé affiché — ex. « Automne chaud ». */
  libelle?: string;
  /** Hex de PAL_COULEURS. */
  signature?: string[];
  neutres?: string[];
  /**
   * « Plutôt loin du visage ». JAMAIS « interdit », jamais « à éviter » :
   * l'écran de résultat le dit avec ces mots-là, et le moteur n'en retire
   * aucune couleur.
   */
  moderation?: string[];
  /** 0..1, absent si le service ne le rend pas — le badge dépend de sa présence. */
  confiance?: number;
  analyseeLe?: string;
  source?: "camera" | "galerie";
}

export const COLORIMETRIE_VIDE: Colorimetrie = { statut: "aucune" };

/** Une analyse exploitable : faite, avec au moins une couleur signature. */
export function colorimetrieUtilisable(c: Colorimetrie | null | undefined): boolean {
  return !!c && c.statut === "faite" && !!c.signature?.length;
}

/** Nombre maximal de couleurs dans la palette Capsela, et de neutres dedans. */
export const PALETTE_CAPSELA_MAX = 8;
export const PALETTE_CAPSELA_NEUTRES = 2;

/**
 * LA PALETTE CAPSELA — calculée à la volée, JAMAIS stockée.
 *
 * L'ordre est celui du brief, et chaque rang dit quelque chose :
 *
 *   1. les signatures QUI SONT AUSSI des préférences — ce qu'elle aime et qui
 *      la met en valeur, l'intersection est ce qu'on veut montrer d'abord ;
 *   2. les autres préférences, hors « avec modération » ;
 *   3. les autres signatures ;
 *   4. jusqu'à deux neutres, pour que la palette soit portable.
 *
 * CE QUI EST EN « AVEC MODÉRATION » N'EST PAS RETIRÉ DU MOTEUR. Ce calcul ne
 * sert qu'à l'affichage : `paletteHexes(profile)` continue de rendre TOUTES
 * les préférences, y compris celles-là. Une couleur qu'elle a choisie ne
 * disparaît pas de ses tenues parce qu'une analyse la place loin du visage —
 * la nuance appartient à l'écran, pas à la sélection.
 *
 * Sans colorimétrie, la palette EST la liste des préférences. C'est le cas
 * « passer l'analyse », et il doit rendre quelque chose de juste, pas un vide.
 */
export function paletteCapsela(preferences: string[], colorimetrie?: Colorimetrie | null): string[] {
  const prefs = preferences.filter(Boolean);
  if (!colorimetrieUtilisable(colorimetrie)) return prefs.slice(0, PALETTE_CAPSELA_MAX);

  const signature = colorimetrie!.signature ?? [];
  const neutres = colorimetrie!.neutres ?? [];
  const moderation = new Set(colorimetrie!.moderation ?? []);
  const ensemblePrefs = new Set(prefs);

  const out: string[] = [];
  const ajouter = (hex: string) => {
    if (out.length >= PALETTE_CAPSELA_MAX) return;
    if (!out.includes(hex)) out.push(hex);
  };

  for (const h of signature) if (ensemblePrefs.has(h)) ajouter(h);
  for (const h of prefs) if (!signature.includes(h) && !moderation.has(h)) ajouter(h);
  for (const h of signature) ajouter(h);

  let poses = 0;
  for (const h of neutres) {
    if (poses >= PALETTE_CAPSELA_NEUTRES) break;
    if (out.includes(h)) continue;
    const avant = out.length;
    ajouter(h);
    if (out.length > avant) poses++;
  }
  return out;
}

/**
 * Hex de PAL_COULEURS, pour valider ce que rend un service externe.
 *
 * Lue au chargement sans risque : `palCouleurs.ts` est un module feuille,
 * sans aucun import. Le cycle qui existait avec `profile.ts` est rompu.
 */
const HEX_CONNUS = new Set(PAL_COULEURS.map(([, x]) => x));

/**
 * Lecture d'une réponse d'analyse — PURE, donc testée.
 *
 * On ne fait jamais confiance à la sortie : toute couleur hors de
 * PAL_COULEURS est écartée plutôt que transmise, même motif que `sanitize()`
 * dans la fonction Edge `analyze-dressing-photo`. Une teinte inventée par un
 * modèle ne doit pas apparaître dans une palette présentée comme la sienne.
 */
export function lireColorimetrie(data: unknown, source: Colorimetrie["source"]): Colorimetrie {
  const o = (data ?? {}) as Record<string, unknown>;
  const hexes = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && HEX_CONNUS.has(x)) : [];
  const signature = hexes(o.signature);
  if (!signature.length) return { statut: "erreur" };
  const c: Colorimetrie = {
    statut: "faite",
    signature,
    neutres: hexes(o.neutres),
    analyseeLe: new Date().toISOString(),
    source,
  };
  if (typeof o.saison === "string") c.saison = o.saison;
  if (typeof o.libelle === "string") c.libelle = o.libelle;
  const mod = hexes(o.moderation);
  // Absent plutôt que vide : l'écran n'affiche le groupe « Plutôt loin du
  // visage » QUE si le service l'a rendu. Un tableau vide afficherait un
  // titre sans contenu.
  if (mod.length) c.moderation = mod;
  if (typeof o.confiance === "number" && o.confiance >= 0 && o.confiance <= 1) c.confiance = o.confiance;
  return c;
}

/**
 * LE SERVICE D'ANALYSE N'EXISTE PAS AU 25/09/2026.
 *
 * `colorimetrieDisponible()` est le seul endroit qui le dit, et toute
 * l'interface en découle : quand elle rend false, l'étape ne propose PAS de
 * prendre une photo — elle annonce que l'analyse arrive et propose de passer.
 * Un bouton « Prendre une photo » qui n'analyse rien serait la promesse qu'on
 * ne peut pas afficher, exactement comme la vidéo récompensée sans régie.
 *
 * Le mock ne s'active que derrière `NEXT_PUBLIC_COLORIMETRIE_MOCK=1`, et
 * l'écran affiche alors « Résultat de démonstration ». Jamais de faux
 * résultat silencieux.
 */
export function colorimetrieMockActive(): boolean {
  return process.env.NEXT_PUBLIC_COLORIMETRIE_MOCK === "1";
}

export function colorimetrieDisponible(): boolean {
  // Le jour où un service existe, c'est ici qu'il s'ajoute — et nulle part
  // ailleurs dans l'interface.
  return colorimetrieMockActive();
}

/** Résultat de démonstration — n'est atteint que si le drapeau est posé. */
const DEMO: Record<string, unknown> = {
  saison: "automne_chaud",
  libelle: "Automne chaud",
  signature: ["#A66950", "#C08A5E", "#C29A3D", "#6E7358", "#6E3B3A"],
  neutres: ["#5A4436", "#E7DCC8", "#A8967C", "#CDBBA2"],
  moderation: ["#2A2724", "#8E8B85", "#D6A9A0"],
  confiance: 0.82,
};

/**
 * Point d'entrée unique de l'analyse. Ne jette jamais : une erreur devient
 * `{ statut: "erreur" }`, que l'écran traite comme « réessayer ou passer ».
 */
export async function analyserColorimetrie(
  _image: Blob,
  source: Colorimetrie["source"]
): Promise<Colorimetrie> {
  if (!colorimetrieDisponible()) return { statut: "erreur" };
  try {
    // Mock : le seul chemin existant aujourd'hui. Le délai imite l'attente
    // réelle pour que l'écran d'analyse soit vu et mesuré.
    await new Promise((r) => setTimeout(r, 2200));
    return lireColorimetrie(DEMO, source);
  } catch {
    return { statut: "erreur" };
  }
}
