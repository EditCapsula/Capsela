import { describe, expect, it } from "vitest";
import {
  aEnvoyer,
  anciennete,
  filtrerNotifications,
  fusionnerNotifications,
  grouperParPeriode,
  nombreNonLues,
  notifPieceAjoutee,
  notifValiseEnregistree,
  notificationsDesValises,
  type NotificationCapsela,
} from "../centreNotifications";
import type { ValiseGardee } from "../valises";

// LE CENTRE DE NOTIFICATIONS (12/11/2026) : la partie pure — périodes, filtres, ancienneté, fusion appareil/compte, valises.
const MAINTENANT = new Date(2026, 10, 12, 18, 0);
const notif = (cle: string, creeeLe: Date, autre: Partial<NotificationCapsela> = {}): NotificationCapsela => ({
  id: `local-${cle}`,
  cle,
  type: "piece_ajoutee",
  categorie: "actions",
  titre: "T",
  message: "M",
  cible: null,
  lue: false,
  creeeLe: creeeLe.toISOString(),
  ...autre,
});
const valise = (depart: string, autre: Partial<ValiseGardee> = {}): ValiseGardee =>
  ({ version: 2, id: "v1", destination: "Milan", depart, retour: "2026-11-25", bagage: "M", sejour: null, occasions: [], meteos: [], situations: [], looks: [{ ids: [1], situations: [0] }], situationsSansLook: [], pieceIds: [1], ...autre }) as ValiseGardee;

describe("grouperParPeriode", () => {
  it("aujourd'hui depuis minuit, la semaine sur les six jours d'avant, le reste plus ancien ; du plus récent au plus ancien", () => {
    const g = grouperParPeriode(
      [
        notif("a", new Date(2026, 10, 12, 0, 5)),
        notif("b", new Date(2026, 10, 11, 23, 50)),
        notif("c", new Date(2026, 10, 6, 9, 0)),
        notif("d", new Date(2026, 10, 5, 23, 0)),
        notif("e", new Date(2026, 10, 12, 17, 0)),
      ],
      MAINTENANT
    );
    expect(g.map((x) => [x.periode, x.notifications.map((n) => n.cle)])).toEqual([
      ["aujourdhui", ["e", "a"]],
      ["semaine", ["b", "c"]],
      ["anciennes", ["d"]],
    ]);
  });
  it("un groupe vide n'est pas rendu", () => {
    expect(grouperParPeriode([notif("a", new Date(2026, 9, 1))], MAINTENANT).map((x) => x.periode)).toEqual(["anciennes"]);
    expect(grouperParPeriode([], MAINTENANT)).toEqual([]);
  });
});

describe("filtres et non lues", () => {
  const liste = [notif("a", MAINTENANT), notif("b", MAINTENANT, { categorie: "valise", lue: true }), notif("c", MAINTENANT, { categorie: "conseils" })];
  it("chaque filtre ne garde que sa catégorie, « Toutes » garde tout", () => {
    expect(filtrerNotifications(liste, "toutes").length).toBe(3);
    expect(filtrerNotifications(liste, "actions").map((n) => n.cle)).toEqual(["a"]);
    expect(filtrerNotifications(liste, "conseils").map((n) => n.cle)).toEqual(["c"]);
    expect(filtrerNotifications(liste, "valise").map((n) => n.cle)).toEqual(["b"]);
  });
  it("compte les non lues", () => {
    expect(nombreNonLues(liste)).toBe(2);
  });
});

describe("anciennete", () => {
  it("de l'instant à la date", () => {
    expect(anciennete(new Date(2026, 10, 12, 17, 59, 40).toISOString(), MAINTENANT)).toBe("À l'instant");
    expect(anciennete(new Date(2026, 10, 12, 17, 48).toISOString(), MAINTENANT)).toBe("Il y a 12 min");
    expect(anciennete(new Date(2026, 10, 12, 14, 30).toISOString(), MAINTENANT)).toBe("Il y a 3 h");
    expect(anciennete(new Date(2026, 10, 11, 21, 0).toISOString(), MAINTENANT)).toBe("Hier");
    expect(anciennete(new Date(2026, 10, 8, 10, 0).toISOString(), MAINTENANT)).toBe("Il y a 4 j");
    expect(anciennete(new Date(2026, 10, 3, 10, 0).toISOString(), MAINTENANT)).toBe("3 nov.");
    expect(anciennete(new Date(2025, 11, 24, 10, 0).toISOString(), MAINTENANT)).toBe("24 déc. 2025");
  });
});

describe("fusion de l'appareil et du compte", () => {
  it("une clé, une notification ; lue d'un côté = lue ; l'identifiant du compte l'emporte", () => {
    const locale = notif("a", new Date(2026, 10, 12, 10), { lue: true });
    const duCompte = notif("a", new Date(2026, 10, 12, 10), { id: "uuid-1", lue: false });
    const f = fusionnerNotifications([locale], [duCompte, notif("b", MAINTENANT, { id: "uuid-2" })]);
    expect(f.map((n) => [n.cle, n.id, n.lue])).toEqual([
      ["b", "uuid-2", false],
      ["a", "uuid-1", true],
    ]);
  });
  it("renvoie au compte ce qu'il ignore : les nouvelles, et les lectures faites sur l'appareil", () => {
    const r = aEnvoyer([notif("a", MAINTENANT, { lue: true }), notif("b", MAINTENANT)], [notif("a", MAINTENANT, { id: "uuid-1" })]);
    expect(r.nouvelles.map((n) => n.cle)).toEqual(["b"]);
    expect(r.lues).toEqual(["a"]);
  });
});

describe("événements", () => {
  it("une pièce ajoutée : une clé par pièce, l'écran de la pièce pour destination", () => {
    const n = notifPieceAjoutee(812, "Blouse en soie");
    expect([n.cle, n.categorie, n.cible, n.message]).toEqual(["piece_ajoutee:812", "actions", "piece:812", "Blouse en soie est dans ton dressing."]);
  });
  it("une valise enregistrée : la même clé avant et après son entrée dans le compte (l'identifiant change)", () => {
    expect(notifValiseEnregistree({ id: "local-1", destination: "Milan", depart: "2026-12-03" }).cle).toBe(notifValiseEnregistree({ id: "42", destination: "Milan", depart: "2026-12-03" }).cle);
  });
});

describe("notificationsDesValises", () => {
  const AUJ = "2026-11-12";
  it("seulement de J-7 à J-1 : ni un voyage lointain, ni le jour du départ, ni un voyage passé", () => {
    expect(notificationsDesValises([valise("2026-11-20"), valise("2026-11-12"), valise("2026-11-01")], AUJ)).toEqual([]);
    expect(notificationsDesValises([valise("2026-11-19")], AUJ).length).toBe(1);
  });
  it("à compléter : le nombre réel de pièces à ajouter et la destination", () => {
    const [n] = notificationsDesValises([valise("2026-11-15", { suggestionIds: [3, 4, 5] })], AUJ);
    expect([n.type, n.categorie, n.message]).toEqual(["valise_a_completer", "valise", "Il te reste 3 pièces à ajouter pour ton séjour à Milan."]);
  });
  it("prête, ou les préparatifs quand l'état n'est pas connu", () => {
    expect(notificationsDesValises([valise("2026-11-13")], AUJ)[0].message).toBe("Tout est prêt pour Milan, départ demain.");
    expect(notificationsDesValises([valise("2026-11-14", { looks: [] })], AUJ)[0].type).toBe("valise_preparatifs");
  });
  it("un changement d'état est un nouvel événement ; le même état, la même clé", () => {
    const aCompleter = notificationsDesValises([valise("2026-11-15", { suggestionIds: [3] })], AUJ)[0].cle;
    const prete = notificationsDesValises([valise("2026-11-15")], AUJ)[0].cle;
    expect(aCompleter).not.toBe(prete);
    expect(notificationsDesValises([valise("2026-11-15")], "2026-11-13")[0].cle).toBe(prete);
  });
});
