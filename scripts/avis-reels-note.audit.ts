import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

// LECTURE AGRÉGÉE DES AVIS RÉELS, POUR LA NOTE SUR 10 (04/10/2026). LECTURE SEULE, COMPTAGES UNIQUEMENT.
//
// Autorisée par la propriétaire le 04/10/2026, pour ces seuls comptages : la répartition des titres de verdict, et la
// part d'avis dont la composition reconnue pourrait recevoir une note. Ne sont JAMAIS lus ni affichés : le texte d'un
// avis, la photo, le libellé d'un vêtement, un identifiant de compte ou de pièce. La requête ne demande que le titre
// du verdict et la liste des vêtements reconnus (dont on ne garde que la catégorie et le statut), et rien n'est
// imprimé hors des totaux.
//
// Ce que cette lecture ne peut PAS dire : la note elle-même. Elle exige les pièces du dressing de la personne
// (couleurs, matières) ; on n'a ici que leurs catégories. « Pourrait recevoir une note » est donc le plancher
// de la règle de noteTenue — deux pièces reconnues au moins, avec un socle — et non une garantie.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const HAUTS = new Set(["haut", "pull"]);
const BAS = new Set(["pantalon", "jean", "jupe", "short"]);
const ROBES = new Set(["robe", "combinaison"]);
const pct = (n: number, t: number) => (t ? ((n / t) * 100).toFixed(1) : "—").padStart(5) + " %";

describe("avis réels — comptages pour la note", () => {
  it("compte, sans rien lire d'autre", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data, error } = await supabase
      .from("avis_styliste")
      .select("verdict:resultat->titres->>verdict, pieces_reconnues")
      .limit(5000);
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const rows = (data ?? []) as unknown as { verdict: string | null; pieces_reconnues: unknown }[];
    const total = rows.length;
    console.log(`\nAvis enregistrés lus : ${total}.`);
    if (!total) return;

    // ═══ 1 · TITRES DE VERDICT ═══
    const verdicts = new Map<string, number>();
    rows.forEach((r) => verdicts.set(r.verdict ?? "(sans titre : avis ancien)", (verdicts.get(r.verdict ?? "(sans titre : avis ancien)") ?? 0) + 1));
    console.log(`\n════════ 1 · TITRES DE VERDICT ════════`);
    for (const [v, n] of [...verdicts.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${v.padEnd(30)} ${String(n).padStart(5)}  ${pct(n, total)}`);

    // ═══ 2 · PIÈCES RECONNUES ═══
    const compte = { aucune: 0, une: 0, deuxPlus: 0, socle: 0, socleEtVerdict: 0 };
    const statuts = new Map<string, number>();
    let vetements = 0;
    for (const r of rows) {
      const liste = Array.isArray(r.pieces_reconnues) ? (r.pieces_reconnues as { categorie?: unknown; pieceId?: unknown; statut?: unknown }[]) : [];
      vetements += liste.length;
      liste.forEach((v) => statuts.set(String(v.statut), (statuts.get(String(v.statut)) ?? 0) + 1));
      const associees = liste.filter((v) => Number.isInteger(v.pieceId));
      if (associees.length === 0) compte.aucune++;
      else if (associees.length === 1) compte.une++;
      else compte.deuxPlus++;
      const cats = associees.map((v) => String(v.categorie));
      const socle = cats.some((c) => ROBES.has(c)) || (cats.some((c) => HAUTS.has(c)) && cats.some((c) => BAS.has(c)));
      if (associees.length >= 2 && socle) {
        compte.socle++;
        if (r.verdict) compte.socleEtVerdict++;
      }
    }
    console.log(`\n════════ 2 · PIÈCES RECONNUES DANS LE DRESSING ════════`);
    console.log(`  vêtements vus par avis : ${(vetements / total).toFixed(1)} en moyenne`);
    console.log(`  statuts : ${[...statuts.entries()].map(([s, n]) => `${s} ${pct(n, vetements).trim()}`).join(" · ")}`);
    console.log(`  aucune pièce associée au dressing : ${pct(compte.aucune, total)}`);
    console.log(`  une seule                         : ${pct(compte.une, total)}`);
    console.log(`  deux ou plus                      : ${pct(compte.deuxPlus, total)}`);
    console.log(`  deux ou plus ET un socle (haut + bas, ou robe) : ${pct(compte.socle, total)}  ← plancher des avis qui auraient une note`);
    console.log(`  … et un titre de verdict (le quatrième poids)  : ${pct(compte.socleEtVerdict, total)}`);
  });
});
