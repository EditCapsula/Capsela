import { describe, expect, it } from "vitest";
import { autorisationValide, decisionEvenement } from "../../../supabase/functions/_shared/revenuecat";

const U = "0b5f2a52-6a0e-4a8e-9c1d-2f1e3d4c5b6a";
const V = "1c6e3b63-7b1f-4b9f-8d2e-3a2f4e5d6c7b";

describe("événements RevenueCat", () => {
  it("un achat active le droit jusqu'à l'échéance", () => {
    expect(decisionEvenement({ type: "INITIAL_PURCHASE", app_user_id: U, expiration_at_ms: Date.UTC(2026, 11, 17), store: "APP_STORE", entitlement_ids: ["premium"] })).toEqual({
      action: "activer",
      userId: U,
      source: "app_store",
      expireLe: "2026-12-17T00:00:00.000Z",
    });
  });
  it("un renouvellement Google Play passe en play_store", () => {
    const d = decisionEvenement({ type: "RENEWAL", app_user_id: U, expiration_at_ms: 1, store: "PLAY_STORE" });
    expect(d.action === "activer" && d.source).toBe("play_store");
  });
  it("une annulation ne retire rien : le droit court jusqu'à l'échéance", () => {
    expect(decisionEvenement({ type: "CANCELLATION", app_user_id: U }).action).toBe("rien");
    expect(decisionEvenement({ type: "BILLING_ISSUE", app_user_id: U }).action).toBe("rien");
  });
  it("une expiration retire le droit", () => {
    expect(decisionEvenement({ type: "EXPIRATION", app_user_id: U })).toEqual({ action: "retirer", userIds: [U] });
  });
  it("un transfert retire le droit aux anciens comptes", () => {
    expect(decisionEvenement({ type: "TRANSFER", transferred_from: [V, "$RCAnonymousID:abc"] })).toEqual({ action: "retirer", userIds: [V] });
  });
  it("un identifiant anonyme, un test ou un autre droit ne font rien", () => {
    expect(decisionEvenement({ type: "INITIAL_PURCHASE", app_user_id: "$RCAnonymousID:abc" }).action).toBe("rien");
    expect(decisionEvenement({ type: "TEST" }).action).toBe("rien");
    expect(decisionEvenement({ type: "INITIAL_PURCHASE", app_user_id: U, entitlement_ids: ["autre"] }).action).toBe("rien");
    expect(decisionEvenement(null).action).toBe("rien");
  });
  it("l'en-tête d'autorisation doit être exactement le secret", () => {
    expect(autorisationValide("Bearer abc123", "abc123")).toBe(true);
    expect(autorisationValide("abc123", "abc123")).toBe(true);
    expect(autorisationValide("abc124", "abc123")).toBe(false);
    expect(autorisationValide(null, "abc123")).toBe(false);
    expect(autorisationValide("abc123", undefined)).toBe(false);
  });
});
