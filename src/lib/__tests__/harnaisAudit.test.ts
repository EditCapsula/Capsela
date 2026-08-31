import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  EXPOSED_STYLE_IDS,
  STYLE_CONFIG,
  STYLE_ID_TO_CATALOG_LABEL,
  STYLE_IDS,
  exposedStyleIds,
  type StyleId,
} from "../profile";
import { assertStyleId, profilAudit, stylesAudit } from "../../../scripts/harnaisAudit";

/**
 * GARDE-FOU DU HARNAIS D'AUDIT — 29/08/2026.
 *
 * Quatorze scripts d'audit passaient des LIBELLÉS français dans
 * `profile.styles` là où la production y met des `StyleId`. Le filtre de style
 * de computeDefaultCapsule était silencieusement sauté et chaque mesure portait
 * sur un pool universel. Corriger les quatorze fichiers ne suffit pas : le
 * quinzième, écrit demain, retomberait dans le même piège.
 *
 * Deux couches, parce qu'aucune ne suffit seule :
 *  1. RUNTIME — `profilAudit` lève sur un libellé, un id inconnu, un tableau
 *     vide. Un audit qui se trompe s'arrête au lieu de continuer en silence.
 *     Mais les scripts d'audit ne tournent qu'en CI, à la demande : un script
 *     jamais rejoué garderait son défaut sans que personne le voie.
 *  2. STATIQUE — ce test, qui appartient à la suite normale (donc à chaque CI),
 *     lit la SOURCE de tous les scripts d'audit et refuse quiconque construit
 *     un Profile lui-même ou écrit un libellé en position de style.
 *
 * Une assertion à l'intérieur de computeDefaultCapsule avait été envisagée et
 * écartée : elle mettrait un contrôle de harnais de test dans du code de
 * production, et `profile.styles` vide est un état légitime en production
 * (utilisateur en cours d'onboarding).
 */

const SCRIPTS_DIR = join(process.cwd(), "scripts");
const AUDITS = readdirSync(SCRIPTS_DIR).filter((f) => f.endsWith(".audit.ts"));

/**
 * Seule exception autorisée. `style-saison.audit.ts` est l'audit de phase 14
 * qui a DÉCOUVERT le défaut : il construit délibérément les deux formes de
 * profil, par libellé et par id, pour mesurer l'écart entre les deux. Le
 * priver de cette capacité effacerait la preuve.
 */
const EXCEPTIONS = new Set(["style-saison.audit.ts"]);

const LIBELLES = new Set<string>([
  ...Object.values(STYLE_ID_TO_CATALOG_LABEL),
  ...Object.values(STYLE_CONFIG.femme).map((c) => c.label),
  ...Object.values(STYLE_CONFIG.homme).map((c) => c.label),
  "Classique", // libellé inventé par les anciens audits, n'existe nulle part
]);

describe("Correspondance identifiant ↔ libellé catalogue", () => {
  it("expose huit styles femme, six styles homme, tous traduisibles", () => {
    expect(exposedStyleIds("femme")).toEqual([...STYLE_IDS]);
    expect(exposedStyleIds("femme")).toHaveLength(8);
    expect(exposedStyleIds("homme")).toHaveLength(6);
    expect(exposedStyleIds("homme")).not.toContain("romantique");
    expect(exposedStyleIds("homme")).not.toContain("glamour");
    // Le harnais et la production lisent la même source.
    expect(stylesAudit("femme")).toEqual(EXPOSED_STYLE_IDS.femme);
    expect(stylesAudit("homme")).toEqual(EXPOSED_STYLE_IDS.homme);
  });

  it("associe chaque id à un libellé catalogue non vide et unique", () => {
    const labels = STYLE_IDS.map((id) => STYLE_ID_TO_CATALOG_LABEL[id]);
    expect(labels.every((l) => typeof l === "string" && l.length > 0)).toBe(true);
    expect(new Set(labels).size).toBe(STYLE_IDS.length);
  });

  it("ne traduit aucun libellé : un libellé passé comme id donne undefined", () => {
    for (const label of Object.values(STYLE_ID_TO_CATALOG_LABEL)) {
      expect(STYLE_ID_TO_CATALOG_LABEL[label as StyleId]).toBeUndefined();
    }
    expect(STYLE_ID_TO_CATALOG_LABEL["Classique" as StyleId]).toBeUndefined();
  });
});

describe("Garde-fou runtime — profilAudit", () => {
  it("accepte les huit identifiants femme", () => {
    for (const id of stylesAudit("femme")) {
      expect(profilAudit({ gender: "femme", styles: [id] }).styles).toEqual([id]);
    }
  });

  it("refuse un libellé catalogue et nomme l'identifiant attendu", () => {
    expect(() => profilAudit({ gender: "femme", styles: ["Casual chic"] }))
      .toThrow(/n'est pas un StyleId[\s\S]*casual_chic/);
  });

  it("refuse un identifiant inconnu", () => {
    expect(() => profilAudit({ gender: "femme", styles: ["Classique"] })).toThrow(/n'est pas un StyleId/);
    expect(() => profilAudit({ gender: "femme", styles: ["chic_urbain"] })).toThrow(/n'est pas un StyleId/);
    expect(() => assertStyleId("Minimaliste")).toThrow();
  });

  it("refuse un tableau de styles vide, mais accepte l'absence explicite", () => {
    expect(() => profilAudit({ gender: "femme", styles: [] })).toThrow(/vide/);
    expect(profilAudit({ gender: "femme", styles: null }).styles).toEqual([]);
  });

  it("porte la morphologie et le genre sans les altérer", () => {
    const p = profilAudit({ gender: "femme", styles: ["boheme"], morphology: "f_poire" });
    expect(p.gender).toBe("femme");
    expect(p.morphology).toBe("f_poire");
  });
});

describe("Garde-fou statique — source des scripts d'audit", () => {
  it("trouve les scripts d'audit", () => {
    expect(AUDITS.length).toBeGreaterThan(10);
  });

  it.each(AUDITS.filter((f) => !EXCEPTIONS.has(f)))(
    "%s ne construit aucun Profile à la main",
    (fichier) => {
      const src = readFileSync(join(SCRIPTS_DIR, fichier), "utf8");
      // EMPTY_PROFILE hors du harnais = un Profile assemblé sur place, donc
      // sans validation des styles.
      expect(src, `${fichier} : construit un Profile sans passer par profilAudit`)
        .not.toMatch(/EMPTY_PROFILE/);
    },
  );

  it.each(AUDITS.filter((f) => !EXCEPTIONS.has(f)))(
    "%s n'écrit aucun libellé en position de style",
    (fichier) => {
      const src = readFileSync(join(SCRIPTS_DIR, fichier), "utf8");
      const fautes: string[] = [];
      // Toute chaîne littérale posée sur une clé `style`/`styles`, ou rangée
      // dans un tableau nommé STYLES, doit être un StyleId.
      const positions = [
        /\bstyles?\s*:\s*"([^"]+)"/g,
        /\bstyles?\s*:\s*\[\s*"([^"]+)"/g,
        /const STYLES\b[^=]*=\s*\[([^\]]*)\]/g,
      ];
      for (const re of positions) {
        for (const m of src.matchAll(re)) {
          for (const brut of m[1].split(",")) {
            const v = brut.trim().replace(/^"|"$/g, "");
            if (!v) continue;
            if (LIBELLES.has(v) || !(STYLE_IDS as readonly string[]).includes(v)) fautes.push(v);
          }
        }
      }
      expect(fautes, `${fichier} : libellé(s) en position de style — passe l'identifiant`).toEqual([]);
    },
  );
});
