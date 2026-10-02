import { describe, expect, it } from "vitest";
import { accordsEcartes, basculerRetour, cleRetoursAccords, nettoyer } from "../retoursAccords";
import { cleAccord, conseilCouleur, REGLES_ASSOCIATION } from "../conseilsCouleurs";
import { PAL_COULEURS } from "../palCouleurs";
import type { Item } from "../types";

const hex = (n: string) => PAL_COULEURS.find(([x]) => x === n)![1];
let id = 0;
const p = (nom: string, cat = "haut"): Item => ({ id: ++id, name: nom, cat, color: nom, hex: hex(nom), season: "Toutes saisons", worn: 0, occasion: ["quotidien"] }) as unknown as Item;
const K = cleAccord(REGLES_ASSOCIATION[0]);

describe("retours sur les accords", () => {
  it("un même geste se retire, un autre remplace", () => {
    const a = basculerRetour({}, K, "aime");
    expect(a[K]).toBe("aime");
    expect(basculerRetour(a, K, "aime")[K]).toBeUndefined();
    expect(basculerRetour(a, K, "pas_pour_moi")[K]).toBe("pas_pour_moi");
  });
  it("ne touche pas aux autres accords", () => {
    const t = basculerRetour({ "Automne|A+B": "aime" }, K, "pas_pour_moi");
    expect(t["Automne|A+B"]).toBe("aime");
  });
  it("seuls les « Pas pour moi » sont écartés", () => {
    expect([...accordsEcartes({ [K]: "pas_pour_moi", "Automne|X+Y": "aime" })]).toEqual([K]);
  });
  it("un stockage altéré est nettoyé", () => {
    expect(nettoyer({ [K]: "aime", mauvais: "aime", "Automne|X+Y": "bof" })).toEqual({ [K]: "aime" });
    expect(nettoyer("x")).toEqual({});
    expect(nettoyer(null)).toEqual({});
  });
  it("la clé est rangée par compte, « demo » sans compte", () => {
    expect(cleRetoursAccords("u1")).toBe("capsela.accords.u1");
    expect(cleRetoursAccords(null)).toBe("capsela.accords.demo");
  });
  it("un accord écarté n'est plus proposé", () => {
    const tenue = [p("Vieux rose"), p("Marron", "pantalon")];
    expect(conseilCouleur(tenue, "Automne")?.cle).toBe(K);
    expect(conseilCouleur(tenue, "Automne", null, new Set([K]))).toBeNull();
  });
});
