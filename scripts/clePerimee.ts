import { readFileSync } from "node:fs";
import { CATEGORY_CANON } from "../supabase/functions/_shared/imagePrompt.ts";
import { computeVisualKey } from "../supabase/functions/_shared/visualKey.ts";

// Partie PURE de l'audit des clés périmées (cf. cles-perimees.audit.ts).
//
// Séparée du fichier d'audit pour une raison précise : l'audit interroge
// Supabase, et personne ne peut le lancer sans identifiants — moi compris.
// Sa logique de décision, elle, se vérifie hors ligne sur de vraies lignes.
// Le défaut que cet audit remplace venait justement d'une règle de
// comparaison jamais testée.

const SOURCE_FONCTION = "supabase/functions/generate-catalog-image/index.ts";

/**
 * Miroir de `shortHash` (generate-catalog-image). Dupliqué et non importé :
 * `index.ts` est du Deno et tire des imports par URL que Vitest ne sait pas
 * résoudre. La duplication est tenue honnête par `verifieHashNonDerive`.
 *
 * Sans lui, tout article « bespoke » — prompt_image_override, silhouette_mode
 * ou details_mode renseignés — ressortirait comme périmé : sa clé porte un
 * suffixe ~ov~/~bp~ que la fonction de clé seule ne produit pas. C'était la
 * SECONDE famille de faux positifs du balayage SQL.
 */
export function shortHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Relit shortHash dans le source de la fonction et échoue s'il a changé de forme. */
export function verifieHashNonDerive(): void {
  const source = readFileSync(SOURCE_FONCTION, "utf8");
  const m = /function shortHash\(s: string\): string \{([\s\S]*?)\n\}/.exec(source);
  if (!m) throw new Error(`${SOURCE_FONCTION} ne déclare plus shortHash sous une forme reconnaissable — audit arrêté plutôt que faux.`);
  const corps = m[1].replace(/\s+/g, "");
  const attendu = "leth=0x811c9dc5;for(leti=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193);}return(h>>>0).toString(36);";
  if (corps !== attendu) {
    throw new Error(
      `shortHash a changé dans ${SOURCE_FONCTION} — le miroir de cet audit est périmé.\n` +
        `  trouvé : ${corps}\n  attendu : ${attendu}\n` +
        `  Aligner le miroir avant de conclure quoi que ce soit.`
    );
  }
}

export interface Article {
  id: number;
  name: string | null;
  category: string | null;
  genre: string | null;
  sous_type: string | null;
  couleur_dominante: string | null;
  matiere: string | null;
  coupe: string | null;
  prompt_image_override: string | null;
  silhouette_mode: string | null;
  details_mode: string | null;
  visual_asset_id: number | null;
}

export type Cause =
  | "attribut absent à la génération"
  | "attribut modifié depuis"
  | "catégorie inconnue du canon";

export interface Perimee {
  article: Article;
  stockee: string;
  attendue: string;
  cause: Cause;
  detail: string;
}

/** Reproduit EXACTEMENT la recette du générateur, marqueur bespoke compris. */
export function cleAttendue(a: Article): string | null {
  const rawCategory = (a.category || "").trim().toLowerCase();
  const canonCategory = CATEGORY_CANON[rawCategory];
  if (!canonCategory) return null;
  const genreRaw = (a.genre || "").trim().toLowerCase();
  const genre = genreRaw === "femme" ? "femme" : genreRaw === "homme" ? "homme" : "unisexe";
  const base = computeVisualKey({
    genre,
    category: canonCategory,
    sousType: a.sous_type,
    couleur: a.couleur_dominante,
    matiere: a.matiere,
    coupe: a.coupe,
  });
  const marqueur = a.prompt_image_override?.trim()
    ? `~ov~${shortHash(a.prompt_image_override.trim())}`
    : a.silhouette_mode?.trim() || a.details_mode?.trim()
      ? `~bp~${shortHash(`${a.silhouette_mode || ""}|${a.details_mode || ""}`)}`
      : "";
  return `${base}${marqueur}`;
}

/**
 * Distingue les deux situations, parce qu'elles n'appellent pas la même suite.
 *
 * « attribut absent à la génération » : la clé a été bâtie AVANT que le
 * sous-type ou la couleur n'existe — elle ne contient donc que le genre et la
 * catégorie, et le visuel est générique. C'est le cas des collants signalés le
 * 23/09 (clé « femme_accessoire »). Régénération justifiée.
 *
 * « attribut modifié depuis » : la fiche a changé après coup. À arbitrer pièce
 * par pièce — le visuel peut rester acceptable.
 */
export function causeDe(stockee: string, attendue: string): { cause: Cause; detail: string } {
  const segmentsStockes = stockee.split("~")[0].split("_").filter(Boolean);
  const segmentsAttendus = attendue.split("~")[0].split("_").filter(Boolean);
  if (segmentsStockes.length < segmentsAttendus.length) {
    const manquants = segmentsAttendus.filter((s) => !segmentsStockes.includes(s));
    return { cause: "attribut absent à la génération", detail: `segments absents de la clé : ${manquants.join(", ") || "—"}` };
  }
  return { cause: "attribut modifié depuis", detail: `${stockee} -> ${attendue}` };
}
