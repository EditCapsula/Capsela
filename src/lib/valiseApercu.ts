import type { CategoryKey, Item } from "./types";

/*
 * L'APERÇU DE LA VALISE (04/10/2026) — quelles pièces montrer dans le flat lay, et à quelle échelle.
 *
 * Pure présentation : aucune règle de sélection de la valise, aucun score. La valise peut compter jusqu'à 24 pièces,
 * l'aperçu en montre huit au plus — une sélection REPRÉSENTATIVE (de quoi faire une tenue) plutôt que les huit
 * premières de la liste, qui seraient huit hauts — et dit le reste par un compteur.
 *
 * Quatre rôles, comme la planche d'une tenue : les pièces principales (hauts, bas, robes, vestes), les chaussures,
 * le sac, les petits accessoires (bijoux, accessoires). Un quota par rôle, puis les places restantes sont rendues
 * dans le même ordre d'importance.
 */

export type RoleApercu = "principale" | "chaussures" | "sac" | "petit";
export type EchelleApercu = "grand" | "moyen";

const PRINCIPALES: CategoryKey[] = ["haut", "pull", "pantalon", "jean", "jupe", "short", "robe", "combinaison", "veste", "manteau"];

export const roleApercu = (cat: CategoryKey): RoleApercu =>
  cat === "chaussures" ? "chaussures" : cat === "sac" ? "sac" : PRINCIPALES.includes(cat) ? "principale" : "petit";

const ORDRE: RoleApercu[] = ["principale", "chaussures", "sac", "petit"];
const QUOTA: Record<RoleApercu, number> = { principale: 4, chaussures: 2, sac: 1, petit: 1 };

export interface PieceApercu {
  item: Item;
  role: RoleApercu;
  /** « grand » : trois pièces ou moins, chacune prend de la place — la composition reste simple. */
  echelle: EchelleApercu;
  /** Une pièce ajoutée pour remplir une case restée vide de la grille (20/10/2026) : posée en petit format, 2 × 1. */
  compacte?: boolean;
}

/** Les cases qu'une pièce occupe dans la grille de six colonnes de l'aperçu (ValiseScreen : gabarits par rôle et échelle). */
export function casesApercu(p: PieceApercu): number {
  if (p.compacte) return 2;
  if (p.echelle === "grand") return p.role === "petit" ? 6 : 9;
  return p.role === "chaussures" || p.role === "petit" ? 2 : 4;
}

export function selectionApercu(pieces: Item[], max = 8): { affichees: PieceApercu[]; reste: number } {
  const parRole = new Map<RoleApercu, Item[]>(ORDRE.map((r) => [r, []]));
  pieces.forEach((p) => parRole.get(roleApercu(p.cat))!.push(p));

  const retenues = new Set<number>();
  ORDRE.forEach((r) => parRole.get(r)!.slice(0, QUOTA[r]).forEach((p) => retenues.add(p.id)));
  // Les places restantes : dans l'ordre d'importance.
  ORDRE.forEach((r) =>
    parRole.get(r)!.forEach((p) => {
      if (retenues.size < max) retenues.add(p.id);
    })
  );
  // Au-delà du maximum (quotas dépassant `max`), on coupe par ordre d'importance.
  const ordonnees = ORDRE.flatMap((r) => parRole.get(r)!.filter((p) => retenues.has(p.id))).slice(0, max);
  const echelle: EchelleApercu = ordonnees.length <= 3 ? "grand" : "moyen";
  const affichees: PieceApercu[] = ordonnees.map((item) => ({ item, role: roleApercu(item.cat), echelle }));
  /*
   * TOUTE LA PLANCHE (20/10/2026, demandé : « explorer tout l'espace pour afficher au moins une autre pièce ») : la dernière rangée de
   * la grille laissait des cases vides alors que des pièces restaient comptées dans « +N pièces ». Chaque paire de cases libres reçoit
   * une pièce de plus, en petit format, dans le même ordre d'importance. Seulement à l'échelle « moyen » : en « grand », toutes les
   * pièces sont déjà là (trois au plus).
   */
  if (echelle === "moyen") {
    const utilisees = affichees.reduce((n, p) => n + casesApercu(p), 0);
    let libres = Math.ceil(utilisees / 6) * 6 - utilisees;
    const vues = new Set(ordonnees.map((p) => p.id));
    const suivantes = ORDRE.flatMap((r) => parRole.get(r)!).filter((p) => !vues.has(p.id));
    for (const item of suivantes) {
      if (libres < 2) break;
      affichees.push({ item, role: roleApercu(item.cat), echelle, compacte: true });
      libres -= 2;
    }
  }
  return { affichees, reste: pieces.length - affichees.length };
}
