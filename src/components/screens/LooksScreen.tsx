"use client";

import { useMemo, useState } from "react";
import BoutonRetour from "@/components/BoutonRetour";
import CarteLook, { ONGLETS_LOOKS } from "@/components/CarteLook";
import SegmentedControl from "@/components/SegmentedControl";
import { isWishlistLook, lookWornCount } from "@/lib/selectors";
import { useCapsela } from "@/lib/store";
import type { Item } from "@/lib/types";
import { filtrerLooks, type FiltreLooks } from "@/lib/looksFiltre";

/**
 * « MES LOOKS » — tous les looks (refonte Dressing, 25/09/2026 ; arbitrage
 * recommandé retenu : créer l'écran). Le Dressing n'en montre plus que
 * quatre ; « Voir tout → » mène ici.
 *
 * Les looks restent résolus sur `[...items, ...vestiairePool]`, jamais sur
 * `wardrobePool` (correctif du 20/08/2026, cf. WardrobeScreen).
 *
 * Le filtre « looks suggérés » (anciennement « Wishlist », atteint par le
 * module « Capsela te suggère ») n'a pas d'onglet — la barre en garde trois.
 * Il reste atteignable par la ligne « ✦ N looks suggérés par Capsela ».
 */
export default function LooksScreen() {
  const { state, actions, vestiairePool } = useCapsela();
  const [filtre, setFiltre] = useState<FiltreLooks>("all");
  const pool = useMemo(() => [...state.items, ...vestiairePool], [state.items, vestiairePool]);
  const looks = filtrerLooks(state.savedLooks, filtre);
  const nbSuggeres = state.savedLooks.filter(isWishlistLook).length;

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
      <div className="flex items-center justify-between gap-3 mt-[10px]">
        <BoutonRetour onClick={actions.goWardrobe} label="Revenir au dressing" />
        <button
          onClick={() => actions.goCreateLook()}
          className="text-[12px] text-terracotta cursor-pointer flex-shrink-0 py-[13px] -my-[13px]"
        >
          + Créer un look
        </button>
      </div>
      <div className="t-titre-ecran text-ink mt-[18px]">
        Mes <span className="italic text-terracotta">looks</span>
      </div>

      {state.savedLooks.length === 0 ? (
        <div className="text-[13px] leading-[1.55] mt-3" style={{ color: "var(--color-muted-3)" }}>
          Tes looks enregistrés et créés apparaîtront ici.
        </div>
      ) : (
        <>
          <div className="mt-5">
            <SegmentedControl
              segments={ONGLETS_LOOKS}
              actif={filtre === "wishlist" ? "all" : filtre}
              onChange={setFiltre}
              ariaLabel="Filtrer mes looks"
            />
          </div>

          {nbSuggeres > 0 && (
            <div className="flex items-baseline justify-between gap-3 mt-4 text-[12px]">
              <span className="text-terracotta">
                ✦ {nbSuggeres} {nbSuggeres === 1 ? "look suggéré" : "looks suggérés"} par Capsela
              </span>
              <button
                onClick={() => setFiltre(filtre === "wishlist" ? "all" : "wishlist")}
                className="text-terracotta flex-shrink-0 cursor-pointer py-[13px] -my-[13px]"
              >
                {filtre === "wishlist" ? "Tout afficher" : "Afficher"}
              </button>
            </div>
          )}

          {looks.length === 0 ? (
            <div className="text-[12px] text-muted leading-[1.5] mt-5">Aucun look dans cette catégorie pour l&apos;instant.</div>
          ) : (
            <div className="grid grid-cols-2 gap-x-[14px] gap-y-[24px] mt-5">
              {looks.map((look) => {
                const pieces = look.pieceIds.map((id) => pool.find((i) => i.id === id)).filter((it): it is Item => Boolean(it));
                return (
                  <CarteLook
                    key={look.id}
                    look={look}
                    pieces={pieces}
                    porte={lookWornCount(look, state.history)}
                    suggere={isWishlistLook(look)}
                    onOuvrir={() => actions.openLook(look.id)}
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
