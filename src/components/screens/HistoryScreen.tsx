"use client";

import AppHeader from "@/components/AppHeader";
import { resolveItemImage } from "@/lib/catalogImages";
import { useCapsela } from "@/lib/store";
import { journalEntries, journalInsights, journalStats, mostWornPieces, neverWornInPool } from "@/lib/selectors";

export default function HistoryScreen() {
  const { state, wardrobePool, vestiairePool, actions } = useCapsela();
  // Pool de résolution stable (correctif 20/08/2026) : wardrobePool bascule
  // dynamiquement vers les pièces réelles dès qu'il y en a dans une
  // catégorie, ce qui peut faire disparaître d'anciennes suggestions
  // catalogue pourtant bien présentes dans l'historique — d'où les
  // placeholders beige constatés. state.items + vestiairePool couvre
  // toujours l'intégralité des pièces possibles, réelles ou suggérées.
  const resolvePool = [...state.items, ...vestiairePool];

  const stats = journalStats(state.items, state.history);
  const insights = journalInsights(state.history);
  const entries = journalEntries(state.history, resolvePool);
  const topWorn = mostWornPieces(state.history, resolvePool, 5);
  const toRediscover = neverWornInPool(wardrobePool, state.history).slice(0, 6);
  const countText = entries.length + (entries.length <= 1 ? " tenue portée" : " tenues portées");

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-24">
      <AppHeader />

      <div className="mt-[18px] text-[11px] tracking-[.18em] uppercase text-muted">{countText}</div>
      <div className="font-serif text-[28px] text-ink mt-[6px]">Ton journal</div>

      {stats.hasItems && (
        <>
          <div className="flex gap-[10px] mt-5">
            <div className="flex-1 bg-ink rounded-[20px] p-[18px]">
              <div className="font-serif text-[32px] leading-[.85] text-cream">{stats.pctWorn}%</div>
              <div className="text-[11px] text-[#B3AA9B] mt-2 leading-[1.4]">du dressing déjà porté</div>
            </div>
            <div className="flex-1 bg-card border border-border rounded-[20px] p-[18px]">
              <div className="font-serif text-[32px] leading-[.85] text-terracotta">{stats.wornThisWeek}</div>
              <div className="text-[11px] text-muted mt-2 leading-[1.4]">
                tenue{stats.wornThisWeek <= 1 ? "" : "s"} portée{stats.wornThisWeek <= 1 ? "" : "s"} cette semaine
              </div>
            </div>
          </div>
          <div className="h-[7px] bg-[#EFE7DA] rounded-full overflow-hidden mt-3">
            <div className="h-full bg-terracotta rounded-full" style={{ width: stats.pctWorn + "%" }} />
          </div>
          <div className="text-[11.5px] text-muted mt-[10px] leading-[1.5]">
            {stats.worn} portées · {stats.never} pas encore — sur {stats.total} pièces.
          </div>
          <button
            onClick={actions.goNeverWorn}
            className="mt-[10px] w-full text-center text-[12.5px] text-terracotta cursor-pointer"
          >
            Voir les pièces jamais portées ›
          </button>
        </>
      )}

      {/* "Ton dressing en chiffres" (recette 20/08/2026) — insights présentés comme des constats personnels, jamais un score technique. */}
      {(insights.wornThisMonth > 0 || insights.distinctPiecesWorn > 0) && (
        <div className="mt-[26px]">
          <div className="text-[11px] tracking-[.16em] uppercase text-muted mb-3">Ton dressing en chiffres</div>
          <div className="grid grid-cols-2 gap-[10px]">
            {insights.wornThisMonth > 0 && (
              <div className="bg-card border border-border rounded-[16px] p-[15px]">
                <div className="font-serif text-[24px] leading-[.9] text-ink">{insights.wornThisMonth}</div>
                <div className="text-[11px] text-muted mt-[6px] leading-[1.4]">
                  tenue{insights.wornThisMonth <= 1 ? "" : "s"} portée{insights.wornThisMonth <= 1 ? "" : "s"} ce mois-ci
                </div>
              </div>
            )}
            {insights.distinctPiecesWorn > 0 && (
              <div className="bg-card border border-border rounded-[16px] p-[15px]">
                <div className="font-serif text-[24px] leading-[.9] text-ink">{insights.distinctPiecesWorn}</div>
                <div className="text-[11px] text-muted mt-[6px] leading-[1.4]">
                  pièce{insights.distinctPiecesWorn <= 1 ? "" : "s"} différente{insights.distinctPiecesWorn <= 1 ? "" : "s"} portée
                  {insights.distinctPiecesWorn <= 1 ? "" : "s"}
                </div>
              </div>
            )}
            {insights.topOccasionLabel && (
              <div className="bg-card border border-border rounded-[16px] p-[15px] col-span-2">
                <div className="font-serif text-[18px] leading-[1.2] text-ink">{insights.topOccasionLabel}</div>
                <div className="text-[11px] text-muted mt-[4px]">Ton occasion la plus fréquente</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pièces les plus portées (recette 20/08/2026). */}
      {topWorn.length > 0 && (
        <div className="mt-[26px]">
          <div className="text-[11px] tracking-[.16em] uppercase text-muted mb-3">Tes pièces les plus portées</div>
          <div className="scrollarea flex gap-[10px] overflow-x-auto pb-[2px]">
            {topWorn.map(({ item, count }) => {
              const img = resolveItemImage(item);
              return (
                <button
                  key={item.id}
                  onClick={() => actions.openItemOutfits(item.id)}
                  className="flex-none w-[86px] text-left cursor-pointer"
                >
                  <div
                    className="w-full rounded-[10px] overflow-hidden"
                    style={
                      img.url
                        ? { aspectRatio: "4/5", background: "#F3EDE1", padding: 6 }
                        : { aspectRatio: "4/5", background: item.hex, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.06)" }
                    }
                  >
                    {img.url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img.url}
                        alt={item.name}
                        style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" }}
                      />
                    )}
                  </div>
                  <div className="text-[11px] text-ink mt-[6px] leading-[1.25] overflow-hidden text-ellipsis whitespace-nowrap">
                    {item.name}
                  </div>
                  <div className="text-[10px] text-terracotta mt-[1px]">
                    {count} fois
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* À redécouvrir (recette 20/08/2026) — boucle Journal → pièce sous-utilisée → "Comment porter cette pièce ?". */}
      {toRediscover.length > 0 && (
        <div className="mt-[26px] bg-card border border-border rounded-[16px] px-4 py-[15px]">
          <div className="text-[11px] tracking-[.16em] uppercase text-terracotta mb-2">À redécouvrir</div>
          <div className="text-[12.5px] text-[#3F3B34] leading-[1.45] mb-[12px]">
            {toRediscover.length} pièce{toRediscover.length <= 1 ? "" : "s"} de ta capsule n&apos;{toRediscover.length <= 1 ? "a" : "ont"}{" "}
            pas encore été portée{toRediscover.length <= 1 ? "" : "s"}.
          </div>
          <div className="scrollarea flex gap-[9px] overflow-x-auto pb-[2px]">
            {toRediscover.map((item) => {
              const img = resolveItemImage(item);
              return (
                <button
                  key={item.id}
                  onClick={() => actions.openItemOutfits(item.id)}
                  className="flex-none w-[68px] text-left cursor-pointer"
                >
                  <div
                    className="w-full rounded-[9px] overflow-hidden"
                    style={
                      img.url
                        ? { aspectRatio: "4/5", background: "#F3EDE1", padding: 5 }
                        : { aspectRatio: "4/5", background: item.hex, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.06)" }
                    }
                  >
                    {img.url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img.url}
                        alt={item.name}
                        style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" }}
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {entries.length > 0 ? (
        <div className="flex flex-col gap-[11px] mt-[22px]">
          {entries.map((h) => (
            <button
              key={h.id}
              onClick={() => actions.viewItemOutfit(h.pieceIds, h.occasion)}
              className="bg-card border border-border rounded-2xl px-[15px] py-[14px] text-left cursor-pointer w-full"
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-ink">{h.rel}</span>
                {h.hasOccasion && (
                  <span className="text-[10px] tracking-[.08em] uppercase text-terracotta bg-[#F0E5D6] rounded-full py-1 px-[10px]">
                    {h.occLabel}
                  </span>
                )}
              </div>
              <div className="flex gap-[7px] mt-[11px]">
                {h.swatches.map((p) => {
                  const img = resolveItemImage(p);
                  return (
                    <div
                      key={p.id}
                      className="w-[34px] h-[42px] rounded-md flex-shrink-0 overflow-hidden"
                      style={
                        img.url
                          ? { background: "#F3EDE1", padding: 3 }
                          : { background: p.hex, boxShadow: "inset 0 0 0 1px rgba(30,26,22,.06)" }
                      }
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
              <div className="text-[11px] text-muted mt-[9px] leading-[1.4]">{h.summary}</div>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-[34px] flex flex-col items-center text-center px-4 py-9">
          <span className="w-14 h-14 rounded-full bg-[#F0E5D6] text-terracotta flex items-center justify-center text-[24px] mb-4">
            ✦
          </span>
          <div className="font-serif text-[19px] leading-[1.3] text-ink">Rien à raconter pour l&apos;instant</div>
          <div className="text-[13px] text-muted mt-2 leading-[1.5] max-w-[250px]">
            Porte une tenue pour commencer ton journal.
          </div>
          <button
            onClick={actions.goTenues}
            className="mt-5 bg-ink text-cream rounded-full py-[15px] px-[26px] text-[12.5px] tracking-[.1em] uppercase cursor-pointer"
          >
            Choisir ma tenue du jour
          </button>
        </div>
      )}
    </div>
  );
}
