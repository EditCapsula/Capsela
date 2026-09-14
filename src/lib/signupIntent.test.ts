import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Régression du 14/09/2026 — « si je crée un compte avec Google, on me
 * redirige directement sur la homepage alors qu'on est censé me faire passer
 * sur l'onboarding ».
 *
 * Au retour OAuth, `getUser()` et `onAuthStateChange` posent tous les deux
 * `justSignedUp` à partir de la même intention. La lecture était destructive :
 * le second appelant lisait une clé déjà vidée et écrasait le true du premier.
 * Ces tests fixent l'invariant qui l'empêche — la consommation est idempotente.
 */

function stockageFactice() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    taille: () => m.size,
  };
}

let stockage: ReturnType<typeof stockageFactice>;

async function chargerModule() {
  vi.resetModules();
  return import("./signupIntent");
}

beforeEach(() => {
  stockage = stockageFactice();
  vi.stubGlobal("sessionStorage", stockage);
});

describe("intention de création de compte", () => {
  it("rend false quand rien n'a été posé", async () => {
    const { consumeSignupIntent } = await chargerModule();
    expect(consumeSignupIntent()).toBe(false);
  });

  it("rend true après markSignupIntent", async () => {
    const { markSignupIntent, consumeSignupIntent } = await chargerModule();
    markSignupIntent();
    expect(consumeSignupIntent()).toBe(true);
  });

  it("rend true aux DEUX appels concurrents du retour OAuth — le défaut corrigé", async () => {
    const { markSignupIntent, consumeSignupIntent } = await chargerModule();
    markSignupIntent();
    // getUser() et onAuthStateChange, dans l'ordre où ils arrivent.
    expect(consumeSignupIntent()).toBe(true);
    expect(consumeSignupIntent()).toBe(true);
  });

  it("vide le stockage dès la première lecture", async () => {
    const { markSignupIntent, consumeSignupIntent } = await chargerModule();
    markSignupIntent();
    consumeSignupIntent();
    expect(stockage.taille()).toBe(0);
  });

  it("ne ressuscite pas l'intention au chargement de page suivant", async () => {
    const { markSignupIntent, consumeSignupIntent } = await chargerModule();
    markSignupIntent();
    expect(consumeSignupIntent()).toBe(true);
    // Nouveau chargement : le module repart neuf, le stockage est déjà vidé.
    const suivant = await chargerModule();
    expect(suivant.consumeSignupIntent()).toBe(false);
  });

  it("laisse une seconde création de compte repartir propre après déconnexion", async () => {
    const { markSignupIntent, consumeSignupIntent, forgetSignupIntent } = await chargerModule();
    markSignupIntent();
    expect(consumeSignupIntent()).toBe(true);
    forgetSignupIntent();
    expect(consumeSignupIntent()).toBe(false);
    markSignupIntent();
    expect(consumeSignupIntent()).toBe(true);
  });

  it("oublie une intention posée puis abandonnée à la déconnexion", async () => {
    const { markSignupIntent, consumeSignupIntent, forgetSignupIntent } = await chargerModule();
    markSignupIntent();
    forgetSignupIntent();
    expect(consumeSignupIntent()).toBe(false);
    expect(stockage.taille()).toBe(0);
  });

  it("ne jette pas quand sessionStorage est indisponible, et rend false", async () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => { throw new Error("bloqué"); },
      setItem: () => { throw new Error("bloqué"); },
      removeItem: () => { throw new Error("bloqué"); },
    });
    const { markSignupIntent, consumeSignupIntent } = await chargerModule();
    expect(() => markSignupIntent()).not.toThrow();
    expect(consumeSignupIntent()).toBe(false);
  });
});
