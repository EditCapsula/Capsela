import { describe, expect, it } from "vitest";
import { exportFileName } from "@/lib/dataExport";

describe("exportFileName", () => {
  it("date le fichier, pour qu'un second export n'écrase pas le premier", () => {
    expect(exportFileName(new Date("2026-08-28T14:32:10Z"))).toBe("capsela-mes-donnees-2026-08-28.json");
    expect(exportFileName(new Date("2027-01-05T00:00:00Z"))).toBe("capsela-mes-donnees-2027-01-05.json");
  });

  it("ne produit que des caractères sûrs pour un système de fichiers", () => {
    // Deux points, barres obliques ou accents casseraient l'enregistrement
    // sur au moins un des systèmes visés (Windows en particulier).
    expect(exportFileName(new Date("2026-12-31T23:59:59Z"))).toMatch(/^[a-z0-9-]+\.json$/);
  });

  it("reste stable au sein d'une même journée", () => {
    const matin = exportFileName(new Date("2026-08-28T01:00:00Z"));
    const soir = exportFileName(new Date("2026-08-28T22:00:00Z"));
    expect(matin).toBe(soir);
  });
});

// L'export doit contenir TOUT ce que l'utilisatrice a fourni (RGPD art. 20) :
// les tenues planifiées, les valises et les verdicts du jour y manquaient
// (relevé du 30/09/2026, docs/legal/README.md, écart 1).
import { vi } from "vitest";

type Resultat = { data: unknown; error: { code?: string; message: string } | null };
const tables: Record<string, Resultat> = {};

vi.mock("@/lib/supabase", () => {
  const requete = (table: string) => {
    const q: Record<string, unknown> = {
      select: () => q,
      eq: () => q,
      order: () => q,
      maybeSingle: () => Promise.resolve(tables[table] ?? { data: null, error: null }),
      then: (ok: (r: Resultat) => unknown) => Promise.resolve(tables[table] ?? { data: [], error: null }).then(ok),
    };
    return q;
  };
  return {
    isSupabaseConfigured: true,
    getSupabase: () => ({
      from: requete,
      storage: { from: () => ({ list: () => Promise.resolve({ data: [], error: null }), createSignedUrls: () => Promise.resolve({ data: [], error: null }), getPublicUrl: () => ({ data: { publicUrl: "" } }) }) },
    }),
  };
});

describe("buildDataExport — tout ce que l'utilisatrice a fourni", () => {
  const reset = () => { for (const k of Object.keys(tables)) delete tables[k]; };

  it("inclut les tenues planifiées, les valises et les verdicts du jour", async () => {
    reset();
    tables.planned_outfits = { data: [{ id: 1, jour: "2026-10-02" }], error: null };
    tables.valises = { data: [{ id: 2, destination: "Rome" }], error: null };
    tables.outfit_feedback = { data: [{ id: 3, jour: "2026-10-01", verdict: "aimee" }], error: null };
    const { buildDataExport } = await import("@/lib/dataExport");
    const e = await buildDataExport("u1", "a@b.fr");
    expect(e.tenues_planifiees).toEqual([{ id: 1, jour: "2026-10-02" }]);
    expect(e.valises).toEqual([{ id: 2, destination: "Rome" }]);
    expect(e.verdicts_du_jour).toEqual([{ id: 3, jour: "2026-10-01", verdict: "aimee" }]);
  });

  it("une table absente (migration non exécutée) donne une liste vide, sans faire échouer l'export", async () => {
    reset();
    for (const t of ["planned_outfits", "valises", "outfit_feedback"]) tables[t] = { data: null, error: { code: "42P01", message: "absente" } };
    const { buildDataExport } = await import("@/lib/dataExport");
    const e = await buildDataExport("u1", null);
    expect(e.tenues_planifiees).toEqual([]);
    expect(e.valises).toEqual([]);
    expect(e.verdicts_du_jour).toEqual([]);
  });

  it("toute autre erreur fait échouer l'export plutôt que de livrer un fichier amputé", async () => {
    reset();
    tables.valises = { data: null, error: { code: "42501", message: "refusé" } };
    const { buildDataExport } = await import("@/lib/dataExport");
    await expect(buildDataExport("u1", null)).rejects.toThrow("Export interrompu");
  });
});
