"use client";

/**
 * UNE LIGNE QUI EST UN INTERRUPTEUR (04/11/2026) : la carte entière se touche (cible pleine largeur), le titre et sa phrase à gauche,
 * l'interrupteur à droite. Un seul dessin pour « Uniquement mon dressing », que le résultat de Planifier et celui de la valise
 * écrivaient chacun de leur côté.
 */
export default function LigneInterrupteur({
  titre,
  texte,
  actif,
  onClick,
  className = "",
}: {
  titre: string;
  texte?: string;
  actif: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={actif}
      onClick={onClick}
      className={"w-full flex gap-3 items-center bg-card border border-border rounded-carte p-[14px] cursor-pointer text-left " + className}
    >
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] font-medium text-ink">{titre}</span>
        {texte && <span className="block text-[11px] text-muted leading-[1.45] mt-[3px]">{texte}</span>}
      </span>
      <span
        aria-hidden="true"
        className="w-11 h-[26px] flex-shrink-0 rounded-full p-[3px] flex transition-colors"
        style={{ background: actif ? "var(--color-terracotta-deep)" : "var(--color-cream-dark-soft)", justifyContent: actif ? "flex-end" : "flex-start" }}
      >
        <span className="w-5 h-5 rounded-full bg-card" />
      </span>
    </button>
  );
}
