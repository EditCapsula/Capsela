import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { computeDefaultCapsule } from "../src/lib/capsule";
import type { CatalogItem } from "../src/lib/catalog";
import { planningDuProgramme } from "../src/lib/planningValise";
import { elementProgramme, type ItemProgramme } from "../src/lib/programmeValise";
import type { StyleId } from "../src/lib/profile";
import { ajusterALaCapacite, estTshirt, LINGE_PAR_JOUR, quantiteLinge, quantiteProposee, UNITE_LINGE, usageDesPieces, type Lavage } from "../src/lib/quantitesProposees";
import type { CapsuleSeason, Item } from "../src/lib/types";
import {
  capaciteDe,
  capsuleDuSejour,
  cibleDeVolume,
  composerValiseVariee,
  generateurMoteur,
  joursDuSejour,
  POIDS_REPETITION,
  situationsDuProgramme,
  unitesDe,
  type MeteoJour,
  type TailleBagage,
} from "../src/lib/valise";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// LES QUANTITÉS PROPOSÉES ET LA CAPACITÉ DU BAGAGE (12/11/2026, étape 3 du brief Vacances, arbitrages de la propriétaire). LECTURE SEULE.
// Mesuré AVANT tout branchement (demandé : « mesurer l'impact sur le remplissage des valises S, M et L avant toute modification du
// code »). Chaque valise est composée comme l'écran la compose (A + B + P + R + cible), puis lue avec les quantités de
// quantitesProposees.ts, pour chaque réponse au lavage (sans réponse, oui, non). La composition ne change pas : les looks sont les
// mêmes avant et après (la diversité ne recule pas par construction) ; ce qui est mesuré, c'est le volume et ce qu'il faut retirer pour
// tenir dans le bagage.
//
// Le linge (sous-vêtements, chaussettes) est un indispensable : il ne compte pas dans le remplissage aujourd'hui. Il est mesuré deux
// fois, non compté puis compté à UNITE_LINGE par article, pour savoir si un long séjour sans lavage tient dans le bagage.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAGE = 1000;

interface Sejour { nom: string; depart: string; retour: string; temp: number; label: string; programme: ItemProgramme[]; saisonDecalee: CapsuleSeason }
const SEJOURS: Sejour[] = [
  { nom: "Culturel chaud 7 j", depart: "2026-12-07", retour: "2026-12-13", temp: 28, label: "Ensoleillé", programme: [{ id: "trajet", frequence: 2 }, { id: "visites", frequence: 3 }, { id: "shopping", frequence: 2 }, { id: "balade", frequence: 2 }, { id: "restaurant", frequence: 3 }, { id: "spa", frequence: 1 }, { id: "ceremonie", frequence: 1 }], saisonDecalee: "Automne" },
  { nom: "Ville hiver 5 j", depart: "2027-01-15", retour: "2027-01-19", temp: 4, label: "Nuageux", programme: [{ id: "trajet", frequence: 2 }, { id: "visites", frequence: 3 }, { id: "shopping", frequence: 1 }, { id: "restaurant", frequence: 3 }], saisonDecalee: "Été" },
  { nom: "Bord de mer 7 j", depart: "2027-07-10", retour: "2027-07-16", temp: 30, label: "Ensoleillé", programme: [{ id: "trajet", frequence: 2 }, { id: "plage", frequence: 4 }, { id: "visites", frequence: 2 }, { id: "restaurant", frequence: 4 }], saisonDecalee: "Hiver" },
  { nom: "Bord de mer 14 j", depart: "2027-07-01", retour: "2027-07-14", temp: 30, label: "Ensoleillé", programme: [{ id: "trajet", frequence: 2 }, { id: "plage", frequence: 8 }, { id: "piscine", frequence: 3 }, { id: "visites", frequence: 3 }, { id: "activite_sportive", frequence: 2 }, { id: "restaurant", frequence: 7 }], saisonDecalee: "Hiver" },
];
const PROFILS: { genre: "femme" | "homme"; styles: StyleId[] }[] = [
  { genre: "femme", styles: ["minimaliste"] },
  { genre: "femme", styles: ["boheme", "casual_chic"] },
  { genre: "homme", styles: ["classique_chic"] },
];
const TAILLES: TailleBagage[] = ["S", "M", "L"];
const LAVAGES: { nom: string; v: Lavage }[] = [
  { nom: "sans réponse", v: null },
  { nom: "lavage oui", v: true },
  { nom: "lavage non", v: false },
];

interface Mesure { avant: number; apres: number; ajuste: number; avecLinge: number; deborde: boolean; debordeLinge: boolean; retires: number; tshirts: number; linge: number; looks: number; exemplairesEnPlus: number }

describe("quantités proposées et capacité", () => {
  it("mesure le remplissage S, M, L avant et après les quantités", async () => {
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

    const cumul = new Map<string, Mesure[]>();
    const lignes: string[] = [];
    for (const sejour of SEJOURS) {
      const jours = joursDuSejour(sejour.depart, sejour.retour);
      const meteos: MeteoJour[] = jours.map((jour) => ({ jour, temp: sejour.temp, label: sejour.label, prevue: true }));
      const situations = situationsDuProgramme(sejour.programme, meteos, ["quotidien"], { planchersVacances: true });
      for (const profil of PROFILS) {
        const profile = profilAudit({ gender: profil.genre, styles: profil.styles });
        const capsule = capsuleDuSejour(situations, (meteo, saison) => computeDefaultCapsule(profile, meteo, [], saison, catalogue));
        const decalee = computeDefaultCapsule(profile, { season: "Automne / Hiver", temp: 14, label: "Doux", seasons: ["Automne / Hiver", "Toutes saisons"] }, [], sejour.saisonDecalee, catalogue);
        const generer = generateurMoteur([], profil.genre);
        for (const [nomDressing, dressing] of [["décalé", decalee], ["partiel", capsule.filter((_, k) => k % 2 === 0)]] as [string, Item[]][]) {
          const tous = new Map<number, Item>([...capsule, ...dressing].map((i) => [i.id, i]));
          for (const taille of TAILLES) {
            const capacite = capaciteDe(taille);
            const r = composerValiseVariee(dressing, capsule, situations, capacite, generer, { variete: true, adaptation: true }, undefined, cibleDeVolume(taille));
            const planning = planningDuProgramme(sejour.programme, jours, situations, r.looks, [], {}, undefined, (id) => POIDS_REPETITION[tous.get(id)?.cat ?? "accessoire"] ?? 0);
            const usages = usageDesPieces(planning, r.looks, situations);
            const pieces = r.pieceIds.map((id) => tous.get(id)).filter((p): p is Item => !!p);
            const volume = (q: Record<string, number>) => pieces.reduce((t, p) => t + unitesDe(p.cat) * (q[String(p.id)] ?? 1), 0);
            const avant = volume({});
            const looks = new Set(planning.filter((c) => c.look != null).map((c) => c.look)).size;
            const detail: string[] = [];
            for (const l of LAVAGES) {
              const proposees: Record<string, number> = {};
              for (const p of pieces) {
                const n = quantiteProposee(p, usages.get(p.id), l.v);
                if (n > 1) proposees[String(p.id)] = n;
              }
              const apres = volume(proposees);
              const linge = LINGE_PAR_JOUR.length * quantiteLinge(jours.length, l.v);
              const ajuste = ajusterALaCapacite(pieces, proposees, capacite, unitesDe);
              const enPlus = Object.values(proposees).reduce((t, n) => t + n - 1, 0);
              const m: Mesure = {
                avant: avant / capacite,
                apres: apres / capacite,
                ajuste: volume(ajuste.quantites) / capacite,
                avecLinge: (volume(ajuste.quantites) + linge * UNITE_LINGE) / capacite,
                deborde: apres > capacite,
                debordeLinge: volume(ajuste.quantites) + linge * UNITE_LINGE > capacite,
                retires: ajuste.retires,
                tshirts: pieces.filter(estTshirt).reduce((t, p) => t + (ajuste.quantites[String(p.id)] ?? 1), 0),
                linge,
                looks,
                exemplairesEnPlus: enPlus,
              };
              const cle = `${taille}|${l.nom}`;
              cumul.set(cle, [...(cumul.get(cle) ?? []), m]);
              const cleLong = `${taille}|${l.nom}|${sejour.nom === "Bord de mer 14 j" ? "14 j" : "≤ 7 j"}`;
              cumul.set(cleLong, [...(cumul.get(cleLong) ?? []), m]);
              detail.push(`${l.nom}: ${(m.apres * 100).toFixed(0)} % (+${enPlus} ex.) → ${(m.ajuste * 100).toFixed(0)} % après ajustement (${m.retires} retirés), avec linge ${(m.avecLinge * 100).toFixed(0)} %`);
            }
            lignes.push(`${sejour.nom} · ${profil.genre} ${profil.styles.join("+")} · ${nomDressing} · ${taille} : ${(avant / capacite * 100).toFixed(0)} % sans quantités, ${looks} looks\n  ${detail.join("\n  ")}`);
          }
        }
      }
    }

    console.log("\n═══ DÉTAIL ═══");
    for (const l of lignes) console.log(l);
    const moy = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    const pc = (x: number) => `${(x * 100).toFixed(0)} %`;
    console.log("\n═══ BILAN ═══");
    console.log("taille · lavage · durée | sans quantités | avec quantités | valises > 100 % | ex. en plus | ex. retirés pour tenir | après ajustement | t-shirts | linge (articles) | avec linge compté | > 100 % avec linge | looks");
    for (const taille of TAILLES)
      for (const l of LAVAGES)
        for (const duree of ["≤ 7 j", "14 j"]) {
          const ms = cumul.get(`${taille}|${l.nom}|${duree}`) ?? [];
          console.log(
            `${taille} · ${l.nom.padEnd(12)} · ${duree.padEnd(5)} | ${pc(moy(ms.map((m) => m.avant)))} | ${pc(moy(ms.map((m) => m.apres)))} | ${ms.filter((m) => m.deborde).length}/${ms.length} | ${moy(ms.map((m) => m.exemplairesEnPlus)).toFixed(1)} | ${moy(ms.map((m) => m.retires)).toFixed(1)} | ${pc(moy(ms.map((m) => m.ajuste)))} | ${moy(ms.map((m) => m.tshirts)).toFixed(1)} | ${moy(ms.map((m) => m.linge)).toFixed(0)} | ${pc(moy(ms.map((m) => m.avecLinge)))} | ${ms.filter((m) => m.debordeLinge).length}/${ms.length} | ${moy(ms.map((m) => m.looks)).toFixed(1)}`
          );
        }
  }, 1_800_000);
});
