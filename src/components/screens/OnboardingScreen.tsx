"use client";

import { useState } from "react";
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

/**
 * Repères "Tenue du jour" (slide 3, "Tes tenues") — ☀️ reprend l'usage
 * déjà établi des emoji météo (WEATHER_ICONS, data.ts) ; le cintre réutilise
 * le même asset que le compteur du slide 2 plutôt qu'un 3e langage d'icône.
 */
const DAILY_OUTFIT_FEATURES: { glyph: string; label: string; desc: string }[] = [
  { glyph: "☀️", label: "Météo", desc: "En temps réel dans ta ville" },
  { glyph: "🗓️", label: "Occasion", desc: "Adaptée à ton programme" },
  { glyph: "", label: "Ton style", desc: "Et les pièces de ta capsule" },
];

/** Pastilles couleur du mini-aperçu "Tenue du jour" — palette neutre déjà présente dans PAL_COULEURS (profile.ts), jamais de nouvelles teintes. */
const OUTFIT_PREVIEW_HEXES = ["#C08A5E", "#F7F4EE", "#2A2724", "#5A4436", "#8E8B85", "#A66950"];

function MoodboardCard({ id, className }: { id: StyleId; className?: string }) {
  const cfg = STYLE_CONFIG.femme[id];
  // Repli gracieux si le visuel Storage ne charge pas (même principe que
  // PolaroidPhoto, HomeScreen.tsx) : le libellé reste lisible sur l'aplat
  // de fond, jamais une icône d'image cassée.
  const [failed, setFailed] = useState(false);
  return (
    <div className={"rounded-[14px] overflow-hidden bg-[#E6DCCB] relative " + (className || "")}>
      {cfg.asset && !failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cfg.asset}
          alt=""
          onError={() => setFailed(true)}
          className="absolute inset-0 w-full h-full object-cover"
        />
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
  const isOutfitPreview = state.onbStep === 2;

  // Slide 2 "Ta capsule" compacté (recette 26/08/2026, signalé : CTA coupé
  // sur mobile) — visuels ~15% moins hauts (aspect-[3/4] → aspect-[15/17]),
  // espacements internes resserrés, espace réduit avant le kicker "TA
  // CAPSULE". Ne touche jamais aux autres slides ni au titre éditorial
  // (conservé pleine taille sur les 3 slides).
  const kickerBlockMt = isCapsulePreview ? "mt-5" : "mt-8";
  const bodyClass = isCapsulePreview
    ? "text-[14px] text-muted mt-2 leading-[1.45]"
    : "text-[14px] text-muted mt-3 leading-[1.55]";

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* CTA uniformisé sur tout l'onboarding (recette 26/08/2026) : zone
          scrollable unique au-dessus d'un footer fixe (jamais un
          position:sticky + padding deviné — cf. le même correctif déjà
          appliqué à l'étape "Ta palette", ProfileSetupScreen.tsx). Le footer
          ne peut plus jamais être poussé vers le bas ni recouvrir le
          contenu, quelle que soit la hauteur de chaque slide. */}
      <div className="scrollarea flex-1 overflow-y-auto">
        <div className="min-h-full flex flex-col px-7 pt-2 pb-6">
          <AppHeader showAvatar={false} />
          <div className="flex justify-between items-center flex-shrink-0">
            {/* Flèche retour supprimée (recette 26/08/2026) — espace conservé
                (même largeur que l'ancien bouton, w-[34px]) pour ne décaler ni
                "Passer" ni aucun autre élément du header entre les 3 slides. */}
            <div className="w-[34px] h-[34px]" />
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
              <div className="rounded-[20px] p-[8px]" style={{ background: slide.bg }}>
                <div className="flex gap-[6px]">
                  <MoodboardCard id="minimaliste" className="flex-1 aspect-[15/17]" />
                  <MoodboardCard id="casual_chic" className="flex-1 aspect-[15/17]" />
                </div>
                <div className="flex items-center gap-[6px] mt-[7px] bg-card rounded-full py-[7px] px-[13px] w-fit mx-auto">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo-hanger-only.png" alt="" style={{ width: 13, height: "auto" }} />
                  <span className="text-[11px] text-ink font-medium">36 pièces · exemple</span>
                </div>
                <div className="flex justify-between mt-[7px] px-[2px]">
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
            ) : isOutfitPreview ? (
              <div className="rounded-[20px] p-[10px]" style={{ background: slide.bg }}>
                <div className="flex gap-[10px] items-stretch">
                  <div className="flex-[1.3] bg-ink rounded-[18px] p-[6px]">
                    <div className="bg-cream rounded-[13px] overflow-hidden px-[10px] pt-[10px] pb-[9px] h-full flex flex-col">
                      <div className="text-[9px] text-ink font-serif text-center mb-[8px]">Tenue du jour</div>
                      <div className="flex gap-[5px] mb-[8px]">
                        <div className="flex-1 bg-card rounded-[8px] px-[6px] py-[5px] text-[7px] text-ink leading-[1.3]">
                          ☀️ 22° · Paris
                        </div>
                        <div className="flex-1 bg-card rounded-[8px] px-[6px] py-[5px] text-[7px] text-ink leading-[1.3]">
                          Travail / Bureau
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-[4px] mb-[8px]">
                        {OUTFIT_PREVIEW_HEXES.map((hex, i) => (
                          <div key={i} className="aspect-square rounded-[6px]" style={{ background: hex }} />
                        ))}
                      </div>
                      <div className="flex-1" />
                      <div className="bg-ink text-cream text-center rounded-full py-[6px] text-[7.5px] mb-[5px]">
                        Voir le détail
                      </div>
                      <div className="border border-border text-ink text-center rounded-full py-[6px] text-[7.5px]">
                        Plus d’idées
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col justify-center gap-[14px]">
                    {DAILY_OUTFIT_FEATURES.map((f) => (
                      <div key={f.label} className="flex items-start gap-[7px]">
                        <div className="w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center text-[11px] flex-shrink-0">
                          {f.glyph || (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src="/logo-hanger-only.png" alt="" style={{ width: 11, height: "auto" }} />
                          )}
                        </div>
                        <div>
                          <div className="text-[10px] text-ink font-medium leading-[1.2]">{f.label}</div>
                          <div className="text-[9px] text-muted mt-[1px] leading-[1.25]">{f.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
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
            <div className={kickerBlockMt}>
              <div className="text-[11px] tracking-[.2em] uppercase text-terracotta">{slide.kicker}</div>
              <div className="font-serif text-[31px] leading-[1.08] tracking-[-.01em] text-ink mt-3">{slide.title}</div>
              <div className={bodyClass}>{slide.body}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer fixe (recette 26/08/2026) : même hauteur, mêmes marges
          horizontales (px-7) et même distance au bas de l'écran sur les 3
          slides — jamais poussé par le contenu, jamais recouvrant, safe-area
          incluse. border-t border-border : même traitement de séparation
          que TabBar.tsx et le CTA sticky de "Ta palette". */}
      <div
        className="flex-shrink-0 px-7 bg-cream border-t border-border"
        style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center justify-between pt-4">
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
    </div>
  );
}
