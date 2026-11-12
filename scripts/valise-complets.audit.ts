import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { formalityOf } from "../src/lib/attributes";
import { computeDefaultCapsule } from "../src/lib/capsule";
import { effectiveFormality } from "../src/lib/data";
import { CLOTHING_CATS } from "../src/lib/logic";
import { adapteeALOccasion } from "../src/lib/selectors";
import type { CatalogItem } from "../src/lib/catalog";
import { piecesPourLaSituation, piecesReserveesDuProfil } from "../src/lib/piecesDeValise";
import { planningDuProgramme } from "../src/lib/planningValise";
import { elementProgramme, type ItemProgramme } from "../src/lib/programmeValise";
import type { StyleId } from "../src/lib/profile";
import type { CapsuleSeason, Item, OccasionKey } from "../src/lib/types";
import {
  capaciteDe,
  capsuleDuSejour,
  cibleDeVolume,
  composerValiseVariee,
  generateurMoteur,
  joursDuSejour,
  lookAChaussuresEtSac,
  lookChezSoi,
  type LeviersValise,
  type MeteoJour,
  PLANCHERS_VACANCES,
  POIDS_REPETITION,
  situationsDuProgramme,
  type TailleBagage,
  unitesDe,
} from "../src/lib/valise";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// DES TENUES COMPLÈTES SEULEMENT (12/11/2026, signalé sur une valise « Polynesia » : deux trajets « Aucun look de ta valise ne répond
// encore à cette occasion »). LECTURE SEULE. AGENTS.md : la composition de l'écran (A + B + P + R + cible) SANS puis AVEC le levier
// `complets`, DANS LA MÊME EXÉCUTION, sur le même catalogue, les mêmes séjours, profils et dressings. Le seul levier qui varie.
//
// Contrairement à valise-variete, la composition est celle de l'ÉCRAN au complet : le générateur reçoit les pièces réservées du profil
// (chaussures de randonnée, maillot…) et la capsule les compte quand elles servent au séjour (ValiseScreen, capsuleDe). Et la valise est
// lue comme l'écran la montre : seuls comptent les looks qui ont des chaussures et un sac (ValiseScreen, `looks`), les autres sont masqués.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAGE = 1000;
const REPETITIONS = 3;

interface Sejour { nom: string; depart: string; retour: string; temp: number; label: string; programme: ItemProgramme[]; saisonDecalee: CapsuleSeason }
const SEJOURS: Sejour[] = [
  {
    nom: "Île tropicale avec randonnée (7 j, 26°) — le cas signalé",
    depart: "2026-11-23",
    retour: "2026-11-29",
    temp: 26,
    label: "Ensoleillé",
    programme: [{ id: "visites", frequence: 3 }, { id: "plage", frequence: 3 }, { id: "restaurant", frequence: 2 }, { id: "randonnee", frequence: 2 }, { id: "trajet", frequence: 2 }],
    saisonDecalee: "Hiver",
  },
  {
    nom: "Voyage culturel chaud (7 j, 28°)",
    depart: "2026-12-07",
    retour: "2026-12-13",
    temp: 28,
    label: "Ensoleillé",
    programme: [{ id: "trajet", frequence: 2 }, { id: "visites", frequence: 3 }, { id: "shopping", frequence: 2 }, { id: "balade", frequence: 2 }, { id: "restaurant", frequence: 3 }, { id: "spa", frequence: 1 }, { id: "ceremonie", frequence: 1 }],
    saisonDecalee: "Automne",
  },
  {
    nom: "Ville en hiver (5 j, 4°)",
    depart: "2027-01-15",
    retour: "2027-01-19",
    temp: 4,
    label: "Nuageux",
    programme: [{ id: "trajet", frequence: 2 }, { id: "visites", frequence: 3 }, { id: "shopping", frequence: 1 }, { id: "restaurant", frequence: 3 }],
    saisonDecalee: "Été",
  },
  {
    nom: "Bord de mer (7 j, 30°)",
    depart: "2027-07-10",
    retour: "2027-07-16",
    temp: 30,
    label: "Ensoleillé",
    programme: [{ id: "trajet", frequence: 2 }, { id: "plage", frequence: 4 }, { id: "visites", frequence: 2 }, { id: "restaurant", frequence: 4 }],
    saisonDecalee: "Hiver",
  },
];
const PROFILS: { genre: "femme" | "homme"; styles: StyleId[] }[] = [
  { genre: "femme", styles: ["minimaliste"] },
  { genre: "femme", styles: ["boheme", "casual_chic"] },
  { genre: "homme", styles: ["classique_chic"] },
];
const TAILLES: TailleBagage[] = ["S", "M", "L"];
const VARIANTES: { nom: string; leviers: LeviersValise }[] = [
  { nom: "écran (avant)", leviers: { variete: true, adaptation: true } },
  { nom: "écran + complets", leviers: { variete: true, adaptation: true, complets: true } },
];

interface Mesure { creneaux: number; couverts: number; trajets: number; trajetsCouverts: number; adaptes: number; visibles: number; masques: number; volume: number }

// Le contrôle commun d'adaptation de valise-variete (même définition).
function adapteeAuCreneau(pieces: Item[], occasion: OccasionKey, genre: "femme" | "homme", sousId: string): boolean {
  const vetements = pieces.filter((p) => CLOTHING_CATS.includes(p.cat) && p.cat !== "manteau");
  if (!vetements.length) return false;
  const plancher = PLANCHERS_VACANCES[sousId] ?? effectiveFormality(occasion, "Présentiel");
  if (Math.max(...vetements.map(formalityOf)) < plancher) return false;
  if (vetements.some((p) => p.occasion?.length && !p.occasion.includes(occasion) && !p.occasion.includes("all" as OccasionKey))) return false;
  return pieces.every((p) => adapteeALOccasion(p, occasion, genre));
}

describe("valise : tenues complètes seulement", () => {
  it("mesure l'écran sans puis avec le levier complets", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const rows: VestiaireRow[] = [];
    for (let debut = 0; ; debut += PAGE) {
      const { data, error } = await supabase.from("vestiaire_universel").select("*").order("id", { ascending: true }).range(debut, debut + PAGE - 1).returns<VestiaireRow[]>();
      if (error) throw new Error(error.message);
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    const catalogue = rows.filter((r) => !(r as { frozen?: boolean }).frozen).map(rowToCatalogItem).filter((i): i is CatalogItem => !!i);
    assertCatalogueStyles(catalogue);
    for (const s of SEJOURS) for (const p of s.programme) if (!elementProgramme(p.id)) throw new Error(`Programme inconnu : ${p.id}`);
    console.log(`\nCatalogue : ${catalogue.length} pièces actives.`);

    const cumul = new Map<string, Mesure[]>();
    const lignes: string[] = [];
    for (const sejour of SEJOURS) {
      const jours = joursDuSejour(sejour.depart, sejour.retour);
      const meteos: MeteoJour[] = jours.map((jour) => ({ jour, temp: sejour.temp, label: sejour.label, prevue: true }));
      const situations = situationsDuProgramme(sejour.programme, meteos, ["quotidien"], { planchersVacances: true });
      for (const profil of PROFILS) {
        const profile = profilAudit({ gender: profil.genre, styles: profil.styles });
        const reservees = piecesReserveesDuProfil(catalogue, profile, []);
        const base = capsuleDuSejour(situations, (meteo, saison) => computeDefaultCapsule(profile, meteo, [], saison, catalogue));
        // Comme l'écran (capsuleDe) : les pièces réservées qui servent au séjour entrent dans la capsule.
        const capsule = [...base, ...reservees.filter((p) => situations.some((st) => piecesPourLaSituation([p], st).length > 0) && !base.some((c) => c.id === p.id))];
        const decalee = computeDefaultCapsule(profile, { season: "Automne / Hiver", temp: 14, label: "Doux", seasons: ["Automne / Hiver", "Toutes saisons"] }, [], sejour.saisonDecalee, catalogue);
        const dressings: [string, Item[]][] = [
          ["décalé", decalee],
          ["partiel", base.filter((_, k) => k % 2 === 0)],
        ];
        const generer = generateurMoteur([], profil.genre, null, reservees);
        for (const [nomDressing, dressing] of dressings) {
          const tous = new Map<number, Item>([...catalogue, ...dressing].map((i) => [i.id, i]));
          for (const taille of TAILLES) {
            const capacite = capaciteDe(taille);
            const ligne: string[] = [];
            for (let rep = 0; rep < REPETITIONS; rep++)
              for (const v of VARIANTES) {
                const r = composerValiseVariee(dressing, capsule, situations, capacite, generer, v.leviers, undefined, cibleDeVolume(taille));
                const pieces = r.pieceIds.map((id) => tous.get(id)).filter((p): p is Item => !!p);
                // Ce que l'écran montre : les looks dont toutes les pièces sont dans la valise, avec chaussures et sac.
                const visibles = r.looks.filter((l) => l.ids.every((id) => r.pieceIds.includes(id)) && lookAChaussuresEtSac(l.ids, pieces, lookChezSoi(l, situations)));
                const planning = planningDuProgramme(sejour.programme, jours, situations, visibles, [], {}, undefined, (id) => POIDS_REPETITION[tous.get(id)?.cat ?? "accessoire"] ?? 0);
                let adaptes = 0;
                for (const c of planning) {
                  if (c.look == null) continue;
                  const occasion = situations.find((s) => (s.sousIds ?? []).includes(c.sousId) && s.jours.includes(c.jour))?.occasion ?? "quotidien";
                  if (adapteeAuCreneau(visibles[c.look].ids.map((id) => tous.get(id)).filter((p): p is Item => !!p), occasion, profil.genre, c.sousId)) adaptes++;
                }
                const trajets = planning.filter((c) => c.creneau === "trajet");
                const m: Mesure = {
                  creneaux: planning.length,
                  couverts: planning.filter((c) => c.look != null).length,
                  trajets: trajets.length,
                  trajetsCouverts: trajets.filter((c) => c.look != null).length,
                  adaptes,
                  visibles: visibles.length,
                  masques: r.looks.length - visibles.length,
                  volume: pieces.reduce((t, p) => t + unitesDe(p.cat), 0) / capacite,
                };
                const cle = `${v.nom}|${taille}|${sejour.nom}`;
                cumul.set(cle, [...(cumul.get(cle) ?? []), m]);
                if (rep === 0) ligne.push(`${v.nom}: ${m.couverts}/${m.creneaux} créneaux · trajets ${m.trajetsCouverts}/${m.trajets} · adaptés ${m.adaptes} · looks affichés ${m.visibles} (masqués ${m.masques}) · volume ${(m.volume * 100).toFixed(0)} %`);
              }
            lignes.push(`\n${sejour.nom} · ${profil.genre} ${profil.styles.join("+")} · dressing ${nomDressing} (${dressing.length}) · ${taille}\n  ${ligne.join("\n  ")}`);
          }
        }
      }
    }

    console.log("\n═══ DÉTAIL ═══");
    for (const l of lignes) console.log(l);
    const pct = (a: number, b: number) => `${b ? ((a / b) * 100).toFixed(0) : "—"} %`;
    const moy = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    console.log("\n═══ BILAN (3 profils × 2 dressings × 3 compositions, par séjour et taille) ═══");
    console.log("séjour · taille · variante | créneaux couverts | trajets couverts | adaptés / couverts | looks affichés | looks masqués | volume");
    for (const sejour of SEJOURS)
      for (const taille of TAILLES)
        for (const v of VARIANTES) {
          const ms = cumul.get(`${v.nom}|${taille}|${sejour.nom}`) ?? [];
          const s = (f: (m: Mesure) => number) => ms.reduce((t, m) => t + f(m), 0);
          console.log(
            `${sejour.nom.slice(0, 26).padEnd(26)} · ${taille} · ${v.nom.padEnd(16)} | ${pct(s((m) => m.couverts), s((m) => m.creneaux)).padEnd(5)} | ${pct(s((m) => m.trajetsCouverts), s((m) => m.trajets)).padEnd(5)} | ${pct(s((m) => m.adaptes), s((m) => m.couverts)).padEnd(5)} | ${moy(ms.map((m) => m.visibles)).toFixed(1)} | ${moy(ms.map((m) => m.masques)).toFixed(1)} | ${pct(moy(ms.map((m) => m.volume)), 1)}`
          );
        }
  }, 1_800_000);
});
