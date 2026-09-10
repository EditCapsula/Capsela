import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fermetureMaille } from "../attributes";
import { STRATEGIE_LEGACY, computeDefaultCapsule, representativeWeatherFor } from "../capsule";
import { EMPTY_PROFILE } from "../profile";
import type { CatalogItem } from "../catalog";
import type { CategoryKey, Item, Season } from "../types";

// MAILLES OUVERTES / FERMÉES — verrouillage du comportement arbitré le
// 31/08/2026.
//
// Ces tests verrouillent la CLASSIFICATION PIÈCE PAR PIÈCE, jamais le total
// agrégé. La distinction n'est pas rhétorique : le premier audit comptait
// 34 mailles fermées en classant les sweats zippés fermés et en laissant les
// hoodies non classés ; le second en compte 34 en faisant exactement
// l'inverse. Deux classifications contradictoires rendent le même total. Un
// test qui aurait vérifié « 34 » aurait donc validé les deux.

const pieceBrute = (over: Partial<Item> = {}): Item => ({
  id: 1, name: "", cat: "pull", color: "Noir", hex: "#2A2724", season: "Toutes saisons" as Season, worn: null, ...over,
});

/**
 * LES 26 VALEURS RÉELLES DE `sous_type` SUR LES 56 PULLS DU VESTIAIRE,
 * relevées par l'audit `sous-type-reel` du 31/08/2026 et classées par l'audit
 * `mailles-fermees` du même jour, tableau relu et validé pièce par pièce.
 *
 * Le champ `n` est l'effectif réel de chaque valeur au catalogue : il n'a
 * aucun effet sur l'assertion, il documente combien de pièces dépendent de
 * chaque ligne. Total 56, dont 34 fermées et 22 ouvertes.
 */
const CLASSIFICATION_AUDITEE: { sousType: string; n: number; attendu: "fermée" | "ouverte" }[] = [
  // ── Fermées : s'enfilent par la tête (34 pièces) ──
  { sousType: "Pull col roulé", n: 7, attendu: "fermée" },
  { sousType: "Pull col rond", n: 7, attendu: "fermée" },
  { sousType: "Pull col V", n: 5, attendu: "fermée" },
  { sousType: "Pull col roulé épais", n: 3, attendu: "fermée" },
  { sousType: "Pull torsadé", n: 2, attendu: "fermée" },
  // Cas frontière explicitement arbitré : un hoodie ne s'ouvre pas.
  { sousType: "Hoodie", n: 2, attendu: "fermée" },
  // Cas frontière explicitement arbitré : un sweat NON zippé reste fermé.
  { sousType: "Sweat graphique", n: 2, attendu: "fermée" },
  { sousType: "Pull col roulé fin", n: 1, attendu: "fermée" },
  { sousType: "Pull sans manches", n: 1, attendu: "fermée" },
  { sousType: "Pull sans manches col V", n: 1, attendu: "fermée" },
  { sousType: "Pull oversize", n: 1, attendu: "fermée" },
  { sousType: "Pull manches ballon maille", n: 1, attendu: "fermée" },
  { sousType: "Pull texturé", n: 1, attendu: "fermée" },
  // ── Ouvertes : s'ouvrent sur le devant (22 pièces) ──
  { sousType: "Cardigan", n: 5, attendu: "ouverte" },
  { sousType: "Cardigan col V", n: 2, attendu: "ouverte" },
  { sousType: "Cardigan épais", n: 2, attendu: "ouverte" },
  { sousType: "Cardigan structuré", n: 2, attendu: "ouverte" },
  { sousType: "Gilet sans manches épais", n: 2, attendu: "ouverte" },
  // Cas frontière explicitement arbitré : le zip prime sur le préfixe "Sweat".
  { sousType: "Sweat à capuche zippé", n: 2, attendu: "ouverte" },
  { sousType: "Cardigan maille", n: 1, attendu: "ouverte" },
  { sousType: "Cardigan col rond", n: 1, attendu: "ouverte" },
  { sousType: "Cardigan fin", n: 1, attendu: "ouverte" },
  { sousType: "Gilet fin maille", n: 1, attendu: "ouverte" },
  { sousType: "Gilet sans manches", n: 1, attendu: "ouverte" },
  { sousType: "Gilet sans manches maille", n: 1, attendu: "ouverte" },
  { sousType: "Gilet crochet sans manches", n: 1, attendu: "ouverte" },
];

describe("classification ouverte / fermée — pièce par pièce", () => {
  it.each(CLASSIFICATION_AUDITEE)(
    "« $sousType » ($n pièces au catalogue) est $attendu",
    ({ sousType, attendu }) => {
      expect(fermetureMaille(pieceBrute({ subtype: sousType, name: sousType }))).toBe(attendu);
    }
  );

  it("couvre les 56 pulls du vestiaire, 34 fermées et 22 ouvertes", () => {
    // Contrôle de complétude du tableau ci-dessus, PAS de la classification :
    // il garantit qu'aucune ligne n'a été retirée sans que les effectifs
    // soient recalculés. Le verdict, lui, est verrouillé ligne à ligne.
    const total = (f: "fermée" | "ouverte") =>
      CLASSIFICATION_AUDITEE.filter((c) => c.attendu === f).reduce((n, c) => n + c.n, 0);
    expect(total("fermée")).toBe(34);
    expect(total("ouverte")).toBe(22);
  });

  it("le zip l'emporte sur le préfixe, y compris quand il n'est que dans le nom", () => {
    expect(fermetureMaille(pieceBrute({ subtype: "Sweat à capuche", name: "Sweat zippé écru" }))).toBe("ouverte");
  });

  it("la casse et les accents ne changent rien", () => {
    expect(fermetureMaille(pieceBrute({ subtype: "PULL COL ROULE", name: "x" }))).toBe("fermée");
    expect(fermetureMaille(pieceBrute({ subtype: "cardigan Fin", name: "x" }))).toBe("ouverte");
  });

  it("hors de la catégorie pull, la fermeture ne s'applique pas", () => {
    // Une robe-pull n'est délibérément pas couverte : autre périmètre.
    expect(fermetureMaille(pieceBrute({ cat: "robe", subtype: "Robe pull", name: "Robe pull" }))).toBeNull();
    expect(fermetureMaille(pieceBrute({ cat: "haut", subtype: "Chemise", name: "Chemise" }))).toBeNull();
  });

  it("un sous-type hors vocabulaire ne ment pas : il renvoie null", () => {
    // « UNKNOWN + données honnêtes » plutôt qu'un classement au jugé — c'est
    // ce qui distingue une règle inapplicable d'une règle silencieusement fausse.
    expect(fermetureMaille(pieceBrute({ subtype: "Poncho", name: "Poncho frangé" }))).toBeNull();
    expect(fermetureMaille(pieceBrute({ subtype: "", name: "" }))).toBeNull();
  });
});

// ── Capsule Été ──────────────────────────────────────────────────────────

const item = (over: Partial<CatalogItem>): CatalogItem => ({
  id: 1, name: "", cat: "haut" as CategoryKey, color: "Noir", hex: "#2A2724",
  season: "Toutes saisons" as Season, worn: null, genre: "unisexe", ...over,
});

/** Pool minimal : de quoi bâtir une capsule, plus les pulls à départager. */
const poolEte = (): CatalogItem[] => [
  item({ id: 1, cat: "haut", name: "T-shirt blanc", subtype: "T-shirt", hex: "#F7F4EE" }),
  item({ id: 2, cat: "haut", name: "Débardeur côtelé", subtype: "Débardeur" }),
  item({ id: 3, cat: "pantalon", name: "Pantalon en lin", subtype: "Pantalon" }),
  item({ id: 4, cat: "jean", name: "Jean droit", subtype: "Droit" }),
  item({ id: 5, cat: "jupe", name: "Jupe midi", subtype: "Midi" }),
  item({ id: 6, cat: "robe", name: "Robe droite", subtype: "Robe droite" }),
  item({ id: 7, cat: "chaussures", name: "Sandales", shoeType: "Sandales" }),
  item({ id: 8, cat: "chaussures", name: "Chaussons", shoeType: "Chaussures d'intérieur" }),
  item({ id: 9, cat: "veste", name: "Blazer en lin", subtype: "Blazer" }),
  item({ id: 10, cat: "sac", name: "Cabas", sacType: "Cabas" }),
  item({ id: 11, cat: "bijou", name: "Collier fin", bijouType: "Collier" }),
  item({ id: 12, cat: "accessoire", name: "Foulard", accessoireType: "Foulard" }),
  // Les deux mailles à départager, toutes deux éligibles à l'Été par ailleurs.
  item({ id: 20, cat: "pull", name: "Pull col roulé fin", subtype: "Pull col roulé", rolePiece: "base" }),
  item({ id: 21, cat: "pull", name: "Cardigan fin col rond", subtype: "Cardigan col rond", rolePiece: "calque" }),
];

const capsuleEte = (pool: CatalogItem[], strategy?: Parameters<typeof computeDefaultCapsule>[5]) =>
  computeDefaultCapsule({ ...EMPTY_PROFILE, gender: "femme" }, representativeWeatherFor("Été"), [], "Été", pool, strategy);

describe("capsule Été — les mailles fermées sont exclues", () => {
  it("une maille fermée n'entre pas, une maille ouverte reste éligible", () => {
    const ids = capsuleEte(poolEte()).map((it) => it.id);
    expect(ids).not.toContain(20);
    expect(ids).toContain(21);
  });

  it("INVARIANT — ensure() ne réintroduit pas une maille fermée en Été", () => {
    // Le filet de sécurité garantit un pull dans chaque capsule et pioche
    // directement dans `sourcePool`. Sans la même éligibilité, il rendrait
    // ici la pièce que la sélection vient d'écarter. Pool volontairement
    // privé de toute maille ouverte : ensure() n'a QUE la fermée à proposer,
    // et il doit alors préférer n'en mettre aucune.
    const pool = poolEte().filter((it) => it.id !== 21);
    const capsule = capsuleEte(pool);
    expect(capsule.map((it) => it.id)).not.toContain(20);
    expect(capsule.some((it) => it.cat === "pull")).toBe(false);
  });

  it("hors Été, la maille fermée reste sélectionnable", () => {
    const hiver = computeDefaultCapsule(
      { ...EMPTY_PROFILE, gender: "femme" }, representativeWeatherFor("Hiver"), [], "Hiver", poolEte()
    );
    expect(hiver.map((it) => it.id)).toContain(20);
  });

  it("la couture d'audit reproduit le comportement d'avant", () => {
    // STRATEGIE_LEGACY porte maillesFermeesEte: "admises" — sans quoi aucun
    // audit ne pourrait mesurer l'avant et l'après dans la même exécution.
    expect(capsuleEte(poolEte(), STRATEGIE_LEGACY).map((it) => it.id)).toContain(20);
  });
});

// ── Non-régression sur ce qui reste gelé ─────────────────────────────────

const SRC = join(process.cwd(), "src");
function fichiers(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === "__tests__" ? [] : fichiers(p);
    return p.endsWith(".ts") || p.endsWith(".tsx") ? [p] : [];
  });
}

describe("périmètre — ce que ce chantier ne devait pas toucher", () => {
  const logic = readFileSync(join(SRC, "lib", "logic.ts"), "utf8");

  it("R-B10 est inchangée : toujours l'égalité stricte sur Chemise/Chemisier", () => {
    // Elle est connue pour ne voir que 20 chemises sur 29. C'est une dette
    // enregistrée, à traiter dans un chantier séparé avec sa propre mesure —
    // pas à corriger au passage de celui-ci.
    expect(logic).toContain('return it.subtype === "Chemise" || it.subtype === "Chemisier";');
    expect(logic).toContain('const shirtLike = pieces.filter((i) => i.subtype === "Chemise" || i.subtype === "Chemisier");');
  });

  it("R-S17 est inchangée : toujours l'égalité stricte sur la robe chemise", () => {
    expect(logic).toContain('occasion === "festive" ? (i) => i.subtype !== "Chemise" : undefined');
  });

  it("aucune notion d'épaisseur n'a été introduite", () => {
    // Décision produit du 31/08/2026 : aucune donnée du catalogue ne porte
    // l'épaisseur, donc aucune règle ne la déduit. Ce test empêche qu'elle
    // réapparaisse par un chemin détourné.
    const coupables = fichiers(SRC).filter((f) =>
      /\b(isThick|isEpais|estEpais|thickness|epaisseur|épaisseur)\b/i.test(readFileSync(f, "utf8"))
    );
    expect(coupables.map((f) => f.slice(SRC.length + 1))).toEqual([]);
  });

  it("la classification ne s'appuie sur aucun champ que le catalogue ne porte pas", () => {
    const attributes = readFileSync(join(SRC, "lib", "attributes.ts"), "utf8");
    const corps = attributes.slice(attributes.indexOf("export function fermetureMaille"));
    const fin = corps.indexOf("\n}");
    expect(corps.slice(0, fin)).not.toMatch(/matiere|coupe|niveauFormalite|rolePiece/);
  });
});
