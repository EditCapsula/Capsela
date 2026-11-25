"use client";

import { t } from "@/lib/langue";

/** Un glyphe au trait des accès de l'accueil (maquette Accueil V9, 07/10/2026). */
export const glypheUnivers = (d: string) => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
    <path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const D_DRESSING = "M10 6a2 2 0 1 1 2 2v1.5M12 9.5L3.4 16a1 1 0 0 0 .6 1.8h16a1 1 0 0 0 .6-1.8z";
export const D_CAPSULE = "M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3";
export const D_AGENDA = "M4.5 6h15v14h-15zM4.5 10h15M8.5 3.5v4M15.5 3.5v4";
export const D_VALISE = "M3 10a2.5 2.5 0 0 1 2.5-2.5h13A2.5 2.5 0 0 1 21 10v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18zM9 7.5V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2.5M9.5 11.5v5M14.5 11.5v5";

const ACCES = [
  { cle: "dressing", d: D_DRESSING, a: "Mon", b: "dressing", label: "Mon dressing" },
  { cle: "capsule", d: D_CAPSULE, a: "Ma", b: "capsule", label: "Ma capsule" },
  { cle: "planifier", d: D_AGENDA, a: "Planifier", b: "mes tenues", label: "Planifier mes tenues" },
  { cle: "valise", d: D_VALISE, a: "Préparer", b: "une valise", label: "Préparer une valise" },
] as const;

/**
 * LES QUATRE ACCÈS DE L'ACCUEIL, EN RANGÉE (19/11/2026, option B arbitrée) : quatre tuiles égales, le glyphe sur une pastille chaude,
 * le libellé en deux lignes. Ils remplacent les quatre cartes « Tout pour ton style » (CarteUnivers) : mêmes destinations, l'appelant les
 * passe (la valise garde sa règle d'accès).
 */
export default function AccesAccueil({ ouvrir }: { ouvrir: Record<(typeof ACCES)[number]["cle"], () => void> }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {ACCES.map((x) => (
        <button
          key={x.cle}
          type="button"
          onClick={ouvrir[x.cle]}
          aria-label={t(x.label)}
          className="flex flex-col items-center gap-[6px] rounded-carte bg-card border border-border py-3 cursor-pointer motion-safe:transition-transform motion-safe:active:scale-[.97] active:opacity-90"
        >
          <span className="w-9 h-9 rounded-full bg-warm-bg text-terracotta flex items-center justify-center">{glypheUnivers(x.d)}</span>
          <span className="text-[11.5px] leading-[1.2] text-ink text-center font-semibold">
            {t(x.a)}
            <br />
            {t(x.b)}
          </span>
        </button>
      ))}
    </div>
  );
}
