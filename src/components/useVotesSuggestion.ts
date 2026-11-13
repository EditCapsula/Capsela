"use client";

import { afficherToast } from "@/components/ToastCapsela";
import { useCapsela } from "@/lib/store";
import type { Item } from "@/lib/types";

/**
 * LES TROIS GESTES D'UNE SUGGESTION, LES MÊMES PARTOUT (13/11/2026, mission « Harmonisation du système de fiches ») — la Capsule
 * et toute autre fiche de suggestion (FicheSuggestionGlobale) passent par ici : jamais deux règles pour un même geste.
 *   · J'aime : le vote, sans navigation ; la fiche affiche « Ajoutée à ta sélection ! » et la suite ; « Retirer de ma sélection » le défait ;
 *   · Pas pour moi : retirée de la capsule pour la saison en cours (pasPourMoi.ts), aucune préférence durable ;
 *   · Ne plus me proposer cette pièce : le refus définitif (vote « rejetee »).
 * Chaque geste se défait par « Annuler » (ToastCapsela), qui remet exactement l'état d'avant.
 */
export function useVotesSuggestion() {
  const { actions, votesSuggestions } = useCapsela();
  const etatDe = (p: Item) => votesSuggestions[String(p.id)];
  return {
    aimer: (p: Item) => {
      // L'état se lit dans la fiche, qui reste ouverte (« Ajoutée à ta sélection ! », planche du 13/11/2026) : pas de message par-dessus.
      void actions.voterSuggestion(p.id, etatDe(p) === "aimee" ? null : "aimee");
    },
    pasPourMoi: (p: Item) => {
      actions.pasPourMoi(p.id);
      afficherToast("Retirée pour cette saison", () => actions.pasPourMoi(p.id, true));
    },
    nePlusProposer: (p: Item) => {
      const avant = etatDe(p);
      void actions.voterSuggestion(p.id, "rejetee");
      afficherToast("Elle ne te sera plus proposée", () => void actions.voterSuggestion(p.id, avant ?? null));
    },
  };
}
