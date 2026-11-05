"use client";

import type { CritereSelection } from "@/lib/capsuleOnglets";
import { accrocheSelection } from "@/lib/capsuleOnglets";

/**
 * « UNE SÉLECTION PENSÉE POUR TOI » (05/11/2026, brief « Évolution UX/UI – Onglet Composer ») : le bloc éditorial sous la planche de
 * Composer, qui remplace « Pourquoi cette tenue ? » (Composer présente une sélection de pièces de saison, pas une tenue complète).
 * Discret — un trait, pas d'aplat — pour ne pas concurrencer la planche ; il ouvre le panneau des critères (`DetailSelection`, rendu
 * dans la feuille de l'écran). Les critères viennent de `criteresDeSelection` (capsuleOnglets.ts) : rien n'est calculé ici.
 */
export default function SelectionPenseePourToi({ criteres, onOuvrir }: { criteres: readonly CritereSelection[]; onOuvrir: () => void }) {
  const accroche = accrocheSelection(criteres);
  if (!criteres.length) return null;
  return (
    <button
      type="button"
      onClick={onOuvrir}
      aria-haspopup="dialog"
      className="mt-[14px] w-full flex items-center gap-[12px] rounded-bloc border border-border px-4 py-[13px] text-left cursor-pointer motion-safe:transition-colors hover:bg-card"
    >
      <span className="flex-1 min-w-0">
        <span className="block t-titre-ligne text-ink">Une sélection pensée pour toi</span>
        {accroche && <span className="block text-[12px] text-muted leading-[1.45] mt-[3px]">{accroche}</span>}
      </span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-muted flex-shrink-0">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  );
}

/** Le contenu du panneau : un critère par bloc, titre, valeur et ce qu'il change à la sélection. */
export function DetailSelection({ criteres }: { criteres: readonly CritereSelection[] }) {
  return (
    <div className="flex flex-col">
      {criteres.map((c, i) => (
        <section key={c.cle} className={i > 0 ? "border-t border-border pt-[14px] mt-[14px]" : ""}>
          <h3 className="t-titre-ligne text-ink">{c.titre}</h3>
          <div className="text-[13px] text-terracotta-deep font-medium mt-[3px]">{c.valeur}</div>
          <p className="text-[12.5px] text-muted-3 leading-[1.5] mt-[5px]" style={{ textWrap: "pretty" }}>
            {c.texte}
          </p>
        </section>
      ))}
    </div>
  );
}
