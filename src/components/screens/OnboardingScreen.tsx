"use client";

import { ONBOARDING_SLIDES } from "@/lib/data";
import { useCapsela } from "@/lib/store";

export default function OnboardingScreen() {
  const { state, actions } = useCapsela();
  const slide = ONBOARDING_SLIDES[state.onbStep];
  const cta = state.onbStep >= 2 ? "Créer mon compte" : "Continuer";

  return (
    <div className="absolute inset-0 flex flex-col px-7 pt-2 pb-7">
      <div className="flex justify-between items-center">
        <button
          onClick={actions.onbBack}
          className="w-[34px] h-[34px] rounded-full bg-card border border-border flex items-center justify-center text-[15px] text-ink cursor-pointer"
        >
          ←
        </button>
        <button onClick={actions.goAuth} className="text-[12px] text-muted cursor-pointer tracking-[.04em]">
          Passer
        </button>
      </div>

      <div className="flex-1 flex flex-col justify-center">
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
        <div className="mt-8">
          <div className="text-[11px] tracking-[.2em] uppercase text-terracotta">{slide.kicker}</div>
          <div className="font-serif text-[31px] leading-[1.08] tracking-[-.01em] text-ink mt-3">{slide.title}</div>
          <div className="text-[14px] text-muted-3 mt-3 leading-[1.55]">{slide.body}</div>
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
                  ? { width: 22, height: 7, background: "#B0654A" }
                  : { width: 7, height: 7, background: "#D8CBB6" }
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
