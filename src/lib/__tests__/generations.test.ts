import { describe, expect, it } from "vitest";
import { generationAutorisee, generationsRestantes, lireQuota, type QuotaGeneration } from "../generations";

const q = (p: Partial<QuotaGeneration>): QuotaGeneration =>
  ({ consomme: true, utilisees: 1, limite: 2, premium: false, bonus: 0, ...p });

describe("generationAutorisee", () => {
  it("n'applique AUCUNE limite quand on ne sait pas", () => {
    // Réseau coupé, mode démo, ou migration 0032 pas encore exécutée. Les
    // trois se traitent pareil, et c'est ce qui rend la fonctionnalité
    // déployable avant la table.
    expect(generationAutorisee(null)).toBe(true);
  });

  it("n'applique aucune limite à un compte Premium", () => {
    expect(generationAutorisee(q({ premium: true, consomme: true, utilisees: 0 }))).toBe(true);
  });

  it("distingue la deuxième génération d'une troisième tentative", () => {
    // LE CŒUR DU TEST. Les deux rendent utilisees = 2 ; seul `consomme` dit
    // si la base a réellement écrit. Se fier au compteur refuserait la
    // deuxième, à laquelle on a droit.
    expect(generationAutorisee(q({ consomme: true, utilisees: 2 }))).toBe(true);
    expect(generationAutorisee(q({ consomme: false, utilisees: 2 }))).toBe(false);
  });

  it("laisse passer la première", () => {
    expect(generationAutorisee(q({ consomme: true, utilisees: 1 }))).toBe(true);
  });
});

describe("generationsRestantes", () => {
  it("ne compte rien quand il n'y a pas de limite à annoncer", () => {
    expect(generationsRestantes(null)).toBeNull();
    expect(generationsRestantes(q({ premium: true }))).toBeNull();
  });

  it("compte, et ne descend jamais sous zéro", () => {
    expect(generationsRestantes(q({ utilisees: 1 }))).toBe(1);
    expect(generationsRestantes(q({ utilisees: 2 }))).toBe(0);
    expect(generationsRestantes(q({ utilisees: 5 }))).toBe(0);
  });
});

describe("lireQuota", () => {
  const ligne = { consomme: true, utilisees: 1, limite: 2, premium: false, bonus: 0 };

  it("accepte le tableau de PostgREST comme l'objet nu", () => {
    expect(lireQuota([ligne])).toEqual(ligne);
    expect(lireQuota(ligne)).toEqual(ligne);
  });

  it("rend null sur une réponse qu'il ne comprend pas — donc aucune limite", () => {
    expect(lireQuota(null)).toBeNull();
    expect(lireQuota([])).toBeNull();
    expect(lireQuota({ utilisees: 1, limite: 2 })).toBeNull();
    expect(lireQuota({ consomme: true, utilisees: "1", limite: 2 })).toBeNull();
    // Réponse d'une base où la fonction n'existe pas encore : PostgREST rend
    // une erreur, mais si jamais un corps arrivait, il ne doit rien bloquer.
    expect(lireQuota({ message: "function does not exist" })).toBeNull();
  });

  it("retient la limite de la BASE, pas celle du client", () => {
    // Si les deux divergeaient, c'est la base qui a raison : c'est elle qui
    // l'applique.
    expect(lireQuota([{ ...ligne, limite: 5 }])?.limite).toBe(5);
  });

  it("traite un `premium` absent comme faux plutôt que comme vrai", () => {
    expect(lireQuota([{ consomme: true, utilisees: 1, limite: 2 }])?.premium).toBe(false);
  });

  it("tolère un `bonus` absent — base à 0032, migration 0033 pas encore passée", () => {
    // Entre les deux migrations, la fonction ne renvoie pas encore ce champ.
    // L'app ne doit pas cesser de fonctionner pour autant.
    expect(lireQuota([{ consomme: true, utilisees: 1, limite: 2, premium: false }])?.bonus).toBe(0);
    expect(lireQuota([{ ...ligne, bonus: 1 }])?.bonus).toBe(1);
  });
});
