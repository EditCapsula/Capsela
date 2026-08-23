"use client";

import { useEffect } from "react";

/**
 * Feuille modale ancrée en bas de l'écran (recette 24/08/2026, écran
 * "Ajouter une pièce" repensé — premier composant de ce type dans l'app,
 * remplace les longues listes de chips toujours visibles par un contenu
 * replié, ouvert à la demande). Fond assombri cliquable pour fermer,
 * contenu scrollable si besoin, jamais plus haut que 85 % de l'écran pour
 * laisser deviner qu'il reste du contenu au-dessus. Largeur alignée sur la
 * coquille de l'app (max-w-[480px] mx-auto, même logique que le toast de
 * TenuesScreen) pour rester cohérente avec le mockup du téléphone en desktop.
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
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-[rgba(29,26,22,.45)]" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 top-0 mx-auto max-w-[480px] flex flex-col justify-end pointer-events-none">
        <div
          className="pointer-events-auto bg-cream rounded-t-[22px] max-h-[85vh] flex flex-col"
          style={{ boxShadow: "0 -10px 30px rgba(0,0,0,.18)" }}
        >
          <div className="flex items-center justify-center pt-[10px] flex-shrink-0">
            <span className="w-[38px] h-[4px] rounded-full" style={{ background: "#DFD3BE" }} />
          </div>
          <div className="flex items-center justify-between px-6 pt-[13px] pb-[11px] flex-shrink-0 border-b border-border">
            <span className="font-serif text-[17px] text-ink">{title}</span>
            <button
              onClick={onClose}
              aria-label="Fermer"
              className="w-[30px] h-[30px] rounded-full bg-card border border-border flex items-center justify-center text-[13px] text-ink cursor-pointer"
            >
              ✕
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
