"use client";

import { aDesManches, MANCHES } from "@/lib/manches";
import { useRef, useState } from "react";
import BottomSheet from "@/components/BottomSheet";
import { GlypheOccasion } from "@/components/GlyphesOccasion";
import {
  ACCESSOIRE_TYPES,
  BAS_CATS,
  BIJOU_TYPES,
  CATS,
  OCCASIONS,
  occasionShortLabel,
  FAMILLES_COULEURS,
  PALETTE,
  PALETTE_BIJOU,
  SAC_TYPES,
  SHOE_TYPES,
  SUBTYPES,
  seasonSuggestion,
} from "@/lib/data";
import { QUATRE_SAISONS, saisonsParDefaut } from "@/lib/saisons";
import { COUPES, MATIERES, isCoupeApplicable, isSizeApplicable, occasionsRetenues } from "@/lib/attributes";
import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";
import { taillesBasFor, TAILLES_HAUT } from "@/lib/profile";
import type { AccessoireType, BijouType, CategoryKey, OccasionKey, SacType, ShoeType } from "@/lib/types";
import BoutonRetour from "@/components/BoutonRetour";
import Button from "@/components/Button";

const POINTURES = ["35", "36", "37", "38", "39", "40", "41", "42"];
const BOTTOM_SIZED: CategoryKey[] = [...BAS_CATS, "jupe", "combinaison"];

function chipCls(on: boolean): string {
  return (
    "px-4 py-[11px] rounded-full text-[13px] cursor-pointer font-sans border " +
    (on ? "bg-ink text-cream border-ink" : "bg-card text-ink border-border")
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

/** Mêmes tracés que dans PieceScreen : le geste « photo » se reconnaît d'un écran à l'autre. */
function CameraIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h3l1.6-2.4h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.4" />
    </svg>
  );
}

function GalerieIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.6" />
      <path d="M21 16l-5-5-5.5 5.5L8 14l-5 5" />
    </svg>
  );
}

/**
 * Titre de section. Le ✦ terracotta signale ce que Capsela a proposé — le
 * même signe qu'ailleurs dans l'app (Tenue, Capsule), et un seul : la refonte
 * du 27/09/2026 retire les pastilles « IA » posées champ par champ, qui
 * donnaient à l'écran un air d'outil technique plutôt que d'aide éditoriale.
 */
function TitreSection({ children, suggere }: { children: React.ReactNode; suggere?: boolean }) {
  return (
    <div className="flex items-center gap-[7px] mb-[11px]">
      {suggere && (
        <span className="font-serif italic text-[13px] text-terracotta" aria-hidden="true">
          ✦
        </span>
      )}
      <span className={"t-surtitre " + (suggere ? "text-terracotta" : "text-muted")}>{children}</span>
    </div>
  );
}

/**
 * Cellule de la carte des attributs essentiels : la valeur s'affiche en
 * texte, sur deux lignes au besoin, et un select natif transparent couvre
 * toute la cellule. Un select visible tronquait les libellés longs dès
 * 360 px (« Chaussur… », « Veste / Blaz… »). Natif et non une liste maison :
 * le sélecteur du système est celui que le pouce connaît, et il gère seul le
 * clavier et l'accessibilité.
 */
function SelectNu({
  label,
  value,
  onChange,
  options,
  placeholder,
  enAttente,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  /** Valeur requise encore vide : le libellé d'attente passe en terracotta. */
  enAttente?: boolean;
}) {
  const affiche = options.find((o) => o.value === value)?.label ?? placeholder ?? "";
  return (
    <label className="relative block min-w-0 pl-[12px] pr-[22px] pt-[11px] pb-[12px] cursor-pointer">
      <span className="t-label text-muted block">{label}</span>
      <span
        className={
          "block mt-[5px] text-[14px] font-medium leading-[1.25] break-words " + (enAttente ? "text-terracotta" : "text-ink")
        }
        aria-hidden="true"
      >
        {affiche}
      </span>
      <select
        aria-label={label}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
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
      <span className="absolute right-[10px] top-[33px] text-muted pointer-events-none text-[10px]" aria-hidden="true">
        ▾
      </span>
    </label>
  );
}

/**
 * Libellés d'occasion propres à cet écran (27/09/2026). « Date » se lit
 * « Rendez-vous », comme le demande la refonte ; mais OCC_SHORT donne déjà
 * « Rendez-vous » à `entretien` (« Rendez-vous important »), et deux chips
 * portant le même mot seraient indiscernables. `entretien` prend donc ici
 * « Entretien », tiré de son propre sous-libellé (« Entretien, réunion
 * clé »). Les clés métier ne changent pas, les autres écrans non plus.
 */
function libelleOccasion(o: OccasionKey): string {
  if (o === "date") return "Rendez-vous";
  if (o === "entretien") return "Entretien";
  return occasionShortLabel(o);
}

function typeOptionsFor(cat: CategoryKey): string[] | undefined {
  if (cat === "chaussures") return SHOE_TYPES;
  if (cat === "sac") return SAC_TYPES;
  if (cat === "bijou") return BIJOU_TYPES;
  if (cat === "accessoire") return ACCESSOIRE_TYPES;
  return SUBTYPES[cat];
}

/**
 * AJOUTER UNE PIÈCE — refonte du 27/09/2026.
 *
 * L'écran ne se lit plus comme un formulaire à remplir mais comme une
 * vérification : Capsela a compris la pièce, l'utilisatrice relit, modifie
 * au besoin, ajoute. Hiérarchie : photo, analyse, nom suggéré, attributs
 * essentiels, caractéristiques, saison, occasions, puis l'action — fixée en
 * pied d'écran, hors du défilement, pour rester sous le pouce.
 *
 * Ce qui ne bloque plus : la saison (saisonsParDefaut, présélectionnées et
 * modifiables, quatre saisons au choix). Ce qui bloque encore, parce que la sauvegarde elle-même
 * l'exige (saveItem) : le type de chaussure (R-B6, nécessaire au moteur)
 * et l'envoi de la photo en cours (jamais d'aperçu local persisté).
 *
 * Aucune mention d'analyse sans analyse réelle : « a analysé ta pièce » et
 * « détectées » suivent addPhotoAnalysee, pas la seule présence d'une photo
 * — en mode démo ou sur un échec de l'analyse, il n'y a rien eu à détecter.
 */
export default function AddScreen() {
  const { state, actions } = useCapsela();
  const { profile } = useAuth();
  // Deux champs distincts (correctif 10/09/2026, signalé : « je ne peux que
  // choisir dans la galerie, je ne peux pas prendre une photo »). Un seul
  // `accept="image/*"` laisse le système décider s'il propose l'appareil
  // photo — beaucoup de navigateurs mobiles, et la plupart des vues intégrées
  // aux applications, ouvrent directement la galerie sans jamais l'offrir.
  // `capture="environment"` demande explicitement l'appareil photo arrière ;
  // le champ sans `capture` garde l'accès à la galerie. Le choix revient donc
  // à l'utilisatrice, plus au navigateur.
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galerieInputRef = useRef<HTMLInputElement>(null);
  const [sourcePhoto, setSourcePhoto] = useState(false);
  const [sheet, setSheet] = useState<"characteristics" | null>(null);
  // Le nom s'affiche comme une proposition, pas comme un champ : l'input
  // n'apparaît qu'à la demande (« Modifier le nom ») ou quand il n'y a encore
  // aucun nom. Il reste affiché tant qu'il a le focus, sans quoi la première
  // lettre tapée dans un champ vide le ferait disparaître.
  const [nomEnEdition, setNomEnEdition] = useState(false);
  // Les occasions montrent d'abord la sélection ; la liste complète s'ouvre
  // sur place, sans feuille par-dessus.
  const [toutesOccasions, setToutesOccasions] = useState(false);
  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Aperçu local instantané puis upload réel vers Supabase Storage
    // (correctif 22/08/2026, signalé : photo jamais affichée après
    // rechargement — l'ancien aperçu blob: n'était jamais persisté).
    if (file) actions.uploadAddPhoto(file);
    // Réinitialise le champ : sans ça, reprendre DEUX FOIS la même photo
    // (même nom de fichier) n'émettrait pas de second `change`.
    e.target.value = "";
    setSourcePhoto(false);
  };

  const creation = state.editingId == null;
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


  // Les saisons affichées sont celles qui seront enregistrées : le choix de
  // l'utilisatrice, sinon saisonsParDefaut — la même règle que saveItem.
  // Quatre saisons cochables depuis le 27/09/2026 (saisons.ts).
  const saisonsRetenues = state.addSaisons ?? saisonsParDefaut(state.addCat, state.addName);
  // « Suggérées » seulement quand Capsela a vraiment une suggestion : le
  // repli sur les quatre saisons est une valeur par défaut, pas une lecture
  // de la pièce.
  const saisonSuggeree = state.addSaisons == null && seasonSuggestion(state.addCat, state.addName) != null;
  const occasions = occasionsRetenues(state.addOccasionTouched, state.addOccasion, state.addCat, state.addShoeType);
  const occasionsSuggerees = !state.addOccasionTouched;

  const shoeTypeMissing = isShoe && !state.addShoeType;
  const blocked = shoeTypeMissing || state.addPhotoUploading;

  const typeOptions = typeOptionsFor(state.addCat);
  const typeValue = isShoe ? state.addShoeType : isSac ? state.addSacType : isBijou ? state.addBijouType : isAccessoire ? state.addAccessoireType : state.addSubtype;
  const setTypeValue = (v: string) => {
    if (isShoe) actions.setAddShoeType(v as ShoeType);
    else if (isSac) actions.setAddSacType(v as SacType);
    else if (isBijou) actions.setAddBijouType(v as BijouType);
    else if (isAccessoire) actions.setAddAccessoireType(v as AccessoireType);
    else actions.setAddSubtype(v);
  };

  const analysee = state.addPhotoAnalysee && creation;
  const nomSuggere = analysee && !state.addNameTouched && state.addName.trim().length > 0;
  const nomVisible = state.addName.trim().length > 0;
  const matiereEstimee = analysee && !state.addMatiereTouched && Boolean(state.addMatiere);
  // Caractéristiques encore vides : proposées à l'ajout, jamais affichées
  // comme un manque (« Non précisée » répété, qui donnait l'impression que
  // l'analyse avait échoué).
  const matiereManquante = !state.addMatiere;
  const coupeManquante = coupeApplicable && !state.addCoupe;

  const titre = !creation ? "Modifier la pièce" : state.replacingId ? "Remplacer par ta pièce" : "Ajouter une pièce";
  const colonnesAttributs = [true, Boolean(typeOptions && typeOptions.length > 0), sizeApplicable].filter(Boolean).length;

  const save = () => {
    if (blocked) return;
    if (sizeApplicable && state.addSize == null && selectedSize) actions.setAddSize(selectedSize);
    actions.saveItem();
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-cream">
      <div className="flex-shrink-0 px-6 pt-[8px] pb-[10px]">
        <div className="relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2">
            <BoutonRetour onClick={actions.addBack} label="Revenir à l'écran précédent" />
          </div>
          <div className="text-center px-[46px] min-h-[38px] flex items-center justify-center">
            <div className="t-titre-section text-ink">{titre}</div>
          </div>
        </div>
      </div>

      <div className="scrollarea flex-1 overflow-y-auto px-6 pb-7">
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={onPhotoChange} className="hidden" />
        <input ref={galerieInputRef} type="file" accept="image/*" onChange={onPhotoChange} className="hidden" />

        {/* 1. La photo, premier élément de l'écran : plus haute qu'avant
            (190 px fixes), proportionnelle à la largeur, bornée pour laisser
            voir le nom sous la ligne de flottaison dès 360 px. */}
        <button
          type="button"
          onClick={() => setSourcePhoto(true)}
          aria-label={state.addPhotoUrl ? "Changer la photo" : "Ajouter une photo"}
          className={
            "mt-[4px] w-full rounded-[16px] flex flex-col items-center justify-center gap-[10px] cursor-pointer relative overflow-hidden " +
            (state.addPhotoUrl ? "bg-card" : "border-[1.5px] border-dashed border-[#d6c7ae] bg-card")
          }
          style={{
            height: "clamp(230px, 68vw, 300px)",
            ...(state.addPhotoUrl
              ? { backgroundImage: `url(${state.addPhotoUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
              : {}),
          }}
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
              className="absolute bottom-3 right-3 flex items-center gap-[6px] text-[11px] text-cream rounded-full px-3 py-[7px]"
              style={{ background: "rgba(29,26,22,.7)" }}
            >
              <CropIcon /> Changer la photo
            </span>
          ) : (
            <>
              <div className="w-[54px] h-[54px] rounded-full bg-ink text-cream flex items-center justify-center">
                <CameraIcon />
              </div>
              <div className="text-[13px] text-ink">Prendre la pièce en photo</div>
              <div className="text-[11px] text-muted">ou importer depuis ta galerie</div>
            </>
          )}
        </button>

        {/* 2. L'analyse : une phrase, pas un badge. */}
        {state.addPhotoAnalyzing && (
          <div className="mt-[14px] flex items-start gap-[10px] rounded-[16px] bg-warm-bg px-4 py-[12px]" role="status">
            <span className="font-serif italic text-[15px] text-terracotta leading-[1.3]" aria-hidden="true">
              ✦
            </span>
            <div className="min-w-0">
              <div className="text-[13px] text-ink font-medium leading-[1.35]">L&apos;édit Capsela analyse ta pièce…</div>
              <div className="text-[12px] text-warm-text-2 leading-[1.45] mt-[2px]">
                Catégorie, couleur et matière vont se préremplir.
              </div>
            </div>
          </div>
        )}
        {analysee && !state.addPhotoAnalyzing && (
          <div className="mt-[14px] flex items-start gap-[10px] rounded-[16px] bg-warm-bg px-4 py-[12px]">
            <span className="font-serif italic text-[15px] text-terracotta leading-[1.3]" aria-hidden="true">
              ✦
            </span>
            <div className="min-w-0">
              <div className="text-[13px] text-ink font-medium leading-[1.35]">L&apos;édit Capsela a analysé ta pièce</div>
              <div className="text-[12px] text-warm-text-2 leading-[1.45] mt-[2px]">
                Vérifie les informations et complète si besoin.
              </div>
            </div>
          </div>
        )}

        {/* 3. Le nom : une proposition à relire, modifiable d'un geste. */}
        <div className="mt-6">
          <TitreSection suggere={nomSuggere}>{nomSuggere ? "Suggestion Capsela" : "Nom de la pièce"}</TitreSection>
          {nomEnEdition || !nomVisible ? (
            <input
              className="capin w-full bg-card border border-border rounded-xl px-4 py-[13px] text-[15px] text-ink font-sans"
              value={state.addName}
              onChange={(e) => actions.setAddName(e.target.value)}
              onFocus={() => setNomEnEdition(true)}
              onBlur={() => setNomEnEdition(false)}
              autoFocus={nomEnEdition}
              enterKeyHint="done"
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              placeholder="ex. Chemise en lin écrue"
              aria-label="Nom de la pièce"
            />
          ) : (
            <div className="flex items-baseline justify-between gap-3">
              <div className="t-titre-section text-ink min-w-0 break-words">{state.addName}</div>
              <button
                onClick={() => setNomEnEdition(true)}
                className="t-lien text-terracotta cursor-pointer flex-shrink-0 py-[6px]"
              >
                Modifier le nom
              </button>
            </div>
          )}
        </div>

        {/* 4. La marque, secondaire. */}
        <div className="mt-5">
          <label className="block">
            <span className="t-label text-muted">
              Marque <span className="normal-case tracking-normal opacity-80">· optionnel</span>
            </span>
            <input
              className="capin mt-[7px] w-full bg-transparent border-0 border-b border-border rounded-none px-0 py-[9px] text-[14px] text-ink font-sans"
              value={state.addBrand}
              onChange={(e) => actions.setAddBrand(e.target.value)}
              placeholder="ex. Sézane"
              enterKeyHint="done"
            />
          </label>
        </div>

        {/* 5. Les attributs essentiels, en une carte compacte. « Modèle » et
            non « Coupe » : ce champ est le sous-type (Longue, Chemise,
            Baskets…), alors que « Coupe » désigne déjà dans l'app un autre
            champ — Serré, Ajusté, Ample —, affiché sous ce nom ici comme sur
            la fiche de la pièce. Deux champs du même nom se confondraient. */}
        <div
          className="mt-6 bg-card border border-border rounded-[16px] grid divide-x divide-border"
          style={{ gridTemplateColumns: colonnesAttributs === 3 ? "1.25fr 1.25fr .8fr" : colonnesAttributs === 2 ? "1fr 1fr" : "1fr" }}
        >
          <SelectNu
            label="Catégorie"
            value={state.addCat}
            onChange={(v) => actions.setAddCat(v as CategoryKey)}
            options={CATS.map(([key, label]) => ({ value: key, label }))}
          />
          {typeOptions && typeOptions.length > 0 && (
            <SelectNu
              label="Modèle"
              value={typeValue || ""}
              onChange={setTypeValue}
              options={typeOptions.map((t) => ({ value: t, label: t }))}
              placeholder={isShoe ? "Choisir" : "À préciser"}
              enAttente={shoeTypeMissing}
            />
          )}
          {sizeApplicable && (
            <SelectNu
              label={isShoe ? "Pointure" : "Taille"}
              value={selectedSize ?? ""}
              onChange={(v) => actions.setAddSize(v)}
              options={sizes.map((t) => ({ value: t, label: t }))}
              placeholder="—"
            />
          )}
        </div>

        {/* 6. Les caractéristiques : seulement ce qui est connu, et une
            invitation discrète pour le reste. */}
        <div className="mt-6 bg-card border border-border rounded-[16px] px-4 pt-[15px] pb-[14px]">
          <TitreSection suggere={analysee}>{analysee ? "Caractéristiques détectées" : "Caractéristiques"}</TitreSection>
          <div className="grid grid-cols-3 gap-[8px] text-center">
            <button onClick={() => setSheet("characteristics")} className="flex flex-col items-center gap-[7px] cursor-pointer min-w-0">
              <span
                className="w-[38px] h-[38px] rounded-full flex-shrink-0"
                style={{ background: state.addColor.hex, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.12)" }}
              />
              <span className="min-w-0">
                <span className="block text-[13px] text-ink leading-[1.2] break-words">{state.addColor.name}</span>
                <span className="block t-label text-muted mt-[3px]">Couleur</span>
              </span>
            </button>
            {matiereManquante ? (
              <button onClick={() => setSheet("characteristics")} className="flex flex-col items-center gap-[7px] cursor-pointer min-w-0">
                <span className="w-[38px] h-[38px] rounded-full border border-dashed border-warm-border flex items-center justify-center text-terracotta text-[16px] flex-shrink-0">
                  +
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] text-terracotta leading-[1.2]">Ajouter</span>
                  <span className="block t-label text-muted mt-[3px]">Matière</span>
                </span>
              </button>
            ) : (
              <button onClick={() => setSheet("characteristics")} className="flex flex-col items-center gap-[7px] cursor-pointer min-w-0">
                <span className="w-[38px] h-[38px] rounded-full bg-warm-bg flex items-center justify-center text-warm-text flex-shrink-0">
                  <FabricIcon />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] text-ink leading-[1.2] break-words">{state.addMatiere}</span>
                  <span className="block t-label text-muted mt-[3px]">{matiereEstimee ? "Matière estimée" : "Matière"}</span>
                </span>
              </button>
            )}
            {coupeApplicable &&
              (coupeManquante ? (
                <button onClick={() => setSheet("characteristics")} className="flex flex-col items-center gap-[7px] cursor-pointer min-w-0">
                  <span className="w-[38px] h-[38px] rounded-full border border-dashed border-warm-border flex items-center justify-center text-terracotta text-[16px] flex-shrink-0">
                    +
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] text-terracotta leading-[1.2]">Ajouter</span>
                    <span className="block t-label text-muted mt-[3px]">Coupe</span>
                  </span>
                </button>
              ) : (
                <button onClick={() => setSheet("characteristics")} className="flex flex-col items-center gap-[7px] cursor-pointer min-w-0">
                  <span className="w-[38px] h-[38px] rounded-full bg-warm-bg flex items-center justify-center text-warm-text flex-shrink-0">
                    <FitIcon />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] text-ink leading-[1.2] break-words">{state.addCoupe}</span>
                    <span className="block t-label text-muted mt-[3px]">Coupe</span>
                  </span>
                </button>
              ))}
          </div>
          <button
            onClick={() => setSheet("characteristics")}
            className="mt-[14px] t-lien text-terracotta cursor-pointer py-[4px]"
          >
            Modifier les caractéristiques →
          </button>
        </div>

        {/* 7. La saison : une recommandation présélectionnée, jamais un verrou. */}
        <div className="mt-7">
          <TitreSection suggere={saisonSuggeree}>{saisonSuggeree ? "Saisons suggérées" : "Saisons"}</TitreSection>
          <div className="text-[12px] text-muted leading-[1.45] -mt-[4px] mb-[12px]">Plusieurs choix possibles.</div>
          {/* Deux colonnes : quatre pastilles sur une ligne ne tiennent pas à
              360 px avec leur coche (« Printemps ✓ »), et une grille égale se
              lit mieux qu'un retour à la ligne au hasard des largeurs. */}
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Saisons">
            {QUATRE_SAISONS.map((s) => {
              const on = saisonsRetenues.includes(s);
              return (
                <button
                  key={s}
                  aria-pressed={on}
                  onClick={() => actions.basculerAddSaison(s)}
                  className={chipCls(on) + " inline-flex items-center justify-center gap-[6px]"}
                >
                  {s}
                  {on && <span aria-hidden="true">✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Les manches (01/10/2026) : seulement pour les pièces qui en ont, jamais
            obligatoires ni présélectionnées — une longueur inconnue reste
            inconnue, le moteur la traite alors comme avant. Rappeler le choix
            actif le retire. */}
        {aDesManches(state.addCat) && (
          <div className="mt-7">
            <TitreSection suggere={false}>Manches</TitreSection>
            <div className="text-[12px] text-muted leading-[1.45] -mt-[4px] mb-[12px]">Facultatif.</div>
            <div className="flex gap-2 flex-wrap" role="group" aria-label="Manches">
              {MANCHES.map(({ valeur, libelle }) => {
                const on = state.addManches === valeur;
                return (
                  <button
                    key={valeur}
                    aria-pressed={on}
                    onClick={() => actions.setAddManches(valeur)}
                    className={chipCls(on) + " inline-flex items-center gap-[6px]"}
                  >
                    {libelle}
                    {on && <span aria-hidden="true">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 8. Les occasions : la suggestion d'abord, la liste complète à la
            demande. Jamais obligatoires. */}
        <div className="mt-7">
          <TitreSection suggere={occasionsSuggerees}>{occasionsSuggerees ? "Occasions suggérées" : "Occasions"}</TitreSection>
          <div className="text-[12px] text-muted leading-[1.45] -mt-[4px] mb-[12px]">
            {occasionsSuggerees
              ? "Capsela te suggère les occasions les plus adaptées à cette pièce."
              : "Plusieurs choix possibles."}
          </div>
          {toutesOccasions ? (
            <div className="flex gap-2 flex-wrap">
              {OCCASIONS.map(([key]) => {
                const on = occasions.includes(key);
                return (
                  <button
                    key={key}
                    onClick={() => actions.setAddOccasion(key)}
                    aria-pressed={on}
                    className={chipCls(on) + " inline-flex items-center gap-[7px]"}
                  >
                    <GlypheOccasion occasion={key} taille={15} />
                    {libelleOccasion(key)}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {occasions.length > 0 ? (
                occasions.map((o) => (
                  <span key={o} className={chipCls(true) + " inline-flex items-center gap-[7px] cursor-default"}>
                    <GlypheOccasion occasion={o} taille={15} />
                    {libelleOccasion(o)}
                  </span>
                ))
              ) : (
                <span className="text-[12px] text-muted">Aucune occasion choisie pour l&apos;instant.</span>
              )}
            </div>
          )}
          {!toutesOccasions && (
            <button onClick={() => setToutesOccasions(true)} className="mt-[12px] t-lien text-terracotta cursor-pointer py-[4px]">
              Modifier les occasions →
            </button>
          )}
        </div>

        <div className="flex items-start gap-[8px] mt-7 text-muted">
          <InfoIcon className="mt-[2px] flex-shrink-0" />
          <span className="text-[11px] leading-[1.45]">Tu pourras modifier toutes ces informations à tout moment.</span>
        </div>
      </div>

      {/* 9. L'action, fixée hors du défilement, au-dessus de la zone système.
          Grisée seulement pour ce que saveItem exige réellement. */}
      <div
        className="flex-shrink-0 px-6 pt-[10px] border-t border-border bg-cream"
        style={{ paddingBottom: "calc(14px + env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={save}
          disabled={blocked}
          className={
            "w-full text-center rounded-full t-bouton " +
            (blocked ? "bg-[#dccfbc] text-[#8a7c68] cursor-not-allowed" : "bg-terracotta active:bg-terracotta-hover text-cream cursor-pointer")
          }
          style={{ minHeight: 52 }}
        >
          {!creation ? "Enregistrer les modifications" : "Ajouter au dressing"}
        </button>
        {state.addPhotoUploading ? (
          <div className="text-center text-[11px] text-terracotta mt-[8px]">Envoi de la photo en cours…</div>
        ) : shoeTypeMissing ? (
          <div className="text-center text-[11px] text-terracotta mt-[8px]">Choisis le modèle de chaussures pour pouvoir les ajouter.</div>
        ) : null}
      </div>

      <BottomSheet
        title={state.addPhotoUrl ? "Changer la photo" : "Ajouter une photo"}
        open={sourcePhoto}
        onClose={() => setSourcePhoto(false)}
      >
        <div className="flex flex-col">
          <button
            onClick={() => {
              setSourcePhoto(false);
              cameraInputRef.current?.click();
            }}
            className="flex items-center gap-[13px] py-[15px] text-[14px] text-ink border-b border-border cursor-pointer text-left"
          >
            <CameraIcon /> Prendre une photo
          </button>
          <button
            onClick={() => {
              setSourcePhoto(false);
              galerieInputRef.current?.click();
            }}
            className="flex items-center gap-[13px] py-[15px] text-[14px] text-ink cursor-pointer text-left"
          >
            <GalerieIcon /> Choisir dans la galerie
          </button>
        </div>
      </BottomSheet>

      <BottomSheet title="Caractéristiques" open={sheet === "characteristics"} onClose={() => setSheet(null)}>
        <div className="t-surtitre text-muted mb-[11px]">Couleur dominante</div>
        {/* Les teintes du dressing, rangées par famille (clair vers foncé) ; les bijoux gardent leur liste de métaux. */}
        {(isBijou
          ? [{ libelle: "", pastilles: PALETTE_BIJOU }]
          : FAMILLES_COULEURS.map((f) => ({ libelle: f.libelle, pastilles: f.noms.flatMap((n) => PALETTE.filter(([nom]) => nom === n)) }))
        ).map((groupe, i) => (
          <div key={groupe.libelle || "metaux"} className={i > 0 ? "mt-[20px]" : ""}>
            {groupe.libelle && <div className="t-label text-muted mb-[10px]">{groupe.libelle}</div>}
            <div className="grid grid-cols-4 gap-x-2 gap-y-[18px]">
              {groupe.pastilles.map(([name, hex]) => {
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
                    <span className={"text-[9px] text-center leading-[1.3] " + (on ? "text-ink" : "text-muted")}>{name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div className="t-surtitre text-muted mt-[26px] mb-[11px]">
          Matière <span className="opacity-60 normal-case tracking-normal">(estimation, jamais garantie sur photo)</span>
        </div>
        <select
          className="capin w-full bg-card border border-border rounded-xl px-4 py-[14px] text-[14px] text-ink font-sans"
          value={state.addMatiere ?? ""}
          onChange={(e) => actions.setAddMatiere((e.target.value || null) as typeof state.addMatiere)}
        >
          <option value="">À préciser</option>
          {MATIERES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        {coupeApplicable && (
          <>
            <div className="t-surtitre text-muted mt-[26px] mb-[11px]">Coupe</div>
            <div className="flex gap-2 flex-wrap">
              {COUPES.map((c) => (
                <button key={c} onClick={() => actions.setAddCoupe(c)} className={chipCls(state.addCoupe === c)}>
                  {c}
                </button>
              ))}
            </div>
          </>
        )}

        <Button variante="principal" className="mt-[26px]"
          onClick={() => setSheet(null)}
        >
          Terminé
        </Button>
      </BottomSheet>
    </div>
  );
}
