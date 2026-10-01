import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DOCUMENTS_LEGAUX, SLUGS_LEGAUX, estProvisoire, urlLegale } from "../legal/documents";
import { inline, lireMarkdown, texteBrut, type Block, type Inline } from "../legal/markdown";

const enfants = (b: Block): Inline[] => (b as unknown as { children: Inline[] }).children;

describe("inline", () => {
  it("gras, italique, code et lien", () => {
    expect(inline("a **b** *c* `d` [e](/legal/cgu)")).toEqual([
      { type: "text", text: "a " },
      { type: "strong", children: [{ type: "text", text: "b" }] },
      { type: "text", text: " " },
      { type: "em", children: [{ type: "text", text: "c" }] },
      { type: "text", text: " " },
      { type: "code", text: "d" },
      { type: "text", text: " " },
      { type: "link", href: "/legal/cgu", children: [{ type: "text", text: "e" }] },
    ]);
  });
  it("un lien qui ne part ni vers le web, ni vers un e-mail, ni vers le site reste du texte", () => {
    expect(inline("[x](javascript:alert)")).toEqual([{ type: "text", text: "x" }]);
    expect(inline("[x](javascript:alert(1))").some((m) => m.type === "link")).toBe(false);
  });
});

describe("lireMarkdown", () => {
  it("titres, paragraphe sur plusieurs lignes, liste, citation, filet", () => {
    const blocs = lireMarkdown("# Titre\n\nUne ligne\nsuite.\n\n- un\n- deux\n  suite\n\n1. a\n2. b\n\n> note\n\n---\n");
    expect(blocs.map((b) => b.type)).toEqual(["heading", "paragraph", "list", "list", "quote", "rule"]);
    expect(texteBrut(enfants(blocs[1]))).toBe("Une ligne suite.");
    expect((blocs[2] as { items: unknown[] }).items).toHaveLength(2);
    expect((blocs[3] as { ordered: boolean }).ordered).toBe(true);
  });
  it("tableau", () => {
    const [t] = lireMarkdown("| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |");
    expect(t.type).toBe("table");
    expect((t as { rows: unknown[] }).rows).toHaveLength(2);
  });
  it("ne rend jamais de HTML brut : une balise reste du texte", () => {
    const [p] = lireMarkdown("<script>alert(1)</script>");
    expect(p.type).toBe("paragraph");
    expect(texteBrut(enfants(p))).toBe("<script>alert(1)</script>");
  });
});

describe("les six textes de docs/legal", () => {
  for (const { slug, titre } of DOCUMENTS_LEGAUX) {
    it(`${slug} : se lit en blocs, avec un titre`, () => {
      const source = readFileSync(path.join(process.cwd(), "docs", "legal", `${slug}.md`), "utf8");
      const blocs = lireMarkdown(source);
      expect(blocs.length).toBeGreaterThan(3);
      expect(blocs[0].type).toBe("heading");
      expect(titre.length).toBeGreaterThan(0);
    });
  }
  it("slugs et URL publiques", () => {
    expect(SLUGS_LEGAUX).toEqual(["mentions-legales", "confidentialite", "cgu", "droits-rgpd", "cookies", "cgv"]);
    expect(urlLegale("cgu")).toBe("/legal/cgu");
  });
  it("un texte à champs vides est annoncé provisoire", () => {
    expect(estProvisoire("Contact : [À COMPLÉTER — adresse e-mail]")).toBe(true);
    expect(estProvisoire("adresse à vérifier [À VÉRIFIER]")).toBe(true);
    expect(estProvisoire("Tout est rempli.")).toBe(false);
  });
});
