import { describe, expect, it } from "vitest";
import { REGLES_ACCES } from "../autorisations";
import { estActif } from "../premium";
import {
  assertPremium,
  autoriserFonctionnalite,
  autoriserSelonRegle,
  estActif as estActifServeur,
  REGLES_ACCES as REGLES_ACCES_SERVEUR,
  type LecteurPremium,
} from "../../../supabase/functions/_shared/premium.ts";

const MAINTENANT = new Date("2026-09-25T12:00:00Z");

/** Faux client Supabase : rend la réponse donnée, ou lève si `leve`. */
function client(reponse: { data: unknown; error: unknown }, leve = false): LecteurPremium & { lu: string[] } {
  const lu: string[] = [];
  return {
    lu,
    from: (table) => ({
      select: (colonnes) => ({
        eq: (colonne, valeur) => ({
          maybeSingle: () => {
            lu.push(`${table}.${colonnes}.${colonne}=${valeur}`);
            if (leve) return Promise.reject(new Error("réseau"));
            return Promise.resolve(reponse);
          },
        }),
      }),
    }),
  };
}

describe("estActif — la copie serveur rend le même verdict que l'app", () => {
  const cas = [
    null,
    { actif: false, expire_le: null },
    { actif: true, expire_le: null },
    { actif: true, expire_le: "2026-12-31T00:00:00Z" },
    { actif: true, expire_le: "2026-01-01T00:00:00Z" },
    { actif: true, expire_le: "pas une date" },
  ];
  it.each(cas.map((c) => [JSON.stringify(c), c]))("%s", (_, row) => {
    expect(estActifServeur(row as never, MAINTENANT)).toBe(estActif(row as never, MAINTENANT));
  });
});

describe("assertPremium — refus AVANT tout appel au modèle", () => {
  it("Premium actif : accès", async () => {
    const c = client({ data: { actif: true, expire_le: null }, error: null });
    expect(await assertPremium(c, { id: "u1" }, MAINTENANT)).toEqual({ ok: true });
    expect(c.lu).toEqual(["premium_access.actif, expire_le.user_id=u1"]);
  });

  it("aucune ligne (compte gratuit) : 403", async () => {
    expect(await assertPremium(client({ data: null, error: null }), { id: "u1" }, MAINTENANT)).toEqual({
      ok: false,
      statut: 403,
      raison: "non_premium",
    });
  });

  it("abonnement expiré : traité comme gratuit", async () => {
    const c = client({ data: { actif: true, expire_le: "2026-09-01T00:00:00Z" }, error: null });
    expect((await assertPremium(c, { id: "u1" }, MAINTENANT)).ok).toBe(false);
  });

  it("statut illisible (erreur de base) : refus, jamais d'accès par défaut", async () => {
    const c = client({ data: null, error: { message: "relation does not exist" } });
    expect(await assertPremium(c, { id: "u1" }, MAINTENANT)).toEqual({ ok: false, statut: 503, raison: "statut_illisible" });
  });

  it("exception réseau : refus aussi", async () => {
    expect((await assertPremium(client({ data: null, error: null }, true), { id: "u1" }, MAINTENANT)).ok).toBe(false);
  });
});

describe("autoriserFonctionnalite — une règle, la même des deux côtés", () => {
  it("les règles serveur sont celles de l'app (miroir)", () => {
    expect(REGLES_ACCES_SERVEUR).toEqual(REGLES_ACCES);
  });

  it("phase de test — AVIS_DE_STYLISTE en accès libre : accordé sans lire premium_access", async () => {
    const gratuit = client({ data: null, error: null });
    const panne = client({ data: null, error: { message: "timeout" } });
    expect(await autoriserFonctionnalite(gratuit, { id: "u1" }, "AVIS_DE_STYLISTE", MAINTENANT)).toEqual({ ok: true });
    expect(await autoriserFonctionnalite(panne, { id: "u1" }, "AVIS_DE_STYLISTE", MAINTENANT)).toEqual({ ok: true });
    expect([...gratuit.lu, ...panne.lu]).toEqual([]);
  });

  it("PREMIUM_REQUIRED (règle du lancement) : Premium confirmé seulement", async () => {
    const premium = client({ data: { actif: true, expire_le: null }, error: null });
    const gratuit = client({ data: null, error: null });
    const panne = client({ data: null, error: { message: "timeout" } });
    expect(await autoriserSelonRegle(premium, { id: "u1" }, "PREMIUM_REQUIRED", MAINTENANT)).toEqual({ ok: true });
    expect((await autoriserSelonRegle(gratuit, { id: "u1" }, "PREMIUM_REQUIRED", MAINTENANT)).ok).toBe(false);
    expect(await autoriserSelonRegle(panne, { id: "u1" }, "PREMIUM_REQUIRED", MAINTENANT)).toEqual({
      ok: false,
      statut: 503,
      raison: "statut_illisible",
    });
  });
});
