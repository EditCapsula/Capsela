"use client";

import { messageCadrage } from "@/lib/cadragePhoto";
import { estPhotoDetouree } from "@/lib/dressing";
import { aDesManches, MANCHES } from "@/lib/manches";
import { aUnMotif, MOTIFS } from "@/lib/motifs";
import { confierPhoto } from "@/lib/importTenue";
import { etatAjout } from "@/lib/etatAjout";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useEffect, useRef, useState } from "react";
import BottomSheet from "@/components/BottomSheet";
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
import { COUPES, MATIERES, isCoupeApplicable, isSizeApplicable, suggestOccasions } from "@/lib/attributes";
import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";
import { taillesBasFor, TAILLES_HAUT } from "@/lib/profile";
import type { AccessoireType, BijouType, CategoryKey, Coupe, OccasionKey, SacType, ShoeType } from "@/lib/types";
import BoutonRetour from "@/components/BoutonRetour";
import Button from "@/components/Button";
import Input from "@/components/Input";

const POINTURES = ["35", "36", "37", "38", "39", "40", "41", "42"];
const BOTTOM_SIZED: CategoryKey[] = [...BAS_CATS, "jupe", "combinaison"];

/** Les huit pastilles de couleur de la page, prises dans la palette réelle (V3, 09/10/2026) ; « Toutes les couleurs » ouvre le reste. */
export const NOMS_PASTILLES = ["Blanc cassé", "Beige", "Camel", "Chocolat", "Kaki", "Marine", "Bordeaux", "Noir"];
/** Teintes claires : la coche y est noire, sur les foncées elle est crème. */
export const luminance = (hex: string) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};

/** Puce de la V3 : 40 px, terracotta plein quand elle est choisie, crème à bord plein sinon. */
export function chip(on: boolean): string {
  return (
    "h-[40px] px-[14px] rounded-full border text-[12.5px] font-medium cursor-pointer font-sans inline-flex items-center justify-center " +
    (on ? "bg-terracotta-deep border-terracotta-deep text-[#FBF3EA]" : "bg-card border-border text-ink")
  );
}

/** Étiquette de section : capitales espacées, grises (design system). */
export const EYEBROW = "text-[10.5px] tracking-[.16em] uppercase text-[#8B8375]";

/** Le cintre de la V3 : le crochet fixe, un arc qui tourne pendant l'attente. */
export function SpinnerCintre({ sombre }: { sombre?: boolean }) {
  return (
    <span className="relative block w-[24px] h-[24px] flex-shrink-0" aria-hidden="true">
      <svg viewBox="0 0 24 24" className="absolute inset-0 w-[24px] h-[24px]" fill="none" stroke={sombre ? "#1D1A16" : "#FBF3EA"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.6 9a1.4 1.4 0 1 1 1.4 1.4V12M12 12l-4.6 3.4h9.2z" />
      </svg>
      <svg viewBox="0 0 24 24" className="absolute inset-0 w-[24px] h-[24px] motion-safe:animate-spin" fill="none" stroke={sombre ? "#A66950" : "#E2C9A8"} strokeWidth="1.6" strokeLinecap="round">
        <path d="M12 2.5a9.5 9.5 0 0 1 9.5 9.5" />
      </svg>
    </span>
  );
}

/**
 * LA CARTE D'ANALYSE (12/10/2026, demandé : « le même écran pour une pièce et pour une tenue »), posée sur la photo en grand : le cintre
 * qui tourne et une phrase, sans liste d'étapes. Partagée par « Ajouter une pièce » et « Importer une tenue », pour que le passage de
 * l'un à l'autre ne se voie pas.
 */
export function CarteAnalyse() {
  return (
    <div role="status" aria-live="polite" className="absolute inset-0 flex items-center justify-center p-[18px]" style={{ background: "rgba(243,238,229,.64)" }}>
      <div className="w-[236px] max-w-full bg-card border border-border rounded-[20px] px-4 py-[14px]">
        <div className="flex items-center gap-[10px]">
          <SpinnerCintre sombre />
          <span className="font-serif font-medium text-[16px] text-ink">Capsela analyse ta photo</span>
        </div>
      </div>
    </div>
  );
}

function ChevronBas({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} width="16" height="16" fill="none" stroke="#5C5648" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6.5 9.5l5.5 5.5 5.5-5.5" />
    </svg>
  );
}

export function Coche({ couleur = "currentColor", taille = 16 }: { couleur?: string; taille?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={taille} height={taille} fill="none" stroke={couleur} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 12.5l4 4 8-9" />
    </svg>
  );
}

/**
 * Champ à liste (catégorie, modèle, taille) : un select natif transparent couvre la case — c'est le sélecteur du
 * système, que le pouce connaît, et il gère seul le clavier et l'accessibilité.
 */
export function ChampSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  valeurSerif,
  fond,
  attente,
  desactive,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  /** Valeur en Fraunces (la catégorie) plutôt qu'en Manrope grise (les champs facultatifs). */
  valeurSerif?: boolean;
  fond?: boolean;
  /** Valeur requise encore vide, ou analyse en cours : valeur grisée. */
  attente?: boolean;
  desactive?: boolean;
}) {
  const affiche = options.find((o) => o.value === value)?.label ?? placeholder ?? "";
  const vide = !value;
  return (
    <label className={"relative flex flex-col justify-center min-h-[56px] pr-[34px] pl-[16px] py-[6px] rounded-[16px] border border-border cursor-pointer min-w-0 focus-within:border-terracotta " + (fond ? "bg-card" : "")}>
      <span className="text-[10px] tracking-[.16em] uppercase text-[#8B8375] whitespace-nowrap">{label}</span>
      <span
        className={
          (valeurSerif ? "font-serif font-medium text-[16px] mt-[2px] " : "text-[13.5px] font-medium mt-[3px] whitespace-nowrap overflow-hidden text-ellipsis ") +
          (vide || attente ? "text-[#8B8375]" : "text-ink")
        }
        aria-hidden="true"
      >
        {affiche}
      </span>
      <ChevronBas className="absolute right-[12px] top-1/2 -mt-[8px]" />
      <select
        aria-label={label}
        disabled={desactive}
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
    </label>
  );
}

/** Mêmes tracés que dans PieceScreen : le geste « photo » se reconnaît d'un écran à l'autre. */
/** Les trois conseils de l'état initial (maquette 11/10/2026) : des consignes de prise de vue, aucune donnée de la personne. */
const CONSEILS_PHOTO = [
  { titre: "Bonne lumière", texte: "Lumière naturelle de préférence", icone: "M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" },
  { titre: "Fond uni", texte: "Un fond clair et sans motif", icone: "M8 3L3 6l2 4 3-1v12h8V9l3 1 2-4-5-3a4 4 0 0 1-8 0z" },
  { titre: "Plusieurs pièces", texte: "Tu peux ajouter plusieurs vêtements en même temps", icone: "M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5" },
] as const;

export function CameraIcon({ taille = 16 }: { taille?: number } = {}) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h3l1.6-2.4h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.4" />
    </svg>
  );
}

export function GalerieIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.6" />
      <path d="M21 16l-5-5-5.5 5.5L8 14l-5 5" />
    </svg>
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
 * AJOUTER UNE PIÈCE — V3 (09/10/2026, maquette « Ajouter une pièce V3 »).
 *
 * Une seule page défilante, un bouton fixe. L'ordre : photo, nom, catégorie et
 * modèle, couleur, manches (pour les pièces qui en ont), détails facultatifs
 * repliés, saisons, occasions. L'écran ne dit « Détecté par Capsela » que d'une
 * valeur réellement lue par l'analyse de la photo (addManchesIA) ; rien n'est
 * simulé quand le service ne répond pas.
 *
 * Obligatoire : une photo ou un nom, les manches d'une pièce qui en a (à
 * l'ajout), au moins une saison, le type de chaussure (R-B6), et la fin de
 * l'analyse. Les occasions sont suggérées en pointillés : seules celles que
 * l'utilisatrice confirme sont enregistrées.
 */
export default function AddScreen() {
  const { state, actions } = useCapsela();
  const { profile } = useAuth();
  // Deux champs distincts (correctif 10/09/2026) : `capture` demande l'appareil photo arrière, le champ sans
  // `capture` garde l'accès à la galerie — beaucoup de navigateurs mobiles n'offrent sinon que la galerie.
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galerieInputRef = useRef<HTMLInputElement>(null);
  const [sourcePhoto, setSourcePhoto] = useState(false);
  // « Toutes les couleurs » : la palette complète, en feuille.
  const [toutesCouleurs, setToutesCouleurs] = useState(false);
  // Les détails facultatifs : repliés à l'ajout ; ouverts d'emblée sur une pièce modifiée qui en porte déjà un.
  const [detailsOuverts, setDetailsOuverts] = useState(
    () => state.editingId != null && Boolean(state.addBrand || state.addMatiere || state.addCoupe || state.addSize),
  );
  // Les occasions montrent d'abord les recommandées ; la liste complète s'ouvre sur place.
  const [toutesOccasions, setToutesOccasions] = useState(false);
  // Le fichier de la photo choisie : de quoi détecter toutes ses pièces (« Importer une tenue ») si elle en montre plusieurs.
  const photoChoisie = useRef<File | null>(null);
  const [aPhotoChoisie, setAPhotoChoisie] = useState(false);
  const detectionLancee = useRef(false);
  const [saisieManuelle, setSaisieManuelle] = useState(false);
  const retirerLaPhoto = () => {
    // Retirer la photo : retour à l'état initial, sans garder les champs lus sur elle.
    actions.retirerPhotoAjout();
    photoChoisie.current = null;
    setAPhotoChoisie(false);
    setSaisieManuelle(false);
  };
  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      photoChoisie.current = file;
      detectionLancee.current = false;
      setAPhotoChoisie(true);
      actions.uploadAddPhoto(file);
    }
    // Sans réinitialisation, reprendre DEUX FOIS la même photo n'émettrait pas de second `change`.
    e.target.value = "";
    setSourcePhoto(false);
  };
  // Un champ qui reçoit le focus se recentre : le clavier ouvert ne le cache pas.
  const recentrer = (e: React.FocusEvent<HTMLElement>) => {
    const el = e.currentTarget;
    setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 250);
  };

  const creation = state.editingId == null;
  const isShoe = state.addCat === "chaussures";
  const isSac = state.addCat === "sac";
  const isBijou = state.addCat === "bijou";
  const isAccessoire = state.addCat === "accessoire";
  const sizeApplicable = isSizeApplicable(state.addCat);
  const coupeApplicable = isCoupeApplicable(state.addCat);
  const avecManches = aDesManches(state.addCat);

  const sizes = isShoe ? POINTURES : BOTTOM_SIZED.includes(state.addCat) ? taillesBasFor(profile.gender) : TAILLES_HAUT;
  const saisonsRetenues = state.addSaisons ?? [];

  const analyseEnCours = state.addPhotoAnalyzing;
  const detourageEnCours = state.addPhotoDetourage === "en_cours";
  const lectureEnCours = analyseEnCours || detourageEnCours;
  const analysee = state.addPhotoAnalysee && creation;
  const photoDetouree = estPhotoDetouree(state.addPhotoUrl);

  const typeOptions = typeOptionsFor(state.addCat);
  const typeValue = isShoe ? state.addShoeType : isSac ? state.addSacType : isBijou ? state.addBijouType : isAccessoire ? state.addAccessoireType : state.addSubtype;
  const setTypeValue = (v: string) => {
    if (isShoe) actions.setAddShoeType(v as ShoeType);
    else if (isSac) actions.setAddSacType(v as SacType);
    else if (isBijou) actions.setAddBijouType(v as BijouType);
    else if (isAccessoire) actions.setAddAccessoireType(v as AccessoireType);
    else actions.setAddSubtype(v);
  };

  // ── Couleur : huit pastilles de la palette réelle ; la couleur courante prend la dernière place si elle n'y est pas.
  const palette = isBijou ? PALETTE_BIJOU : PALETTE;
  const pastilles = (isBijou ? palette.slice(0, 8) : NOMS_PASTILLES.flatMap((n) => palette.filter(([nom]) => nom === n))).slice(0, 8);
  const couleurAffichee: [string, string][] = pastilles.some(([, hex]) => hex === state.addColor.hex)
    ? pastilles
    : [...pastilles.slice(0, 7), [state.addColor.name, state.addColor.hex]];

  // ── Manches : d'où vient la valeur affichée.
  const ia = state.addManchesIA;
  const manchesDetectees = ia != null && !state.addManchesTouched && state.addManches === ia;
  const manchesModifiees = ia != null && state.addManches !== ia;
  const manchesMeta = analyseEnCours
    ? { texte: "Analyse en cours…", couleur: "#8B8375" }
    : manchesDetectees
      ? { texte: "Détecté par Capsela", couleur: "#9E5B43" }
      : manchesModifiees
        ? { texte: "Modifié par toi", couleur: "#5C5648" }
        : state.addPhotoUrl && !state.addManches
          ? { texte: "Non détecté · à préciser", couleur: "#8B8375" }
          : { texte: "À préciser", couleur: "#8B8375" };

  // ── Motif (11/10/2026) : facultatif ; d'où vient la valeur affichée.
  const avecMotif = aUnMotif(state.addCat);
  const motifIA = state.addMotifIA;
  const motifDetecte = motifIA != null && !state.addMotifTouched && state.addMotif === motifIA;
  const motifModifie = motifIA != null && state.addMotif !== motifIA;
  const motifMeta = analyseEnCours
    ? { texte: "Analyse en cours…", couleur: "#8B8375" }
    : motifDetecte
      ? { texte: "Détecté par Capsela", couleur: "#9E5B43" }
      : motifModifie
        ? { texte: "Modifié par toi", couleur: "#5C5648" }
        : { texte: "Facultatif", couleur: "#8B8375" };

  // ── Ce qui bloque l'ajout, dans l'ordre où on le dit.
  const manquantes: string[] = [];
  if (creation && avecManches && !state.addManches) manquantes.push("les manches");
  if (saisonsRetenues.length === 0) manquantes.push("au moins une saison");
  const shoeTypeMissing = isShoe && !state.addShoeType;
  // DÉTECTION AUTOMATIQUE (11/10/2026, choisie par la propriétaire) : dès que l'analyse dit que la photo choisie ici montre une pièce
  // portée ou plusieurs pièces, elle passe à « Importer une tenue », une seule fois par photo choisie. Au retour sur cet écran, le fichier
  // n'est plus là : rien ne se relance, la personne reste sur le formulaire d'une pièce.
  const cadrageMulti = state.addPhotoCadrage === "portee" || state.addPhotoCadrage === "plusieurs";
  // L'écran reste en « chargement » entre la fin de l'analyse et le passage à l'import : jamais un éclair du formulaire d'une pièce seule.
  const redirection = creation && aPhotoChoisie && cadrageMulti && !state.addPhotoAnalyzing && !state.addPhotoUploading;
  useEffect(() => {
    if (!creation || !aPhotoChoisie || lectureEnCours || !cadrageMulti || detectionLancee.current || !photoChoisie.current) return;
    detectionLancee.current = true;
    // Le fichier ET son URL déjà envoyée : l'import ne renvoie pas la photo. Cet écran repart de zéro (la photo appartient désormais à l'import).
    confierPhoto({ fichier: photoChoisie.current, url: /^https?:/.test(state.addPhotoUrl ?? "") ? state.addPhotoUrl ?? undefined : undefined });
    actions.retirerPhotoAjout();
    photoChoisie.current = null;
    setAPhotoChoisie(false);
    actions.openImporterTenue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creation, aPhotoChoisie, lectureEnCours, cadrageMulti, actions]);

  const blocage = lectureEnCours || state.addPhotoUploading
    ? "Un instant, Capsela analyse ta photo."
    : creation && !state.addPhotoUrl && !state.addName.trim()
      ? "Ajoute une photo ou un nom pour commencer."
      : shoeTypeMissing
        ? "Choisis le modèle de chaussures pour pouvoir les ajouter."
        : manquantes.length
          ? `Précise ${manquantes.join(" et ")} pour l'ajouter.`
          : null;
  // Les champs et le bouton d'ajout ne se montrent qu'une fois la photo analysée (cf. etatAjout.ts, états tirés du pipeline réel).
  const etat = etatAjout({
    creation,
    photo: Boolean(state.addPhotoUrl),
    envoi: state.addPhotoUploading,
    analyse: state.addPhotoAnalyzing,
    analysee: state.addPhotoAnalysee,
    analyseDisponible: isSupabaseConfigured,
    saisieManuelle,
    redirection,
    nomRempli: state.addName.trim().length > 0,
  });
  const formulaireVisible = etat === "pret";
  const desactive = Boolean(blocage) || state.addSaving || state.addDone;

  const nomSuggere = analysee && !state.addNameTouched && state.addName.trim().length > 0;
  const matiereEstimee = analysee && !state.addMatiereTouched && Boolean(state.addMatiere);
  const resumeDetails = [
    state.addBrand.trim(),
    state.addMatiere,
    coupeApplicable ? state.addCoupe : null,
    sizeApplicable && state.addSize ? (isShoe ? "Pointure " : "Taille ") + state.addSize : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const titre = !creation ? "Modifier la pièce" : state.replacingId ? "Remplacer par ta pièce" : "Ajouter une pièce";

  // ── Occasions : les suggestions de Capsela (pointillés), puis celles que l'utilisatrice a confirmées hors suggestion.
  // Seules les confirmées sont enregistrées.
  const suggerees = suggestOccasions(state.addCat, state.addShoeType);
  const confirmees = state.addOccasion;
  const occasionsEnTete = [...suggerees, ...confirmees.filter((o) => !suggerees.includes(o))];
  const occasionsAffichees = toutesOccasions ? OCCASIONS.map(([key]) => key) : occasionsEnTete;

  const save = () => {
    if (desactive) return;
    actions.saveItem();
  };


  const libelleCta = state.addDone
    ? "Ajoutée au dressing"
    : state.addSaving
      ? "Ajout en cours…"
      : !creation
        ? "Enregistrer les modifications"
        : "Ajouter au dressing";

  return (
    <div className="absolute inset-0 flex flex-col bg-cream">
      <div className="flex-shrink-0 grid grid-cols-[44px_1fr_44px] items-center gap-2 px-[14px] pt-[8px] pb-[6px]">
        <BoutonRetour onClick={actions.addBack} label="Revenir à l'écran précédent" />
        <div className="text-center font-serif font-medium text-[19px] text-ink">{titre}</div>
        <span />
      </div>

      <div className="scrollarea flex-1 min-h-0 overflow-y-auto px-[18px] pt-[6px] pb-[132px]">
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={onPhotoChange} className="hidden" />
        <input ref={galerieInputRef} type="file" accept="image/*" onChange={onPhotoChange} className="hidden" />

        {/* 1. La photo : même hauteur vide ou remplie (ratio 1,3), aucun saut de mise en page. */}
        {state.addPhotoUrl ? (
          <div
            role="img"
            aria-label="Photo de la pièce"
            className={"relative rounded-[24px] overflow-hidden border border-border " + (etat === "chargement" ? "aspect-[4/5]" : "aspect-[1.3]") + " " + (photoDetouree ? "bg-photo-bg" : "bg-warm-bg")}
            style={{
              backgroundImage: `url(${state.addPhotoUrl})`,
              // Détourée : la pièce entière, jamais recadrée comme une photo.
              backgroundSize: photoDetouree ? "contain" : "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
          >
            {state.addPhotoUploading && (
              <span className="absolute inset-0 flex items-center justify-center text-[12px] text-cream" style={{ background: "rgba(29,26,22,.45)" }}>
                Envoi de la photo…
              </span>
            )}
            {!lectureEnCours && !state.addPhotoUploading && creation && (
              <button
                type="button"
                aria-label="Retirer la photo"
                onClick={retirerLaPhoto}
                className="absolute right-[10px] top-[10px] w-[44px] h-[44px] rounded-full bg-card flex items-center justify-center cursor-pointer"
              >
                <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="#1D1A16" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10 11v5M14 11v5" />
                </svg>
              </button>
            )}
            {(lectureEnCours || etat === "chargement") && <CarteAnalyse />}
          </div>
        ) : (
          <>
            {/* État initial (maquette « Ajouter une pièce », 11/10/2026) : l'invitation, deux boutons l'un sous l'autre, puis les conseils. */}
            <div className="rounded-[24px] bg-card border border-border px-[18px] pt-[26px] pb-[18px] flex flex-col items-center text-center">
              <span className="w-[64px] h-[64px] rounded-full flex items-center justify-center text-terracotta-deep" style={{ background: "rgba(158,91,67,.12)" }} aria-hidden="true">
                <CameraIcon taille={28} />
              </span>
              <div className="font-serif font-medium text-[22px] text-ink mt-[14px]">Photographier ma pièce</div>
              <div className="text-[12.5px] text-[#5C5648] mt-1 leading-[1.45]">
                Sur un fond uni, à la lumière du jour.
                <br />
                Tu peux photographier plusieurs vêtements en même temps.
              </div>
              <div className="flex flex-col gap-2 w-full mt-[20px]">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="h-[48px] rounded-full bg-terracotta-deep text-[#FBF3EA] text-[13.5px] font-semibold cursor-pointer"
                >
                  Prendre une photo
                </button>
                <button
                  type="button"
                  onClick={() => galerieInputRef.current?.click()}
                  className="h-[48px] rounded-full border border-border bg-cream text-ink text-[13.5px] font-semibold cursor-pointer"
                >
                  Importer
                </button>
              </div>
            </div>
            {etat === "initial" && (
              <section className="mt-[22px]" aria-labelledby="ajout-conseils">
                <div id="ajout-conseils" className={EYEBROW}>
                  Conseils
                </div>
                <ul className="list-none p-0 mt-[10px] flex flex-col gap-2">
                  {CONSEILS_PHOTO.map((c) => (
                    <li key={c.titre} className="flex items-center gap-3 rounded-[16px] bg-warm-bg px-3 py-[10px]">
                      <span className="w-[32px] h-[32px] flex-shrink-0 flex items-center justify-center text-terracotta-deep" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                          <path d={c.icone} />
                        </svg>
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13px] text-ink font-medium leading-[1.3]">{c.titre}</span>
                        <span className="block text-[12px] text-[#5C5648] leading-[1.35]">{c.texte}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {state.addPhotoUrl && !lectureEnCours && !state.addPhotoUploading && (
          <button
            type="button"
            onClick={() => setSourcePhoto(true)}
            className="mx-auto mt-3 min-h-[44px] px-5 rounded-full border border-border bg-cream text-ink text-[13px] font-semibold flex items-center gap-2 cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="w-[16px] h-[16px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4" />
            </svg>
            Remplacer la photo
          </button>
        )}

        {/* Une photo qui n'est pas celle d'une pièce seule : dit à l'ajout, d'après ce que l'analyse a vu — jamais stocké, jamais deviné. */}
        {creation && !lectureEnCours && messageCadrage(state.addPhotoCadrage) && (
          <div className="mt-[10px] rounded-tuile bg-warm-bg border border-sand-border px-4 py-[12px]" role="status">
            <div className="text-[13px] text-ink font-medium leading-[1.35]">{messageCadrage(state.addPhotoCadrage)!.titre}</div>
            <div className="text-[12px] text-warm-text-2 leading-[1.45] mt-[2px]">{messageCadrage(state.addPhotoCadrage)!.texte}</div>
            {aPhotoChoisie && (state.addPhotoCadrage === "portee" || state.addPhotoCadrage === "plusieurs") && (
              <button
                type="button"
                onClick={() => {
                  if (photoChoisie.current) confierPhoto({ fichier: photoChoisie.current, url: /^https?:/.test(state.addPhotoUrl ?? "") ? state.addPhotoUrl ?? undefined : undefined });
                  actions.openImporterTenue();
                }}
                className="mt-[10px] min-h-[44px] text-[13px] font-semibold text-terracotta-deep cursor-pointer"
              >
                Détecter toutes les pièces de la photo
              </button>
            )}
          </div>
        )}

        {etat === "echec" && (
          <div role="alert" className="mt-[10px] rounded-tuile bg-warm-bg border border-sand-border px-4 py-[12px]">
            <div className="text-[13px] text-ink font-medium leading-[1.35]">Capsela n&apos;a pas pu lire cette photo.</div>
            <div className="text-[12px] text-warm-text-2 leading-[1.45] mt-[2px]">Aucune information n&apos;a été détectée : réessaie, remplace la photo ou saisis la pièce à la main.</div>
            {aPhotoChoisie && (
              <button
                type="button"
                onClick={() => photoChoisie.current && actions.uploadAddPhoto(photoChoisie.current)}
                className="mt-[10px] mr-4 min-h-[44px] text-[13px] font-semibold text-terracotta-deep cursor-pointer"
              >
                Réessayer
              </button>
            )}
            <button type="button" onClick={() => setSaisieManuelle(true)} className="mt-[10px] min-h-[44px] text-[13px] font-semibold text-terracotta-deep cursor-pointer">
              Saisir à la main
            </button>
          </div>
        )}

        {etat === "initial" && (
          <button type="button" onClick={() => setSaisieManuelle(true)} className="mt-4 min-h-[44px] text-[13px] font-semibold text-terracotta-deep cursor-pointer">
            Saisir la pièce sans photo
          </button>
        )}

        {formulaireVisible && (
          <>
        {/* 2. Le nom. */}
        <label htmlFor="ajout-nom" className={"block mt-[22px] " + EYEBROW}>
          Nom de la pièce
        </label>
        {nomSuggere && (
          <div className="flex items-center gap-[6px] mt-[6px] text-[12px] text-terracotta">
            <span className="font-serif italic" aria-hidden="true">✦</span>
            Nom suggéré par Capsela
          </div>
        )}
        <Input
          id="ajout-nom"
          value={state.addName}
          onChange={(e) => actions.setAddName(e.target.value)}
          onFocus={recentrer}
          enterKeyHint="done"
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          placeholder={lectureEnCours ? "Capsela te le propose dans un instant" : "ex. Chemise en lin écrue"}
          className="mt-2 !h-[52px] font-serif text-[17px]"
        />

        {/* 3. Catégorie et modèle. Le modèle est exigé pour des chaussures (R-B6) ; ailleurs, c'est le type de pièce,
            distinct de la « Coupe » (détails facultatifs). */}
        <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-2 mt-[10px]">
          <ChampSelect
            label="Catégorie"
            value={analyseEnCours ? "" : state.addCat}
            onChange={(v) => actions.setAddCat(v as CategoryKey)}
            options={CATS.map(([key, label]) => ({ value: key, label }))}
            valeurSerif
            fond
            attente={analyseEnCours}
            placeholder={analyseEnCours ? "Analyse…" : undefined}
            desactive={analyseEnCours}
          />
          {typeOptions && typeOptions.length > 0 && (
            <ChampSelect
              label="Modèle"
              value={typeValue || ""}
              onChange={setTypeValue}
              options={typeOptions.map((t) => ({ value: t, label: t }))}
              placeholder={isShoe ? "Choisir" : "Facultatif"}
              attente={shoeTypeMissing}
            />
          )}
        </div>

        {/* 4. La couleur principale : huit pastilles, un anneau et une coche sur la choisie — jamais la seule teinte. */}
        <div className="flex items-baseline justify-between gap-3 mt-6">
          <span className={EYEBROW}>Couleur principale</span>
          <span className={"font-serif font-medium text-[15px] " + (analyseEnCours ? "text-[#8B8375]" : "text-ink")}>
            {analyseEnCours ? "Analyse…" : state.addColor.name}
          </span>
        </div>
        <div role="radiogroup" aria-label="Couleur principale" className="flex justify-between mt-2">
          {couleurAffichee.map(([nom, hex]) => {
            const on = state.addColor.hex === hex;
            const claire = luminance(hex) > 0.62;
            return (
              <button
                key={hex}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={nom}
                onClick={() => actions.setAddColor({ name: nom, hex })}
                className="w-[44px] h-[44px] rounded-full bg-transparent p-[3px] cursor-pointer"
                style={{ border: `2px solid ${on ? "#1D1A16" : "transparent"}` }}
              >
                <span
                  className="w-full h-full rounded-full flex items-center justify-center"
                  style={{ background: hex, border: `1px solid ${claire ? "#D9CDB8" : hex}` }}
                >
                  {on && <Coche couleur={claire ? "#1D1A16" : "#FBF8F3"} />}
                </span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setToutesCouleurs(true)}
          className="min-h-[44px] inline-flex items-center gap-1 text-[12.5px] font-semibold text-terracotta-deep cursor-pointer"
        >
          Toutes les couleurs
          <svg viewBox="0 0 24 24" className="w-[13px] h-[13px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9.5 6l6 6-6 6" />
          </svg>
        </button>

        {/* 5. Les manches : seulement pour les pièces qui en ont ; obligatoires à l'ajout. */}
        {avecManches && (
          <>
            <div className="flex items-center justify-between gap-3 mt-2 min-h-[24px]">
              <span className={EYEBROW}>Manches</span>
              <span className="flex items-center gap-[10px] text-[11.5px] font-medium" style={{ color: manchesMeta.couleur }}>
                {manchesMeta.texte}
                {manchesModifiees && !analyseEnCours && (
                  <button
                    type="button"
                    onClick={actions.retablirAddManches}
                    className="min-h-[44px] -my-[10px] text-[11.5px] font-semibold text-terracotta-deep underline underline-offset-[3px] cursor-pointer"
                  >
                    Rétablir
                  </button>
                )}
              </span>
            </div>
            <div role="radiogroup" aria-label="Manches" className="grid grid-cols-2 gap-2 mt-[10px]">
              {MANCHES.map(({ valeur, libelle }) => {
                const on = state.addManches === valeur;
                return (
                  <button
                    key={valeur}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={analyseEnCours}
                    onClick={() => actions.setAddManches(valeur)}
                    className={chip(on) + " disabled:opacity-60 disabled:cursor-default"}
                  >
                    {libelle}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* 5 bis. Le motif : facultatif, lu sur la photo quand il est net, jamais pour un bijou. Aucune règle de tenue ne le lit encore. */}
        {avecMotif && (
          <>
            <div className="flex items-center justify-between gap-3 mt-[22px] min-h-[24px]">
              <span className={EYEBROW}>Motif</span>
              <span className="flex items-center gap-[10px] text-[11.5px] font-medium" style={{ color: motifMeta.couleur }}>
                {motifMeta.texte}
                {motifModifie && !analyseEnCours && (
                  <button
                    type="button"
                    onClick={actions.retablirAddMotif}
                    className="min-h-[44px] -my-[10px] text-[11.5px] font-semibold text-terracotta-deep underline underline-offset-[3px] cursor-pointer"
                  >
                    Rétablir
                  </button>
                )}
              </span>
            </div>
            <div role="radiogroup" aria-label="Motif" className="flex flex-wrap gap-2 mt-[10px]">
              {MOTIFS.map(({ valeur, libelle }) => {
                const on = state.addMotif === valeur;
                return (
                  <button
                    key={valeur}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={analyseEnCours}
                    onClick={() => actions.setAddMotif(valeur)}
                    className={chip(on) + " disabled:opacity-60 disabled:cursor-default"}
                  >
                    {libelle}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* 6. Les détails facultatifs : repliés, entre deux filets. Replié, le sous-titre rappelle ce qui est déjà renseigné. */}
        <div className="mt-6 border-y border-border">
          <button
            type="button"
            onClick={() => setDetailsOuverts((v) => !v)}
            aria-expanded={detailsOuverts}
            aria-controls="details-facultatifs"
            className="w-full min-h-[56px] py-2 flex items-center justify-between gap-3 text-left cursor-pointer"
          >
            <span className="flex flex-col gap-[3px] min-w-0">
              <span className="text-[13.5px] font-semibold text-ink">Détails facultatifs</span>
              <span className="text-[12px] text-[#5C5648] break-words">{resumeDetails || "Marque, matière, coupe, taille…"}</span>
            </span>
            <ChevronBas className={"flex-shrink-0 motion-safe:transition-transform " + (detailsOuverts ? "rotate-180" : "")} />
          </button>
          {detailsOuverts && (
            <div id="details-facultatifs" className="pt-[2px] pb-4 flex flex-col gap-[14px]">
              <div className={"grid gap-2 " + (sizeApplicable ? "grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]" : "grid-cols-1")}>
                <input
                  aria-label="Marque, optionnelle"
                  value={state.addBrand}
                  onChange={(e) => actions.setAddBrand(e.target.value)}
                  onFocus={recentrer}
                  placeholder="Marque"
                  enterKeyHint="done"
                  className="h-[44px] min-w-0 px-[14px] rounded-[14px] border border-border bg-card text-[13px] font-medium text-ink outline-none focus:border-terracotta placeholder:text-[#8B8375]"
                />
                {sizeApplicable && (
                  <label className="relative block min-w-0">
                    <span className="sr-only">{isShoe ? "Pointure" : "Taille"}</span>
                    <select
                      value={state.addSize ?? ""}
                      onChange={(e) => actions.setAddSize(e.target.value || null)}
                      className={"h-[44px] w-full appearance-none px-[14px] pr-[30px] rounded-[14px] border border-border bg-card text-[13px] font-medium outline-none focus:border-terracotta " + (state.addSize ? "text-ink" : "text-[#8B8375]")}
                    >
                      <option value="">{isShoe ? "Pointure" : "Taille"}</option>
                      {sizes.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <ChevronBas className="absolute right-[10px] top-1/2 -mt-[8px] pointer-events-none" />
                  </label>
                )}
              </div>
              <div>
                <div className={EYEBROW}>{matiereEstimee ? "Matière estimée" : "Matière"}</div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {MATIERES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={state.addMatiere === m}
                      onClick={() => actions.setAddMatiere(state.addMatiere === m ? null : m)}
                      className={chip(state.addMatiere === m)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              {coupeApplicable && (
                <div>
                  <div className={EYEBROW}>Coupe</div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {COUPES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={state.addCoupe === c}
                        onClick={() => actions.setAddCoupe(state.addCoupe === c ? null : (c as Coupe))}
                        className={chip(state.addCoupe === c)}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 7. Les saisons : aucune présélection, au moins une. Lues sur la photo quand l'analyse est sûre. */}
        <div className="flex items-baseline justify-between gap-3 mt-[22px]">
          <span className={EYEBROW}>{state.addSaisonsLues ? "Saisons suggérées" : "Saisons"}</span>
          <span className="text-[11.5px] text-[#8B8375]">
            {saisonsRetenues.length ? `${saisonsRetenues.length} choisie${saisonsRetenues.length > 1 ? "s" : ""}` : "Au moins une"}
          </span>
        </div>
        {state.addSaisonsLues && <div className="text-[12px] text-[#5C5648] mt-[4px]">Lues sur ta photo, modifiables.</div>}
        <div className="grid grid-cols-4 gap-[6px] mt-[10px]" role="group" aria-label="Saisons">
          {QUATRE_SAISONS.map((sa) => {
            const on = saisonsRetenues.includes(sa);
            return (
              <button key={sa} type="button" aria-pressed={on} onClick={() => actions.basculerAddSaison(sa)} className={chip(on) + " !px-1"}>
                {sa}
              </button>
            );
          })}
        </div>

        {/* 8. Les occasions : suggérées en pointillés, confirmées en terracotta plein. Seules les confirmées sont enregistrées. */}
        <div className={"mt-6 " + EYEBROW}>Occasions recommandées</div>
        <div className="text-[12px] text-[#5C5648] mt-[5px]">En pointillés, les suggestions de Capsela : touche pour confirmer.</div>
        <div className="flex flex-wrap gap-2 mt-[10px]" role="group" aria-label="Occasions">
          {occasionsAffichees.map((key) => {
            const confirmee = confirmees.includes(key);
            const suggeree = !confirmee && suggerees.includes(key);
            const libelle = libelleOccasion(key);
            return (
              <button
                key={key}
                type="button"
                aria-pressed={confirmee}
                aria-label={suggeree ? `${libelle}, suggérée` : libelle}
                onClick={() => actions.setAddOccasion(key)}
                className={
                  "h-[40px] px-[15px] rounded-full text-[12.5px] font-medium cursor-pointer font-sans border " +
                  (confirmee
                    ? "bg-terracotta-deep border-terracotta-deep text-[#FBF3EA] border-solid"
                    : suggeree
                      ? "bg-card border-[#A66950] text-terracotta-deep border-dashed"
                      : "bg-card border-border text-ink")
                }
              >
                {libelle}
              </button>
            );
          })}
          {!toutesOccasions && occasionsEnTete.length === 0 && <span className="text-[12px] text-muted">Aucune occasion pour l&apos;instant.</span>}
        </div>
        {!toutesOccasions && (
          <button
            type="button"
            onClick={() => setToutesOccasions(true)}
            className="mt-[10px] min-h-[44px] w-full rounded-full border border-border bg-card text-[13px] text-terracotta cursor-pointer font-sans"
          >
            + Ajouter une autre occasion
          </button>
        )}
          </>
        )}
      </div>

      {/* 9. L'action, fixée hors du défilement, au-dessus de la zone système. */}
      {formulaireVisible && (
      <div className="absolute left-0 right-0 bottom-0 bg-cream border-t border-border px-[18px] pt-3" style={{ paddingBottom: "calc(14px + env(safe-area-inset-bottom))" }}>
        <button
          type="button"
          onClick={save}
          disabled={desactive}
          aria-busy={state.addSaving}
          className={
            "w-full h-[52px] rounded-full flex items-center justify-center gap-[10px] text-[13.5px] font-semibold uppercase tracking-[.08em] " +
            (blocage && !state.addSaving && !state.addDone ? "bg-[#E2C9A8] text-[#5C5648] cursor-not-allowed" : "bg-terracotta-deep text-[#FBF3EA] cursor-pointer disabled:cursor-default")
          }
        >
          {state.addSaving && <SpinnerCintre />}
          {state.addDone && <Coche couleur="#FBF3EA" taille={18} />}
          {libelleCta}
        </button>
        <div className="text-center text-[12px] text-[#5C5648] mt-2 min-h-[16px]" role={state.addErreur ? "alert" : undefined}>
          {state.addErreur ??
            (state.addDone ? "Tu la retrouves dans ton dressing." : (blocage ?? "Tout reste modifiable depuis ton dressing."))}
        </div>
      </div>
      )}

      <BottomSheet title={state.addPhotoUrl ? "Changer la photo" : "Ajouter une photo"} open={sourcePhoto} onClose={() => setSourcePhoto(false)}>
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
          {creation && state.addPhotoUrl && (
            <button
              onClick={() => {
                setSourcePhoto(false);
                // Retirer la photo : retour à l'état initial, sans garder les champs lus sur elle.
                actions.retirerPhotoAjout();
                photoChoisie.current = null;
                setAPhotoChoisie(false);
                setSaisieManuelle(false);
              }}
              className="flex items-center gap-[13px] py-[15px] text-[14px] text-ink border-t border-border cursor-pointer text-left"
            >
              Retirer la photo
            </button>
          )}
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
                  <button key={hex} aria-pressed={on} onClick={() => actions.setAddColor({ name, hex })} className="flex flex-col items-center gap-[7px] cursor-pointer">
                    <span
                      className="w-[38px] h-[38px] rounded-champ"
                      style={{
                        background: hex,
                        border: on ? "2px solid var(--color-ink)" : "1px solid rgba(29,26,22,.12)",
                        boxShadow: on ? "0 0 0 3px var(--color-cream) inset" : "none",
                      }}
                    />
                    <span className={"text-[9px] text-center leading-[1.3] " + (on ? "text-ink" : "text-muted")}>
                      {name}
                      {on ? " ✓" : ""}
                    </span>
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
