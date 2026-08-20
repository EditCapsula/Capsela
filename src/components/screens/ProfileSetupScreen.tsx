"use client";

import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";
import {
  AFFINITE_OPTIONS,
  GENDERS,
  INTENSITE_OPTIONS,
  MAX_PALETTE_COULEURS,
  MIN_PALETTE_COULEURS,
  MORPHOLOGIES,
  MORPHOLOGY_LABELS,
  MORPHO_HINTS,
  PAL_COULEURS,
  STYLE_IDS,
  TAILLES_HAUT,
  paletteColorName,
  styleConfigFor,
  tailleBasLabelFor,
  taillesBasFor,
  type Affinite,
  type Intensite,
  type Profile,
} from "@/lib/profile";

/**
 * Étape Morphologie exclue pour les profils Homme (Tâche 4, arbitrages du
 * 20/08/2026 : taxonomie homme non activée en P0) — filtrée à l'usage dans
 * le composant, jamais ce tableau brut, pour que STEPS reflète toujours le
 * parcours réellement servi.
 */
const ALL_STEPS = [
  { key: "genre", kicker: "Genre", title: "Comment tu te définis ?", subtitle: "Pour des suggestions plus justes, jamais pour t’enfermer dans une case." },
  { key: "pal_couleurs", kicker: "Ta palette", title: "Quelles couleurs aimes-tu porter ?", subtitle: "De 1 à 6 couleurs — celles qui reviennent le plus souvent dans tes tenues." },
  { key: "pal_ressenti", kicker: "Ta palette", title: "Deux précisions rapides", subtitle: "Elles affinent nos suggestions, sans jamais écarter une couleur que tu as choisie." },
  { key: "pal_recap", kicker: "Ta palette", title: "Voilà ta palette", subtitle: "Tu pourras la retoucher quand tu veux depuis ton profil." },
  { key: "taille", kicker: "Taille", title: "Quelles sont tes tailles habituelles ?", subtitle: "Ça nous aide à te proposer des tenues qui tombent bien." },
  { key: "style", kicker: "Style", title: "Quel style te ressemble le plus ?", subtitle: "Choisis celui qui correspond le mieux à ta façon de t'habiller." },
  { key: "morpho", kicker: "Morphologie", title: "Et ta silhouette ?", subtitle: "Pour affiner nos recommandations de coupes." },
] as const;

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

/** Grille de pastilles de la palette personnelle — sélection unique ou multiple (jusqu'à 3, éviction FIFO). */
function PaletteDots({
  options,
  selected,
  onSelect,
}: {
  options: [string, string][];
  selected: string[];
  onSelect: (hex: string) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-x-3 gap-y-5 mt-[26px]">
      {options.map(([name, hex]) => {
        const on = selected.includes(hex);
        return (
          <button key={hex} onClick={() => onSelect(hex)} className="flex flex-col items-center gap-[8px] cursor-pointer">
            <span
              className="w-11 h-11 rounded-full"
              style={{
                background: hex,
                boxShadow: on ? "0 0 0 2px #F3EEE5, 0 0 0 4px #A66950" : "inset 0 0 0 1px rgba(29,26,22,.10)",
              }}
            />
            <span className={"text-[10px] text-center leading-[1.3] " + (on ? "text-ink" : "text-muted")}>{name}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function ProfileSetupScreen() {
  const { profile, saveProfile } = useAuth();
  const { state, actions } = useCapsela();
  const [draft, setDraft] = useState<Profile>(profile);
  const STEPS = ALL_STEPS.filter((s) => s.key !== "morpho" || draft.gender === "femme");
  const [step, setStep] = useState(() =>
    Math.max(0, STEPS.findIndex((s) => s.key === (state.profileSetupStep || "genre")))
  );
  const [guideOpen, setGuideOpen] = useState(false);

  const patch = (p: Partial<Profile>) => setDraft((d) => ({ ...d, ...p }));

  const toggleCouleur = (hex: string) => {
    const cur = draft.paletteCouleurs;
    if (cur.includes(hex)) return patch({ paletteCouleurs: cur.filter((x) => x !== hex) });
    patch({ paletteCouleurs: cur.length >= MAX_PALETTE_COULEURS ? [...cur.slice(1), hex] : [...cur, hex] });
  };
  // Sélection unique (Tâche 7, arbitrages du 20/08/2026 — reconduit après
  // un essai de multi-sélection le même jour) : un seul id stocké, la carte
  // précédente se désélectionne automatiquement.
  const selectStyle = (id: string) => patch({ styles: [id] });

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
  // Seules les étapes style et palette exigent une sélection non vide
  // (styles : recette 20/08/2026 ; palette : Tâche 8, min 1 couleur) — les
  // autres étapes gardent leur comportement existant, jamais bloquant.
  const canContinue =
    (meta.key !== "style" || draft.styles.length > 0) &&
    (meta.key !== "pal_couleurs" || draft.paletteCouleurs.length >= MIN_PALETTE_COULEURS);

  const recapRows = [
    {
      label: "Couleurs",
      value: draft.paletteCouleurs.map(paletteColorName).filter(Boolean).join(", ") || "à choisir",
      swatches: draft.paletteCouleurs,
    },
    { label: "Affinité", value: draft.paletteAffinite || "non précisée", swatches: [] as string[] },
    { label: "Intensité", value: draft.paletteIntensite || "non précisée", swatches: [] as string[] },
  ];

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
              key={s.key}
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

      {meta.key === "genre" && (
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

      {meta.key === "pal_couleurs" && (
        <PaletteDots options={PAL_COULEURS} selected={draft.paletteCouleurs} onSelect={toggleCouleur} />
      )}

      {meta.key === "pal_ressenti" && (
        <div className="mt-[26px]">
          <div className="text-[11px] tracking-[.16em] uppercase text-muted mb-[11px]">
            Tes couleurs penchent plutôt vers…
          </div>
          <div className="flex gap-2 flex-wrap">
            {AFFINITE_OPTIONS.map((a: Affinite) => (
              <button key={a} onClick={() => patch({ paletteAffinite: a })} className={chipCls(draft.paletteAffinite === a)}>
                {a}
              </button>
            ))}
          </div>
          <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-6 mb-[11px]">Et leur intensité ?</div>
          <div className="flex gap-2 flex-wrap">
            {INTENSITE_OPTIONS.map((it: Intensite) => (
              <button key={it} onClick={() => patch({ paletteIntensite: it })} className={chipCls(draft.paletteIntensite === it)}>
                {it}
              </button>
            ))}
          </div>
        </div>
      )}

      {meta.key === "pal_recap" && (
        <div className="mt-6 bg-card border border-border rounded-[18px] p-[18px]">
          {recapRows.map((r) => (
            <div key={r.label} className="flex items-center gap-3 py-[11px] border-b border-border last:border-b-0">
              <span className="w-[70px] flex-shrink-0 text-[11px] tracking-[.1em] uppercase text-muted">{r.label}</span>
              <div className="flex items-center gap-[6px] flex-wrap flex-1 min-w-0">
                {r.swatches.map((hex) => (
                  <span
                    key={hex}
                    className="w-[15px] h-[15px] rounded-full flex-shrink-0"
                    style={{ background: hex, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.10)" }}
                  />
                ))}
                <span className="text-[12.5px] text-ink">{r.value}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {meta.key === "taille" && (
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

      {meta.key === "style" && (
        <div className="grid grid-cols-2 gap-[11px] mt-[26px]">
          {STYLE_IDS.map((id) => {
            const cfg = styleConfigFor(draft.gender)[id];
            const on = draft.styles[0] === id;
            return (
              <button
                key={id}
                onClick={() => selectStyle(id)}
                className={
                  "relative text-left rounded-[16px] overflow-hidden border cursor-pointer flex flex-col " +
                  (on ? "border-terracotta" : "border-border")
                }
                style={{ background: on ? "#F6EBE2" : "#FBF8F3" }}
              >
                <div
                  className="w-full flex-shrink-0"
                  style={{
                    aspectRatio: "4/3",
                    backgroundColor: "#E6DCCB",
                    backgroundImage: `url(${cfg.asset})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                  }}
                />
                <span
                  className="absolute top-[9px] right-[9px] w-[21px] h-[21px] rounded-full flex items-center justify-center border-2"
                  style={{ background: "#FBF8F3", borderColor: on ? "#A66950" : "#DFD3BE" }}
                >
                  {on && <span className="w-[10px] h-[10px] rounded-full" style={{ background: "#A66950" }} />}
                </span>
                <div className="px-[13px] py-[12px]">
                  <div className="font-serif text-[15px] text-ink leading-[1.2]">{cfg.label}</div>
                  <div className="text-[11px] text-muted mt-[4px] leading-[1.35]">{cfg.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {meta.key === "morpho" && (
        <>
          <div className="flex flex-col gap-[10px] mt-[26px]">
            {MORPHOLOGIES.map((m) => (
              <OptionRow
                key={m}
                label={MORPHOLOGY_LABELS[m]}
                on={draft.morphology === m}
                onClick={() => patch({ morphology: m })}
              />
            ))}
          </div>
          <button onClick={() => setGuideOpen(!guideOpen)} className="flex items-center gap-[7px] mt-[18px] cursor-pointer">
            <span className="text-[12.5px] text-terracotta">Comment savoir quelle est ma morphologie ?</span>
          </button>
          {guideOpen && (
            <div className="bg-card border border-border rounded-[14px] px-4 py-[14px] mt-[10px] flex flex-col gap-[11px]">
              {MORPHOLOGIES.map((m) => (
                <div key={m}>
                  <div className="text-[12.5px] text-ink font-semibold">{MORPHOLOGY_LABELS[m]}</div>
                  <div className="text-[12px] text-muted mt-[2px] leading-[1.4]">{MORPHO_HINTS[m]}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="flex-1" />
      <button
        onClick={canContinue ? next : undefined}
        disabled={!canContinue}
        className={
          "mt-[22px] text-center rounded-full py-4 text-[13px] tracking-[.1em] uppercase " +
          (canContinue ? "cursor-pointer bg-terracotta text-cream" : "cursor-not-allowed bg-[#dccfbc] text-[#8a7c68]")
        }
      >
        {isLast ? "Terminer le profil" : "Continuer"}
      </button>
    </div>
  );
}
