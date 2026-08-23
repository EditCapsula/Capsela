"use client";

import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import { resolveItemImage } from "@/lib/catalogImages";
import { useCapsela } from "@/lib/store";
import {
  dailyActivity,
  journalEntries,
  journalInsights,
  journalStats,
  mostWornPieces,
  neverWornInPool,
  newLooksThisMonth,
  type JournalPeriod,
} from "@/lib/selectors";

const PERIOD_BUCKETS: { key: JournalPeriod; label: string }[] = [
  { key: "today", label: "Aujourd'hui" },
  { key: "yesterday", label: "Hier" },
  { key: "week", label: "Cette semaine" },
  { key: "earlier", label: "Plus tôt" },
];

const HISTORY_PAGE_SIZE = 5;

function SparkleIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2l2.1 7.9L22 12l-7.9 2.1L12 22l-2.1-7.9L2 12l7.9-2.1L12 2z" />
    </svg>
  );
}

function CalendarIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.2" />
      <path d="M3.5 9.5h17M8 3v3.6M16 3v3.6" />
    </svg>
  );
}

function HangerIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3.2a1.5 1.5 0 1 1 1.3 2.3L12 7" />
      <path d="M12 7l9.3 6.6a1.4 1.4 0 0 1-.9 2.5H3.6a1.4 1.4 0 0 1-.9-2.5L12 7z" />
    </svg>
  );
}

function InfoIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11.2v5.3M12 7.8v.01" />
    </svg>
  );
}

function StarIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2.5l2.7 6.6 7.1.6-5.4 4.7 1.6 6.9L12 17.4l-6 3.9 1.6-6.9-5.4-4.7 7.1-.6L12 2.5z" />
    </svg>
  );
}

function TShirtIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 4L4 7.2l2.4 2.6L8 8.4V20h8V8.4l1.6 1.4 2.4-2.6L16 4l-4 1.8L8 4z" />
    </svg>
  );
}

function Donut({ pct, size = 52 }: { pct: number; size?: number }) {
  const stroke = 5.5;
  const r = size / 2 - stroke / 2;
  const c = 2 * Math.PI * r;
  const filled = (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EFE7DA" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#A66950"
        strokeWidth={stroke}
        strokeDasharray={`${filled} ${c - filled}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.27} fill="#1D1A16" fontWeight={600}>
        {pct}%
      </text>
    </svg>
  );
}

function Sparkline({ values, width = 104, height = 32 }: { values: number[]; width?: number; height?: number }) {
  const max = Math.max(1, ...values);
  const stepX = width / Math.max(1, values.length - 1);
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - (v / max) * (height - 6) - 3;
    return [x, y];
  });
  const path = "M" + points.map(([x, y]) => `${x},${y}`).join(" L");
  const [lx, ly] = points[points.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" className="flex-shrink-0">
      <path d={path} stroke="#A66950" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="2.6" fill="#A66950" />
    </svg>
  );
}

const RANK_BADGE = ["bg-terracotta", "bg-ink", "bg-gold"];

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
  const topWorn = mostWornPieces(state.history, resolvePool, 3);
  const toRediscover = neverWornInPool(wardrobePool, state.history).slice(0, 6);
  const newLooks = newLooksThisMonth(state.savedLooks);
  const activity = dailyActivity(state.history, 10);
  const countText = entries.length + (entries.length <= 1 ? " tenue portée" : " tenues portées");

  const [historyExpanded, setHistoryExpanded] = useState(false);
  const visibleEntries = historyExpanded ? entries : entries.slice(0, HISTORY_PAGE_SIZE);
  const hasMoreHistory = entries.length > HISTORY_PAGE_SIZE;

  const bannerText = !stats.hasItems
    ? ""
    : stats.pctWorn >= 100
      ? "Bravo ! Tu utilises pleinement ta capsule. Continue comme ça, chaque pièce compte."
      : stats.pctWorn >= 50
        ? `Tu es sur la bonne voie : ${stats.pctWorn}% de ta capsule déjà portée.`
        : `${stats.pctWorn}% de ta capsule déjà portée — encore ${stats.never} pièce${stats.never <= 1 ? "" : "s"} à découvrir.`;

  const hasMonthlyInsights = insights.topOccasionShare != null || stats.never > 0 || newLooks > 0 || topWorn.length > 0;

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-24">
      <AppHeader />

      <div className="mt-[18px] text-[11px] tracking-[.18em] uppercase text-muted">{countText}</div>
      <div className="font-serif text-[28px] text-ink mt-[6px]">Ton journal</div>

      {/* Rotation réelle du dressing (recette 23/08/2026) : quatre repères
          d'un coup d'œil — le "% déjà porté" reste visible mais partage la
          vedette avec l'activité récente, jamais seul en hero. */}
      {stats.hasItems && (
        <>
          <div className="grid grid-cols-4 gap-[7px] mt-5">
            <div className="bg-ink rounded-[16px] p-[11px] flex flex-col justify-between min-h-[92px]">
              <SparkleIcon className="text-[#D9CBB6]" />
              <div>
                <div className="font-serif text-[21px] leading-[.9] text-cream">{stats.pctWorn}%</div>
                <div className="text-[9px] text-[#B3AA9B] mt-[4px] leading-[1.25]">déjà porté</div>
              </div>
            </div>
            <div className="bg-card border border-border rounded-[16px] p-[11px] flex flex-col justify-between min-h-[92px]">
              <CalendarIcon className="text-terracotta" />
              <div>
                <div className="font-serif text-[21px] leading-[.9] text-ink">{stats.wornThisWeek}</div>
                <div className="text-[9px] text-muted mt-[4px] leading-[1.25]">cette semaine</div>
              </div>
            </div>
            <div className="bg-card border border-border rounded-[16px] p-[11px] flex flex-col justify-between min-h-[92px]">
              <CalendarIcon className="text-terracotta" />
              <div>
                <div className="font-serif text-[21px] leading-[.9] text-ink">{insights.wornThisMonth}</div>
                <div className="text-[9px] text-muted mt-[4px] leading-[1.25]">ce mois-ci</div>
              </div>
            </div>
            <div className="bg-card border border-border rounded-[16px] p-[11px] flex flex-col justify-between min-h-[92px]">
              <HangerIcon className="text-terracotta" />
              <div>
                <div className="font-serif text-[21px] leading-[.9] text-ink">{insights.distinctPiecesWornThisMonth}</div>
                <div className="text-[9px] text-muted mt-[4px] leading-[1.25]">pièces ce mois-ci</div>
              </div>
            </div>
          </div>

          {bannerText && (
            <div className="mt-3 bg-warm-bg border border-warm-border rounded-2xl px-4 py-[13px] flex items-center justify-between gap-3">
              <div className="text-[12px] text-warm-text-2 leading-[1.45]">{bannerText}</div>
              <Sparkline values={activity} />
            </div>
          )}

          <button
            onClick={actions.goNeverWorn}
            className="mt-[10px] w-full text-center text-[12.5px] text-terracotta cursor-pointer"
          >
            Voir les pièces jamais portées ›
          </button>
        </>
      )}

      {/* Ce que Capsela apprend de toi (recette 23/08/2026) — remplace le
          simple récapitulatif de chiffres par des constats concrets, chacun
          dérivé de l'historique réel, jamais d'une valeur inventée. */}
      {hasMonthlyInsights && (
        <div className="mt-[26px]">
          <div className="flex items-center gap-[6px] mb-3">
            <div className="text-[11px] tracking-[.16em] uppercase text-muted">Tes insights du mois</div>
            <InfoIcon className="text-placeholder" />
          </div>
          <div className="scrollarea flex gap-[9px] overflow-x-auto pb-[2px]">
            {insights.topOccasionShare != null && insights.topOccasionShort && (
              <div className="flex-none w-[132px] bg-card border border-border rounded-[16px] p-[13px] flex flex-col gap-[9px]">
                <Donut pct={insights.topOccasionShare} />
                <div>
                  <div className="text-[12px] text-ink leading-[1.3]">de looks {insights.topOccasionShort}</div>
                  <div className="text-[10px] text-muted mt-[2px]">Ton style du mois</div>
                </div>
              </div>
            )}
            {stats.never > 0 && (
              <div className="flex-none w-[132px] bg-card border border-border rounded-[16px] p-[13px] flex flex-col justify-between gap-[9px]">
                <HangerIcon className="text-terracotta" />
                <div>
                  <div className="font-serif text-[22px] leading-[.9] text-ink">{stats.never}</div>
                  <div className="text-[10px] text-muted mt-[4px] leading-[1.3]">
                    pièce{stats.never <= 1 ? "" : "s"} pas encore portée{stats.never <= 1 ? "" : "s"}
                  </div>
                </div>
                <button onClick={actions.goNeverWorn} className="text-[10.5px] text-terracotta text-left cursor-pointer">
                  Les redécouvrir →
                </button>
              </div>
            )}
            {newLooks > 0 && (
              <div className="flex-none w-[132px] bg-card border border-border rounded-[16px] p-[13px] flex flex-col justify-between gap-[9px]">
                <StarIcon className="text-terracotta" />
                <div>
                  <div className="font-serif text-[22px] leading-[.9] text-ink">{newLooks}</div>
                  <div className="text-[10px] text-muted mt-[4px] leading-[1.3]">
                    nouveau{newLooks <= 1 ? "" : "x"} look{newLooks <= 1 ? "" : "s"} créé{newLooks <= 1 ? "" : "s"}
                  </div>
                </div>
                <div className="text-[10.5px] text-terracotta">Bravo !</div>
              </div>
            )}
            {topWorn.length > 0 && (
              <div className="flex-none w-[132px] bg-card border border-border rounded-[16px] p-[13px] flex flex-col justify-between gap-[9px]">
                <TShirtIcon className="text-terracotta" />
                <div>
                  <div className="font-serif text-[22px] leading-[.9] text-ink">{topWorn[0].count}</div>
                  <div className="text-[10px] text-muted mt-[4px] leading-[1.3]">fois portée</div>
                </div>
                <div className="text-[10.5px] text-terracotta leading-[1.25]">Ta pièce la plus polyvalente</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top 3 des pièces les plus portées (recette 23/08/2026). */}
      {topWorn.length > 0 && (
        <div className="mt-[26px]">
          <div className="text-[11px] tracking-[.16em] uppercase text-muted mb-3">Tes 3 pièces les plus portées</div>
          <div className="scrollarea flex gap-[12px] overflow-x-auto pb-[2px]">
            {topWorn.map(({ item, count }, idx) => {
              const img = resolveItemImage(item);
              return (
                <button
                  key={item.id}
                  onClick={() => actions.openItemOutfits(item.id)}
                  className="flex-none w-[86px] text-left cursor-pointer"
                >
                  <div className="relative">
                    <span
                      className={`absolute -top-[6px] -left-[6px] z-10 w-[19px] h-[19px] rounded-full flex items-center justify-center text-[10px] text-cream ${RANK_BADGE[idx]}`}
                    >
                      {idx + 1}
                    </span>
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
                  </div>
                  <div className="text-[11px] text-ink mt-[6px] leading-[1.25] line-clamp-2">
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

      {/* À redécouvrir (recette 20/08/2026) — boucle Journal → pièce sous-utilisée → "Voir des idées de tenues". */}
      {toRediscover.length > 0 && (
        <div className="mt-[26px] bg-card border border-border rounded-[16px] px-4 py-[15px]">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] tracking-[.16em] uppercase text-terracotta">À redécouvrir</div>
            <button onClick={actions.goNeverWorn} className="text-[11px] text-terracotta cursor-pointer">
              Voir tout ›
            </button>
          </div>
          <div className="text-[12.5px] text-[#3F3B34] leading-[1.45] mb-[12px]">
            {toRediscover.length} pièce{toRediscover.length <= 1 ? "" : "s"} de ta capsule n&apos;{toRediscover.length <= 1 ? "a" : "ont"}{" "}
            pas encore été portée{toRediscover.length <= 1 ? "" : "s"}.
          </div>
          <div className="scrollarea flex gap-[10px] overflow-x-auto pb-[2px]">
            {toRediscover.map((item) => {
              const img = resolveItemImage(item);
              return (
                <button
                  key={item.id}
                  onClick={() => actions.openItemOutfits(item.id)}
                  className="flex-none w-[86px] text-left cursor-pointer"
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
                  <div className="text-[11px] text-ink mt-[6px] leading-[1.25] line-clamp-2">
                    {item.name}
                  </div>
                  <div className="text-[10px] text-terracotta mt-[1px] leading-[1.25]">Voir des idées de tenues ›</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {entries.length > 0 ? (
        <div className="mt-[26px]">
          <div className="text-[11px] tracking-[.16em] uppercase text-muted mb-3">Tes dernières tenues</div>
          {PERIOD_BUCKETS.map(({ key, label }) => {
            const group = visibleEntries.filter((e) => e.period === key);
            if (group.length === 0) return null;
            const showRel = key !== "today" && key !== "yesterday";
            return (
              <div key={key} className="mb-[22px] last:mb-0">
                <div className="text-[11px] tracking-[.16em] uppercase text-muted mb-3">{label}</div>
                <div className="flex flex-col gap-[11px]">
                  {group.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => actions.viewItemOutfit(h.pieceIds, h.occasion)}
                      className="bg-card border border-border rounded-2xl px-[15px] py-[14px] text-left cursor-pointer w-full"
                    >
                      <div className="flex items-center justify-between gap-2">
                        {showRel ? <span className="text-[13px] text-ink">{h.rel}</span> : <span />}
                        <div className="flex items-center gap-[8px]">
                          {h.hasOccasion && (
                            <span className="text-[10px] tracking-[.08em] uppercase text-terracotta bg-[#F0E5D6] rounded-full py-1 px-[10px]">
                              {h.occLabel}
                            </span>
                          )}
                          <span className="text-muted text-[13px]">›</span>
                        </div>
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
              </div>
            );
          })}
          {hasMoreHistory && (
            <button
              onClick={() => setHistoryExpanded((v) => !v)}
              className="w-full text-center text-[12.5px] text-terracotta cursor-pointer py-2"
            >
              {historyExpanded ? "Voir moins ⌃" : "Voir plus d'historique ⌄"}
            </button>
          )}
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
