import { tenueAUnSocle } from "./logic";
import type { Item } from "./types";
import type { VetementReconnu } from "../../supabase/functions/_shared/avisStyliste.ts";

/*
 * RECONNAISSANCE DES PIÈCES — la couche de données entre l'avis de styliste
 * et les actions de l'app (26/09/2026) :
 *
 *   PHOTO → PIÈCES DU DRESSING → COMPOSITION DE TENUE → ACTIONS
 *
 * Le serveur relie chaque vêtement visible au dressing (reconnaitrePieces,
 * même évaluation que « Voir dans mon dressing »). Ce module lit ce résultat,
 * applique les corrections de l'utilisatrice, et en tire LA composition que
 * lisent Porter aujourd'hui, Planifier, Demain et le Journal — une seule,
 * pour que toutes les actions manipulent les mêmes pièces.
 *
 * Fonctions pures, testées : aucune ne devine une pièce. Un vêtement non
 * reconnu reste non reconnu tant que l'utilisatrice ne l'a pas associé
 * elle-même.
 */

export type { VetementReconnu };

const STATUTS = new Set<VetementReconnu["statut"]>(["reconnue", "non_reconnue", "corrigee"]);

/** Six vêtements au plus (VETEMENTS_VISIBLES_MAX côté serveur), cinq candidats chacun. */
export function lireReconnaissance(v: unknown): VetementReconnu[] {
  if (!Array.isArray(v)) return [];
  const entiers = (x: unknown) => (Array.isArray(x) ? [...new Set(x.filter((n): n is number => Number.isInteger(n)))].slice(0, 5) : []);
  const lus: VetementReconnu[] = [];
  for (const brut of v.slice(0, 6)) {
    if (!brut || typeof brut !== "object") continue;
    const o = brut as Record<string, unknown>;
    if (typeof o.categorie !== "string" || !STATUTS.has(o.statut as VetementReconnu["statut"])) continue;
    const pieceId = Number.isInteger(o.pieceId) ? (o.pieceId as number) : null;
    lus.push({
      categorie: o.categorie as VetementReconnu["categorie"],
      libelle: typeof o.libelle === "string" ? o.libelle.trim().slice(0, 60) : "",
      pieceId,
      // Un statut « reconnue » sans pièce ne veut rien dire : il est lu non reconnu.
      statut: pieceId === null ? "non_reconnue" : (o.statut as VetementReconnu["statut"]),
      candidats: entiers(o.candidats).filter((id) => id !== pieceId),
    });
  }
  return lus;
}

/**
 * L'utilisatrice associe elle-même une pièce au vêtement `index` — ou
 * aucune (null : « Ce n'est aucune de mes pièces »). La pièce écartée
 * rejoint les candidats, pour pouvoir revenir en arrière. Une même pièce
 * n'est jamais associée à deux vêtements : l'autre redevient non reconnu.
 */
export function corrigerReconnaissance(r: VetementReconnu[], index: number, pieceId: number | null): VetementReconnu[] {
  if (!r[index]) return r;
  return r.map((v, i) => {
    if (i === index) {
      const candidats = [...(v.pieceId !== null && v.pieceId !== pieceId ? [v.pieceId] : []), ...v.candidats.filter((c) => c !== pieceId)];
      return { ...v, pieceId, statut: pieceId === null ? "non_reconnue" : "corrigee", candidats: [...new Set(candidats)].slice(0, 5) };
    }
    if (pieceId !== null && v.pieceId === pieceId) {
      return { ...v, pieceId: null, statut: "non_reconnue", candidats: [pieceId, ...v.candidats.filter((c) => c !== pieceId)].slice(0, 5) };
    }
    return v;
  });
}

/**
 * LA COMPOSITION : les pièces associées, encore présentes dans le dressing
 * (une pièce supprimée depuis disparaît en silence, jamais remplacée), dans
 * l'ordre des vêtements, sans doublon.
 */
export function compositionReconnue(r: VetementReconnu[], dressing: Item[]): Item[] {
  const vues = new Set<number>();
  const pieces: Item[] = [];
  for (const v of r) {
    if (v.pieceId === null || vues.has(v.pieceId)) continue;
    const item = dressing.find((i) => i.id === v.pieceId);
    if (!item) continue;
    vues.add(v.pieceId);
    pieces.push(item);
  }
  return pieces;
}

/** La composition peut-elle se porter ou se planifier ? Même règle que le moteur : un haut et un bas, ou une robe / combinaison. */
export const compositionUtilisable = (pieces: Item[]) => tenueAUnSocle(pieces);

/**
 * Catégories voisines, proposées ensemble par « Modifier » : un jean rangé
 * en « Pantalon » (ou l'inverse) doit rester trouvable. Seulement pour le
 * choix manuel — la reconnaissance, elle, ne relie qu'une même catégorie.
 */
const FAMILLES: string[][] = [["pantalon", "jean"]];

/**
 * Les pièces proposées par « Modifier » pour le vêtement `index` : d'abord
 * les candidats du serveur (les plus probables), puis les autres pièces de
 * la même catégorie du dressing (ou d'une catégorie voisine, FAMILLES). Jamais la pièce déjà associée, jamais une
 * pièce associée à un autre vêtement (elle y resterait sinon sans le dire).
 */
export function piecesPourModifier(r: VetementReconnu[], index: number, dressing: Item[]): Item[] {
  const v = r[index];
  if (!v) return [];
  const ailleurs = new Set(r.flatMap((x, i) => (i !== index && x.pieceId !== null ? [x.pieceId] : [])));
  const exclue = (id: number) => id === v.pieceId || ailleurs.has(id);
  const candidats = v.candidats.map((id) => dressing.find((i) => i.id === id)).filter((i): i is Item => !!i && !exclue(i.id));
  const famille = FAMILLES.find((f) => f.includes(v.categorie)) ?? [v.categorie];
  const reste = dressing.filter((i) => famille.includes(i.cat) && !exclue(i.id) && !candidats.some((c) => c.id === i.id));
  return [...candidats, ...reste];
}
