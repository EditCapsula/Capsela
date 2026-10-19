import { describe, expect, it } from "vitest";
import {
  affairesAffichees,
  affairesDuSejour,
  affairesMasquees,
  cocheesValides,
  GROUPES_AFFAIRES,
  libelleAjoutValide,
  noteCabine,
  SEUIL_CHALEUR,
  type ContexteSejour,
} from "../affairesVoyage";

const m = (temp: number, label = "Nuageux", prevue = false) => ({ jour: "2026-10-20", temp, label, prevue });
const ctx = (programme: string[], meteos = [m(18)]): ContexteSejour => ({ programme: programme.map((id) => ({ id, frequence: 1 })), meteos });
const ids = (c: ContexteSejour) => affairesDuSejour(c).map((a) => a.id);

describe("affairesDuSejour — liées à des données réelles, jamais devinées", () => {
  it("étoffé le 19/10/2026 : linge, toilette, trousse de secours, électronique en essentiels", () => {
    const a = ids(ctx(["visites"]));
    for (const id of ["sous_vetements", "chaussettes", "pyjama", "sac_linge", "gel_douche", "trousse_secours", "batterie", "carte_vitale"]) expect(a).toContain(id);
  });

  it("plage : tongs, sac de plage, lunettes et chapeau ; la chaleur seule apporte lunettes et chapeau, pas les tongs", () => {
    const plage = affairesDuSejour(ctx(["plage"]));
    for (const id of ["tongs", "sac_plage", "lunettes_soleil", "chapeau"]) expect(plage.find((x) => x.id === id)?.raison).toBe("Plage au programme");
    const chaud = ids(ctx(["visites"], [m(SEUIL_CHALEUR)]));
    expect(chaud).toContain("lunettes_soleil");
    expect(chaud).not.toContain("tongs");
    expect(ids(ctx(["visites"]))).not.toContain("lunettes_soleil");
  });

  it("trajet au programme : écouteurs, livre, coussin et en-cas, avec leur raison ; sans trajet, rien", () => {
    const a = affairesDuSejour(ctx(["visites", "trajet"]));
    for (const id of ["ecouteurs", "livre", "coussin", "en_cas"]) expect(a.find((x) => x.id === id)?.raison).toBe("Trajet au programme");
    expect(ids(ctx(["visites"]))).not.toContain("coussin");
  });

  it("les essentiels sont toujours là, sans raison affichée", () => {
    const a = affairesDuSejour(ctx(["visites"]));
    for (const id of ["papiers", "dentifrice", "parfum", "brosse", "chargeur"]) expect(a.map((x) => x.id)).toContain(id);
    expect(a.find((x) => x.id === "dentifrice")?.raison).toBeUndefined();
  });

  it("crème solaire : plage ou piscine au programme, ou forte chaleur ; sinon rien", () => {
    expect(ids(ctx(["plage"]))).toContain("creme_solaire");
    expect(ids(ctx(["piscine"]))).toContain("creme_solaire");
    expect(ids(ctx(["visites"], [m(SEUIL_CHALEUR)]))).toContain("creme_solaire");
    expect(ids(ctx(["visites"], [m(SEUIL_CHALEUR - 1)]))).not.toContain("creme_solaire");
    expect(affairesDuSejour(ctx(["visites"], [m(27)])).find((a) => a.id === "creme_solaire")?.raison).toBe("Chaleur attendue (jusqu'à 27°)");
  });

  it("randonnée : chaussures de randonnée et gourde, avec leur raison", () => {
    const a = affairesDuSejour(ctx(["randonnee"]));
    expect(a.find((x) => x.id === "chaussures_rando")?.raison).toBe("Randonnée au programme");
    expect(a.map((x) => x.id)).toContain("gourde");
    expect(ids(ctx(["visites"]))).not.toContain("chaussures_rando");
  });

  it("la pluie ne compte que dans une PRÉVISION ; le froid, sur la température attendue", () => {
    expect(ids(ctx(["visites"], [m(14, "Pluie", true)]))).toContain("parapluie");
    expect(ids(ctx(["visites"], [m(14, "Pluie", false)]))).not.toContain("parapluie");
    expect(ids(ctx(["visites"], [m(3)]))).toContain("gants_bonnet");
    expect(ids(ctx(["visites"], [m(10)]))).not.toContain("gants_bonnet");
  });

  it("sans météo, aucune affaire de météo ; sans doublon ; rangées par groupe", () => {
    const a = affairesDuSejour(ctx(["plage", "piscine"], []));
    expect(a.filter((x) => x.id === "creme_solaire")).toHaveLength(1);
    expect(a.map((x) => x.id)).not.toContain("parapluie");
    const ordre = GROUPES_AFFAIRES.map((g) => g.id);
    const rangs = a.map((x) => ordre.indexOf(x.groupe));
    expect([...rangs].sort((x, y) => x - y)).toEqual(rangs);
  });
});

describe("ce que la personne ajoute et masque", () => {
  const c = ctx(["plage"]);
  it("une affaire masquée disparaît et se réaffiche ; une affaire ajoutée apparaît dans l'équipement", () => {
    const etat = { masquees: ["parfum"], ajoutees: [{ id: "perso-1", libelle: "Appareil photo" }] };
    const a = affairesAffichees(c, etat);
    expect(a.map((x) => x.id)).not.toContain("parfum");
    expect(a.find((x) => x.id === "perso-1")).toMatchObject({ libelle: "Appareil photo", groupe: "equipement", raison: "Ajoutée par toi" });
    expect(affairesMasquees(c, etat).map((x) => x.id)).toEqual(["parfum"]);
  });

  it("une case cochée sur une affaire masquée ou retirée ne compte plus", () => {
    const etat = { cochees: ["papiers", "parfum", "inconnue"], masquees: ["parfum"] };
    expect(cocheesValides(affairesAffichees(c, etat), etat)).toEqual(["papiers"]);
  });

  it("un libellé ajouté : rogné, d'au moins 2 caractères, sans doublon d'une affaire affichée", () => {
    const a = affairesAffichees(c, undefined);
    expect(libelleAjoutValide("  Appareil   photo ", a)).toBe("Appareil photo");
    expect(libelleAjoutValide("a", a)).toBeNull();
    expect(libelleAjoutValide("dentifrice", a)).toBeNull();
  });
});

describe("noteCabine", () => {
  it("seulement pour une valise S, dite comme règle générale à vérifier", () => {
    expect(noteCabine("S")).toContain("100 ml");
    expect(noteCabine("S")).toContain("vérifie");
    for (const t of ["M", "L", "XL"] as const) expect(noteCabine(t)).toBeNull();
  });
});
