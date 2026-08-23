"use client";

import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import { CATS } from "@/lib/data";
import { resolveItemImage } from "@/lib/catalogImages";
import { useCapsela } from "@/lib/store";
import { isWishlistLook, lookWornCount, neverWornItems } from "@/lib/selectors";
import type { SavedLook } from "@/lib/types";

function TshirtIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 4L4 7.2l2.4 2.6L8 8.4V20h8V8.4l1.6 1.4 2.4-2.6L16 4l-4 1.8L8 4z" />
    </svg>
  );
}
function HangerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3.2a1.5 1.5 0 1 1 1.3 2.3L12 7" />
      <path d="M12 7l9.3 6.6a1.4 1.4 0 0 1-.9 2.5H3.6a1.4 1.4 0 0 1-.9-2.5L12 7z" />
    </svg>
  );
}
function SparkleIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l2.1 7.9L22 12l-7.9 2.1L12 22l-2.1-7.9L2 12l7.9-2.1L12 2z" />
    </svg>
  );
}
function LightbulbIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.45 1 1.15 1 1.9V16h5v-.2c0-.75.4-1.45 1-1.9A6 6 0 0 0 12 3z" />
    </svg>
  );
}

type LookFilter = "all" | "saved" | "created" | "wishlist";

export default function WardrobeScreen() {
  const { state, actions, wardrobePool } = useCapsela();
  const items = state.items;
  const neverWorn = neverWornItems(items);
  const [lookFilter, setLookFilter] = useState<LookFilter>("all");

  // Le dressing n'affiche que les pièces réelles ; les suggestions de la
  // capsule par défaut vivent exclusivement sur l'écran Capsule.
  const groups = CATS.map(([key, , plural]) => {
    return { key, label: plural.toUpperCase(), items: items.filter((i) => i.cat === key) };
  }).filter((g) => g.items.length > 0);

  const savedCount = state.savedLooks.filter((l) => l.source === "saved").length;
  const createdCount = state.savedLooks.filter((l) => l.source === "created").length;
  const wishlistCount = state.savedLooks.filter(isWishlistLook).length;
  const matchesFilter = (l: SavedLook) =>
    lookFilter === "all" ||
    (lookFilter === "saved" && l.source === "saved") ||
    (lookFilter === "created" && l.source === "created") ||
    (lookFilter === "wishlist" && isWishlistLook(l));
  const filteredLooks = state.savedLooks.filter(matchesFilter);

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-24">
      <AppHeader />

      <div className="flex items-start justify-between gap-3 mt-[18px]">
        <div>
          <div className="text-[11px] tracking-[.18em] uppercase text-muted">Ton dressing</div>
          <div className="font-serif text-[26px] leading-[1.2] text-ink mt-[6px]">Ton vestiaire, tes looks.</div>
          <div className="text-[12px] text-muted mt-[6px]">
            {groups.length} {groups.length <= 1 ? "catégorie" : "catégories"} · {items.length} {items.length <= 1 ? "pièce" : "pièces"}
          </div>
        </div>
        {/* Décalé sous le titre plutôt qu'aligné avec "TON DRESSING"
            (recette 24/08/2026, signalé : concurrençait le titre comme point
            d'entrée visuel) — le centre du cercle vient plutôt tomber vers le
            compteur "X catégories · Y pièces". */}
        <button onClick={actions.openAdd} className="flex items-center gap-[9px] flex-shrink-0 cursor-pointer text-left mt-[26px]">
          <span className="w-[42px] h-[42px] rounded-full bg-terracotta text-cream flex items-center justify-center text-2xl flex-shrink-0">
            +
          </span>
          <span className="text-[11.5px] text-ink leading-[1.25] mt-[2px]">
            Ajouter
            <br />
            une pièce
          </span>
        </button>
      </div>

      {neverWorn.length > 0 &&
        (() => {
          const rep = neverWorn[0];
          const img = resolveItemImage(rep);
          return (
            <button
              onClick={actions.goNeverWorn}
              className="mt-4 w-full flex items-center gap-[12px] bg-warm-bg border border-warm-border rounded-[16px] px-4 py-[13px] cursor-pointer text-left"
            >
              <span className="w-[32px] h-[32px] rounded-full bg-terracotta text-cream flex items-center justify-center text-[14px] flex-shrink-0">
                ↻
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-ink">
                  {neverWorn.length} {neverWorn.length === 1 ? "pièce jamais portée" : "pièces jamais portées"}
                </div>
                <div className="text-[11px] text-warm-text mt-[1px]">
                  {neverWorn.length === 1 ? "Cette pièce dort dans ton dressing." : "Ces pièces dorment dans ton dressing."}
                </div>
                <div className="text-[11.5px] text-terracotta mt-[3px]">Que faire avec ? →</div>
              </div>
              <div
                className="w-[50px] h-[60px] rounded-[10px] flex-shrink-0 overflow-hidden"
                style={img.url ? { background: "#F3EDE1" } : { background: rep.hex, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.06)" }}
              >
                {img.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img.url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" }} />
                )}
              </div>
              <span className="text-terracotta text-[16px] flex-shrink-0">›</span>
            </button>
          );
        })()}

      {items.length === 0 ? (
        <>
          <div className="mt-[26px] text-center">
            <div className="font-serif text-[22px] leading-[1.25] text-ink">
              Ton dressing est encore <span className="italic text-terracotta">vide</span>
            </div>
            <div className="text-[12.5px] text-muted leading-[1.55] mt-[9px]">
              Ajoute tes premières pièces — une photo suffit. Tes tenues se construiront à partir de ce que tu
              possèdes déjà.
            </div>
          </div>
          <button
            onClick={actions.openAdd}
            className="mt-[22px] w-full bg-ink text-cream text-center rounded-full py-4 text-[12.5px] tracking-[.1em] uppercase cursor-pointer"
          >
            Ajouter une pièce
          </button>
          <button
            onClick={actions.goCapsule}
            className="mt-[14px] w-full text-center text-[13px] text-terracotta cursor-pointer"
          >
            Découvre ta capsule ›
          </button>
        </>
      ) : (
        // "Mes pièces" (recette 23/08/2026) — vue d'ensemble compacte par
        // catégorie (photo représentative + effectif) ; le détail complet
        // par pièce vit désormais sur son propre écran ("Voir tout"), pour
        // que Mes looks garde sa mise en avant sur cette page plutôt que
        // d'être repoussé sous une longue liste de pièces.
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-[7px] text-ink">
              <TshirtIcon />
              <span className="text-[12px] tracking-[.1em] uppercase font-semibold">Mes pièces</span>
            </div>
            <button onClick={actions.goWardrobePieces} className="text-[12.5px] text-terracotta cursor-pointer">
              Voir tout ›
            </button>
          </div>
          <div className="text-[11.5px] text-muted mt-[2px] mb-3">Toutes les pièces de ton dressing.</div>
          <div className="grid grid-cols-2 gap-[9px]">
            {groups.map((g) => {
              const img = resolveItemImage(g.items[0]);
              return (
                <button
                  key={g.key}
                  onClick={actions.goWardrobePieces}
                  className="bg-card border border-border rounded-[14px] overflow-hidden text-left cursor-pointer"
                >
                  <div className="w-full" style={{ aspectRatio: "16/10", background: "#F3EDE1" }}>
                    {img.url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img.url}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" }}
                      />
                    )}
                  </div>
                  <div className="px-[12px] py-[10px]">
                    <div className="text-[12.5px] text-ink">{g.label}</div>
                    <div className="text-[10.5px] text-placeholder mt-[1px]">
                      {g.items.length} {g.items.length <= 1 ? "pièce" : "pièces"}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-6">
        <div className="flex items-center gap-[7px] text-ink">
          <HangerIcon />
          <span className="text-[12px] tracking-[.1em] uppercase font-semibold">Mes looks</span>
        </div>
        <div className="flex items-center justify-between mt-[2px] mb-3">
          <div className="text-[11.5px] text-muted">Tes looks enregistrés et créés par toi.</div>
          {state.savedLooks.length > 0 && (
            <button onClick={() => actions.goCreateLook()} className="text-[12.5px] text-terracotta cursor-pointer flex-shrink-0">
              + Créer un look
            </button>
          )}
        </div>
      </div>
      {state.savedLooks.length === 0 ? (
        <div>
          {/* Simplification CTA d'ajout (recette 20/08/2026) : un seul message explicatif, un seul bouton — plus de bloc "+ Ajouter une pièce" redondant en bas de page. */}
          <div className="text-[12.5px] text-muted leading-[1.5] mb-[12px]">
            Tes looks apparaîtront ici lorsque tu commenceras à composer tes tenues.
          </div>
          <button
            onClick={() => actions.goCreateLook()}
            className="w-full flex items-center justify-center gap-[9px] border-[1.5px] border-dashed border-[#d6c7ae] bg-card rounded-[14px] py-4 text-[13px] tracking-[.06em] text-ink cursor-pointer"
          >
            <span className="text-[17px] text-terracotta">+</span> Composer mon premier look
          </button>
        </div>
      ) : (
        <>
          <div className="scrollarea flex gap-[8px] overflow-x-auto pb-[2px] mb-4">
            {(
              [
                { key: "all", label: `Tous (${state.savedLooks.length})` },
                { key: "saved", label: `♡ Enregistrés (${savedCount})` },
                { key: "created", label: `✦ Créés par moi (${createdCount})` },
                { key: "wishlist", label: `Wishlist (${wishlistCount})` },
              ] as { key: LookFilter; label: string }[]
            ).map((f) => (
              <button
                key={f.key}
                onClick={() => setLookFilter(f.key)}
                className={
                  "flex-none rounded-full px-4 py-[9px] text-[12px] whitespace-nowrap cursor-pointer " +
                  (lookFilter === f.key ? "bg-terracotta text-cream" : "bg-card border border-border text-ink")
                }
              >
                {f.label}
              </button>
            ))}
          </div>

          {filteredLooks.length === 0 ? (
            <div className="text-[12.5px] text-muted leading-[1.5]">Aucun look dans cette catégorie pour l&apos;instant.</div>
          ) : (
            <div className="grid grid-cols-2 gap-[10px]">
              {filteredLooks.map((look) => {
                // "Enregistrer cette tenue" (recette 23/08/2026) peut mélanger
                // pièces possédées et suggestions capsule dans un même look —
                // résolution sur wardrobePool, jamais sur le seul dressing réel.
                const pieces = look.pieceIds
                  .map((id) => wardrobePool.find((i) => i.id === id))
                  .filter((it): it is NonNullable<typeof it> => Boolean(it));
                const wishlist = isWishlistLook(look);
                const worn = lookWornCount(look, state.history);
                return (
                  <button
                    key={look.id}
                    onClick={() => actions.openLook(look.id)}
                    className="bg-card border border-border rounded-[16px] overflow-hidden text-left cursor-pointer"
                  >
                    <div className="px-[11px] pt-[10px]">
                      <span className={"inline-flex items-center gap-[4px] text-[9px] tracking-[.05em] uppercase " + (wishlist ? "text-terracotta" : look.source === "saved" ? "text-terracotta" : "text-muted")}>
                        {wishlist ? (
                          <>
                            <SparkleIcon /> Suggéré (Wishlist)
                          </>
                        ) : look.source === "saved" ? (
                          "♡ Enregistré"
                        ) : (
                          <>
                            <SparkleIcon /> Créé par moi
                          </>
                        )}
                      </span>
                    </div>
                    {/* grid-cols-4 fixe (correctif 25/08/2026, signalé : cartes
                        désalignées) — avec flex-1, une seule vignette
                        occupait toute la largeur de la carte et devenait bien
                        plus haute (aspect-ratio 3/4 appliqué à une largeur
                        4x plus grande) qu'une carte à 4 pièces, faussant la
                        hauteur des cartes et donc l'alignement de la grille
                        2 colonnes. Avec 4 colonnes fixes, chaque vignette
                        garde la même taille quel que soit le nombre de
                        pièces (1 à 4) ; les cases vides au-delà de N restent
                        simplement inoccupées. */}
                    <div className="grid grid-cols-4 px-[11px] pt-[8px] gap-[3px]">
                      {pieces.slice(0, 4).map((p) => {
                        const img = resolveItemImage(p);
                        return (
                          <div
                            key={p.id}
                            className="rounded-[7px] overflow-hidden"
                            style={{ aspectRatio: "3/4", background: img.url ? "#F3EDE1" : p.hex }}
                          >
                            {img.url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={img.url}
                                alt=""
                                style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" }}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="px-[11px] py-[10px]">
                      <div className="text-[12.5px] text-ink leading-[1.25] overflow-hidden text-ellipsis whitespace-nowrap">
                        {look.name}
                      </div>
                      <div className="text-[10px] text-placeholder mt-[2px]">
                        {pieces.length} {pieces.length <= 1 ? "pièce" : "pièces"} · {worn > 0 ? `Porté ${worn} fois` : "Non porté"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {wishlistCount > 0 && (
            <button
              onClick={() => setLookFilter("wishlist")}
              className="mt-4 w-full flex items-center gap-[11px] bg-warm-bg border border-warm-border rounded-[14px] px-4 py-[13px] cursor-pointer text-left"
            >
              <span className="text-terracotta flex-shrink-0">
                <LightbulbIcon />
              </span>
              <div className="flex-1 min-w-0 text-[11.5px] text-warm-text-2 leading-[1.4]">
                {wishlistCount} {wishlistCount === 1 ? "look contient" : "looks contiennent"} des pièces que tu ne possèdes pas
                encore.
                <span className="block text-[11px] mt-[1px]">Découvre des alternatives ou ajoute-les à ton dressing.</span>
              </div>
              <span className="text-terracotta text-[16px] flex-shrink-0">›</span>
            </button>
          )}
        </>
      )}

      <button
        onClick={actions.goTenues}
        className="mt-[22px] w-full bg-terracotta text-cream text-center rounded-full py-[15px] text-[12.5px] tracking-[.1em] uppercase cursor-pointer"
      >
        Voir ma tenue du jour
      </button>
    </div>
  );
}
