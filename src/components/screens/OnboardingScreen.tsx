"use client";

import { ONBOARDING_SLIDES } from "@/lib/data";
import AppHeader from "@/components/AppHeader";
import { useCapsela } from "@/lib/store";
import { STYLE_CONFIG, type StyleId } from "@/lib/profile";

/**
 * Cards du moodboard "Ton style" (slide 1 de l'onboarding, recette
 * 26/08/2026, direction adaptée d'une proposition externe) — réutilise les
 * visuels de style déjà générés (STYLE_CONFIG, consommés par ailleurs par
 * l'étape Style de ProfileSetupScreen), jamais une nouvelle génération
 * d'assets. Genre non encore connu à ce stade de l'onboarding (demandé
 * plus tard dans ProfileSetupScreen) — femme choisi par défaut pour ce
 * moment purement illustratif, avant toute personnalisation réelle.
 */
const MOODBOARD_STYLE_IDS: StyleId[] = ["minimaliste", "casual_chic", "boheme", "classique_chic", "streetwear"];

/**
 * Repères de la capsule (slide 2, "Ta capsule") — glyphes texte simples
 * (✓/✦), même convention que la coche ✓ déjà utilisée telle quelle ailleurs
 * dans l'app (OptionRow) plutôt qu'une nouvelle icône SVG par repère.
 */
const CAPSULE_FEATURES: { glyph: string; label: string; desc: string }[] = [
  { glyph: "✓", label: "Cohérente", desc: "Tout s’accorde facilement" },
  { glyph: "✦", label: "Polyvalente", desc: "Des basiques et des pièces fortes" },
  { glyph: "↻", label: "Adaptable", desc: "Garde, remplace, personnalise" },
];

function MoodboardCard({ id, className }: { id: StyleId; className?: string }) {
  const cfg = STYLE_CONFIG.femme[id];
  return (
    <div className={"rounded-[14px] overflow-hidden bg-[#E6DCCB] relative " + (className || "")}>
      {cfg.asset && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cfg.asset} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}
      <div className="absolute bottom-0 left-0 right-0 px-[9px] py-[7px] bg-gradient-to-t from-black/45 to-transparent">
        <div className="text-[10.5px] text-white font-medium leading-[1.2]">{cfg.label}</div>
      </div>
    </div>
  );
}

export default function OnboardingScreen() {
  const { state, actions } = useCapsela();
  const slide = ONBOARDING_SLIDES[state.onbStep];
  const cta = state.onbStep >= 2 ? "Créer mon compte" : "Continuer";
  const isStyleMoodboard = state.onbStep === 0;
  const isCapsulePreview = state.onbStep === 1;

  return (
    <div className="absolute inset-0 flex flex-col px-7 pt-2 pb-7">
      <AppHeader showAvatar={false} />
      <div className="flex justify-between items-center">
        <button
          onClick={actions.onbBack}
          className="w-[34px] h-[34px] rounded-full bg-card border border-border flex items-center justify-center text-[15px] text-ink cursor-pointer"
        >
          ←
        </button>
        <button onClick={actions.goAuth} className="text-[13px] text-muted cursor-pointer">
          Passer
        </button>
      </div>

      <div className="flex-1 flex flex-col justify-center">
        {isStyleMoodboard ? (
          <div className="rounded-[20px] p-[10px]" style={{ background: slide.bg }}>
            <div className="grid grid-cols-3 gap-[8px]">
              {MOODBOARD_STYLE_IDS.slice(0, 3).map((id) => (
                <MoodboardCard key={id} id={id} className="aspect-[3/4]" />
              ))}
            </div>
            <div className="flex gap-[8px] mt-[8px]">
              {MOODBOARD_STYLE_IDS.slice(3, 5).map((id) => (
                <MoodboardCard key={id} id={id} className="flex-1 aspect-[4/3]" />
              ))}
            </div>
          </div>
        ) : isCapsulePreview ? (
          <div className="rounded-[20px] p-[10px]" style={{ background: slide.bg }}>
            <div className="flex gap-[8px]">
              <MoodboardCard id="minimaliste" className="flex-1 aspect-[3/4]" />
              <MoodboardCard id="casual_chic" className="flex-1 aspect-[3/4]" />
            </div>
            <div className="flex items-center gap-[6px] mt-[10px] bg-card rounded-full py-[7px] px-[13px] w-fit mx-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-hanger-only.png" alt="" style={{ width: 13, height: "auto" }} />
              <span className="text-[11px] text-ink font-medium">36 pièces · exemple</span>
            </div>
            <div className="flex justify-between mt-[10px] px-[2px]">
              {CAPSULE_FEATURES.map((f) => (
                <div key={f.label} className="flex flex-col items-center text-center w-1/3 px-[4px]">
                  <div className="w-7 h-7 rounded-full bg-card border border-border flex items-center justify-center text-terracotta text-[13px] flex-shrink-0">
                    {f.glyph}
                  </div>
                  <div className="text-[10.5px] text-ink font-medium mt-[6px] leading-[1.2]">{f.label}</div>
                  <div className="text-[9px] text-muted mt-[2px] leading-[1.25]">{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div
            className="aspect-square max-h-[300px] rounded-[20px] relative flex items-center justify-center overflow-hidden"
            style={{ background: slide.bg }}
          >
            <div className="font-serif italic text-[120px]" style={{ color: slide.glyphColor }}>
              {slide.glyph}
            </div>
            <div
              className="absolute bottom-[14px] left-4 text-[10px] tracking-[.18em] uppercase"
              style={{ color: slide.tagColor }}
            >
              {slide.tag}
            </div>
          </div>
        )}
        <div className="mt-8">
          <div className="text-[11px] tracking-[.2em] uppercase text-terracotta">{slide.kicker}</div>
          <div className="font-serif text-[31px] leading-[1.08] tracking-[-.01em] text-ink mt-3">{slide.title}</div>
          <div className="text-[14px] text-muted mt-3 leading-[1.55]">{slide.body}</div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-5">
        <div className="flex gap-[7px] items-center">
          {ONBOARDING_SLIDES.map((_, i) => (
            <span
              key={i}
              className="rounded-full inline-block"
              style={
                i === state.onbStep
                  ? { width: 22, height: 7, background: "#A66950" }
                  : { width: 7, height: 7, background: "#DFD3BE" }
              }
            />
          ))}
        </div>
        <button
          onClick={actions.onbNext}
          className="bg-ink text-cream rounded-full py-[14px] px-[26px] text-[13px] tracking-[.08em] uppercase cursor-pointer"
        >
          {cta}
        </button>
      </div>
    </div>
  );
}
