"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";
import { PALETTE } from "@/lib/data";
import {
  CLOTHING_SIZES,
  GENDERS,
  MORPHOLOGIES,
  STYLE_OPTIONS,
  TASTE_OPTIONS,
  type Profile,
} from "@/lib/profile";

const STEPS = ["Genre", "Taille", "Style", "Morphologie", "Goûts"] as const;

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "px-[15px] py-[9px] rounded-full text-[13px] whitespace-nowrap cursor-pointer transition-all border " +
        (active ? "bg-ink text-cream border-ink" : "bg-card text-muted-3 border-border")
      }
    >
      {label}
    </button>
  );
}

export default function ProfileSetupScreen() {
  const { profile, saveProfile, email } = useAuth();
  const { actions } = useCapsela();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Profile>(profile);

  const patch = (p: Partial<Profile>) => setDraft((d) => ({ ...d, ...p }));
  const toggleIn = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  const stepValid = [
    draft.gender != null,
    draft.heightCm != null || draft.clothingSize != null || draft.shoeSize != null,
    draft.styles.length > 0,
    draft.morphology != null,
    true, // les goûts sont optionnels
  ][step];

  const finish = async () => {
    await saveProfile({ ...draft, completed: true });
    actions.goTenues();
  };

  const next = () => (step >= STEPS.length - 1 ? finish() : setStep(step + 1));
  const back = () => setStep(Math.max(0, step - 1));

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto flex flex-col px-7 pt-2 pb-7">
      <div className="flex items-center justify-between">
        {step > 0 ? (
          <button
            onClick={back}
            className="w-[38px] h-[38px] rounded-full bg-card border border-border flex items-center justify-center text-[17px] text-ink cursor-pointer"
          >
            ←
          </button>
        ) : (
          <div className="w-[38px]" />
        )}
        <div className="flex gap-[7px] items-center">
          {STEPS.map((label, i) => (
            <span
              key={label}
              className={
                "rounded-full transition-all " +
                (i === step ? "w-[22px] h-[7px] bg-terracotta" : "w-[7px] h-[7px] bg-[#d8cbb6]")
              }
            />
          ))}
        </div>
        <div className="w-[38px]" />
      </div>

      <div className="mt-6">
        <div className="text-[11px] tracking-[.2em] uppercase text-terracotta">
          Ton profil · {step + 1} / {STEPS.length}
        </div>

        {step === 0 && (
          <>
            <div className="font-serif text-[30px] leading-[1.08] text-ink mt-3">
              Comment te <span className="italic">présenter</span> ?
            </div>
            <div className="text-[13px] text-muted-2 mt-3 leading-[1.55]">
              Tes recommandations de pièces et de tenues s&apos;adaptent à ton genre — et restent
              modifiables à tout moment.
            </div>
            <div className="flex flex-col gap-[10px] mt-6">
              {GENDERS.map((g) => (
                <button
                  key={g.key}
                  onClick={() => patch({ gender: g.key })}
                  className={
                    "flex items-center justify-between rounded-2xl border px-4 py-[15px] text-[14px] cursor-pointer transition-all " +
                    (draft.gender === g.key
                      ? "bg-ink text-cream border-ink"
                      : "bg-card text-ink border-border")
                  }
                >
                  {g.label}
                  {draft.gender === g.key && <span className="text-terracotta">✓</span>}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="font-serif text-[30px] leading-[1.08] text-ink mt-3">
              Tes <span className="italic">mesures</span>
            </div>
            <div className="text-[13px] text-muted-2 mt-3 leading-[1.55]">
              Pour te proposer des coupes qui tombent bien. Renseigne ce que tu veux.
            </div>

            <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-6 mb-[11px]">Taille (cm)</div>
            <input
              type="number"
              inputMode="numeric"
              className="capin w-full bg-card border border-border rounded-xl px-4 py-[14px] text-[14px] text-ink font-sans"
              placeholder="ex. 168"
              value={draft.heightCm ?? ""}
              onChange={(e) => patch({ heightCm: e.target.value ? Number(e.target.value) : null })}
            />

            <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-6 mb-[11px]">
              Taille de confection
            </div>
            <div className="flex gap-2 flex-wrap">
              {CLOTHING_SIZES.map((sz) => (
                <Chip
                  key={sz}
                  label={sz}
                  active={draft.clothingSize === sz}
                  onClick={() => patch({ clothingSize: draft.clothingSize === sz ? null : sz })}
                />
              ))}
            </div>

            <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-6 mb-[11px]">Pointure (EU)</div>
            <input
              type="number"
              inputMode="numeric"
              className="capin w-full bg-card border border-border rounded-xl px-4 py-[14px] text-[14px] text-ink font-sans"
              placeholder="ex. 38"
              value={draft.shoeSize ?? ""}
              onChange={(e) => patch({ shoeSize: e.target.value ? Number(e.target.value) : null })}
            />
          </>
        )}

        {step === 2 && (
          <>
            <div className="font-serif text-[30px] leading-[1.08] text-ink mt-3">
              Ton <span className="italic">style</span>
            </div>
            <div className="text-[13px] text-muted-2 mt-3 leading-[1.55]">
              Choisis un ou plusieurs styles — ta capsule par défaut partira de là.
            </div>
            <div className="flex gap-2 flex-wrap mt-6">
              {STYLE_OPTIONS.map((st) => (
                <Chip
                  key={st}
                  label={st}
                  active={draft.styles.includes(st)}
                  onClick={() => patch({ styles: toggleIn(draft.styles, st) })}
                />
              ))}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="font-serif text-[30px] leading-[1.08] text-ink mt-3">
              Ta <span className="italic">morphologie</span>
            </div>
            <div className="text-[13px] text-muted-2 mt-3 leading-[1.55]">
              Pour privilégier les coupes qui te mettent en valeur.
            </div>
            <div className="flex flex-col gap-[10px] mt-6">
              {MORPHOLOGIES.map((m) => (
                <button
                  key={m.key}
                  onClick={() => patch({ morphology: m.key })}
                  className={
                    "text-left rounded-2xl border px-4 py-[13px] cursor-pointer transition-all " +
                    (draft.morphology === m.key
                      ? "bg-ink border-ink"
                      : "bg-card border-border")
                  }
                >
                  <div
                    className={
                      "text-[14px] " + (draft.morphology === m.key ? "text-cream" : "text-ink")
                    }
                  >
                    {m.label}
                  </div>
                  <div
                    className={
                      "text-[11.5px] mt-[2px] leading-[1.4] " +
                      (draft.morphology === m.key ? "text-[#a99c88]" : "text-muted")
                    }
                  >
                    {m.hint}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <div className="font-serif text-[30px] leading-[1.08] text-ink mt-3">
              Tes <span className="italic">goûts</span>
            </div>
            <div className="text-[13px] text-muted-2 mt-3 leading-[1.55]">
              Couleurs et envies — optionnel, mais ça affine les recommandations.
            </div>

            <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-6 mb-3">
              Couleurs préférées
            </div>
            <div className="flex gap-[13px] flex-wrap">
              {PALETTE.map(([name, hex]) => {
                const on = draft.favoriteColors.includes(name);
                return (
                  <button
                    key={name}
                    onClick={() => patch({ favoriteColors: toggleIn(draft.favoriteColors, name) })}
                    className="flex flex-col items-center gap-[6px] cursor-pointer"
                  >
                    <span
                      className="w-[38px] h-[38px] rounded-[11px]"
                      style={{
                        background: hex,
                        border: on ? "2px solid #1e1a16" : "1px solid rgba(30,26,22,.12)",
                        boxShadow: on ? "0 0 0 3px #f4eee4 inset" : "none",
                      }}
                    />
                    <span className={"text-[9.5px] " + (on ? "text-ink" : "text-muted")}>{name}</span>
                  </button>
                );
              })}
            </div>

            <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-6 mb-[11px]">Tes envies</div>
            <div className="flex gap-2 flex-wrap">
              {TASTE_OPTIONS.map((t) => (
                <Chip
                  key={t}
                  label={t}
                  active={draft.tastes.includes(t)}
                  onClick={() => patch({ tastes: toggleIn(draft.tastes, t) })}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex-1" />

      <button
        onClick={next}
        disabled={!stepValid}
        className={
          "mt-7 text-center rounded-full py-4 text-[13px] tracking-[.12em] uppercase transition-all " +
          (stepValid ? "bg-terracotta text-cream cursor-pointer" : "bg-[#e0d5c2] text-[#a99c88] cursor-default")
        }
      >
        {step >= STEPS.length - 1 ? "C'est parti" : "Continuer"}
      </button>
      {email && (
        <div className="text-[11px] text-muted text-center mt-3">Compte · {email}</div>
      )}
    </div>
  );
}
