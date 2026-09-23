import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeVisualColor, normalizeVisualSubtype } from "../visualKey";
import {
  normalizeVisualColor as normalizeVisualColorDeno,
  normalizeVisualSubtype as normalizeVisualSubtypeDeno,
} from "../../../supabase/functions/_shared/visualKey.ts";

/**
 * LES DEUX COPIES DE LA LOGIQUE DE CLÉ VISUELLE DOIVENT RESTER D'ACCORD.
 *
 * `src/lib/visualKey.ts` (bundle Next) et
 * `supabase/functions/_shared/visualKey.ts` (runtime Deno) sont dupliquées
 * volontairement — le miroir Deno le dit lui-même : « à garder synchronisé si
 * les dictionnaires évoluent côté app ». Jusqu'ici, rien ne le vérifiait.
 *
 * L'enjeu n'est pas cosmétique. C'est le miroir Deno qui ÉCRIT réellement
 * `visual_assets.visual_key` ; c'est donc lui que tout audit de clés périmées
 * doit prendre pour référence. Si les deux dictionnaires divergent, l'app et
 * la fonction ne parlent plus de la même pièce, et un audit comparant l'un aux
 * clés produites par l'autre inventerait des dérives — ou en masquerait.
 *
 * Ce test compare les deux par le CALCUL, sur l'union des entrées déclarées de
 * part et d'autre, plutôt que par une lecture de diff : un commentaire
 * différent n'est pas une divergence, une entrée manquante si.
 *
 * Les signatures de `computeVisualKey`, elles, diffèrent légitimement : côté
 * app elle prend un CatalogItem et dérive le sous-type de plusieurs champs,
 * côté Deno elle prend les colonnes DB et retombe sur "unisexe". Ce sont deux
 * façades sur les mêmes dictionnaires — ce sont les dictionnaires qui sont
 * comparés ici.
 */
const SRC_APP = "src/lib/visualKey.ts";
const SRC_DENO = "supabase/functions/_shared/visualKey.ts";

/** Relit les clés d'un dictionnaire dans le source — même approche que le garde-fou visuels. */
function clesDuDictionnaire(fichier: string, nom: string): string[] {
  const source = readFileSync(fichier, "utf8");
  const m = new RegExp(`${nom}[^=]*=\\s*\\{([\\s\\S]*?)\\n\\};`).exec(source);
  if (!m) throw new Error(`${fichier} ne déclare plus ${nom} sous une forme reconnaissable — divergence non vérifiable.`);
  return [...m[1].matchAll(/^\s*"?([^":\n]+?)"?\s*:/gm)].map((e) => e[1].trim());
}

/** Relit les entrées d'un Set déclaré en littéral. */
function entreesDuSet(fichier: string, nom: string): string[] {
  const source = readFileSync(fichier, "utf8");
  const m = new RegExp(`${nom}[^=]*=\\s*new Set\\(\\[([\\s\\S]*?)\\]\\)`).exec(source);
  if (!m) throw new Error(`${fichier} ne déclare plus ${nom} sous une forme reconnaissable — divergence non vérifiable.`);
  return m[1]
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean)
    .sort();
}

describe("miroir Deno de la clé visuelle", () => {
  it("déclare les mêmes couleurs regroupées des deux côtés", () => {
    const app = clesDuDictionnaire(SRC_APP, "COLOR_BUCKETS").sort();
    const deno = clesDuDictionnaire(SRC_DENO, "COLOR_BUCKETS").sort();
    expect(deno).toEqual(app);
    expect(app.length).toBeGreaterThan(10); // garde-fou du garde-fou : la regex a bien lu quelque chose
  });

  it("déclare les mêmes sous-types regroupés des deux côtés", () => {
    const app = clesDuDictionnaire(SRC_APP, "SUBTYPE_BUCKETS").sort();
    const deno = clesDuDictionnaire(SRC_DENO, "SUBTYPE_BUCKETS").sort();
    expect(deno).toEqual(app);
    expect(app.length).toBeGreaterThan(10);
  });

  it("déclare les mêmes matières visuellement significatives", () => {
    expect(entreesDuSet(SRC_DENO, "VISUALLY_SIGNIFICANT_MATIERES")).toEqual(
      entreesDuSet(SRC_APP, "VISUALLY_SIGNIFICANT_MATIERES")
    );
  });

  it("normalise chaque couleur déclarée à l'identique", () => {
    const toutes = [
      ...new Set([...clesDuDictionnaire(SRC_APP, "COLOR_BUCKETS"), ...clesDuDictionnaire(SRC_DENO, "COLOR_BUCKETS")]),
    ];
    for (const c of toutes) {
      expect(normalizeVisualColorDeno(c), c).toBe(normalizeVisualColor(c));
    }
  });

  it("normalise chaque sous-type déclaré à l'identique", () => {
    const tous = [
      ...new Set([...clesDuDictionnaire(SRC_APP, "SUBTYPE_BUCKETS"), ...clesDuDictionnaire(SRC_DENO, "SUBTYPE_BUCKETS")]),
    ];
    for (const s of tous) {
      expect(normalizeVisualSubtypeDeno(s), s).toBe(normalizeVisualSubtype(s));
    }
  });

  it("traite de la même façon ce qui n'est dans aucun seau", () => {
    // Les valeurs hors dictionnaire retombent sur le slug : c'est le chemin le
    // plus emprunté en pratique, et celui qu'un test sur les seuls seaux
    // n'aurait jamais couvert.
    const horsSeau = ["Vert absinthe", "Chemise bowling", "Taupe clair", "Robe trapèze structurée", "  ", "Écru / beige"];
    for (const v of horsSeau) {
      expect(normalizeVisualColorDeno(v), v).toBe(normalizeVisualColor(v));
      expect(normalizeVisualSubtypeDeno(v), v).toBe(normalizeVisualSubtype(v));
    }
  });
});
