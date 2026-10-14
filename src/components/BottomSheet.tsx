"use client";

import { useEffect, useRef } from "react";

/**
 * Feuille modale ancrée en bas de l'écran (recette 24/08/2026, écran
 * "Ajouter une pièce" repensé — premier composant de ce type dans l'app,
 * remplace les longues listes de chips toujours visibles par un contenu
 * replié, ouvert à la demande). Fond assombri cliquable pour fermer,
 * contenu scrollable si besoin, jamais plus haut que 85 % de l'écran pour
 * laisser deviner qu'il reste du contenu au-dessus. Largeur alignée sur la
 * coquille de l'app (max-w-[480px] mx-auto, même logique que le toast de
 * TenuesScreen) pour rester cohérente avec le mockup du téléphone en desktop.
 *
 * STYLE DU 14/10/2026 (brief du sélecteur d'occasions, appliqué À TOUTES les feuilles sur décision de la propriétaire) : voile plus
 * léger (.32), fond blanc cassé des cartes (--color-card), poignée sable (--color-sand-border), rayon haut du hero (24 px), titre
 * Fraunces 500 20 px, croix seule dans une cible de 44 px. Échap ferme ; le focus revient à l'élément qui a ouvert la feuille.
 */
export default function BottomSheet({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // onClose change à chaque rendu chez la plupart des appelants : lu par référence, il ne relance pas l'effet (et ne vole pas le focus).
  const fermer = useRef(onClose);
  useEffect(() => {
    fermer.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const declencheur = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") fermer.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      // Rendu au déclencheur s'il est encore dans la page (une feuille qui change d'écran l'a démonté).
      if (declencheur?.isConnected) declencheur.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-[rgba(29,26,22,.32)]" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 top-0 mx-auto max-w-[480px] flex flex-col justify-end pointer-events-none">
        <div
          className="pointer-events-auto bg-card rounded-t-hero max-h-[85vh] flex flex-col"
          style={{ boxShadow: "0 -10px 30px rgba(0,0,0,.18)" }}
        >
          <div className="flex items-center justify-center pt-[10px] flex-shrink-0">
            <span className="w-[38px] h-[4px] rounded-full" style={{ background: "var(--color-sand-border)" }} />
          </div>
          <div className="flex items-center justify-between gap-3 pl-6 pr-[14px] pt-[6px] pb-[4px] flex-shrink-0 border-b border-border">
            <span className="font-serif font-medium text-[20px] leading-[1.2] text-ink">{title}</span>
            <button
              onClick={onClose}
              aria-label="Fermer"
              className="w-[44px] h-[44px] flex-shrink-0 flex items-center justify-center text-ink cursor-pointer"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" style={{ display: "block" }}>
                <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="scrollarea overflow-y-auto px-6 pt-[16px]" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
