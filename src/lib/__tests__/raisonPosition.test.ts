import { describe, expect, it } from "vitest";
import { raisonErreurPosition } from "../weather";

// « UTILISER MA POSITION ACTUELLE » DIT POURQUOI ELLE ÉCHOUE (13/11/2026) : la raison, d'après le code ou le message de l'erreur.
describe("raisonErreurPosition", () => {
  it("lit les codes du navigateur", () => {
    expect(raisonErreurPosition({ code: 1, message: "User denied Geolocation" })).toBe("refusee");
    expect(raisonErreurPosition({ code: 3, message: "Timeout expired" })).toBe("delai");
    expect(raisonErreurPosition({ code: 2, message: "Position unavailable" })).toBe("indisponible");
  });
  it("lit les messages du plugin natif", () => {
    expect(raisonErreurPosition(new Error("Location permission request was denied."))).toBe("refusee");
    expect(raisonErreurPosition(new Error("Location services are not enabled"))).toBe("desactivee");
    expect(raisonErreurPosition(new Error("Timeout while waiting for location"))).toBe("delai");
    expect(raisonErreurPosition(new Error("quelque chose d'autre"))).toBe("indisponible");
  });
});
