"use client";

import { useEffect } from "react";
import PieceScreen from "@/components/screens/PieceScreen";
import { useCapsela } from "@/lib/store";

/**
 * LA FICHE D'UNE PIÈCE, EN FEUILLE (15/10/2026, demandé : « depuis la homepage, au clic sur une pièce, ouvrir la fiche détaillée dans
 * une feuille »). La fiche complète — l'écran PieceScreen tel quel, aucune copie — posée sur l'écran courant, qui reste dessous :
 * même voile et même arrondi haut que BottomSheet, mais presque toute la hauteur, car la fiche est une page entière. Le retour de la
 * fiche, le voile, la poignée et Échap la referment ; toute navigation vers un autre écran aussi (une action de la fiche qui ouvre
 * « Comment porter », un look…).
 */
export default function FicheEnFeuille() {
  const { state, actions } = useCapsela();
  const feuille = state.ficheEnFeuille;
  const ouverte = feuille != null && feuille.ecran === state.screen;

  // L'écran a changé sous la feuille : elle n'a plus lieu d'être.
  useEffect(() => {
    if (feuille && feuille.ecran !== state.screen) actions.fermerFicheEnFeuille();
  }, [feuille, state.screen, actions]);

  useEffect(() => {
    if (!ouverte) return;
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") actions.fermerFicheEnFeuille();
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [ouverte, actions]);

  if (!ouverte) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Fiche de la pièce">
      <div className="absolute inset-0 bg-[rgba(29,26,22,.32)]" onClick={actions.fermerFicheEnFeuille} />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[480px] bg-cream rounded-t-hero overflow-hidden motion-safe:animate-[detail-part-entree_220ms_ease-out_both]" style={{ top: "max(env(safe-area-inset-top), 24px)" }}>
        <button
          type="button"
          onClick={actions.fermerFicheEnFeuille}
          aria-label="Fermer la fiche"
          className="absolute top-0 inset-x-0 z-10 h-[18px] flex items-center justify-center cursor-pointer"
        >
          <span aria-hidden="true" className="w-[38px] h-[4px] rounded-full" style={{ background: "var(--color-sand-border)" }} />
        </button>
        <div className="absolute inset-x-0 bottom-0 top-[14px]">
          <PieceScreen onFermer={actions.fermerFicheEnFeuille} />
        </div>
      </div>
    </div>
  );
}
