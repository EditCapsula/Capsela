"use client";

import { useRef, useState } from "react";
import BottomSheet from "@/components/BottomSheet";
import {
  ACCESSOIRE_TYPES,
  BAS_CATS,
  BIJOU_TYPES,
  CATS,
  OCCASIONS,
  OCC_SHORT,
  PALETTE,
  PALETTE_BIJOU,
  SAC_TYPES,
  SEASONS,
  SHOE_TYPES,
  SUBTYPES,
  seasonSuggestion,
} from "@/lib/data";
import { COUPES, MATIERES, isCoupeApplicable, isSizeApplicable } from "@/lib/attributes";
import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";
import { taillesBasFor, TAILLES_HAUT } from "@/lib/profile";
import type { AccessoireType, BijouType, CategoryKey, SacType, ShoeType } from "@/lib/types";

const POINTURES = ["35", "36", "37", "38", "39", "40", "41", "42"];
const BOTTOM_SIZED: CategoryKey[] = [...BAS_CATS, "jupe", "combinaison"];

function chipCls(on: boolean): string {
  return (
    "px-4 py-[11px] rounded-full text-[13px] cursor-pointer font-sans border " +
    (on ? "bg-ink text-cream border-ink" : "bg-card text-ink border-border")
  );
}

function SparkleIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2l2.1 7.9L22 12l-7.9 2.1L12 22l-2.1-7.9L2 12l7.9-2.1L12 2z" />
    </svg>
  );
}
function HangerIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3.2a1.5 1.5 0 1 1 1.3 2.3L12 7" />
      <path d="M12 7l9.3 6.6a1.4 1.4 0 0 1-.9 2.5H3.6a1.4 1.4 0 0 1-.9-2.5L12 7z" />
    </svg>
  );
}
function TshirtIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 4L4 7.2l2.4 2.6L8 8.4V20h8V8.4l1.6 1.4 2.4-2.6L16 4l-4 1.8L8 4z" />
    </svg>
  );
}
function LeafIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15c0-7 5.5-11 16-11 0 11-4.5 16.5-11.5 16.5C5 20.5 4 18 4 15z" />
      <path d="M5 20L15 10" />
    </svg>
  );
}
function FabricIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M4 8l16 8M4 12l16 8M4 4l16 8M8 4L4 8m16 8l-4 4" />
    </svg>
  );
}
function FitIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12h4M16 12h4M9 8l-3 4 3 4M15 8l3 4-3 4" />
    </svg>
  );
}
function CropIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M6 2v4M6 6H2M18 22v-4M18 18h4M6 6h12v12M18 18H6V6" />
    </svg>
  );
}
function InfoIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11.2v5.3M12 7.8v.01" />
    </svg>
  );
}

/** Pastille "détecté par Capsela" (recette 24/08/2026) — un seul marqueur commun partout, jamais de pourcentage de confiance. */
function AiTag() {
  return (
    <span className="inline-flex items-center gap-[3px] text-[9.5px] tracking-[.03em] text-terracotta bg-[#F0E5D6] rounded-full py-[2px] px-[7px] flex-shrink-0">
      <SparkleIcon /> IA
    </span>
  );
}

function FieldLabel({ children, ai }: { children: React.ReactNode; ai?: boolean }) {
  return (
    <div className="flex items-center gap-[8px] mt-6 mb-[11px]">
      <span className="text-[11px] tracking-[.16em] uppercase text-muted">{children}</span>
      {ai && <AiTag />}
    </div>
  );
}

/** Select natif stylé en bouton compact (icône + valeur + chevron) — remplace les grilles de chips pour catégorie/type/taille/saison (recette 24/08/2026, signalé : trop de scroll). */
function SelectField({
  icon,
  value,
  onChange,
  options,
  placeholder,
}: {
  icon?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <div className="relative flex-1 min-w-0">
      {icon && <span className="absolute left-[13px] top-1/2 -translate-y-1/2 text-terracotta pointer-events-none">{icon}</span>}
      <select
        className={
          "capin w-full bg-card border border-border rounded-xl py-[13px] pr-[30px] text-[13.5px] text-ink font-sans cursor-pointer " +
          (icon ? "pl-[34px]" : "pl-[13px]")
        }
        style={{ appearance: "none", WebkitAppearance: "none" }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="absolute right-[12px] top-1/2 -translate-y-1/2 text-muted pointer-events-none text-[10px]">▾</span>
    </div>
  );
}

function typeOptionsFor(cat: CategoryKey): string[] | undefined {
  if (cat === "chaussures") return SHOE_TYPES;
  if (cat === "sac") return SAC_TYPES;
  if (cat === "bijou") return BIJOU_TYPES;
  if (cat === "accessoire") return ACCESSOIRE_TYPES;
  return SUBTYPES[cat];
}

export default function AddScreen() {
  const { state, actions } = useCapsela();
  const { profile } = useAuth();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [sheet, setSheet] = useState<"characteristics" | "occasions" | null>(null);
  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Aperçu local instantané puis upload réel vers Supabase Storage
    // (correctif 22/08/2026, signalé : photo jamais affichée après
    // rechargement — l'ancien aperçu blob: n'était jamais persisté).
    if (file) actions.uploadAddPhoto(file);
  };

  const isShoe = state.addCat === "chaussures";
  const isSac = state.addCat === "sac";
  const isBijou = state.addCat === "bijou";
  const isAccessoire = state.addCat === "accessoire";
  const sizeApplicable = isSizeApplicable(state.addCat);
  const coupeApplicable = isCoupeApplicable(state.addCat);

  const sizes = isShoe ? POINTURES : BOTTOM_SIZED.includes(state.addCat) ? taillesBasFor(profile.gender) : TAILLES_HAUT;
  // Taille pré-remplie depuis le profil, modifiable.
  const profileDefaultSize = isShoe ? profile.pointure : BOTTOM_SIZED.includes(state.addCat) ? profile.tailleBas : profile.tailleHaut;
  const selectedSize = state.addSize ?? profileDefaultSize;

  const colorPalette = isBijou ? PALETTE_BIJOU : PALETTE;

  const suggestedSeason = seasonSuggestion(state.addCat, state.addName);
  const effectiveSeason = state.addSeason ?? suggestedSeason;
  const seasonMissing = !state.addSeason;
  const shoeTypeMissing = isShoe && !state.addShoeType;
  const subtypeMissing = false; // aucune catégorie n'exige de sous-type générique (seul le type de chaussure bloque, R-B6).
  const blocked = seasonMissing || shoeTypeMissing || subtypeMissing || state.addPhotoUploading;

  const typeOptions = typeOptionsFor(state.addCat);
  const typeValue = isShoe ? state.addShoeType : isSac ? state.addSacType : isBijou ? state.addBijouType : isAccessoire ? state.addAccessoireType : state.addSubtype;
  const typeTouched = isShoe ? state.addShoeTypeTouched : isSac ? state.addSacTypeTouched : isBijou ? state.addBijouTypeTouched : isAccessoire ? state.addAccessoireTypeTouched : state.addSubtypeTouched;
  const setTypeValue = (v: string) => {
    if (isShoe) actions.setAddShoeType(v as ShoeType);
    else if (isSac) actions.setAddSacType(v as SacType);
    else if (isBijou) actions.setAddBijouType(v as BijouType);
    else if (isAccessoire) actions.setAddAccessoireType(v as AccessoireType);
    else actions.setAddSubtype(v);
  };

  const photoAnalyzed = Boolean(state.addPhotoUrl) && !state.addPhotoAnalyzing;
  const nameIsAi = !state.addNameTouched && state.addName.trim().length > 0;
  const catIsAi = !state.addCatTouched && photoAnalyzed;
  const typeIsAi = !typeTouched && Boolean(typeValue);
  const colorIsAi = !state.addColorTouched && photoAnalyzed;
  const matiereIsAi = !state.addMatiereTouched && Boolean(state.addMatiere);
  const coupeIsAi = !state.addCoupeTouched && Boolean(state.addCoupe);
  const characteristicsAi = colorIsAi || matiereIsAi || coupeIsAi;
  const seasonIsAi = Boolean(effectiveSeason) && effectiveSeason === suggestedSeason;
  const occasionsIsAi = !state.addOccasionTouched;

  const save = () => {
    if (blocked) return;
    if (sizeApplicable && state.addSize == null && selectedSize) actions.setAddSize(selectedSize);
    if (state.addSeason == null && effectiveSeason) actions.setAddSeason(effectiveSeason);
    actions.saveItem();
  };

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-[100px]">
      <div className="relative pt-2">
        <button
          onClick={actions.addBack}
          className="absolute left-0 top-0 w-[38px] h-[38px] rounded-full bg-card border border-border flex items-center justify-center text-[17px] text-ink cursor-pointer"
        >
          ←
        </button>
        <div className="text-center px-[46px]">
          <div className="font-serif text-[21px] text-ink leading-[1.2]">
            {state.editingId != null ? "Modifier la pièce" : state.replacingId ? "Remplacer par ta pièce" : "Ajouter une pièce"}
          </div>
        </div>
      </div>

      <input ref={photoInputRef} type="file" accept="image/*" onChange={onPhotoChange} className="hidden" />
      <button
        type="button"
        onClick={() => photoInputRef.current?.click()}
        className={
          "mt-[18px] w-full h-[190px] rounded-2xl flex flex-col items-center justify-center gap-[10px] cursor-pointer relative overflow-hidden " +
          (state.addPhotoUrl ? "" : "border-[1.5px] border-dashed border-[#d6c7ae] bg-card")
        }
        style={
          state.addPhotoUrl
            ? { backgroundImage: `url(${state.addPhotoUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
            : undefined
        }
      >
        {state.addPhotoUploading && (
          <span
            className="absolute inset-0 flex items-center justify-center text-[12px] text-cream"
            style={{ background: "rgba(29,26,22,.45)" }}
          >
            Envoi de la photo…
          </span>
        )}
        {state.addPhotoUrl ? (
          <span
            className="absolute bottom-3 right-3 flex items-center gap-[6px] text-[11px] text-cream rounded-full px-3 py-[6px]"
            style={{ background: "rgba(29,26,22,.7)" }}
          >
            <CropIcon /> Changer la photo
          </span>
        ) : (
          <>
            <div className="w-[54px] h-[54px] rounded-full bg-ink text-cream flex items-center justify-center text-2xl">▢</div>
            <div className="text-[13px] text-ink">Prendre la pièce en photo</div>
            <div className="text-[11px] text-muted">ou importer depuis ta galerie</div>
          </>
        )}
      </button>
      {state.addPhotoAnalyzing && (
        <div className="text-[12px] text-terracotta mt-[9px] leading-[1.4]">
          Analyse de la photo… catégorie, couleur et matière vont se pré-remplir.
        </div>
      )}
      {photoAnalyzed && state.editingId == null && (
        <div className="text-[12px] text-muted mt-[9px] flex items-center gap-[5px]">
          L&apos;édit Capsela a analysé ta photo <SparkleIcon className="text-terracotta" />
        </div>
      )}

      <FieldLabel ai={nameIsAi}>Nom de la pièce</FieldLabel>
      <input
        className="capin w-full bg-card border border-border rounded-xl px-4 py-[14px] text-[14px] text-ink font-sans"
        value={state.addName}
        onChange={(e) => actions.setAddName(e.target.value)}
        placeholder="ex. Chemise en lin écrue"
      />

      <FieldLabel>
        Marque <span className="opacity-60 normal-case tracking-normal">(optionnel)</span>
      </FieldLabel>
      <input
        className="capin w-full bg-card border border-border rounded-xl px-4 py-[14px] text-[14px] text-ink font-sans"
        value={state.addBrand}
        onChange={(e) => actions.setAddBrand(e.target.value)}
        placeholder="ex. Sézane"
      />

      <div className="flex items-center gap-[16px] mt-6 mb-[11px]">
        <div className="flex items-center gap-[6px] flex-1">
          <span className="text-[11px] tracking-[.16em] uppercase text-muted">Catégorie</span>
          {catIsAi && <AiTag />}
        </div>
        {typeOptions && typeOptions.length > 0 && (
          <div className="flex items-center gap-[6px] flex-1">
            <span className="text-[11px] tracking-[.16em] uppercase text-muted">Type</span>
            {typeIsAi && <AiTag />}
          </div>
        )}
        {sizeApplicable && (
          <div className="w-[76px] flex-shrink-0 text-[11px] tracking-[.16em] uppercase text-muted">
            {isShoe ? "Pointure" : "Taille"}
          </div>
        )}
      </div>
      <div className="flex items-start gap-[8px]">
        <SelectField
          icon={<HangerIcon />}
          value={state.addCat}
          onChange={(v) => actions.setAddCat(v as CategoryKey)}
          options={CATS.map(([key, label]) => ({ value: key, label }))}
        />
        {typeOptions && typeOptions.length > 0 && (
          <SelectField
            icon={<TshirtIcon />}
            value={typeValue || ""}
            onChange={setTypeValue}
            options={typeOptions.map((t) => ({ value: t, label: t }))}
            placeholder={isShoe ? "Choisir" : "Non précisé"}
          />
        )}
        {sizeApplicable && (
          <div className="w-[76px] flex-shrink-0">
            <SelectField
              value={selectedSize ?? ""}
              onChange={(v) => actions.setAddSize(v)}
              options={sizes.map((t) => ({ value: t, label: t }))}
              placeholder="—"
            />
          </div>
        )}
      </div>
      {shoeTypeMissing && (
        <div className="text-[11.5px] text-terracotta mt-[8px]">Choisis un type de chaussure pour pouvoir ajouter cette pièce.</div>
      )}

      {/* "Analysé par Capsela" (recette 24/08/2026) — couleur/matière estimée/
          coupe repliées en résumé compact, jamais le nuancier complet ni la
          liste des matières affichés d'office ; tout reste modifiable via
          "Modifier ces caractéristiques" (bottom sheet), rien n'est perdu. */}
      <div className="mt-6 bg-card border border-border rounded-[16px] px-4 py-[16px]">
        <div className="flex items-center gap-[7px] mb-[14px]">
          <span className="text-[11px] tracking-[.16em] uppercase text-ink font-semibold">Analysé par L&apos;édit Capsela</span>
          {characteristicsAi && <AiTag />}
        </div>
        <div className="grid grid-cols-3 gap-[8px] text-center">
          <div className="flex flex-col items-center gap-[7px]">
            <span
              className="w-[34px] h-[34px] rounded-full flex-shrink-0"
              style={{ background: state.addColor.hex, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.12)" }}
            />
            <div>
              <div className="text-[10px] tracking-[.08em] uppercase text-muted">Couleur</div>
              <div className="text-[12.5px] text-ink mt-[2px] leading-[1.2]">{state.addColor.name}</div>
            </div>
          </div>
          <div className="flex flex-col items-center gap-[7px]">
            <span className="w-[34px] h-[34px] rounded-full bg-warm-bg flex items-center justify-center text-warm-text flex-shrink-0">
              <FabricIcon />
            </span>
            <div>
              <div className="text-[10px] tracking-[.08em] uppercase text-muted">Matière estimée</div>
              <div className="text-[12.5px] text-ink mt-[2px] leading-[1.2]">{state.addMatiere || "Non précisée"}</div>
            </div>
          </div>
          {coupeApplicable && (
            <div className="flex flex-col items-center gap-[7px]">
              <span className="w-[34px] h-[34px] rounded-full bg-warm-bg flex items-center justify-center text-warm-text flex-shrink-0">
                <FitIcon />
              </span>
              <div>
                <div className="text-[10px] tracking-[.08em] uppercase text-muted">Coupe</div>
                <div className="text-[12.5px] text-ink mt-[2px] leading-[1.2]">{state.addCoupe || "Non précisée"}</div>
              </div>
            </div>
          )}
        </div>
        <button
          onClick={() => setSheet("characteristics")}
          className="mt-[14px] text-[12.5px] text-terracotta cursor-pointer flex items-center gap-[4px]"
        >
          Modifier ces caractéristiques ›
        </button>
      </div>

      <FieldLabel ai={seasonIsAi}>Saison</FieldLabel>
      <SelectField
        icon={<LeafIcon />}
        value={effectiveSeason ?? ""}
        onChange={(v) => actions.setAddSeason(v as (typeof SEASONS)[number])}
        options={SEASONS.map((s) => ({ value: s, label: s }))}
        placeholder="À confirmer"
      />

      <div className="flex items-center gap-[8px] mt-6 mb-[11px]">
        <span className="text-[11px] tracking-[.16em] uppercase text-muted">Occasions recommandées</span>
        {occasionsIsAi && <AiTag />}
      </div>
      <div className="flex gap-2 flex-wrap">
        {state.addOccasion.length > 0 ? (
          state.addOccasion.map((o) => (
            <span key={o} className={chipCls(true)}>
              {OCC_SHORT[o] || o}
            </span>
          ))
        ) : (
          <span className="text-[12.5px] text-muted">Aucune occasion sélectionnée.</span>
        )}
      </div>
      <button
        onClick={() => setSheet("occasions")}
        className="mt-[10px] text-[12.5px] text-terracotta cursor-pointer flex items-center gap-[4px]"
      >
        Modifier les occasions ›
      </button>

      <div className="flex items-start gap-[8px] mt-6 text-muted">
        <InfoIcon className="mt-[2px] flex-shrink-0" />
        <span className="text-[11.5px] leading-[1.45]">Tu pourras modifier toutes ces informations à tout moment.</span>
      </div>

      <button
        onClick={save}
        className={
          "mt-6 w-full text-center rounded-full py-4 text-[13px] tracking-[.14em] uppercase " +
          (blocked ? "bg-[#dccfbc] text-[#8a7c68] cursor-not-allowed" : "bg-terracotta active:bg-terracotta-hover text-cream cursor-pointer")
        }
      >
        {state.editingId != null ? "Enregistrer les modifications" : "Ajouter à mon dressing"}
      </button>
      {blocked && !state.addPhotoUploading && (
        <div className="text-center text-[11.5px] text-terracotta mt-[10px]">
          {shoeTypeMissing ? "Confirme le type de chaussure pour pouvoir ajouter cette pièce." : "Confirme la saison pour pouvoir ajouter cette pièce."}
        </div>
      )}
      {state.addPhotoUploading && (
        <div className="text-center text-[11.5px] text-terracotta mt-[10px]">Envoi de la photo en cours…</div>
      )}

      <BottomSheet title="Caractéristiques" open={sheet === "characteristics"} onClose={() => setSheet(null)}>
        <div className="text-[11px] tracking-[.16em] uppercase text-muted mb-[11px]">Couleur dominante</div>
        <div className="grid grid-cols-4 gap-x-2 gap-y-[18px]">
          {colorPalette.map(([name, hex]) => {
            const on = state.addColor.hex === hex;
            return (
              <button
                key={hex}
                onClick={() => actions.setAddColor({ name, hex })}
                className="flex flex-col items-center gap-[7px] cursor-pointer"
              >
                <span
                  className="w-[38px] h-[38px] rounded-[11px]"
                  style={{
                    background: hex,
                    border: on ? "2px solid #1D1A16" : "1px solid rgba(29,26,22,.12)",
                    boxShadow: on ? "0 0 0 3px #F3EEE5 inset" : "none",
                  }}
                />
                <span className={"text-[9.5px] text-center leading-[1.3] " + (on ? "text-ink" : "text-muted")}>{name}</span>
              </button>
            );
          })}
        </div>

        <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-[26px] mb-[11px]">
          Matière <span className="opacity-60 normal-case tracking-normal">(estimation, jamais garantie sur photo)</span>
        </div>
        <select
          className="capin w-full bg-card border border-border rounded-xl px-4 py-[14px] text-[14px] text-ink font-sans"
          value={state.addMatiere ?? ""}
          onChange={(e) => actions.setAddMatiere((e.target.value || null) as typeof state.addMatiere)}
        >
          <option value="">Non précisée</option>
          {MATIERES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        {coupeApplicable && (
          <>
            <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-[26px] mb-[11px]">Coupe</div>
            <div className="flex gap-2 flex-wrap">
              {COUPES.map((c) => (
                <button key={c} onClick={() => actions.setAddCoupe(c)} className={chipCls(state.addCoupe === c)}>
                  {c}
                </button>
              ))}
            </div>
          </>
        )}

        <button
          onClick={() => setSheet(null)}
          className="mt-[26px] w-full bg-terracotta active:bg-terracotta-hover text-cream text-center rounded-full py-[14px] text-[12.5px] tracking-[.1em] uppercase cursor-pointer"
        >
          Terminé
        </button>
      </BottomSheet>

      <BottomSheet title="Occasions" open={sheet === "occasions"} onClose={() => setSheet(null)}>
        <div className="text-[12.5px] text-muted mb-[16px] leading-[1.45]">Plusieurs choix possibles.</div>
        <div className="flex gap-2 flex-wrap">
          {OCCASIONS.map(([key, label]) => (
            <button key={key} onClick={() => actions.setAddOccasion(key)} className={chipCls(state.addOccasion.includes(key))}>
              {OCC_SHORT[key] || label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setSheet(null)}
          className="mt-[26px] w-full bg-terracotta active:bg-terracotta-hover text-cream text-center rounded-full py-[14px] text-[12.5px] tracking-[.1em] uppercase cursor-pointer"
        >
          Terminé
        </button>
      </BottomSheet>
    </div>
  );
}
