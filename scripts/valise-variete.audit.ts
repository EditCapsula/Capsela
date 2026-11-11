import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { formalityOf } from "../src/lib/attributes";
import { computeDefaultCapsule } from "../src/lib/capsule";
import { effectiveFormality } from "../src/lib/data";
import { CLOTHING_CATS } from "../src/lib/logic";
import { adapteeALOccasion } from "../src/lib/selectors";
import type { CatalogItem } from "../src/lib/catalog";
import { planningDuProgramme } from "../src/lib/planningValise";
import { elementProgramme, type ItemProgramme } from "../src/lib/programmeValise";
import type { StyleId } from "../src/lib/profile";
import type { CapsuleSeason, Item, OccasionKey } from "../src/lib/types";
import {
  capaciteDe,
  capsuleDuSejour,
  cibleDeVolume,
  completerAvecCapsule,
  composerValise,
  composerValiseVariee,
  generateurMoteur,
  joursDuSejour,
  situationsDuProgramme,
  type LeviersValise,
  type LookValise,
  type MeteoJour,
  PLANCHERS_VACANCES,
  POIDS_REPETITION,
  type TailleBagage,
  unitesDe,
} from "../src/lib/valise";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// LA VALISE VARIÉE ET ADAPTÉE (11/11/2026, validé par la propriétaire : A « variété sur tout le séjour », B « le dressing ne passe avant
// que s'il convient »). LECTURE SEULE. AGENTS.md : la référence (production : composerValise puis completerAvecCapsule), A seul, B seul,
// puis A + B, DANS LA MÊME EXÉCUTION, sur le même catalogue, les mêmes séjours et les mêmes dressings.
//
// Le dressing d'un séjour est tiré du catalogue :
//   · « décalé » : la capsule du même profil pour une AUTRE saison (le cas signalé : des pièces possédées qui conviennent mal au voyage) ;
//   · « partiel » : une pièce sur deux de la capsule de la saison du séjour.
// Chaque valise est lue à travers le VRAI planning (planningDuProgramme), créneau par créneau, comme l'écran l'affiche.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAGE = 1000;
const PRINCIPALES = new Set<Item["cat"]>(["pantalon", "jean", "jupe", "short", "robe", "combinaison"]);
const HAUTS = new Set<Item["cat"]>(["haut", "pull"]);

interface Sejour {
  nom: string;
  depart: string;
  retour: string;
  temp: number;
  label: string;
  programme: ItemProgramme[];
  saisonDecalee: CapsuleSeason;
}
const SEJOURS: Sejour[] = [
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
/** Le moteur tire au hasard : chaque valise est composée trois fois, la moyenne est retenue. */
const REPETITIONS = 3;
// P (11/11/2026) : les niveaux de formalité des contextes de vacances fixés par la propriétaire (PLANCHERS_VACANCES). Plafond : au plus
// un créneau sur quatre pour une même pièce principale (plafondPrincipale).
// R (11/11/2026) : la répartition jour par jour compte les pièces déjà portées (planningDuProgramme, poidsPiece).
const VARIANTES: { nom: string; leviers: LeviersValise | null; planchers?: boolean; repartition?: boolean }[] = [
  { nom: "référence", leviers: null },
  { nom: "réf. + P", leviers: null, planchers: true },
  { nom: "A + B", leviers: { variete: true, adaptation: true } },
  { nom: "A+B+plafond", leviers: { variete: true, adaptation: true, plafond: true } },
  { nom: "A+B+pl.+P", leviers: { variete: true, adaptation: true, plafond: true }, planchers: true },
  { nom: "réf. + R", leviers: null, repartition: true },
  { nom: "A+B+pl.+R", leviers: { variete: true, adaptation: true, plafond: true }, repartition: true },
  { nom: "A+B+pl.+P+R", leviers: { variete: true, adaptation: true, plafond: true }, planchers: true, repartition: true },
];

interface Mesure {
  /** Par occasion : [créneaux couverts, dont par une tenue relâchée par le moteur]. */
  relaches: Map<string, [number, number]>;
  creneaux: number;
  couverts: number;
  adaptes: number;
  maxPrincipale: number;
  principales: number;
  hauts: number;
  looks: number;
  pieces: number;
  capsule: number;
  volume: number;
}

/**
 * UNE TENUE ADAPTÉE À SON CRÉNEAU — le même contrôle pour toutes les variantes (le drapeau `elargie` des valises n'est pas calculé de la
 * même façon par la référence, qui le lève sur l'ensemble des situations d'un look, et par la composition variée, situation par
 * situation). Trois conditions, sur l'occasion du créneau : le niveau de formalité de l'occasion atteint par au moins un vêtement
 * (manteau exclu), chaque vêtement déclaré pour cette occasion quand il en déclare, et les préférences d'occasion (adapteeALOccasion).
 */
// Depuis le 11/11/2026, le niveau attendu d'un créneau est celui que la propriétaire a fixé pour son contexte de vacances
// (PLANCHERS_VACANCES), le même pour TOUTES les variantes ; sans contexte fixé, celui de l'occasion.
function adapteeAuCreneau(pieces: Item[], occasion: OccasionKey, genre: "femme" | "homme", sousId: string): boolean {
  const vetements = pieces.filter((p) => CLOTHING_CATS.includes(p.cat) && p.cat !== "manteau");
  if (!vetements.length) return false;
  const plancher = PLANCHERS_VACANCES[sousId] ?? effectiveFormality(occasion, "Présentiel");
  if (Math.max(...vetements.map(formalityOf)) < plancher) return false;
  if (vetements.some((p) => p.occasion?.length && !p.occasion.includes(occasion) && !p.occasion.includes("all" as OccasionKey))) return false;
  return pieces.every((p) => adapteeALOccasion(p, occasion, genre));
}

function mesurer(looks: LookValise[], pieceIds: number[], suggestionIds: number[], tous: Map<number, Item>, sejour: Sejour, situations: ReturnType<typeof situationsDuProgramme>, capacite: number, genre: "femme" | "homme", repartition = false): Mesure {
  const jours = joursDuSejour(sejour.depart, sejour.retour);
  const planning = planningDuProgramme(sejour.programme, jours, situations, looks, [], {}, undefined, repartition ? (id) => POIDS_REPETITION[tous.get(id)?.cat ?? "accessoire"] ?? 0 : undefined);
  const portes = planning.filter((c) => c.look != null).map((c) => looks[c.look!]);
  const usages = new Map<number, number>();
  for (const l of portes) for (const id of l.ids) usages.set(id, (usages.get(id) ?? 0) + 1);
  const catDe = (id: number) => tous.get(id)?.cat;
  const principales = [...usages.keys()].filter((id) => PRINCIPALES.has(catDe(id)!));
  const relaches = new Map<string, [number, number]>();
  let adaptes = 0;
  for (const c of planning) {
    if (c.look == null) continue;
    const occasion = situations.find((s) => (s.sousIds ?? []).includes(c.sousId) && s.jours.includes(c.jour))?.occasion ?? "quotidien";
    const ok = adapteeAuCreneau(looks[c.look].ids.map((id) => tous.get(id)).filter((p): p is Item => !!p), occasion, genre, c.sousId);
    if (ok) adaptes++;
    const r = relaches.get(c.sousId) ?? [0, 0];
    r[0]++;
    if (!ok) r[1]++;
    relaches.set(c.sousId, r);
  }
  return {
    relaches,
    creneaux: planning.length,
    couverts: portes.length,
    adaptes,
    maxPrincipale: Math.max(0, ...principales.map((id) => usages.get(id)!)),
    principales: principales.length,
    hauts: [...usages.keys()].filter((id) => HAUTS.has(catDe(id)!)).length,
    looks: new Set(planning.filter((c) => c.look != null).map((c) => c.look)).size,
    pieces: pieceIds.length,
    capsule: suggestionIds.filter((id) => pieceIds.includes(id)).length,
    volume: pieceIds.reduce((t, id) => t + unitesDe(catDe(id) ?? "haut"), 0) / capacite,
  };
}

describe("valise variée et adaptée", () => {
  it("mesure la référence, A, B et A + B sur les mêmes séjours", async () => {
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
      const situationsBase = situationsDuProgramme(sejour.programme, meteos, ["quotidien"]);
      const situationsP = situationsDuProgramme(sejour.programme, meteos, ["quotidien"], { planchersVacances: true });
      const situations = situationsBase;
      for (const profil of PROFILS) {
        const profile = profilAudit({ gender: profil.genre, styles: profil.styles });
        const capsule = capsuleDuSejour(situations, (meteo, saison) => computeDefaultCapsule(profile, meteo, [], saison, catalogue));
        const decalee = computeDefaultCapsule(profile, { season: "Automne / Hiver", temp: 14, label: "Doux", seasons: ["Automne / Hiver", "Toutes saisons"] }, [], sejour.saisonDecalee, catalogue);
        const dressings: [string, Item[]][] = [
          ["décalé", decalee],
          ["partiel", capsule.filter((_, k) => k % 2 === 0)],
        ];
        const generer = generateurMoteur([], profil.genre);
        for (const [nomDressing, dressing] of dressings) {
          const tous = new Map<number, Item>([...capsule, ...dressing].map((i) => [i.id, i]));
          for (const taille of TAILLES) {
            const capacite = capaciteDe(taille);
            const ligne: string[] = [];
            for (let rep = 0; rep < REPETITIONS; rep++)
            for (const v of VARIANTES) {
              const situations = v.planchers ? situationsP : situationsBase;
              let looks: LookValise[];
              let pieceIds: number[];
              let suggestionIds: number[];
              if (!v.leviers) {
                const r0 = composerValise(dressing, situations, capacite, generer);
                const r = completerAvecCapsule(dressing, capsule, situations, r0, capacite, generer, cibleDeVolume(taille));
                ({ looks, pieceIds, suggestionIds } = r);
              } else {
                ({ looks, pieceIds, suggestionIds } = composerValiseVariee(dressing, capsule, situations, capacite, generer, v.leviers));
              }
              const m = mesurer(looks, pieceIds, suggestionIds, tous, sejour, situations, capacite, profil.genre, v.repartition);
              const cle = `${v.nom}|${taille}`;
              cumul.set(cle, [...(cumul.get(cle) ?? []), m]);
              if (rep === 0) ligne.push(`${v.nom}: ${m.couverts}/${m.creneaux} créneaux · adaptés ${m.adaptes} · max bas ${m.maxPrincipale} · bas ${m.principales} · hauts ${m.hauts} · looks ${m.looks} · pièces ${m.pieces} (capsule ${m.capsule})`);
            }
            lignes.push(`\n${sejour.nom} · ${profil.genre} ${profil.styles.join("+")} · dressing ${nomDressing} (${dressing.length}) · ${taille}\n  ${ligne.join("\n  ")}`);
          }
        }
      }
    }

    // Le détail d'abord, le bilan en dernier : c'est lui qu'on lit en fin de journal.
    console.log("\n═══ DÉTAIL ═══");
    for (const l of lignes) console.log(l);
    const moy = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    const pct = (a: number, b: number) => `${b ? ((a / b) * 100).toFixed(0) : "—"} %`;
    console.log("\n═══ BILAN (moyennes sur 3 séjours × 3 profils × 2 dressings × 3 compositions) ═══");
    console.log("\nTenues NON adaptées à leur créneau (contrôle commun : niveau, occasions déclarées, préférences), par activité — non adaptées / couvertes :");
    for (const v of VARIANTES) {
      const tot = new Map<string, [number, number]>();
      for (const taille of TAILLES)
        for (const m of cumul.get(`${v.nom}|${taille}`) ?? [])
          for (const [k, [n, r]] of m.relaches) {
            const t = tot.get(k) ?? [0, 0];
            tot.set(k, [t[0] + n, t[1] + r]);
          }
      console.log(`  ${v.nom.padEnd(14)} ${[...tot].sort(([a], [b]) => a.localeCompare(b)).map(([k, [n, r]]) => `${k} ${r}/${n}`).join(" · ")}`);
    }
    console.log("\nvariante · taille | créneaux couverts | adaptés | bas le plus porté (créneaux) | bas distincts | hauts distincts | looks distincts | pièces (dont capsule) | volume");
    for (const taille of TAILLES)
      for (const v of VARIANTES) {
        const ms = cumul.get(`${v.nom}|${taille}`) ?? [];
        const s = (f: (m: Mesure) => number) => ms.reduce((t, m) => t + f(m), 0);
        console.log(
          `${(v.nom + " · " + taille).padEnd(20)} | ${pct(s((m) => m.couverts), s((m) => m.creneaux)).padEnd(6)} | ${pct(s((m) => m.adaptes), s((m) => m.couverts)).padEnd(6)} | ${moy(ms.map((m) => m.maxPrincipale)).toFixed(1).padEnd(5)} | ${moy(ms.map((m) => m.principales)).toFixed(1).padEnd(5)} | ${moy(ms.map((m) => m.hauts)).toFixed(1).padEnd(5)} | ${moy(ms.map((m) => m.looks)).toFixed(1).padEnd(5)} | ${moy(ms.map((m) => m.pieces)).toFixed(1)} (${moy(ms.map((m) => m.capsule)).toFixed(1)}) | ${pct(moy(ms.map((m) => m.volume)), 1)}`
        );
      }
  }, 1_800_000);
});
