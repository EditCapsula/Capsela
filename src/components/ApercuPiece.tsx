"use client";

import BottomSheet from "@/components/BottomSheet";
import Button from "@/components/Button";
import PhotoPiece from "@/components/PhotoPiece";
import { isCatalogId } from "@/lib/catalog";
import { CATLABEL, isBag } from "@/lib/data";
import { participePorte, participePorteMaj } from "@/lib/logic";
import { daysSinceWorn, wearCounts } from "@/lib/selectors";
import { wornAgo } from "@/lib/data";
import { useCapsela } from "@/lib/store";
import type { Item } from "@/lib/types";

/**
 * L'APERÇU D'UNE PIÈCE (14/10/2026) — ouvert en appuyant sur une pièce d'un hero (accueil, carrousel, Tenue, look planifié…) : une feuille
 * posée sur l'écran, pas une page, pour ne pas quitter la tenue. Elle dit ce que la pièce est (photo, nom, catégorie, matière, couleur), d'où
 * elle vient (« Ton dressing » ou « Suggestion » de la capsule) et, pour une pièce du dressing, combien de fois elle a été portée ; la fiche
 * complète est à un appui. Rien n'est écrit ici.
 */
export default function ApercuPiece() {
  const { state, vestiairePool, actions } = useCapsela();
  const id = state.pieceApercu;
  const piece: Item | undefined = id == null ? undefined : [...state.items, ...vestiairePool].find((p) => p.id === id);
  if (id == null || !piece) return null;

  const suggestion = isCatalogId(piece.id);
  const infos = [CATLABEL[isBag(piece) ? "sac" : piece.cat], piece.matiere, piece.color].filter(Boolean).join(" · ");
  const nb = wearCounts(state.history).get(piece.id) || 0;
  const jamais = piece.worn == null;
  const jours = jamais ? null : daysSinceWorn(state.history, piece.id);
  const port = suggestion ? null : jamais ? "Jamais " + participePorte(piece) : nb > 0 ? `${participePorteMaj(piece)} ${nb} fois` : wornAgo(jours).replace(/^Porté/, participePorteMaj(piece));

  return (
    <BottomSheet title={suggestion ? "Suggestion" : "Ton dressing"} open onClose={actions.fermerApercuPiece}>
      <div className="flex gap-4 items-start">
        <div className="flex-none" style={{ width: 120 }}>
          <PhotoPiece piece={piece} ratio={0.8} rayon={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-serif text-ink" style={{ fontSize: 20, lineHeight: 1.2 }}>{piece.name}</div>
          <div className="text-[12.5px] text-muted-3 mt-[6px]">{infos}</div>
          {port && <div className="text-[12.5px] text-ink mt-[10px]">{port}</div>}
          {suggestion && <div className="text-[12px] text-muted-3 leading-[1.45] mt-[10px]">Une pièce de ta capsule, pas encore dans ton dressing.</div>}
        </div>
      </div>
      <Button
        variante="principal"
        className="mt-5"
        onClick={() => {
          actions.fermerApercuPiece();
          actions.openItem(piece.id, suggestion);
        }}
      >
        Voir la fiche
      </Button>
    </BottomSheet>
  );
}
