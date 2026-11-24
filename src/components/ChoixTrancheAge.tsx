"use client";

import { t } from "@/lib/langue";
import { libelleTranche, TRANCHES_AGE, type TrancheAge } from "@/lib/ageMinimum";

/**
 * LA TRANCHE D'ÂGE EN PUCES (24/11/2026, ageMinimum.ts) : inscription par e-mail, écran après la connexion Google ou Apple, profil.
 * Question NEUTRE d'un contrôle d'âge : aucune tranche présélectionnée, toutes au même poids — « Moins de 15 ans » compris.
 */
export default function ChoixTrancheAge({ valeur, onChange, className = "", sansMoinsDe15 = false }: { valeur: TrancheAge | null; onChange: (tr: TrancheAge) => void; className?: string; /** Le profil d'un compte existant : l'âge minimum est déjà vérifié. */ sansMoinsDe15?: boolean }) {
  return (
    <div className={"flex flex-wrap gap-2 " + className} role="radiogroup" aria-label={t("Ta tranche d'âge")}>
      {TRANCHES_AGE.filter((tr) => !sansMoinsDe15 || tr !== "moins_15").map((tr) => {
        const on = valeur === tr;
        return (
          <button
            key={tr}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(tr)}
            className={
              "inline-flex items-center rounded-full px-[14px] text-[13px] cursor-pointer border transition-colors " +
              (on ? "bg-terracotta border-terracotta text-cream font-semibold" : "bg-card border-sand-border text-ink")
            }
            style={{ minHeight: 44 }}
          >
            {libelleTranche(tr)}
          </button>
        );
      })}
    </div>
  );
}
