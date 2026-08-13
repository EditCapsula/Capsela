"use client";

import AppHeader from "@/components/AppHeader";
import { CATS } from "@/lib/data";
import { CAPSULE_SEASONS, computeDefaultCapsule, currentSeasonKey, type CapsuleSeason } from "@/lib/capsule";
import { GENDERS } from "@/lib/profile";
import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";

export default function CapsuleScreen() {
  const { state, weather, actions } = useCapsela();
  const { profile } = useAuth();

  const capsuleSeason: CapsuleSeason = state.capsuleSeason || currentSeasonKey();
  const capsule = computeDefaultCapsule(profile, weather.temp, state.suggestedExcluded, capsuleSeason);
  const styleLabel = profile.styles[0] || GENDERS.find((g) => g.key === profile.gender)?.label || "";

  const count = (cat: string) => capsule.filter((i) => i.cat === cat).length;
  const tops = count("haut");
  const bottoms = count("pantalon") + count("jean") + count("jupe") + count("short");
  const dresses = count("robe") + count("combinaison");
  const shoes = Math.max(1, count("chaussures"));
  const looksCount = (tops * bottoms + dresses) * shoes;

  const introText = styleLabel
    ? "Composée à partir de ton style " + styleLabel + " et de ta palette personnelle — le temps que tu remplisses ton dressing."
    : "Composée à partir de ton profil et de ta palette personnelle — le temps que tu remplisses ton dressing.";

  const groups = CATS.map(([key, , plural]) => ({
    key,
    label: plural.toUpperCase(),
    items: capsule.filter((i) => i.cat === key),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-24">
      <AppHeader />

      <div className="flex items-center gap-[14px]">
        <button
          onClick={actions.goWardrobe}
          className="w-[38px] h-[38px] rounded-full bg-card border border-border flex items-center justify-center text-[17px] text-ink cursor-pointer"
        >
          ←
        </button>
        <div>
          <div className="text-[11px] tracking-[.18em] uppercase text-muted">Proposée pour toi</div>
          <div className="font-serif text-[24px] text-ink mt-[2px]">Ta capsule</div>
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

      <div className="mt-4 flex items-start gap-[11px] bg-card border border-border rounded-[14px] px-4 py-[14px]">
        <span className="font-serif italic text-[15px] text-terracotta flex-shrink-0">✦</span>
        <div className="text-[12.5px] text-muted-3 leading-[1.5]">
          {introText + " Elle s'ajustera automatiquement dès que tu ajouteras tes propres pièces."}
        </div>
      </div>

      {groups.map((g) => (
        <div key={g.key}>
          <div className="mt-6 mb-3 text-[12px] tracking-[.1em] uppercase text-ink font-semibold">
            {g.label} <span className="text-placeholder font-normal">({g.items.length})</span>
          </div>
          <div className="scrollarea flex gap-[9px] overflow-x-auto pb-[2px]" style={{ scrollSnapType: "x mandatory" }}>
            {g.items.map((it) => (
              <div key={it.id} className="flex-none w-[104px]" style={{ scrollSnapAlign: "start" }}>
                <div
                  className="w-full rounded-[11px] border border-border"
                  style={{ aspectRatio: "4/5", background: it.hex, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.06)" }}
                />
                <div className="text-[11.5px] text-ink mt-[6px] leading-[1.25] overflow-hidden text-ellipsis whitespace-nowrap">
                  {it.name}
                </div>
                <div className="text-[9.5px] text-terracotta mt-[1px]">Suggestion</div>
                <button
                  onClick={() => actions.startReplace(it.id, it.cat)}
                  className="mt-[6px] w-full text-center text-[10.5px] text-muted border border-border rounded-full py-[6px] px-2 cursor-pointer"
                >
                  J&apos;ai déjà ça
                </button>
                {it.affLink && (
                  <a
                    href={it.affLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-[6px] block w-full text-center text-[10.5px] text-terracotta border border-border rounded-full py-[6px] px-2 cursor-pointer"
                  >
                    Trouver cette pièce
                  </a>
                )}
                <button
                  onClick={() => actions.dismissSuggested(it.id)}
                  className="mt-[6px] w-full text-center text-[10.5px] text-[#9C6B5A] border border-border rounded-full py-[6px] px-2 cursor-pointer"
                >
                  Retirer
                </button>
              </div>
            ))}
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
