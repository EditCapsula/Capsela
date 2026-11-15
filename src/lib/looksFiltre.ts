import { occasionShortLabel } from "./data";
import { isWishlistLook } from "./selectors";
import type { OccasionKey, SavedLook } from "./types";

/**
 * Filtres des looks, partagés par le Dressing et « Mes looks » (refonte du
 * 25/09/2026). « wishlist » = looks contenant des pièces suggérées ; il n'a
 * pas d'onglet, il est posé par la ligne « ✦ Looks suggérés par Capsela ».
 */
export type FiltreLooks = "all" | "saved" | "created" | "wishlist";

export function filtrerLooks(looks: SavedLook[], filtre: FiltreLooks): SavedLook[] {
  return looks.filter(
    (l) =>
      filtre === "all" ||
      (filtre === "saved" && l.source === "saved") ||
      (filtre === "created" && l.source === "created") ||
      (filtre === "wishlist" && isWishlistLook(l))
  );
}

/*
 * L'ONGLET « MES LOOKS » DU DRESSING (15/11/2026, brief « Refonte UX/UI – Page Dressing »). Les filtres demandés (Favoris, Travail,
 * Quotidien, Sorties, Soirées, Vacances) sont ADAPTÉS AUX DONNÉES : un look porte au plus une occasion (`occasion`, facultative) et une
 * source (créé / enregistré) ; aucun champ « favori » n'existe (pas de colonne en base). Une puce n'existe que si au moins un look y
 * répond — jamais de catégorie artificielle, jamais de puce vide.
 */

/** Une puce de filtre de l'onglet Mes looks : toutes, une occasion réellement portée par des looks, une source, les suggérés. */
export type CleFiltreLook = "tous" | `occ:${string}` | "created" | "saved" | "wishlist";

export interface FiltreLookDisponible {
  cle: CleFiltreLook;
  libelle: string;
  n: number;
}

/** Ordre d'affichage des occasions (celui des occasions de l'app), pour que les puces ne changent pas d'ordre selon les looks. */
const ORDRE_OCCASIONS: OccasionKey[] = ["quotidien", "travail_formel", "date", "soiree", "evenement_perso", "voyage", "sport", "cocooning"];

export function correspondFiltreLook(l: SavedLook, cle: CleFiltreLook): boolean {
  if (cle === "tous") return true;
  if (cle === "created" || cle === "saved") return l.source === cle;
  if (cle === "wishlist") return isWishlistLook(l);
  return l.occasion === cle.slice(4);
}

/** Les puces à proposer, dans l'ordre : Tous, les occasions présentes, Créés, Enregistrés, Suggérés — chacune avec son nombre réel. */
export function filtresLooksDisponibles(looks: readonly SavedLook[]): FiltreLookDisponible[] {
  const parOcc = new Map<string, number>();
  for (const l of looks) if (l.occasion && l.occasion !== "all") parOcc.set(l.occasion, (parOcc.get(l.occasion) ?? 0) + 1);
  const occs = [...parOcc.keys()].sort((a, b) => {
    const ia = ORDRE_OCCASIONS.indexOf(a as OccasionKey);
    const ib = ORDRE_OCCASIONS.indexOf(b as OccasionKey);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  const sortie: FiltreLookDisponible[] = [{ cle: "tous", libelle: "Tous", n: looks.length }];
  for (const o of occs) sortie.push({ cle: `occ:${o}`, libelle: occasionShortLabel(o as OccasionKey), n: parOcc.get(o) ?? 0 });
  const crees = looks.filter((l) => l.source === "created").length;
  const enregistres = looks.filter((l) => l.source === "saved").length;
  const suggeres = looks.filter(isWishlistLook).length;
  // Une source ne départage que si les deux existent : « Créés » qui vaut « Tous » n'apprend rien.
  if (crees > 0 && enregistres > 0) {
    sortie.push({ cle: "created", libelle: "Créés", n: crees });
    sortie.push({ cle: "saved", libelle: "Enregistrés", n: enregistres });
  }
  if (suggeres > 0) sortie.push({ cle: "wishlist", libelle: "Suggérés", n: suggeres });
  return sortie;
}

export type TriLooks = "recent" | "ancien" | "az";

/** Recherche (nom et occasion), filtre, tri — l'onglet Mes looks n'affiche que des looks réels de la personne. */
export function looksAffiches(looks: readonly SavedLook[], p: { recherche: string; filtre: CleFiltreLook; tri: TriLooks }): SavedLook[] {
  const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const terme = norm(p.recherche.trim());
  return looks
    .filter((l) => correspondFiltreLook(l, p.filtre))
    .filter((l) => !terme || norm(`${l.name} ${l.occasion && l.occasion !== "all" ? occasionShortLabel(l.occasion) : ""}`).includes(terme))
    .slice()
    .sort(
      p.tri === "az"
        ? (a, b) => a.name.localeCompare(b.name, "fr")
        : p.tri === "ancien"
          ? (a, b) => a.createdAt - b.createdAt
          : (a, b) => b.createdAt - a.createdAt
    );
}
