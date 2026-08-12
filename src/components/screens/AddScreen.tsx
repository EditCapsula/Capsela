"use client";

import { ACCESSOIRE_TYPES, BAS_CATS, BIJOU_TYPES, CATLABEL, CATS, OCCASIONS, OCC_SHORT, PALETTE, PALETTE_BIJOU, SAC_TYPES, SEASONS, SHOE_TYPES, SUBTYPES, SUBTYPE_REQUIRED, seasonSuggestion } from "@/lib/data";
import { COUPES, MATIERES, isCoupeApplicable, isSizeApplicable } from "@/lib/attributes";
import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";
import { taillesBasFor, TAILLES_HAUT } from "@/lib/profile";
import type { CategoryKey } from "@/lib/types";

const POINTURES = ["35", "36", "37", "38", "39", "40", "41", "42"];
const BOTTOM_SIZED: CategoryKey[] = [...BAS_CATS, "jupe", "combinaison"];

function chipCls(on: boolean): string {
  return (
    "px-4 py-[11px] rounded-full text-[13px] cursor-pointer font-sans border " +
    (on ? "bg-ink text-cream border-ink" : "bg-card text-ink border-border")
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-6 mb-[11px]">{children}</div>;
}

/** Sous-menu "↳ Préciser : X" — reprend le rattachement visuel du prototype (trait vertical + libellé en terracotta). */
function SubMenu({ label, note, children }: { label: string; note?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex gap-[11px] mt-[14px]">
      <div className="w-[1.5px] flex-shrink-0 bg-border rounded-sm ml-[7px]" />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] tracking-[.16em] uppercase text-terracotta mb-[10px]">
          ↳ Préciser : {label}{" "}
          {note && <span className="opacity-55 normal-case tracking-normal text-muted">{note}</span>}
        </div>
        <div className="flex gap-2 flex-wrap">{children}</div>
      </div>
    </div>
  );
}

export default function AddScreen() {
  const { state, actions } = useCapsela();
  const { profile } = useAuth();

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

  const suggestion = seasonSuggestion(state.addCat, state.addName);
  const seasonMissing = !state.addSeason;
  const shoeTypeMissing = isShoe && !state.addShoeType;
  const subtypeOptions = SUBTYPES[state.addCat];
  const subtypeRequired = SUBTYPE_REQUIRED.includes(state.addCat);
  const subtypeMissing = subtypeRequired && !state.addSubtype;
  const blocked = seasonMissing || shoeTypeMissing || subtypeMissing;

  const save = () => {
    if (blocked) return;
    if (sizeApplicable && state.addSize == null && selectedSize) actions.setAddSize(selectedSize);
    actions.saveItem();
  };

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-[100px]">
      <div className="flex items-center gap-[14px]">
        <button
          onClick={actions.addBack}
          className="w-[38px] h-[38px] rounded-full bg-card border border-border flex items-center justify-center text-[17px] text-ink cursor-pointer"
        >
          ←
        </button>
        <div className="font-serif text-[22px] text-ink">
          {state.replacingId ? "Remplacer par ta pièce" : "Ajouter une pièce"}
        </div>
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

      {isShoe && (
        <SubMenu label="chaussure">
          {SHOE_TYPES.map((t) => (
            <button key={t} onClick={() => actions.setAddShoeType(t)} className={chipCls(state.addShoeType === t)}>
              {t}
            </button>
          ))}
        </SubMenu>
      )}

      {subtypeOptions && subtypeOptions.length > 0 && (
        <SubMenu label={CATLABEL[state.addCat].toLowerCase()} note={!subtypeRequired && "(facultatif)"}>
          {subtypeOptions.map((t) => (
            <button key={t} onClick={() => actions.setAddSubtype(t)} className={chipCls(state.addSubtype === t)}>
              {t}
            </button>
          ))}
        </SubMenu>
      )}

      {isSac && (
        <SubMenu label="sac" note="(détecté automatiquement, à confirmer)">
          {SAC_TYPES.map((t) => (
            <button key={t} onClick={() => actions.setAddSacType(t)} className={chipCls(state.addSacType === t)}>
              {t}
            </button>
          ))}
        </SubMenu>
      )}

      {isBijou && (
        <SubMenu label="bijou" note="(détecté automatiquement, à confirmer)">
          {BIJOU_TYPES.map((t) => (
            <button key={t} onClick={() => actions.setAddBijouType(t)} className={chipCls(state.addBijouType === t)}>
              {t}
            </button>
          ))}
        </SubMenu>
      )}

      {isAccessoire && (
        <SubMenu label="accessoire" note="(détecté automatiquement, à confirmer)">
          {ACCESSOIRE_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => actions.setAddAccessoireType(t)}
              className={chipCls(state.addAccessoireType === t)}
            >
              {t}
            </button>
          ))}
        </SubMenu>
      )}

      {sizeApplicable && (
        <>
          <Label>
            {isShoe ? "Pointure" : "Taille"} <span className="opacity-60 normal-case tracking-normal">(reprise de ton profil, modifiable)</span>
          </Label>
          {isShoe ? (
            <input
              className="capin bg-card border border-border rounded-[14px] px-4 py-[13px] text-[14px] text-ink font-sans w-[120px]"
              value={state.addSize ?? ""}
              onChange={(e) => actions.setAddSize(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
              placeholder="Ex. 39"
              inputMode="numeric"
            />
          ) : (
            <div className="flex gap-2 flex-wrap">
              {sizes.map((t) => (
                <button key={t} onClick={() => actions.setAddSize(t)} className={chipCls(selectedSize === t)}>
                  {t}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <Label>Couleur dominante</Label>
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

      <Label>
        Occasion <span className="opacity-60 normal-case tracking-normal">(plusieurs choix possibles)</span>
      </Label>
      <div className="flex gap-2 flex-wrap">
        {OCCASIONS.map(([key, label]) => (
          <button key={key} onClick={() => actions.setAddOccasion(key)} className={chipCls(state.addOccasion.includes(key))}>
            {OCC_SHORT[key] || label}
          </button>
        ))}
      </div>

      <Label>
        Matière <span className="opacity-60 normal-case tracking-normal">(détectée automatiquement, modifiable)</span>
      </Label>
      <div className="flex gap-2 flex-wrap">
        {MATIERES.map((m) => (
          <button key={m} onClick={() => actions.setAddMatiere(m)} className={chipCls(state.addMatiere === m)}>
            {m}
          </button>
        ))}
      </div>

      {coupeApplicable && (
        <>
          <Label>Coupe</Label>
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
        onClick={save}
        className={
          "mt-7 w-full text-center rounded-full py-4 text-[13px] tracking-[.14em] uppercase " +
          (blocked ? "bg-[#dccfbc] text-[#8a7c68] cursor-not-allowed" : "bg-terracotta text-cream cursor-pointer")
        }
      >
        Ajouter à mon dressing
      </button>
      {blocked && (
        <div className="text-center text-[11.5px] text-terracotta mt-[10px]">
          {(() => {
            const missing: string[] = [];
            if (seasonMissing) missing.push("la saison");
            if (shoeTypeMissing) missing.push("le type de chaussure");
            else if (subtypeMissing) missing.push("le type de pièce");
            return "Confirme " + missing.join(" et ") + " pour pouvoir ajouter cette pièce.";
          })()}
        </div>
      )}
    </div>
  );
}
