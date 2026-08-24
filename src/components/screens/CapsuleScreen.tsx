"use client";

import { useMemo, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { CATS } from "@/lib/data";
import { CAPSULE_SEASONS, computeDefaultCapsule, currentSeasonKey, type CapsuleSeason } from "@/lib/capsule";
import { useAuth } from "@/lib/auth";
import { styleLabel } from "@/lib/profile";
import { useCapsela } from "@/lib/store";
import { resolveItemImage } from "@/lib/catalogImages";
import type { CategoryKey } from "@/lib/types";

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s ease" }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export default function CapsuleScreen() {
  const { state, weather, actions, vestiairePool } = useCapsela();
  const { profile } = useAuth();

  const capsuleSeason: CapsuleSeason = state.capsuleSeason || currentSeasonKey();

  // Exploration ponctuelle d'un autre style ("Explorer d'autres styles" depuis
  // l'état vide Tenues, recette 24/08/2026) — state.exploredStyleId ne
  // remplace jamais profile.styles : seule cette variable locale, dérivée à
  // la volée, voit le style temporaire ; aucune écriture profil ici.
  const exploredStyleId = state.exploredStyleId;
  const capsule = useMemo(() => {
    const capsuleProfile = exploredStyleId ? { ...profile, styles: [exploredStyleId] } : profile;
    return computeDefaultCapsule(capsuleProfile, weather, state.suggestedExcluded, capsuleSeason, vestiairePool);
  }, [profile, exploredStyleId, weather, state.suggestedExcluded, capsuleSeason, vestiairePool]);

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

  // Style renseigné en profil (recette 25/08/2026) — premier style choisi,
  // même convention que ProfileScreen/ProfileEditScreen (styleLabel(profile.styles[0], ...)) ;
  // "" si aucun style n'a été renseigné, jamais un style inventé.
  const userStyleLabel = styleLabel(profile.styles[0], profile.gender);
  // Style exploré (recette 24/08/2026) — n'affecte que ce libellé d'affichage,
  // jamais profile.styles ; la capsule ci-dessus est déjà calculée sur ce
  // même style temporaire.
  const exploredStyleLabel = exploredStyleId ? styleLabel(exploredStyleId, profile.gender) : null;

  const groups = CATS.map(([key, , plural]) => ({
    key,
    label: plural.toUpperCase(),
    items: capsule.filter((i) => i.cat === key),
  })).filter((g) => g.items.length > 0);

  // Accordéon (recette 25/08/2026, prototype fourni) — remplace l'ancienne
  // navigation par liens texte "Tout / Hauts / Pantalons..." (qui masquait
  // toutes les autres catégories tant que "Tout" n'était pas resélectionné)
  // par une liste où chaque catégorie reste visible, repliée, avec son
  // effectif ; une seule s'ouvre à la fois — cliquer sur celle déjà ouverte
  // la referme sans en rouvrir une autre. La première catégorie non vide
  // reste ouverte par défaut, comme dans le prototype.
  const [openCat, setOpenCat] = useState<CategoryKey | null>(groups[0]?.key ?? null);

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-24">
      <AppHeader />

      <div className="mt-[18px]">
        <div className="text-[11px] tracking-[.18em] uppercase text-muted">Ta capsule</div>
        <div className="font-serif text-[28px] leading-[1.15] text-ink mt-[6px]">
          Capsule <span className="italic text-terracotta">{capsuleSeason}</span>
        </div>
        <div className="text-[12px] text-muted leading-[1.5] mt-[8px]">
          {exploredStyleLabel ? (
            <>
              Aperçu du style <span className="text-ink">{exploredStyleLabel}</span> — pas ton style habituel.
            </>
          ) : userStyleLabel ? (
            <>
              Une sélection pensée pour ton style <span className="text-ink">{userStyleLabel}</span> et ta palette,
              pour inspirer tes tenues.
            </>
          ) : (
            "Une sélection pensée pour ton style et ta palette, pour inspirer tes tenues."
          )}
        </div>
        <div className="font-serif text-[15px] text-ink mt-[10px]">
          {capsule.length} pièces · {looksCount} looks possibles
        </div>
        <button onClick={actions.openAdd} className="mt-[6px] text-[12px] text-terracotta cursor-pointer">
          + Ajouter une pièce à mon dressing
        </button>
      </div>

      {exploredStyleLabel && (
        <div className="mt-[14px] flex items-center gap-[11px] bg-card border border-border rounded-[14px] px-4 py-[14px]">
          <span className="font-serif italic text-[15px] text-terracotta flex-shrink-0">✦</span>
          <div className="flex-1 min-w-0 text-[12.5px] text-[#3F3B34] leading-[1.45]">
            Tu explores le style {exploredStyleLabel}, sans changer ton profil.
          </div>
          <button
            onClick={actions.clearExploredStyle}
            className="flex-shrink-0 text-[12px] text-terracotta cursor-pointer whitespace-nowrap"
          >
            Revenir à mon style
          </button>
        </div>
      )}

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

      <div className="mt-6">
        {groups.map((g) => {
          const open = openCat === g.key;
          return (
            <div key={g.key} className="border-b border-border">
              <button
                onClick={() => setOpenCat(open ? null : g.key)}
                className="w-full flex items-center justify-between py-[14px] cursor-pointer text-left"
              >
                <span className="text-[12px] tracking-[.1em] uppercase font-semibold text-ink">
                  {g.label} <span className="text-placeholder font-normal">({g.items.length})</span>
                </span>
                <span className="text-muted flex-shrink-0">
                  <ChevronIcon open={open} />
                </span>
              </button>
              {open && (
                <div
                  className="scrollarea flex gap-[9px] overflow-x-auto pb-[16px]"
                  style={{ scrollSnapType: "x mandatory" }}
                >
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
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={actions.goTenues}
        className="mt-[22px] w-full bg-terracotta active:bg-terracotta-hover text-cream text-center rounded-full py-4 text-[13px] tracking-[.1em] uppercase cursor-pointer"
      >
        ✦ Voir mes idées de tenues
      </button>
    </div>
  );
}
