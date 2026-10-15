import { describe, expect, it } from "vitest";
import { libelleVersion } from "../versionApp";

describe("libelleVersion — date et commit du build, sans numéro (15/10/2026)", () => {
  it("date à l'heure de Paris et commit court", () => {
    expect(libelleVersion("f5524dc1d6492f4c", "2026-10-15T04:15:25Z")).toBe("15/10/2026 · f5524dc");
  });
  it("un build juste avant minuit UTC est daté du lendemain à Paris", () => {
    expect(libelleVersion("abc1234", "2026-10-15T22:30:00Z")).toBe("16/10/2026 · abc1234");
  });
  it("ce qui manque n'est pas inventé", () => {
    expect(libelleVersion("", "2026-10-15T04:15:25Z")).toBe("15/10/2026");
    expect(libelleVersion("abc1234", "")).toBe("abc1234");
    expect(libelleVersion("", "pas une date")).toBe("de développement");
  });
});
