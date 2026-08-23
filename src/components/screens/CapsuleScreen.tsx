"use client";

import { useMemo, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { CATS } from "@/lib/data";
import { CAPSULE_SEASONS, computeDefaultCapsule, currentSeasonKey, type CapsuleSeason } from "@/lib/capsule";
import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";
import { resolveItemImage } from "@/lib/catalogImages";

export default function CapsuleScreen() {
  const { state, weather, actions, vestiairePool } = useCapsela();
  const { profile } = useAuth();

  const capsuleSeason: CapsuleSeason = state.capsuleSeason || currentSeasonKey();
  const capsule = useMemo(
    () => computeDefaultCapsule(profile, weather, state.suggestedExcluded, capsuleSeason, vestiairePool),
    [profile, weather, state.suggestedExcluded, capsuleSeason, vestiairePool]
  );

  // Affichage seul ici (pas de déclenchement) : la capsule liste 15-30
  // pièces d'un coup, donc y déclencher la génération pour toutes en même
  // temps équivaudrait à une génération en masse, explicitement exclue tant
  // que le système n'est pas validé. Le déclenchement à la demande, pièce
  // par pièce, se fait uniquement à l'ouverture de la fiche détail
  // (PieceScreen) — cohérent avec "chaque article est cliquable".

  const count = (cat: string) => capsule.filter((i) => i.cat === cat).length;
  const tops = count("haut");
  const bottoms = count("pantalon") + count("jean") + count("jupe") + count("short");
  const dresses = count("robe") + count("combinaison");
  const shoes = Math.max(1, count("chaussures"));
  const looksCount = (tops * bottoms + dresses) * shoes;

  const groups = CATS.map(([key, , plural]) => ({
    key,
    label: plural.toUpperCase(),
    items: capsule.filter((i) => i.cat === key),
  })).filter((g) => g.items.length > 0);

  const [catFilter, setCatFilter] = useState<string>("all");
  const visibleGroups = catFilter === "all" ? groups : groups.filter((g) => g.key === catFilter);

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-24">
      <AppHeader />

      <div className="flex items-start gap-[14px] mt-[18px]">
        <button
          onClick={actions.goWardrobe}
          className="w-[38px] h-[38px] rounded-full bg-card border border-border flex items-center justify-center text-[17px] text-ink cursor-pointer flex-shrink-0"
        >
          ←
        </button>
        <div>
          <div className="text-[11px] tracking-[.18em] uppercase text-muted">Proposée pour toi</div>
          <div className="font-serif text-[24px] text-ink mt-[6px]">Ta capsule</div>
          <div className="text-[12px] text-muted leading-[1.5] mt-[6px]">
            Composée à partir de ton profil et de ta palette personnelle. Elle s&apos;ajustera automatiquement au fur et à mesure que tu ajouteras tes propres pièces.
          </div>
        </div>
      </div>

      <div className="scrollarea flex gap-2 overflow-x-auto pb-[2px] mt-[18px]">
        {CAPSULE_SEASONS.map((s) => {
          const on = capsuleSeason === s;
          return (
            <button
              key={s}
              onClick={() => actions.setCapsuleSeason(s)}
              className="flex-none py-[9px] px-4 rounded-full text-[12.5px] cursor-pointer border whitespace-nowrap"
              style={{ background: on ? "#1D1A16" : "#FBF8F3", borderColor: on ? "#1D1A16" : "#E6DCCB", color: on ? "#F3EEE5" : "#1D1A16" }}
            >
              {s}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <div className="font-serif text-[22px] text-ink">
          Capsule <span className="italic text-terracotta">{capsuleSeason}</span>
        </div>
        <div className="text-[12.5px] text-muted mt-[5px]">
          {capsule.length} pièces · {looksCount} looks possibles
        </div>
      </div>

      {/* Navigation par catégorie (recette 20/08/2026, passe design) — liens
          texte discrets, jamais des boutons pill : filtre réellement la
          liste affichée (Tout + une entrée par catégorie présente dans la
          capsule), plus une simple ancre de défilement. */}
      {groups.length > 1 && (
        <div className="scrollarea flex gap-4 overflow-x-auto pb-[2px] mt-4">
          <button
            onClick={() => setCatFilter("all")}
            className={
              "flex-none text-[11px] tracking-[.1em] uppercase cursor-pointer whitespace-nowrap pb-[2px] border-b-2 " +
              (catFilter === "all"
                ? "text-ink font-bold border-terracotta"
                : "text-[#9C9081] font-normal border-transparent hover:text-ink")
            }
          >
            Tout
          </button>
          {groups.map((g) => (
            <button
              key={g.key}
              onClick={() => setCatFilter(g.key)}
              className={
                "flex-none text-[11px] tracking-[.1em] uppercase cursor-pointer whitespace-nowrap pb-[2px] border-b-2 " +
                (catFilter === g.key
                  ? "text-ink font-bold border-terracotta"
                  : "text-[#9C9081] font-normal border-transparent hover:text-ink")
              }
            >
              {g.label}
            </button>
          ))}
        </div>
      )}

      {visibleGroups.map((g) => (
        <div key={g.key} id={"capsule-cat-" + g.key}>
          <div className="mt-6 mb-3 text-[12px] tracking-[.1em] uppercase text-ink font-semibold">
            {g.label} <span className="text-placeholder font-normal">({g.items.length})</span>
          </div>
          <div className="scrollarea flex gap-[9px] overflow-x-auto pb-[2px]" style={{ scrollSnapType: "x mandatory" }}>
            {g.items.map((it) => {
              const resolvedImage = resolveItemImage(it);
              return (
                <button
                  key={it.id}
                  onClick={() => actions.openItemOutfits(it.id)}
                  className="flex-none w-[104px] text-left cursor-pointer"
                  style={{ scrollSnapAlign: "start" }}
                >
                  <div
                    className="w-full rounded-[11px] border border-border relative overflow-hidden"
                    style={{
                      aspectRatio: "4/5",
                      background: resolvedImage.url ? "#F3EDE1" : it.hex,
                      boxShadow: resolvedImage.url ? undefined : "inset 0 0 0 1px rgba(29,26,22,.06)",
                    }}
                  >
                    {resolvedImage.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolvedImage.url}
                        alt={it.name}
                        loading="lazy"
                        style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center", padding: 8, boxSizing: "border-box" }}
                      />
                    ) : (
                      it.imageStatus === "generating" && (
                        <span className="absolute inset-0 animate-pulse" style={{ background: "rgba(243,238,229,.35)" }} />
                      )
                    )}
                  </div>
                  <div className="text-[11.5px] text-ink mt-[6px] leading-[1.25] overflow-hidden text-ellipsis whitespace-nowrap">
                    {it.name}
                  </div>
                  <div className="text-[9.5px] text-terracotta mt-[1px]">Suggestion</div>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <button
        onClick={actions.goTenues}
        className="mt-[22px] w-full bg-terracotta text-cream text-center rounded-full py-4 text-[13px] tracking-[.1em] uppercase cursor-pointer"
      >
        Voir ma tenue du jour
      </button>
    </div>
  );
}
