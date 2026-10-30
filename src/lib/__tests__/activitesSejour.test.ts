import { describe, expect, it } from "vitest";
import {
  activiteDeLOccasion,
  activiteDuLibelle,
  activitesDesChoix,
  ajouterLibelle,
  basculerIdee,
  CATEGORIES_IDEES,
  choixDeLaValise,
  dejaChoisi,
  destinationAvecPreposition,
  IDEES_GENERIQUES,
  ideesUniques,
  type ActiviteChoisie,
} from "../activitesSejour";
import { ACTIVITES, programmeDesActivites } from "../programmeValise";
import { ACTIVITES as ACTIVITES_SERVEUR, CATEGORIES, ideesLues, inviteIdees } from "../../../supabase/functions/_shared/ideesSejour";

/** L'ÉTAPE ACTIVITÉS EN UNE SEULE SÉLECTION (30/10/2026, brief « Refonte UX de l'étape Activités »). */

describe("le titre dit la destination", () => {
  it("une ville, un pays, une destination européenne, un archipel", () => {
    expect(destinationAvecPreposition("Marrakech")).toBe("à Marrakech");
    expect(destinationAvecPreposition("Maroc")).toBe("au Maroc");
    expect(destinationAvecPreposition("Sénégal")).toBe("au Sénégal");
    expect(destinationAvecPreposition("Italie")).toBe("en Italie");
    expect(destinationAvecPreposition("Rome")).toBe("à Rome");
    expect(destinationAvecPreposition("Maldives")).toBe("aux Maldives");
    expect(destinationAvecPreposition("les Maldives")).toBe("aux Maldives");
  });
  it("sans destination lisible : rien (l'écran dit alors « pendant ton séjour »)", () => {
    expect(destinationAvecPreposition(" ")).toBeNull();
  });
});

describe("sélection libre", () => {
  const souks = { libelle: "Explorer les souks", categorie: "culture" as const, activite: "ville" as const };
  const rooftop = { libelle: "Dîner sur un rooftop", categorie: "gastronomie" as const, activite: "soiree" as const };

  it("plusieurs idées, puis le retrait de l'une d'elles", () => {
    let choix = basculerIdee(basculerIdee([], souks), rooftop);
    expect(choix.map((c) => c.libelle)).toEqual(["Explorer les souks", "Dîner sur un rooftop"]);
    choix = basculerIdee(choix, souks);
    expect(choix.map((c) => c.libelle)).toEqual(["Dîner sur un rooftop"]);
  });

  it("plusieurs libellés saisis, sans doublon évident ; le libellé n'est jamais réécrit", () => {
    let choix: ActiviteChoisie[] = [];
    choix = ajouterLibelle(choix, "  Sortie en quad. ");
    choix = ajouterLibelle(choix, "Mariage de Léa");
    choix = ajouterLibelle(choix, "une sortie en QUAD");
    choix = ajouterLibelle(choix, "   ");
    expect(choix.map((c) => c.libelle)).toEqual(["Sortie en quad", "Mariage de Léa"]);
    expect(dejaChoisi(choix, "Mariage de léa")).toBe(true);
  });

  it("un mariage s'ajoute comme une visite, et devient une cérémonie pour le moteur", () => {
    const choix = ajouterLibelle([], "Mariage");
    expect(choix[0]).toEqual({ libelle: "Mariage", activite: "evenement", source: "perso" });
    expect(programmeDesActivites(activitesDesChoix(choix), 5).map((p) => p.id)).toContain("ceremonie");
  });

  it("des idées en double, autrement écrites, ne s'affichent qu'une fois", () => {
    expect(ideesUniques([souks, { ...souks, libelle: "explorer les souks." }, rooftop])).toHaveLength(2);
  });
});

describe("la correspondance vers le moteur", () => {
  it("les libellés saisis courants trouvent leur activité", () => {
    expect(activiteDuLibelle("Dîner d'anniversaire")).toBe("soiree");
    expect(activiteDuLibelle("Réunion client")).toBe("travail");
    expect(activiteDuLibelle("Sortie en bateau")).toBe("nature");
    expect(activiteDuLibelle("Hammam traditionnel")).toBe("detente");
    expect(activiteDuLibelle("Visiter la médina")).toBe("ville");
    expect(activiteDuLibelle("Randonnée dans l'Atlas")).toBe("randonnee");
    expect(activiteDuLibelle("Journée piscine")).toBe("plage");
    expect(activiteDuLibelle("Dîner de mariage")).toBe("evenement");
  });
  it("un libellé qu'aucune activité ne décrit reste sans correspondance : gardé, il ne change rien aux tenues", () => {
    expect(activiteDuLibelle("Voir Mamie")).toBeNull();
    const choix = ajouterLibelle([], "Voir Mamie");
    expect(choix[0].libelle).toBe("Voir Mamie");
    expect(activitesDesChoix(choix)).toEqual([]);
  });
  it("l'occasion lue par l'IA se traduit ; Quotidien ne dit rien", () => {
    expect(activiteDeLOccasion("evenement_perso")).toBe("evenement");
    expect(activiteDeLOccasion("date")).toBe("soiree");
    expect(activiteDeLOccasion("quotidien")).toBeNull();
    expect(activiteDeLOccasion(null)).toBeNull();
  });
});

describe("le programme reçu par le moteur", () => {
  it("activités mixtes (idées et saisies) : celles du moteur, sans doublon ; le moteur et ses parts ne changent pas", () => {
    let choix: ActiviteChoisie[] = [];
    choix = basculerIdee(choix, { libelle: "Visiter la médina", categorie: "culture", activite: "ville" });
    choix = basculerIdee(choix, { libelle: "Explorer les souks", categorie: "culture", activite: "ville" });
    choix = ajouterLibelle(choix, "Sortie en quad");
    choix = ajouterLibelle(choix, "Mariage");
    expect(activitesDesChoix(choix)).toEqual(["ville", "nature", "evenement"]);
    expect(programmeDesActivites(activitesDesChoix(choix), 6)).toEqual(programmeDesActivites(["ville", "nature", "evenement"], 6));
  });
  it("aucune activité : le repli d'avant (le quotidien)", () => {
    expect(programmeDesActivites(activitesDesChoix([]), 4)).toEqual(programmeDesActivites([], 4));
  });
});

describe("la reprise d'une valise", () => {
  it("ses choix gardés, tels quels", () => {
    const gardes: ActiviteChoisie[] = [{ libelle: "Dîner sur un rooftop", activite: "soiree", source: "idee" }];
    expect(choixDeLaValise(gardes, ["plage"])).toEqual(gardes);
  });
  it("une valise d'avant : ses activités cochées, sous le libellé de l'idée qui les dit (cochée, jamais en double)", () => {
    const repris = choixDeLaValise(undefined, ["plage", "soiree"]);
    expect(repris).toEqual([
      { libelle: "Profiter de la plage", activite: "plage", source: "idee" },
      { libelle: "Sortir le soir", activite: "soiree", source: "idee" },
    ]);
    for (const c of repris) expect(IDEES_GENERIQUES.find((i) => i.libelle === c.libelle)?.activite).toBe(c.activite);
    // Chaque activité d'avant a son idée.
    for (const a of ACTIVITES) expect(choixDeLaValise(undefined, [a.id])[0].libelle).not.toBe(a.libelle);
  });
});

describe("les idées", () => {
  it("le serveur et l'app partagent les mêmes familles et les mêmes activités", () => {
    expect([...CATEGORIES]).toEqual(CATEGORIES_IDEES.map((c) => c.id));
    expect([...ACTIVITES_SERVEUR]).toEqual(ACTIVITES.map((a) => a.id));
  });
  it("une réponse est réduite aux idées valides, sans doublon", () => {
    const lues = ideesLues({
      idees: [
        { libelle: "Explorer les souks.", categorie: "culture", activite: "ville" },
        { libelle: "Explorer les souks", categorie: "culture", activite: "ville" },
        { libelle: "Nager avec les dauphins", categorie: "aventure", activite: "plage" },
        { libelle: "Dîner sur un rooftop", categorie: "gastronomie", activite: "diner" },
        { libelle: "", categorie: "culture", activite: "ville" },
      ],
    });
    expect(lues).toEqual([{ libelle: "Explorer les souks", categorie: "culture", activite: "ville" }]);
    expect(ideesLues(null)).toEqual([]);
    expect(ideesLues({ idees: "non" })).toEqual([]);
  });
  it("la consigne demande de ne citer que des lieux réels et connus", () => {
    expect(inviteIdees("Marrakech")).toMatch(/existe réellement/);
  });
  it("destination sans idée : les idées de repli, variées, toutes valides", () => {
    expect(ideesLues({ idees: IDEES_GENERIQUES })).toEqual(IDEES_GENERIQUES);
    expect(new Set(IDEES_GENERIQUES.map((i) => i.categorie)).size).toBeGreaterThanOrEqual(5);
  });
});
