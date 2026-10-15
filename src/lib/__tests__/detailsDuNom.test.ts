import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { detailsDuNom, signatureDesDetails } from "../detailsDuNom";
import { buildImagePrompt, type VestiaireRow } from "../../../supabase/functions/_shared/imagePrompt.ts";
import { computeVisualKey } from "../../../supabase/functions/_shared/visualKey.ts";

// AUDIT DES VISUELS DU 14/10/2026 : 68 pièces dont les deux visuels étaient faux de la même façon — un sous-type inconnu du
// vocabulaire (bonnet → « accessory » dessiné en écharpe, gants → sac, hoodie sans capuche, boots → derbies) ou un détail écrit
// seulement dans le nom (« Chemise rayée » dessinée unie). Ces tests portent sur la version Deno, celle qui génère réellement.

const ligne = (over: Partial<VestiaireRow>): VestiaireRow => ({
  id: 1, name: null, category: null, sous_type: null, couleur_dominante: "Noir", matiere: null, genre: "femme", coupe: null, ...over,
});
const sujet = (over: Partial<VestiaireRow>) => buildImagePrompt(ligne(over));

describe("detailsDuNom — les détails visibles du nom", () => {
  it("lit motifs et aspects", () => {
    expect(detailsDuNom("Chemise rayée oversize légère")).toContain("striped");
    expect(detailsDuNom("Jupe midi à carreaux")).toEqual(["midi-length", "checked"]);
    expect(detailsDuNom("Pull torsadé")).toEqual(["cable-knit"]);
    expect(detailsDuNom("Veste matelassée légère")).toEqual(["quilted", "lightweight"]);
    expect(detailsDuNom("Bracelet chaîne fin")).toEqual(["thin chain"]);
  });

  it("un bigramme passe avant ses mots : « manches courtes » n'est jamais « short »", () => {
    expect(detailsDuNom("Chemise manches courtes en lin")).toEqual(["short-sleeved"]);
    expect(detailsDuNom("Pantalon en velours côtelé")).toEqual(["corduroy"]);
  });

  it("un imprimé précis remplace l'imprimé générique", () => {
    expect(detailsDuNom("Blouse fluide imprimée paisley")).toEqual(["paisley print"]);
    expect(detailsDuNom("Foulard imprimé")).toEqual(["printed"]);
  });

  it("seconde passe : manchette des boutons, créoles ou puces, rayures marinière, longueurs contraires", () => {
    expect(detailsDuNom("Boutons de manchette minimalistes")).toEqual([]);
    expect(detailsDuNom("Petites créoles / puces")).toEqual(["small hoop"]);
    expect(detailsDuNom("T-shirt rayé type marinière")).toEqual(["breton-striped"]);
    expect(detailsDuNom("Jupe midi / maxi fluide")).toEqual([]);
  });

  it("rien pour un nom sans détail", () => {
    expect(detailsDuNom("Chemise")).toEqual([]);
    expect(detailsDuNom(null)).toEqual([]);
  });

  it("les deux copies (app et Deno) sont identiques", () => {
    const app = readFileSync("src/lib/detailsDuNom.ts", "utf8");
    const deno = readFileSync("supabase/functions/_shared/detailsDuNom.ts", "utf8");
    expect(app).toBe(deno);
  });
});

describe("buildImagePrompt — les sous-types relevés à l'audit", () => {
  const cas: [Partial<VestiaireRow>, string][] = [
    [{ category: "accessoires", sous_type: "Bonnet", name: "Bonnet côtelé minimaliste" }, "beanie"],
    [{ category: "accessoires", sous_type: "Béret", name: "Béret classique" }, "beret"],
    [{ category: "accessoires", sous_type: "Bob", name: "Bucket hat" }, "bucket hat"],
    [{ category: "accessoires", sous_type: "Gants", name: "Gants classiques" }, "gloves"],
    [{ category: "bijoux", sous_type: "Boutons de manchette", name: "Boutons de manchette minimalistes" }, "cufflinks"],
    [{ category: "pulls_gilets", sous_type: "Hoodie", name: "Hoodie oversize" }, "hooded sweatshirt"],
    [{ category: "chaussures", sous_type: "Bottines Chelsea", name: "Bottines Chelsea" }, "chelsea ankle boots"],
    [{ category: "chaussures", sous_type: "Boots lacées", name: "Boots lacées" }, "lace-up ankle boots"],
    [{ category: "chaussures", sous_type: "Babies", name: "Babies / Mary Jane" }, "mary jane shoes"],
    [{ category: "chaussures", sous_type: "Bottes hautes", name: "Bottes hautes classiques" }, "knee-high boots"],
    [{ category: "hauts", sous_type: "Caraco", name: "Caraco fluide" }, "camisole"],
    [{ category: "pantalons", sous_type: "Parachute", name: "Pantalon parachute" }, "parachute pants"],
    [{ category: "sacs", sous_type: "Sac banane", name: "Sac banane crossbody" }, "belt bag"],
    [{ category: "manteaux_exterieurs", sous_type: "Caban", name: "Caban croisé en laine" }, "double-breasted"],
    [{ category: "accessoires", sous_type: "Chapeau", name: "Chapeau fedora souple" }, "fedora"],
    [{ category: "bijoux", sous_type: "Bracelet minimaliste", name: "Bracelet minimaliste", matiere: "Cuir" }, "smooth single-band bracelet"],
    [{ category: "pantalons", sous_type: "Legging", name: "Legging de sport" }, "non-shiny"],
  ];
  it("chaque sous-type a son sujet, et la génération l'accepte", () => {
    for (const [over, attendu] of cas) {
      const b = sujet(over);
      expect(b.prompt.split("\n")[0].toLowerCase(), over.sous_type ?? "").toContain(attendu);
      expect(b.ok, over.sous_type ?? "").toBe(true);
    }
  });

  it("le motif du nom entre dans le prompt sans changer le sujet", () => {
    const b = sujet({ category: "hauts", sous_type: "Chemise", name: "Chemise rayée", couleur_dominante: "Bleu ciel" });
    expect(b.noun).toBe("button-up shirt");
    expect(b.prompt.split("\n")[0].toLowerCase()).toContain("striped");
  });
});

describe("buildImagePrompt — le sujet dans sa forme finale (seconde passe du 15/10/2026)", () => {
  const ligne1 = (over: Partial<VestiaireRow>) => sujet(over).prompt.split("\n")[0];
  it("aucun mot déjà dit par le sujet n'est répété", () => {
    expect(ligne1({ category: "accessoires", sous_type: "Bonnet", name: "Bonnet côtelé" })).toContain("black ribbed knit beanie hat");
    expect(ligne1({ category: "robes", sous_type: "Robe nuisette", name: "Robe nuisette midi satinée" })).toContain("midi-length satin slip dress");
    expect(ligne1({ category: "hauts", sous_type: "Blouse lavallière", name: "Blouse fluide à col lavallière" })).toContain("black pussy-bow blouse");
  });
  it("« with … » vient après le sujet", () => {
    expect(ligne1({ category: "hauts", sous_type: "Caraco satiné", name: "Caraco satiné à fines bretelles" })).toContain("black satin camisole top with thin straps.");
  });
  it("une chemise a un col et des manches longues, sauf détail contraire", () => {
    expect(ligne1({ category: "hauts", sous_type: "Chemise", name: "Chemise" })).toContain("long-sleeved collared button-up shirt");
    expect(ligne1({ category: "hauts", sous_type: "Chemise manches courtes", name: "Chemise oversize manches courtes" })).not.toContain("long-sleeved");
    expect(ligne1({ category: "hauts", sous_type: "Chemise", name: "Chemise col mao" })).not.toContain("collared");
  });
  it("une doudoune sans longueur écrite est à la hanche, une doudoune longue reste longue", () => {
    expect(ligne1({ category: "manteaux_exterieurs", sous_type: "Doudoune", name: "Doudoune" })).toContain("hip-length puffer jacket");
    expect(ligne1({ category: "manteaux_exterieurs", sous_type: "Doudoune", name: "Doudoune longue" })).not.toContain("hip-length");
  });
});

describe("signatureDesDetails — la cascade générique ne mélange plus les détails (15/10/2026)", () => {
  const p = (over: Partial<VestiaireRow>) => sujet(over).prompt;
  it("des boucles pendantes ne prennent pas le visuel de créoles texturées, ni l'inverse", () => {
    const pendantes = p({ category: "bijoux", sous_type: "Boucles d'oreilles", name: "Boucles d'oreilles pendantes", couleur_dominante: "Doré" });
    const creoles = p({ category: "bijoux", sous_type: "Boucles d'oreilles", name: "Créoles texturées", couleur_dominante: "Doré" });
    expect(signatureDesDetails(pendantes)).toBe("drop");
    expect(signatureDesDetails(creoles)).toBe("hoop|textured");
  });
  it("un ancien prompt sans détail reste réutilisable par une pièce sans détail", () => {
    const ancien = "Premium ecommerce cutout product image of women's gold earrings.\n\nProduct:\nEarrings.";
    expect(signatureDesDetails(ancien)).toBe("");
    expect(signatureDesDetails(p({ category: "bijoux", sous_type: "Boucles d'oreilles", name: "Boucles d'oreilles", couleur_dominante: "Doré" }))).toBe("");
  });
  it("« long » ne se lit pas dans « long-sleeved »", () => {
    expect(signatureDesDetails("men's blue long-sleeved collared button-up shirt.")).toBe("long-sleeved");
  });
});

describe("computeVisualKey — les détails du nom dans la clé", () => {
  const base = { genre: "femme", category: "haut", sousType: "Chemise", couleur: "Bleu", matiere: null };
  it("une chemise rayée ne partage plus la clé d'une chemise unie", () => {
    expect(computeVisualKey({ ...base, nom: "Chemise" })).toBe("femme_haut_chemise_bleu");
    expect(computeVisualKey({ ...base, nom: "Chemise rayée" })).toBe("femme_haut_chemise_bleu_striped");
  });
});
