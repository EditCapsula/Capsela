"use client";

import { useState } from "react";
import BottomSheet from "@/components/BottomSheet";
import { useCapsela } from "@/lib/store";
import { daysSinceWorn, wearCounts } from "@/lib/selectors";
import { wornAgo } from "@/lib/data";

/**
 * "Mes pièces" (recette 24/08/2026, mockup fourni) — grille plate 2 colonnes
 * remplaçant le regroupement par catégorie en scroll horizontal : plus
 * lisible pour parcourir tout le dressing d'un coup. "Jamais porté" reste
 * décidé par it.worn (source de vérité déjà utilisée partout ailleurs,
 * ex. PieceScreen) ; le total "Porté X fois" vient de l'historique réel
 * (wearCounts, jamais un compteur séparé désynchronisable).
 *
 * Correctif 25/08/2026 (signalé : "Aujourd'hui" affiché sur plusieurs
 * pièces manifestement pas portées le jour même) — it.worn est figé par la
 * dernière action "porter" et ne "vieillit" jamais tout seul ; le nombre de
 * jours réel vient maintenant de daysSinceWorn (dérivé de la date de la
 * plus récente entrée d'historique). Même correctif que l'ancien "Porté
 * aujourd'hui" qui restait affiché indéfiniment.
 *
 * SUPPRESSION MULTIPLE (09/09/2026, signalé : "je dois pouvoir supprimer des
 * pièces du dressing"). Retirer une pièce était déjà possible, mais seulement
 * une par une et au fond du menu d'une pièce ouverte — invisible depuis cette
 * grille, qui est pourtant l'écran où l'on fait le tri. Le mode sélection
 * s'active depuis l'en-tête ; tant qu'il est actif, toucher une carte la
 * coche au lieu de l'ouvrir, et rien n'est supprimé avant la confirmation.
 * Une suppression est définitive : c'est la seule raison pour laquelle elle
 * passe par une feuille de confirmation, comme la suppression de compte.
 *
 * "Aujourd'hui" affiché en pastille sur la photo plutôt qu'en 3e ligne de
 * légende (correctif 25/08/2026, signalé : cartes désalignées) — une
 * légende à hauteur variable (2 ou 3 lignes selon la pièce) agrandissait la
 * ligne de grille concernée, avec un risque de décalage visuel entre les
 * deux colonnes ; la légende reste maintenant toujours sur 2 lignes,
 * quelle que soit la pièce.
 */
export default function WardrobePiecesScreen() {
  const { state, actions } = useCapsela();
  const items = state.items;
  const counts = wearCounts(state.history);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const quitterSelection = () => {
    setSelectionMode(false);
    setSelection(new Set());
    setConfirmOpen(false);
  };

  const basculer = (id: number) =>
    setSelection((prec) => {
      const suivant = new Set(prec);
      if (suivant.has(id)) suivant.delete(id);
      else suivant.add(id);
      return suivant;
    });

  const supprimer = () => {
    actions.removeItems([...selection]);
    quitterSelection();
  };

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-24">
      <div className="flex items-center justify-between gap-3 mt-[10px]">
        <div className="flex items-center gap-[14px] min-w-0">
          <button
            onClick={actions.goWardrobe}
            className="w-[38px] h-[38px] rounded-full bg-card border border-border flex items-center justify-center text-[17px] text-ink cursor-pointer flex-shrink-0"
          >
            ←
          </button>
          <div className="font-serif text-[20px] text-ink truncate">Mes pièces</div>
        </div>
        {selectionMode ? (
          <button onClick={quitterSelection} className="text-[12.5px] text-muted flex-shrink-0 cursor-pointer py-[6px]">
            Annuler
          </button>
        ) : (
          <div className="flex items-center gap-[14px] flex-shrink-0">
            {items.length > 0 && (
              <button
                onClick={() => setSelectionMode(true)}
                className="text-[12.5px] text-muted cursor-pointer py-[6px]"
              >
                Sélectionner
              </button>
            )}
            <button onClick={actions.openAdd} className="flex items-center gap-[7px] cursor-pointer">
              <span className="w-[30px] h-[30px] rounded-full bg-terracotta text-cream flex items-center justify-center text-[16px] flex-shrink-0">
                +
              </span>
              <span className="text-[11.5px] text-ink">Ajouter</span>
            </button>
          </div>
        )}
      </div>

      <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-4">
        {selectionMode
          ? selection.size === 0
            ? "Touche les pièces à retirer"
            : `${selection.size} ${selection.size === 1 ? "sélectionnée" : "sélectionnées"}`
          : `${items.length} ${items.length === 1 ? "pièce" : "pièces"}`}
      </div>

      {items.length === 0 ? (
        <div className="text-[12.5px] text-muted leading-[1.5] mt-3">
          Tes pièces apparaîtront ici au fur et à mesure que tu les ajoutes à ton dressing.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-[12px] gap-y-[22px] mt-4">
          {items.map((it) => {
            const count = counts.get(it.id) || 0;
            // it.worn (jamais null si déjà porté) reste la source de vérité
            // de "jamais porté" (correctif 25/08/2026, signalé en revue :
            // wearCounts seul pouvait afficher "Jamais porté" pour une pièce
            // dont worn est renseigné mais dont l'historique n'a pas (ou
            // plus) d'entrée correspondante — ex. fetchOutfitHistory revenu
            // vide sur un aléa réseau).
            const neverWorn = it.worn == null;
            const days = neverWorn ? null : daysSinceWorn(state.history, it.id);
            const isToday = days === 0;
            const selected = selection.has(it.id);
            return (
              <button
                key={it.id}
                onClick={() => (selectionMode ? basculer(it.id) : actions.openItem(it.id, false))}
                aria-pressed={selectionMode ? selected : undefined}
                className="text-left cursor-pointer"
              >
                <div
                  className="relative w-full rounded-[14px] border border-border overflow-hidden"
                  style={
                    it.photoUrl
                      ? { aspectRatio: "4/5", backgroundImage: `url(${it.photoUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
                      : { aspectRatio: "4/5", background: it.hex, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.06)" }
                  }
                >
                  {selectionMode && (
                    <span
                      className="absolute top-[8px] left-[8px] w-[22px] h-[22px] rounded-full border flex items-center justify-center text-[12px]"
                      style={
                        selected
                          ? { background: "rgba(166,105,80,.95)", borderColor: "rgba(166,105,80,.95)", color: "#F3EEE5" }
                          : { background: "rgba(243,238,229,.85)", borderColor: "rgba(29,26,22,.18)", color: "transparent" }
                      }
                    >
                      ✓
                    </span>
                  )}
                  {isToday && !selectionMode && (
                    <span
                      className="absolute top-[8px] right-[8px] text-[9.5px] tracking-[.04em] text-cream rounded-full px-[8px] py-[3px]"
                      style={{ background: "rgba(166,105,80,.92)" }}
                    >
                      Aujourd&apos;hui
                    </span>
                  )}
                </div>
                <div
                  className="text-[13px] text-ink mt-[8px] leading-[1.25] overflow-hidden text-ellipsis whitespace-nowrap"
                  style={selectionMode && !selected ? { opacity: 0.45 } : undefined}
                >
                  {it.name}
                </div>
                <div className="text-[11px] text-placeholder mt-[2px]">
                  {neverWorn ? "Jamais porté" : count > 0 ? `Porté ${count} fois` : wornAgo(days)}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selectionMode && selection.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[480px] px-6 pb-[18px] pt-[14px] bg-gradient-to-t from-cream via-cream to-transparent">
          <button
            onClick={() => setConfirmOpen(true)}
            className="w-full text-center rounded-full py-[14px] text-[12.5px] tracking-[.1em] uppercase bg-rust text-cream cursor-pointer"
          >
            Retirer {selection.size} {selection.size === 1 ? "pièce" : "pièces"}
          </button>
        </div>
      )}

      <BottomSheet
        title={selection.size === 1 ? "Retirer cette pièce" : `Retirer ${selection.size} pièces`}
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
      >
        <div className="text-[13px] text-ink leading-[1.55]">
          {selection.size === 1 ? "Cette pièce quittera" : "Ces pièces quitteront"} ton dressing et{" "}
          {selection.size === 1 ? "ne sera plus proposée" : "ne seront plus proposées"} dans tes tenues. Ton historique
          reste intact. <span className="text-rust">Cette action est définitive.</span>
        </div>
        <button
          onClick={supprimer}
          className="mt-[22px] w-full text-center rounded-full py-[14px] text-[12.5px] tracking-[.1em] uppercase bg-rust text-cream cursor-pointer"
        >
          Retirer définitivement
        </button>
        <button
          onClick={() => setConfirmOpen(false)}
          className="mt-[10px] w-full text-center text-[13px] text-muted py-[10px] cursor-pointer"
        >
          Annuler
        </button>
      </BottomSheet>
    </div>
  );
}
