"use client";

import { QUANTITE_MAX, QUANTITE_MIN } from "@/lib/quantitesValise";

/*
 * LE CONTRÔLE DE QUANTITÉ (07/11/2026, refonte de la valise : « la quantité doit être modifiable directement depuis la carte, avec un
 * contrôle + / − »). Aucun équivalent dans l'app : une ligne fine, − la valeur +, aux couleurs du design system. Les deux boutons sont
 * des cibles d'au moins 32 px ; aux bornes, le bouton concerné est désactivé (jamais sous 1, jamais au-delà du plafond).
 */
export default function ControleQuantite({
  valeur,
  onChange,
  libelle,
  compact = false,
}: {
  valeur: number;
  onChange: (delta: number) => void;
  /** Ce dont on règle la quantité, pour les lecteurs d'écran (« Chemise en lin »). */
  libelle: string;
  compact?: boolean;
}) {
  const taille = compact ? 30 : 34;
  const bouton = (delta: number, signe: string, actif: boolean, aria: string) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (actif) onChange(delta);
      }}
      disabled={!actif}
      aria-label={aria}
      className={"flex items-center justify-center rounded-full text-[15px] leading-none cursor-pointer disabled:cursor-default " + (actif ? "text-ink" : "text-placeholder")}
      style={{ width: taille, height: taille }}
    >
      <span aria-hidden="true">{signe}</span>
    </button>
  );
  return (
    <div className="inline-flex items-center justify-between rounded-full border border-border bg-cream" role="group" aria-label={`Quantité : ${libelle}`}>
      {bouton(-1, "−", valeur > QUANTITE_MIN, `Une de moins : ${libelle}`)}
      <span className="min-w-[18px] text-center text-[13px] text-ink tabular-nums" aria-live="polite">
        {valeur}
      </span>
      {bouton(1, "+", valeur < QUANTITE_MAX, `Une de plus : ${libelle}`)}
    </div>
  );
}
