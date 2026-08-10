"use client";

import { CATS, OCCASIONS, PALETTE, SEASONS, seasonSuggestion } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";
import { taillesBasFor, TAILLES_HAUT } from "@/lib/profile";
import type { CategoryKey } from "@/lib/types";

const POINTURES = ["35", "36", "37", "38", "39", "40", "41", "42"];
const BOTTOM_SIZED: CategoryKey[] = ["bas", "jupe", "combinaison"];

function chipCls(on: boolean): string {
  return (
    "px-4 py-[11px] rounded-full text-[13px] cursor-pointer font-sans border " +
    (on ? "bg-ink text-cream border-ink" : "bg-card text-ink border-border")
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-6 mb-[11px]">{children}</div>;
}

export default function AddScreen() {
  const { state, actions } = useCapsela();
  const { profile } = useAuth();

  const sizes =
    state.addCat === "chaussures"
      ? POINTURES
      : BOTTOM_SIZED.includes(state.addCat)
        ? taillesBasFor(profile.gender)
        : TAILLES_HAUT;
  // Taille pré-remplie depuis le profil, modifiable.
  const profileDefaultSize =
    state.addCat === "chaussures"
      ? profile.pointure
      : BOTTOM_SIZED.includes(state.addCat)
        ? profile.tailleBas
        : profile.tailleHaut;
  const selectedSize = state.addSize ?? profileDefaultSize;

  const suggestion = seasonSuggestion(state.addCat, state.addName);
  const seasonMissing = !state.addSeason;

  const save = () => {
    if (seasonMissing) return;
    if (state.addSize == null && selectedSize) actions.setAddSize(selectedSize);
    actions.saveItem();
  };

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-[30px]">
      <div className="flex items-center gap-[14px]">
        <button
          onClick={actions.addBack}
          className="w-[38px] h-[38px] rounded-full bg-card border border-border flex items-center justify-center text-[17px] text-ink cursor-pointer"
        >
          ←
        </button>
        <div className="font-serif text-[22px] text-ink">Ajouter une pièce</div>
      </div>

      <div className="mt-[22px] h-[190px] rounded-2xl border-[1.5px] border-dashed border-[#d6c7ae] bg-card flex flex-col items-center justify-center gap-[10px]">
        <div className="w-[54px] h-[54px] rounded-full bg-ink text-cream flex items-center justify-center text-2xl">▢</div>
        <div className="text-[13px] text-ink">Prendre la pièce en photo</div>
        <div className="text-[11px] text-muted">ou importer depuis ta galerie</div>
      </div>

      <Label>Nom de la pièce</Label>
      <input
        className="capin w-full bg-card border border-border rounded-xl px-4 py-[14px] text-[14px] text-ink font-sans"
        value={state.addName}
        onChange={(e) => actions.setAddName(e.target.value)}
        placeholder="ex. Chemise en lin écrue"
      />

      <Label>
        Marque <span className="opacity-60 normal-case tracking-normal">(optionnel)</span>
      </Label>
      <input
        className="capin w-full bg-card border border-border rounded-xl px-4 py-[14px] text-[14px] text-ink font-sans"
        value={state.addBrand}
        onChange={(e) => actions.setAddBrand(e.target.value)}
        placeholder="ex. Sézane"
      />

      <Label>Catégorie</Label>
      <div className="flex gap-2 flex-wrap">
        {CATS.map(([key, label]) => (
          <button key={key} onClick={() => actions.setAddCat(key)} className={chipCls(state.addCat === key)}>
            {label}
          </button>
        ))}
      </div>

      <Label>
        Taille <span className="opacity-60 normal-case tracking-normal">(reprise de ton profil, modifiable)</span>
      </Label>
      <div className="flex gap-2 flex-wrap">
        {sizes.map((t) => (
          <button key={t} onClick={() => actions.setAddSize(t)} className={chipCls(selectedSize === t)}>
            {t}
          </button>
        ))}
      </div>

      <Label>Couleur dominante</Label>
      <div className="grid grid-cols-4 gap-x-2 gap-y-[18px]">
        {PALETTE.map(([name, hex]) => {
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
              <span className={"text-[9.5px] text-center leading-[1.3] " + (on ? "text-ink" : "text-muted")}>
                {name}
              </span>
            </button>
          );
        })}
      </div>

      <Label>
        Saison <span className="text-terracotta">*</span>
      </Label>
      {seasonMissing && suggestion && (
        <div className="text-[12px] text-terracotta mb-[9px] leading-[1.4]">
          Suggestion : {suggestion} — confirme ou modifie ci-dessous.
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        {SEASONS.map((s) => (
          <button key={s} onClick={() => actions.setAddSeason(s)} className={chipCls(state.addSeason === s)}>
            {s}
          </button>
        ))}
      </div>

      <Label>Occasion</Label>
      <div className="flex gap-2 flex-wrap">
        {OCCASIONS.map(([key, label]) => (
          <button key={key} onClick={() => actions.setAddOccasion(key)} className={chipCls(state.addOccasion === key)}>
            {label}
          </button>
        ))}
      </div>

      <button
        onClick={save}
        className={
          "mt-7 w-full text-center rounded-full py-4 text-[13px] tracking-[.14em] uppercase " +
          (seasonMissing ? "bg-[#dccfbc] text-[#8a7c68] cursor-not-allowed" : "bg-terracotta text-cream cursor-pointer")
        }
      >
        Ajouter à mon dressing
      </button>
      {seasonMissing && (
        <div className="text-center text-[11.5px] text-terracotta mt-[10px]">
          Confirme la saison pour pouvoir ajouter cette pièce.
        </div>
      )}
    </div>
  );
}
