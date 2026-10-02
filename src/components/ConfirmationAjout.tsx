"use client";

import { useCapsela } from "@/lib/store";

/**
 * « Pièce ajoutée à ton dressing » (27/09/2026, refonte « Ajouter une
 * pièce »). Jusque-là, l'ajout renvoyait à l'écran d'origine sans un mot :
 * la pièce apparaissait (ou non) dans la liste, à chacune de le vérifier.
 *
 * Posé par saveItem une fois l'ajout RÉUSSI — après la réponse de Supabase,
 * pas au clic : un échec d'insertion garde son propre bandeau d'erreur et ne
 * doit pas être précédé d'une confirmation. Même forme que le toast de la
 * tenue du jour (pilule encre, TenuesScreen), au-dessus de la barre du bas
 * quand elle est là, au-dessus du bouton de pied d'écran sinon. Disparaît
 * seul (délai porté par le store, cf. annoncerPieceAjoutee) ; « Voir mon
 * dressing » n'apparaît que si l'on n'y est pas déjà.
 */
export default function ConfirmationAjout({ auDessusDeLaBarre }: { auDessusDeLaBarre: boolean }) {
  const { state, actions } = useCapsela();
  const { fermerPieceAjoutee } = actions;

  if (!state.pieceAjoutee) return null;
  const dejaAuDressing = state.screen === "wardrobe" || state.screen === "wardrobePieces";

  return (
    <div
      className="fixed inset-x-0 mx-auto max-w-[480px] px-6 z-30"
      style={{
        bottom: auDessusDeLaBarre
          ? "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 14px)"
          : "calc(env(safe-area-inset-bottom) + 92px)",
      }}
      role="status"
    >
      {/* Le texte passe à la ligne plutôt que d'être coupé : à côté de « Voir
          mon dressing », il ne tient pas sur une ligne dès 360 px. */}
      <div className="flex items-center gap-3 bg-ink rounded-feuille py-[10px] pl-4 pr-[6px] shadow-lg">
        <span className="flex-1 min-w-0 text-[12px] text-cream leading-[1.35]">
          <span aria-hidden="true">✓ </span>Pièce ajoutée à ton dressing
        </span>
        {dejaAuDressing ? (
          <button
            onClick={fermerPieceAjoutee}
            aria-label="Fermer"
            className="flex-shrink-0 text-[12px] text-cream/70 cursor-pointer py-[7px] px-[11px]"
          >
            ✕
          </button>
        ) : (
          <button
            onClick={() => {
              fermerPieceAjoutee();
              actions.goWardrobe();
            }}
            className="flex-shrink-0 whitespace-nowrap text-[12px] text-terracotta cursor-pointer py-[7px] px-[11px]"
          >
            Voir mon dressing
          </button>
        )}
      </div>
    </div>
  );
}
