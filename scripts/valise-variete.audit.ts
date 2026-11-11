import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { computeDefaultCapsule } from "../src/lib/capsule";
import type { CatalogItem } from "../src/lib/catalog";
import { planningDuProgramme } from "../src/lib/planningValise";
import { elementProgramme, type ItemProgramme } from "../src/lib/programmeValise";
import type { StyleId } from "../src/lib/profile";
import type { CapsuleSeason, Item } from "../src/lib/types";
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
const VARIANTES: { nom: string; leviers: LeviersValise | null }[] = [
  { nom: "référence", leviers: null },
  { nom: "A variété", leviers: { variete: true } },
  { nom: "B adaptation", leviers: { adaptation: true } },
  { nom: "A + B", leviers: { variete: true, adaptation: true } },
];

interface Mesure {
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

function mesurer(looks: LookValise[], pieceIds: number[], suggestionIds: number[], tous: Map<number, Item>, sejour: Sejour, situations: ReturnType<typeof situationsDuProgramme>, capacite: number): Mesure {
  const jours = joursDuSejour(sejour.depart, sejour.retour);
  const planning = planningDuProgramme(sejour.programme, jours, situations, looks);
  const portes = planning.filter((c) => c.look != null).map((c) => looks[c.look!]);
  const usages = new Map<number, number>();
  for (const l of portes) for (const id of l.ids) usages.set(id, (usages.get(id) ?? 0) + 1);
  const catDe = (id: number) => tous.get(id)?.cat;
  const principales = [...usages.keys()].filter((id) => PRINCIPALES.has(catDe(id)!));
  return {
    creneaux: planning.length,
    couverts: portes.length,
    adaptes: portes.filter((l) => !l.elargie).length,
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
      const situations = situationsDuProgramme(sejour.programme, meteos, ["quotidien"]);
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
            for (const v of VARIANTES) {
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
              const m = mesurer(looks, pieceIds, suggestionIds, tous, sejour, situations, capacite);
              const cle = `${v.nom}|${taille}`;
              cumul.set(cle, [...(cumul.get(cle) ?? []), m]);
              ligne.push(`${v.nom}: ${m.couverts}/${m.creneaux} créneaux · adaptés ${m.adaptes} · max bas ${m.maxPrincipale} · bas ${m.principales} · hauts ${m.hauts} · looks ${m.looks} · pièces ${m.pieces} (capsule ${m.capsule})`);
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
    console.log("\n═══ BILAN (moyennes sur 3 séjours × 3 profils × 2 dressings) ═══");
    console.log("variante · taille | créneaux couverts | adaptés | bas le plus porté (créneaux) | bas distincts | hauts distincts | looks distincts | pièces (dont capsule) | volume");
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
