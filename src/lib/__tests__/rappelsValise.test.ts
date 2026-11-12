import { describe, expect, it } from "vitest";
import { avancementValise, compteAReboursCourt, departsParJour, periodeCourte, etatDeLaValise, joursAvantDepart, messageDEcheance, periodeEnLettres, prochainRappel } from "../rappelsValise";
import type { ValiseGardee } from "../valises";

// LES RAPPELS CONTEXTUELS DES VALISES (06/11/2026) : une seule source pour la carte, les points et le planning.
const valise = (id: string, depart: string, retour: string, autre: Partial<ValiseGardee> = {}): ValiseGardee =>
  ({ version: 2, id, destination: "Sénégal", depart, retour, bagage: "M", sejour: null, occasions: [], meteos: [], situations: [], looks: [{ ids: [1], situations: [0] }], situationsSansLook: [], pieceIds: [1], ...autre }) as ValiseGardee;
const AUJ = "2026-11-06";

describe("prochainRappel", () => {
  it("aucune valise, aucun rappel", () => {
    expect(prochainRappel([], AUJ)).toBeNull();
  });
  it("un voyage lointain (J-8), en cours ou terminé : pas de rappel", () => {
    expect(prochainRappel([valise("a", "2026-11-14", "2026-11-20")], AUJ)).toBeNull();
    expect(prochainRappel([valise("b", "2026-11-06", "2026-11-10")], AUJ)).toBeNull();
    expect(prochainRappel([valise("c", "2026-10-01", "2026-10-05")], AUJ)).toBeNull();
  });
  it("J-7, J-3, J-1 : le message suit l'échéance", () => {
    expect(prochainRappel([valise("a", "2026-11-13", "2026-11-20")], AUJ)?.message).toBe("Ton départ approche, ta valise t'attend.");
    expect(prochainRappel([valise("a", "2026-11-09", "2026-11-20")], AUJ)?.message).toBe("Plus que 3 jours avant le départ !");
    expect(prochainRappel([valise("a", "2026-11-07", "2026-11-20")], AUJ)?.badge).toBe("Demain");
  });
  it("plusieurs voyages : le départ le plus proche seulement", () => {
    const r = prochainRappel([valise("loin", "2026-11-12", "2026-11-15"), valise("proche", "2026-11-11", "2026-11-20")], AUJ);
    expect(r?.valise.id).toBe("proche");
    expect(r?.voyage).toBe("Sénégal · du 11 au 20 novembre");
    expect(r?.badge).toBe("Dans 5 jours");
  });
  it("des dates modifiées changent le rappel (calculé, jamais stocké)", () => {
    expect(prochainRappel([valise("a", "2026-11-11", "2026-11-20")], AUJ)).not.toBeNull();
    expect(prochainRappel([valise("a", "2026-12-11", "2026-12-20")], AUJ)).toBeNull();
  });
});

describe("état de la valise et messages", () => {
  it("à compléter s'il reste des pièces suggérées ; prête sinon ; inconnu sans tenue", () => {
    expect(etatDeLaValise(valise("a", AUJ, AUJ, { suggestionIds: [3] }))).toBe("a_completer");
    expect(etatDeLaValise(valise("a", AUJ, AUJ))).toBe("prete");
    expect(etatDeLaValise(valise("a", AUJ, AUJ, { looks: [] }))).toBeNull();
  });
  it("J-1 ne pose la question que si l'état n'est pas connu", () => {
    expect(messageDEcheance(1, null)).toBe("Demain, c'est le départ. Ta valise est prête ?");
    expect(messageDEcheance(1, "prete")).toBe("Demain, c'est le départ.");
    expect(prochainRappel([valise("a", "2026-11-07", "2026-11-20", { suggestionIds: [2] })], AUJ)?.etat).toBe("Il te reste quelques pièces à ajouter à ta valise.");
  });
  it("périodes et écarts", () => {
    expect(periodeEnLettres("2026-11-28", "2026-12-03")).toBe("du 28 novembre au 3 décembre");
    expect(periodeEnLettres("2026-11-11", "2026-11-11")).toBe("le 11 novembre");
    expect(joursAvantDepart("2026-03-30", "2026-03-28")).toBe(2); // passage à l'heure d'été
  });
});

describe("departsParJour", () => {
  it("chaque voyage à sa date, deux le même jour restent distincts", () => {
    const m = departsParJour([valise("a", "2026-11-11", "2026-11-20"), valise("b", "2026-11-11", "2026-11-12"), valise("c", "2026-12-01", "2026-12-02")]);
    expect(m.get("2026-11-11")?.map((v) => v.id)).toEqual(["a", "b"]);
    expect(m.get("2026-12-01")?.map((v) => v.id)).toEqual(["c"]);
  });
});

describe("avancementValise", () => {
  it("les pièces déjà dans le dressing sur celles de la valise ; les suggestions restent à ajouter", () => {
    expect(avancementValise(valise("a", AUJ, AUJ, { pieceIds: [1, 2, 3, 4, 5, 6, 7, 8], suggestionIds: [7, 8] }))).toEqual({ aAjouter: 2, pourcentage: 75 });
    expect(avancementValise(valise("a", AUJ, AUJ, { pieceIds: [1, 2] }))).toEqual({ aAjouter: 0, pourcentage: 100 });
  });
  it("état inconnu ou valise sans pièce : pas de barre", () => {
    expect(avancementValise(valise("a", AUJ, AUJ, { looks: [] }))).toBeNull();
    expect(avancementValise(valise("a", AUJ, AUJ, { pieceIds: [], suggestionIds: [3] }))).toBeNull();
  });
});

describe("formats courts de la carte de l'accueil", () => {
  it("dates et compte à rebours", () => {
    expect(periodeCourte("2026-11-15", "2026-11-19")).toBe("15–19 nov.");
    expect(periodeCourte("2026-11-28", "2026-12-03")).toBe("28 nov.–3 déc.");
    expect(periodeCourte("2026-11-11", "2026-11-11")).toBe("11 nov.");
    expect([compteAReboursCourt(1), compteAReboursCourt(3)]).toEqual(["Demain", "J-3"]);
  });
});
