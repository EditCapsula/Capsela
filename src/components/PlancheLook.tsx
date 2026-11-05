"use client";

import { FlatLayCapsela } from "@/components/FlatLayCapsela";
import type { Item } from "@/lib/types";

/**
 * LA PLANCHE D'UN LOOK HORS DES HEROS (05/11/2026, demandé : « en faire une règle commune pour éviter que chaque écran ait son propre
 * traitement »). L'agenda des looks (Planifier → Mes planifications) et la valise posaient leurs pièces avec `OutfitComposition`, une
 * autre grille, d'autres tailles. Elles passent désormais par le même moteur que les heros (`FlatLayCapsela`, `composerFlatLay`) : mêmes
 * colonnes, mêmes proportions, mêmes accessoires (docs/flat-lay.md, « La règle commune des compositions de looks »).
 *
 * Remplit son parent, qui doit avoir une hauteur (une vignette de taille fixe, une carte au format donné). Contexte « packing » : une
 * marge de 4 unités, sans réserve pour des badges — ces planches n'en portent pas.
 */
export default function PlancheLook({ pieces, label }: { pieces: Item[]; label?: string }) {
  return (
    <span className="relative block w-full h-full" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <FlatLayCapsela items={pieces} context="packing" layoutSeed={pieces.map((p) => p.id).join(",")} />
    </span>
  );
}
