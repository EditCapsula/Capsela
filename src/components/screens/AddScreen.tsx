"use client";

import { messageCadrage } from "@/lib/cadragePhoto";
import { estPhotoDetouree } from "@/lib/dressing";
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
} from "@/lib/data";
import { QUATRE_SAISONS } from "@/lib/saisons";
import { COUPES, MATIERES, isCoupeApplicable, isSizeApplicable, occasionsRetenues, suggestOccasions } from "@/lib/attributes";
import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";
import { taillesBasFor, TAILLES_HAUT } from "@/lib/profile";
import type { AccessoireType, BijouType, CategoryKey, Coupe, OccasionKey, SacType, ShoeType } from "@/lib/types";
import BoutonRetour from "@/components/BoutonRetour";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Input from "@/components/Input";

const POINTURES = ["35", "36", "37", "38", "39", "40", "41", "42"];
const BOTTOM_SIZED: CategoryKey[] = [...BAS_CATS, "jupe", "combinaison"];

function chipCls(on: boolean): string {
  return (
    "px-4 py-[11px] rounded-full text-[13px] cursor-pointer font-sans border " +
    (on ? "bg-ink text-cream border-ink" : "bg-card text-ink border-border")
  );
}

/** Saison choisie : fond plein terracotta-deep (surface pleine, comme le chip d'occasion actif de la Tenue). */
function chipSaisonCls(on: boolean): string {
  return (
    "px-2 py-[11px] rounded-full text-[13px] cursor-pointer font-sans border inline-flex items-center justify-center gap-[5px] " +
    (on ? "bg-terracotta-deep text-cream border-terracotta-deep" : "bg-card text-ink border-border")
  );
}

/** Occasion retenue : contour terracotta sur fond doux — plusieurs peuvent l'être, le plein est réservé à la saison. */
function chipOccasionCls(on: boolean): string {
  return (
    "px-4 py-[11px] rounded-full text-[13px] cursor-pointer font-sans border inline-flex items-center gap-[7px] " +
    (on ? "bg-warm-bg text-terracotta border-terracotta" : "bg-card text-ink border-border")
  );
}

function PencilIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" />
      <path d="M14.5 7.5l3 3" />
    </svg>
  );
}
function CocheRonde() {
  return (
    <span className="w-[16px] h-[16px] rounded-full bg-success text-cream flex items-center justify-center flex-shrink-0" aria-hidden="true">
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </span>
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
 * Case de la grille « Informations essentielles » (04/10/2026, d'après la maquette validée) : deux cases par ligne,
 * le libellé en petites capitales, la valeur dessous en Fraunces — sur deux lignes au besoin, jamais tronquée. Un
 * select natif transparent couvre toute la case : c'est le sélecteur du système, que le pouce connaît, et il gère
 * seul le clavier et l'accessibilité.
 */
function CaseSelect({
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
  /** Valeur requise encore vide : la valeur d'attente passe en terracotta. */
  enAttente?: boolean;
}) {
  const affiche = options.find((o) => o.value === value)?.label ?? placeholder ?? "";
  return (
    <Card as="label" rayon="tuile" className="relative block min-w-0 pl-[14px] pr-[26px] pt-[10px] pb-[11px] cursor-pointer focus-within:border-terracotta">
      <span className="t-label text-muted block">{label}</span>
      <span className={"block mt-[4px] text-[15px] font-serif leading-[1.25] break-words " + (enAttente ? "text-terracotta" : "text-ink")} aria-hidden="true">
        {affiche}
      </span>
      <span className="absolute right-[11px] top-1/2 -translate-y-1/2 text-muted text-[10px] pointer-events-none" aria-hidden="true">▾</span>
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
    </Card>
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
 * La saison est obligatoire mais jamais présélectionnée (09/10/2026) : lue sur
 * la photo quand l'analyse est sûre, sinon à choisir. Ce qui bloque aussi, parce que la sauvegarde elle-même
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
  // « Toutes les couleurs » : la palette complète, en feuille. Les couleurs courantes sont sur la page.
  const [toutesCouleurs, setToutesCouleurs] = useState(false);
  // Les détails facultatifs (marque, matière, coupe, taille, manches) : repliés
  // à l'ajout ; ouverts d'emblée sur une pièce modifiée qui en porte déjà un,
  // pour que rien de ce qui est enregistré ne reste caché (09/10/2026).
  const [detailsOuverts, setDetailsOuverts] = useState(
    () =>
      state.editingId != null &&
      Boolean(state.addBrand || state.addMatiere || state.addCoupe || state.addSize || state.addManches),
  );
  // Les occasions montrent d'abord les recommandées ; la liste complète
  // s'ouvre sur place, sans feuille par-dessus.
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
  // Aucune taille présélectionnée (09/10/2026) : elle n'est enregistrée que si elle est choisie.
  const selectedSize = state.addSize;


  // Les saisons affichées sont celles qui seront enregistrées : le choix de
  // l'utilisatrice ou, à défaut, la suggestion lue sur la photo ; rien n'est
  // présélectionné, et le choix est obligatoire (09/10/2026).
  // Quatre saisons cochables depuis le 27/09/2026 (saisons.ts).
  const saisonsRetenues = state.addSaisons ?? [];
  const occasions = occasionsRetenues(state.addOccasionTouched, state.addOccasion, state.addCat, state.addShoeType);
  const occasionsSuggerees = !state.addOccasionTouched;

  const shoeTypeMissing = isShoe && !state.addShoeType;
  const saisonManquante = saisonsRetenues.length === 0;
  const blocked = shoeTypeMissing || saisonManquante || state.addPhotoUploading;

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
  const analyseEnCours = state.addPhotoAnalyzing;
  const detourageEnCours = state.addPhotoDetourage === "en_cours";
  const detourageFait = state.addPhotoDetourage === "fait";
  const photoDetouree = estPhotoDetouree(state.addPhotoUrl);
  const manchesLues = analysee && !state.addManchesTouched && state.addManches != null;
  // Les teintes courantes affichées sur la page : une sélection de la palette réelle (jamais une valeur
  // inventée), plus la couleur courante si elle n'en fait pas partie — rien ne reste caché.
  const NOMS_COURANTS = ["Blanc cassé", "Crème", "Sable", "Camel", "Chocolat", "Kaki", "Gris", "Marine", "Bordeaux", "Noir"];
  const palette = isBijou ? PALETTE_BIJOU : PALETTE;
  const courantes = isBijou ? palette.slice(0, 6) : NOMS_COURANTS.flatMap((n) => palette.filter(([nom]) => nom === n));
  const pastillesCourantes = courantes.some(([, hex]) => hex === state.addColor.hex)
    ? courantes
    : [[state.addColor.name, state.addColor.hex] as [string, string], ...courantes];
  // Ce qui est déjà renseigné, rappelé sur l'en-tête replié.
  const resumeDetails = [
    state.addBrand.trim(),
    state.addMatiere,
    coupeApplicable ? state.addCoupe : null,
    sizeApplicable && selectedSize ? (isShoe ? "Pointure " : "Taille ") + selectedSize : null,
    aDesManches(state.addCat) && state.addManches ? MANCHES.find((m) => m.valeur === state.addManches)?.libelle : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const nomSuggere = analysee && !state.addNameTouched && state.addName.trim().length > 0;
  const matiereEstimee = analysee && !state.addMatiereTouched && Boolean(state.addMatiere);

  const titre = !creation ? "Modifier la pièce" : state.replacingId ? "Remplacer par ta pièce" : "Ajouter une pièce";
  // Les occasions recommandées d'abord (même ordre qu'à l'ouverture, donc stable quand on en bascule une), puis
  // celles que la personne a choisies hors recommandation ; la liste complète, dans l'ordre de l'app.
  const recommandees = suggestOccasions(state.addCat, state.addShoeType);
  const occasionsEnTete = [...recommandees, ...occasions.filter((o) => !recommandees.includes(o))];

  const save = () => {
    if (blocked) return;
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

        {/* 1. La photo, premier élément de l'écran : proportionnelle à la
            largeur, bornée pour laisser voir le nom sous la ligne de flottaison
            dès 360 px. Sans photo : deux actions explicites, prendre la pièce
            en photo ou l'importer. Avec photo : toute la carte rouvre le choix
            de la source (09/10/2026). */}
        {state.addPhotoUrl ? (
          <button
            type="button"
            onClick={() => setSourcePhoto(true)}
            aria-label="Modifier la photo"
            className={
              "mt-[4px] w-full rounded-tuile flex flex-col items-center justify-center gap-[10px] cursor-pointer relative overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta border border-border " +
              (photoDetouree ? "bg-photo-bg" : "bg-card")
            }
            style={{
              height: "clamp(230px, 68vw, 300px)",
              backgroundImage: `url(${state.addPhotoUrl})`,
              // Détourée : la pièce entière, sur la tuile — jamais recadrée comme une photo (04/10/2026).
              backgroundSize: photoDetouree ? "contain" : "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
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
            <span className="absolute bottom-3 right-3 flex items-center gap-[6px] text-[11px] text-ink bg-cream border border-border rounded-full px-3 py-[8px]">
              <PencilIcon /> Modifier la photo
            </span>
          </button>
        ) : (
          <div
            className="mt-[4px] w-full rounded-tuile flex flex-col items-center justify-center gap-[6px] border-[1.5px] border-dashed border-[#d6c7ae] bg-card px-5 py-6 text-center"
            style={{ minHeight: "clamp(230px, 62vw, 280px)" }}
          >
            <div className="w-[54px] h-[54px] rounded-full bg-ink text-cream flex items-center justify-center mb-[6px]" aria-hidden="true">
              <CameraIcon />
            </div>
            <div className="t-titre-carte text-ink">Photographier ma pièce</div>
            <div className="text-[12px] text-muted">Ou importer depuis ma galerie</div>
            <div className="grid grid-cols-2 gap-[10px] w-full mt-[14px]">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center justify-center gap-[8px] rounded-full bg-ink text-cream text-[13px] min-h-[46px] cursor-pointer"
              >
                <CameraIcon /> Prendre une photo
              </button>
              <button
                type="button"
                onClick={() => galerieInputRef.current?.click()}
                className="flex items-center justify-center gap-[8px] rounded-full border border-border bg-cream text-ink text-[13px] min-h-[46px] cursor-pointer"
              >
                <GalerieIcon /> Importer
              </button>
            </div>
          </div>
        )}

        {/* 2. Un seul bloc pour tout ce que Capsela fait de la photo (04/10/2026) :
            analyse et détourage ne s'annoncent plus par deux bandeaux. Chaque
            coche suit un fait — « Fond supprimé » le détourage réellement
            rendu, « Analyse terminée » l'analyse réellement faite ; rien n'est
            dit quand le détourage n'est pas branché ou échoue. */}
        {(analyseEnCours || detourageEnCours || analysee || detourageFait) && (
          <div className="mt-[14px] rounded-tuile bg-warm-bg px-4 py-[13px]" role="status">
            <div className="flex items-start gap-[10px]">
              <span className="font-serif italic text-[15px] text-terracotta leading-[1.3]" aria-hidden="true">
                ✦
              </span>
              <div className="min-w-0">
                <div className="text-[13px] text-ink font-medium leading-[1.35]">
                  {analyseEnCours
                    ? "Capsela analyse ta pièce…"
                    : detourageEnCours
                      ? "Capsela retire le fond de ta photo…"
                      : analysee
                        ? "Pièce analysée par Capsela"
                        : "Photo détourée par Capsela"}
                </div>
                <div className="text-[12px] text-warm-text-2 leading-[1.45] mt-[2px]">
                  {analyseEnCours
                    ? "Catégorie, couleur et matière vont se préremplir."
                    : detourageEnCours
                      ? "Ta pièce se mêlera mieux aux autres dans tes tenues."
                      : analysee
                        ? "Vérifie les informations détectées avant de l'ajouter."
                        : "Reprends ou change la photo si le résultat ne te convient pas."}
                </div>
              </div>
            </div>
            {(detourageFait || (analysee && !analyseEnCours)) && (
              <ul className="flex flex-wrap gap-x-4 gap-y-[6px] mt-[10px] ml-[25px] text-[12px] text-warm-text list-none p-0">
                {detourageFait && <li className="flex items-center gap-[6px]"><CocheRonde />Fond supprimé</li>}
                {analysee && !analyseEnCours && <li className="flex items-center gap-[6px]"><CocheRonde />Analyse terminée</li>}
              </ul>
            )}
          </div>
        )}

        {/* Une photo qui n'est pas celle d'une pièce seule (05/10/2026) : dit à l'ajout, d'après ce que l'analyse a vu — jamais
            stocké, jamais deviné (cadragePhoto.ts). */}
        {creation && !analyseEnCours && messageCadrage(state.addPhotoCadrage) && (
          <div className="mt-[10px] rounded-tuile bg-warm-bg border border-sand-border px-4 py-[12px]" role="status">
            <div className="text-[13px] text-ink font-medium leading-[1.35]">{messageCadrage(state.addPhotoCadrage)!.titre}</div>
            <div className="text-[12px] text-warm-text-2 leading-[1.45] mt-[2px]">{messageCadrage(state.addPhotoCadrage)!.texte}</div>
          </div>
        )}

        {/* 3. L'identification, visible sans action : le nom (une proposition à
            relire, toujours modifiable), la catégorie et le modèle. Le modèle
            reste ici : pour des chaussures il est exigé par le moteur (R-B6) ;
            ailleurs c'est le type de pièce (Longue, Chemise, Baskets…), distinct
            de la « Coupe » (Serré, Ajusté, Ample) et de la marque. */}
        <div className="mt-6">
          <TitreSection>Nom de la pièce</TitreSection>
          {nomSuggere && (
            <div className="flex items-center gap-[6px] mb-[8px] text-[12px] text-terracotta">
              <span className="font-serif italic" aria-hidden="true">✦</span>
              Nom suggéré par Capsela
            </div>
          )}
          <div className="relative">
            <Input
              value={state.addName}
              onChange={(e) => actions.setAddName(e.target.value)}
              enterKeyHint="done"
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              placeholder="ex. Chemise en lin écrue"
              aria-label="Nom de la pièce"
              className="pr-[46px] font-serif text-[17px]"
            />
            <span className="absolute right-[17px] top-1/2 -translate-y-1/2 text-muted pointer-events-none">
              <PencilIcon />
            </span>
          </div>
          <div className="grid grid-cols-2 gap-[10px] mt-[10px]">
            <CaseSelect
              label="Catégorie"
              value={state.addCat}
              onChange={(v) => actions.setAddCat(v as CategoryKey)}
              options={CATS.map(([key, label]) => ({ value: key, label }))}
            />
            {typeOptions && typeOptions.length > 0 && (
              <CaseSelect
                label="Modèle"
                value={typeValue || ""}
                onChange={setTypeValue}
                options={typeOptions.map((t) => ({ value: t, label: t }))}
                placeholder={isShoe ? "Choisir" : "À préciser"}
                enAttente={shoeTypeMissing}
              />
            )}
          </div>
          {shoeTypeMissing && (
            <div className="text-[12px] text-terracotta mt-[8px]" role="alert">
              Choisis le modèle de chaussures pour pouvoir les ajouter.
            </div>
          )}
        </div>

        {/* 4. La couleur : les teintes courantes en pastilles, la palette
            complète à « Toutes les couleurs ». La couleur choisie est dite en
            toutes lettres et cochée — jamais portée par la seule teinte. */}
        <div className="mt-6">
          <TitreSection suggere={analysee && !state.addColorTouched}>Couleur</TitreSection>
          <div className="flex flex-wrap gap-x-[10px] gap-y-[12px]" role="group" aria-label="Couleur de la pièce">
            {pastillesCourantes.map(([name, hex]) => {
              const on = state.addColor.hex === hex;
              return (
                <button
                  key={hex}
                  type="button"
                  aria-label={name}
                  aria-pressed={on}
                  onClick={() => actions.setAddColor({ name, hex })}
                  className="relative w-[40px] h-[40px] rounded-full cursor-pointer flex items-center justify-center"
                  style={{
                    background: hex,
                    border: on ? "2px solid var(--color-ink)" : "1px solid rgba(29,26,22,.14)",
                    boxShadow: on ? "0 0 0 3px var(--color-cream) inset" : "none",
                  }}
                >
                  {on && (
                    <span className="absolute -right-[3px] -top-[3px] w-[16px] h-[16px] rounded-full bg-ink text-cream flex items-center justify-center" aria-hidden="true">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between gap-3 mt-[12px]">
            <span className="text-[13px] text-ink font-serif">{state.addColor.name}</span>
            <button
              type="button"
              onClick={() => setToutesCouleurs(true)}
              className="t-lien text-terracotta underline underline-offset-[3px] cursor-pointer py-[4px]"
            >
              Toutes les couleurs →
            </button>
          </div>
        </div>

        {/* 5. Les détails facultatifs, repliés : marque, matière, coupe, taille,
            manches — seulement ceux qui concernent la catégorie, aucun
            présélectionné. Replié, l'en-tête rappelle ce qui est déjà renseigné. */}
        <div className="mt-6 rounded-tuile border border-border bg-card">
          <button
            type="button"
            onClick={() => setDetailsOuverts((v) => !v)}
            aria-expanded={detailsOuverts}
            aria-controls="details-facultatifs"
            className="w-full flex items-center justify-between gap-3 px-4 py-[14px] cursor-pointer text-left"
          >
            <span className="min-w-0">
              <span className="block t-surtitre text-muted">Détails facultatifs</span>
              {!detailsOuverts && (
                <span className="block text-[12px] text-ink-soft mt-[3px] break-words">
                  {resumeDetails || "Marque, matière, coupe, taille…"}
                </span>
              )}
            </span>
            <span className={"text-muted text-[12px] flex-shrink-0 motion-safe:transition-transform " + (detailsOuverts ? "rotate-180" : "")} aria-hidden="true">
              ▾
            </span>
          </button>
          {detailsOuverts && (
            <div id="details-facultatifs" className="px-4 pb-4">
              <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-[10px]">
                <Card as="label" rayon="tuile" className="block px-[14px] pt-[10px] pb-[11px] cursor-text focus-within:border-terracotta min-w-0">
                  <span className="t-label text-muted block">Marque</span>
                  <input
                    className="capin mt-[4px] w-full min-w-0 bg-transparent border-0 p-0 text-[15px] font-serif text-ink"
                    value={state.addBrand}
                    onChange={(e) => actions.setAddBrand(e.target.value)}
                    placeholder="Optionnel"
                    aria-label="Marque, optionnelle"
                    enterKeyHint="done"
                  />
                </Card>
                <CaseSelect
                  label={matiereEstimee ? "Matière estimée" : "Matière"}
                  value={state.addMatiere ?? ""}
                  onChange={(v) => actions.setAddMatiere((v || null) as typeof state.addMatiere)}
                  options={MATIERES.map((m) => ({ value: m, label: m }))}
                  placeholder="Optionnel"
                />
                {coupeApplicable && (
                  <CaseSelect
                    label="Coupe"
                    value={state.addCoupe ?? ""}
                    onChange={(v) => actions.setAddCoupe((v || null) as Coupe | null)}
                    options={COUPES.map((c) => ({ value: c, label: c }))}
                    placeholder="Optionnel"
                  />
                )}
                {sizeApplicable && (
                  <CaseSelect
                    label={isShoe ? "Pointure" : "Taille"}
                    value={selectedSize ?? ""}
                    onChange={(v) => actions.setAddSize(v || null)}
                    options={sizes.map((t) => ({ value: t, label: t }))}
                    placeholder="Optionnel"
                  />
                )}
              </div>
              {/* Les manches : seulement pour les pièces qui en ont, jamais
                  présélectionnées — une longueur inconnue reste inconnue, le
                  moteur la traite alors comme avant. Rappeler le choix actif le retire. */}
              {aDesManches(state.addCat) && (
                <div className="mt-[16px]">
                  <TitreSection suggere={manchesLues}>{manchesLues ? "Manches identifiées" : "Manches"}</TitreSection>
                  <div className="text-[12px] text-muted leading-[1.45] -mt-[4px] mb-[12px]">
                    {manchesLues ? "Lues sur ta photo, modifiables." : "Optionnel."}
                  </div>
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
            </div>
          )}
        </div>

        {/* 6. La saison : jamais présélectionnée, jamais un verrou. */}
        <div className="mt-7">
          <TitreSection suggere={state.addSaisonsLues}>{state.addSaisonsLues ? "Saisons suggérées" : "Saisons"}</TitreSection>
          <div className="text-[12px] text-muted leading-[1.45] -mt-[4px] mb-[12px]">
            {state.addSaisonsLues ? "Lues sur ta photo, modifiables." : "Quand portes-tu cette pièce ? Sélection multiple."}
          </div>
          {/* Quatre pastilles sur une ligne dès 380 px (maquette du 04/10/2026), deux fois deux en deçà, où la
              coche (« Printemps ✓ ») ne tient plus à côté du mot : au-delà, le fond plein dit seul le choix. */}
          <div className="grid grid-cols-2 min-[380px]:grid-cols-4 gap-2" role="group" aria-label="Saisons">
            {QUATRE_SAISONS.map((s) => {
              const on = saisonsRetenues.includes(s);
              return (
                <button
                  key={s}
                  aria-pressed={on}
                  onClick={() => actions.basculerAddSaison(s)}
                  className={chipSaisonCls(on)}
                >
                  {s}
                  {on && <span aria-hidden="true" className="min-[380px]:hidden">✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* 8. Les occasions : les recommandées d'abord (suggestOccasions, la
            règle d'origine), la liste complète à la demande. Jamais
            obligatoires ; aucune occasion n'est retirée de la liste. */}
        <div className="mt-7">
          <TitreSection suggere={occasionsSuggerees}>{occasionsSuggerees ? "Occasions recommandées" : "Occasions"}</TitreSection>
          <div className="text-[12px] text-muted leading-[1.45] -mt-[4px] mb-[12px]">
            {occasionsSuggerees
              ? "Capsela te recommande les occasions les plus adaptées à cette pièce."
              : "Sélection multiple."}
          </div>
          <div className="flex gap-2 flex-wrap" role="group" aria-label="Occasions">
            {(toutesOccasions ? OCCASIONS.map(([key]) => key) : occasionsEnTete).map((key) => {
              const on = occasions.includes(key);
              return (
                <button
                  key={key}
                  onClick={() => actions.setAddOccasion(key)}
                  aria-pressed={on}
                  className={chipOccasionCls(on)}
                >
                  <GlypheOccasion occasion={key} taille={15} />
                  {libelleOccasion(key)}
                  {on && <span aria-hidden="true">✓</span>}
                </button>
              );
            })}
            {!toutesOccasions && occasionsEnTete.length === 0 && (
              <span className="text-[12px] text-muted">Aucune occasion choisie pour l&apos;instant.</span>
            )}
          </div>
          {!toutesOccasions && (
            <button onClick={() => setToutesOccasions(true)} className="mt-[12px] w-full rounded-full border border-border bg-card py-[13px] text-[13px] text-terracotta cursor-pointer font-sans">
              + Ajouter une autre occasion
            </button>
          )}
        </div>
      </div>

      {/* 9. L'action, fixée hors du défilement, au-dessus de la zone système.
          Grisée seulement pour ce que saveItem exige réellement. */}
      <div
        className="flex-shrink-0 px-6 pt-[10px] border-t border-border bg-cream"
        style={{ paddingBottom: "calc(14px + env(safe-area-inset-bottom))" }}
      >
        {state.addErreur && (
          <div className="text-center text-[12px] text-rust mb-[8px] leading-[1.4]" role="alert">
            {state.addErreur}
          </div>
        )}
        <Button onClick={save} disabled={blocked || state.addSaving} aria-busy={state.addSaving}>
          {state.addSaving ? "Enregistrement…" : !creation ? "Enregistrer les modifications" : "Ajouter au dressing"}
        </Button>
        {state.addPhotoUploading ? (
          <div className="text-center text-[11px] text-terracotta mt-[8px]">Envoi de la photo en cours…</div>
        ) : shoeTypeMissing ? (
          <div className="text-center text-[11px] text-terracotta mt-[8px]">Choisis le modèle de chaussures pour pouvoir les ajouter.</div>
        ) : saisonManquante ? (
          <div className="text-center text-[11px] text-terracotta mt-[8px]">Choisis au moins une saison pour ajouter la pièce.</div>
        ) : null}
        <div className="flex items-center justify-center gap-[7px] mt-[9px] text-muted">
          <InfoIcon className="flex-shrink-0" />
          <span className="text-[11px] leading-[1.4]">Tout est modifiable depuis ton dressing.</span>
        </div>
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

      <BottomSheet title="Toutes les couleurs" open={toutesCouleurs} onClose={() => setToutesCouleurs(false)}>
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
                    aria-pressed={on}
                    onClick={() => actions.setAddColor({ name, hex })}
                    className="flex flex-col items-center gap-[7px] cursor-pointer"
                  >
                    <span
                      className="w-[38px] h-[38px] rounded-champ"
                      style={{
                        background: hex,
                        border: on ? "2px solid var(--color-ink)" : "1px solid rgba(29,26,22,.12)",
                        boxShadow: on ? "0 0 0 3px var(--color-cream) inset" : "none",
                      }}
                    />
                    <span className={"text-[9px] text-center leading-[1.3] " + (on ? "text-ink" : "text-muted")}>{name}{on ? " ✓" : ""}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <Button variante="principal" className="mt-[26px]" onClick={() => setToutesCouleurs(false)}>
          Terminé
        </Button>
      </BottomSheet>
    </div>
  );
}
