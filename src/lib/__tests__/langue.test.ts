import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { langueDeDepart, poserLangue, t, tn } from "../langue";
import { EN } from "../traductions/en";

afterEach(() => poserLangue("fr"));

describe("langue de départ", () => {
  it("anglais fermé : français pour tout le monde", () => {
    expect(langueDeDepart("en", ["en-US"], false)).toBe("fr");
  });
  it("le choix des Préférences d'abord, sinon la langue du téléphone", () => {
    expect(langueDeDepart("fr", ["en-US"], true)).toBe("fr");
    expect(langueDeDepart(null, ["fr-FR", "en"], true)).toBe("fr");
    expect(langueDeDepart(null, ["en-GB"], true)).toBe("en");
    expect(langueDeDepart(null, ["es-ES"], true)).toBe("en");
    expect(langueDeDepart("xx", [], true)).toBe("fr");
  });
});

describe("t et tn", () => {
  it("français : le texte tel quel, variables remplies", () => {
    expect(t("Langue")).toBe("Langue");
    expect(tn(0, "{n} pièce", "{n} pièces")).toBe("0 pièce");
    expect(tn(2, "{n} pièce", "{n} pièces")).toBe("2 pièces");
  });
  it("anglais : la table, et la règle anglaise du pluriel", () => {
    poserLangue("en");
    expect(t("Langue")).toBe("Language");
    expect(t("Un texte sans traduction")).toBe("Un texte sans traduction");
  });
});

// Toutes les sources de src, hors tests.
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === "__tests__" ? [] : sources(p);
    return /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}

describe("couverture de la table anglaise", () => {
  it("chaque t(\"…\"), tn(…) et aTraduire(\"…\") des sources a sa traduction", () => {
    const chaine = String.raw`"((?:[^"\\]|\\.)*)"`;
    const motifs = [
      new RegExp(String.raw`\b(?:t|aTraduire)\(\s*` + chaine, "g"),
      new RegExp(String.raw`\btn\([^,]+,\s*` + chaine + String.raw`\s*,\s*` + chaine, "g"),
    ];
    const absents: string[] = [];
    // langue.ts est exclu : ses commentaires citent t("…") en exemple.
    for (const f of sources(join(__dirname, "..", "..")).filter((f) => !f.endsWith("/lib/langue.ts"))) {
      const code = readFileSync(f, "utf8");
      for (const m of motifs) {
        for (const r of code.matchAll(m)) {
          for (const cle of r.slice(1)) {
            const texte = JSON.parse(`"${cle}"`) as string;
            if (!(texte in EN)) absents.push(`${f.split("/src/")[1]} : ${texte}`);
          }
        }
      }
    }
    expect(absents).toEqual([]);
  });
});
