"use client";

import { useSyncExternalStore } from "react";
import { VuePiece } from "@/components/RemplacementPiece";
import { estSuggestion } from "@/lib/remplacementPiece";
import { useCapsela } from "@/lib/store";
import type { Item } from "@/lib/types";

/**
 * LA FEUILLE D'UNE PIÈCE VUE DANS UN LOOK QUI NE SE MODIFIE PAS (13/11/2026, harmonisation des fiches) : une idée de look, l'avis d'un
 * proche, une tenue planifiée affichée. La même vue que là où le look se modifie (VuePiece, RemplacementPiece.tsx), sans « Remplacer ».
 * Ouverte par useOuvrirPiece ; un petit magasin externe, comme le menu d'actions : une seule feuille, montée une fois par App.tsx.
 */
let ouverte: Item | null = null;
const abonnes = new Set<() => void>();
const publier = (it: Item | null) => {
  ouverte = it;
  abonnes.forEach((f) => f());
};
export const ouvrirFeuillePiece = (it: Item) => publier(it);
const abonner = (f: () => void) => {
  abonnes.add(f);
  return () => {
    abonnes.delete(f);
  };
};

export default function FeuillePieceGlobale() {
  const { actions } = useCapsela();
  const piece = useSyncExternalStore(abonner, () => ouverte, () => null);
  return (
    <VuePiece
      piece={piece}
      onFermer={() => publier(null)}
      onVoir={(p) => {
        publier(null);
        actions.openItem(p.id, estSuggestion(p));
      }}
    />
  );
}
