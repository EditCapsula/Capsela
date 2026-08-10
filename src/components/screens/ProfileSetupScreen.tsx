"use client";

import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";
import {
  GENDERS,
  MAX_PROFILE_COLORS,
  MORPHOLOGIES,
  MORPHO_HINTS,
  PROFILE_PALETTE,
  STYLE_OPTIONS,
  TAILLES_HAUT,
  tailleBasLabelFor,
  taillesBasFor,
  type Profile,
} from "@/lib/profile";

const STEPS = [
  {
    kicker: "Étape 1 · Genre",
    title: "Comment tu te définis ?",
    subtitle: "Pour des suggestions plus justes, jamais pour t’enfermer dans une case.",
  },
  {
    kicker: "Étape 2 · Goûts",
    title: "Quelles couleurs préfères-tu porter ?",
    subtitle: "Choisis jusqu’à 3 teintes qui te ressemblent.",
  },
  {
    kicker: "Étape 3 · Taille",
    title: "Quelles sont tes tailles habituelles ?",
    subtitle: "Ça nous aide à te proposer des tenues qui tombent bien.",
  },
  {
    kicker: "Étape 4 · Style",
    title: "Quel est ton style ?",
    subtitle: "Un seul choix — celui qui te ressemble le plus aujourd’hui.",
  },
  {
    kicker: "Étape 5 · Morphologie",
    title: "Et ta silhouette ?",
    subtitle: "Pour affiner nos recommandations de coupes.",
  },
];

function chipCls(on: boolean): string {
  return (
    "px-4 py-[11px] rounded-full text-[13px] cursor-pointer font-sans border " +
    (on ? "bg-ink text-cream border-ink" : "bg-card text-ink border-border")
  );
}

function OptionRow({
  label,
  on,
  onClick,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "flex items-center gap-3 px-4 py-[15px] rounded-[14px] cursor-pointer text-[13.5px] leading-[1.4] text-left border " +
        (on ? "bg-ink text-cream border-ink" : "bg-card text-ink border-border")
      }
    >
      <span className="flex-1">{label}</span>
      <span
        className={
          "w-5 h-5 rounded-full flex-shrink-0 text-[11px] flex items-center justify-center " +
          (on ? "bg-terracotta text-cream border border-terracotta" : "border-[1.5px] border-dots text-transparent")
        }
      >
        {on ? "✓" : ""}
      </span>
    </button>
  );
}

export default function ProfileSetupScreen() {
  const { profile, saveProfile } = useAuth();
  const { state, actions } = useCapsela();
  const [step, setStep] = useState(state.profileSetupStep || 0);
  const [draft, setDraft] = useState<Profile>(profile);
  const [guideOpen, setGuideOpen] = useState(false);

  const patch = (p: Partial<Profile>) => setDraft((d) => ({ ...d, ...p }));

  const toggleColor = (hex: string) => {
    const cur = draft.favoriteColors;
    if (cur.includes(hex)) return patch({ favoriteColors: cur.filter((x) => x !== hex) });
    if (cur.length >= MAX_PROFILE_COLORS) return patch({ favoriteColors: [...cur.slice(1), hex] });
    patch({ favoriteColors: [...cur, hex] });
  };

  const isLast = step >= STEPS.length - 1;

  const finish = async () => {
    await saveProfile({ ...draft, completed: true });
    if (state.profileSetupFromEdit) actions.goProfileEdit();
    else actions.goHome();
  };

  const next = () => (isLast ? finish() : setStep(step + 1));
  const back = () => {
    if (step > 0) setStep(step - 1);
    else if (state.profileSetupFromEdit || profile.completed) actions.goProfile();
  };
  const showBack = step > 0 || state.profileSetupFromEdit || profile.completed;

  const meta = STEPS[step];
  const taillesBas = taillesBasFor(draft.gender);

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto flex flex-col px-7 pt-2 pb-7">
      <AppHeader showAvatar={false} />

      <div className="flex items-center justify-between">
        {showBack ? (
          <button
            onClick={back}
            className="w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center text-[16px] text-ink cursor-pointer"
          >
            ←
          </button>
        ) : (
          <div className="w-9" />
        )}
        <div className="flex gap-[6px]">
          {STEPS.map((s, i) => (
            <span
              key={s.kicker}
              className="rounded-full inline-block"
              style={
                i === step
                  ? { width: 20, height: 6, background: "#A66950" }
                  : { width: 6, height: 6, background: "#DFD3BE" }
              }
            />
          ))}
        </div>
        <div className="w-9" />
      </div>

      <div className="mt-[26px]">
        <div className="text-[11px] tracking-[.18em] uppercase text-terracotta">{meta.kicker}</div>
        <div className="font-serif text-[27px] leading-[1.15] text-ink mt-3">{meta.title}</div>
        <div className="text-[13.5px] text-muted mt-[10px] leading-[1.5]">{meta.subtitle}</div>
      </div>

      {step === 0 && (
        <div className="flex flex-col gap-[10px] mt-[26px]">
          {GENDERS.map((g) => (
            <OptionRow
              key={g.key}
              label={g.label}
              on={draft.gender === g.key}
              onClick={() => patch({ gender: g.key })}
            />
          ))}
        </div>
      )}

      {step === 1 && (
        <div className="grid grid-cols-4 gap-x-2 gap-y-5 mt-[26px]">
          {PROFILE_PALETTE.map(([name, hex]) => {
            const on = draft.favoriteColors.includes(hex);
            return (
              <button key={hex} onClick={() => toggleColor(hex)} className="flex flex-col items-center gap-[7px] cursor-pointer">
                <span
                  className="w-[38px] h-[38px] rounded-[11px]"
                  style={{
                    background: hex,
                    border: on ? "2px solid #1D1A16" : "1px solid rgba(29,26,22,.12)",
                    boxShadow: on ? "0 0 0 3px #F3EEE5 inset" : "none",
                  }}
                />
                <span className={"text-[9.5px] text-center leading-[1.3] " + (on ? "text-ink" : "text-muted")}>
                  {name}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {step === 2 && (
        <div className="mt-[26px]">
          <div className="text-[11px] tracking-[.16em] uppercase text-muted mb-[11px]">Taille de haut</div>
          <div className="flex gap-2 flex-wrap">
            {TAILLES_HAUT.map((t) => (
              <button key={t} onClick={() => patch({ tailleHaut: t })} className={chipCls(draft.tailleHaut === t)}>
                {t}
              </button>
            ))}
          </div>
          <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-[22px] mb-[11px]">
            {tailleBasLabelFor(draft.gender)}
          </div>
          <div className="flex gap-2 flex-wrap">
            {taillesBas.map((t) => (
              <button key={t} onClick={() => patch({ tailleBas: t })} className={chipCls(draft.tailleBas === t)}>
                {t}
              </button>
            ))}
          </div>
          <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-[22px] mb-[11px]">Pointure</div>
          <input
            inputMode="numeric"
            className="capin bg-card border border-border rounded-[14px] px-[17px] py-[13px] text-[14px] text-ink font-sans w-[120px]"
            placeholder="Ex. 39"
            value={draft.pointure ?? ""}
            onChange={(e) => patch({ pointure: e.target.value.replace(/[^0-9]/g, "").slice(0, 2) || null })}
          />
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-wrap gap-[9px] mt-[26px]">
          {STYLE_OPTIONS.map((st) => {
            const on = draft.styles[0] === st;
            return (
              <button
                key={st}
                onClick={() => patch({ styles: [st] })}
                className={
                  "px-[18px] py-[11px] rounded-full cursor-pointer text-[14px] border " +
                  (on ? "bg-ink text-cream border-ink" : "bg-card text-ink border-border")
                }
              >
                {st}
              </button>
            );
          })}
        </div>
      )}

      {step === 4 && (
        <>
          <div className="flex flex-col gap-[10px] mt-[26px]">
            {MORPHOLOGIES.map((m) => (
              <OptionRow key={m} label={m} on={draft.morphology === m} onClick={() => patch({ morphology: m })} />
            ))}
          </div>
          <button onClick={() => setGuideOpen(!guideOpen)} className="flex items-center gap-[7px] mt-[18px] cursor-pointer">
            <span className="text-[12.5px] text-terracotta">Comment savoir quelle est ma morphologie ?</span>
          </button>
          {guideOpen && (
            <div className="bg-card border border-border rounded-[14px] px-4 py-[14px] mt-[10px] flex flex-col gap-[11px]">
              {MORPHOLOGIES.map((m) => (
                <div key={m}>
                  <div className="text-[12.5px] text-ink font-semibold">{m}</div>
                  <div className="text-[12px] text-muted mt-[2px] leading-[1.4]">{MORPHO_HINTS[m]}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="flex-1" />
      <button
        onClick={next}
        className="mt-[22px] text-center rounded-full py-4 text-[13px] tracking-[.1em] uppercase cursor-pointer bg-terracotta text-cream"
      >
        {isLast ? "Terminer le profil" : "Continuer"}
      </button>
    </div>
  );
}
