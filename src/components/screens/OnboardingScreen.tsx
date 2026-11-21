"use client";

import { aTraduire, t } from "@/lib/langue";
import { useRef, useState } from "react";
import { ONBOARDING_SLIDES } from "@/lib/data";
import AppHeader from "@/components/AppHeader";
import { useCapsela } from "@/lib/store";
import { STYLE_CONFIG, VISUELS_ETAPE_STYLE_FEMME, type StyleId } from "@/lib/profile";
import Button from "@/components/Button";
import Card from "@/components/Card";

/*
 * L'ONBOARDING AVANT LE COMPTE (refonte du 05/10/2026, brief « Onboarding premium de Capsela »).
 *
 * Six écrans, une histoire : Capsela comprend ton style → ton dressing → t'aide à t'habiller → prépare ta semaine (Planifier,
 * ajouté le 20/11/2026) → t'accompagne quand tu pars → et le compte. Les quatre premiers ont la même forme (logo, « Passer », visuel, sur-titre, titre, phrase, points de
 * progression, « Continuer ») ; le cinquième n'explique plus rien et ne garde que le compte.
 *
 * LES VISUELS : le premier garde les visuels de style du projet ; les suivants sont recadrés depuis les visuels éditoriaux
 * fournis par la propriétaire le 05/10/2026 (public/onboarding/, tirés de « Capsela_Onboarding_Editorial_Assets » : penderie,
 * tenue à plat, valise ouverte, téléphone posé sur un lin). Seule la PHOTO en est gardée : les textes, les puces, les cartes
 * sont du HTML aux jetons de l'app (les images fournies portaient les leurs, coupés à droite sur la valise, non traduisibles,
 * hors du design system). Limite : ces sources font 368 px de large — nettes à 1×, un peu douces sur un écran très dense.
 * Les chiffres montrés (36 pièces, 22°, Rhodes, 24 pièces) sont des EXEMPLES, dits
 * comme tels dans l'écran. Le genre n'est pas connu à ce stade (il se demande après le compte) : les visuels sont purement
 * illustratifs — profil femme, sauf l'écran « Ton style », qui mêle les deux univers (04/11/2026).
 *
 * LA HAUTEUR : la zone de contenu défile au-dessus d'un pied fixe (le bouton n'est jamais poussé ni recouvert), mais les
 * visuels se règlent sur la hauteur d'écran (`--h-visuel`) pour que, sur un téléphone courant, rien ne défile. Sur un très
 * petit écran, le visuel rétrécit d'abord, le titre garde sa taille tant que possible, le bouton reste visible.
 *
 * Mouvement : un fondu et 6 px de montée (capsule-apparition, déjà dans l'app), le visuel un peu après le texte ; arrêtés
 * si le téléphone demande moins d'animations. Pas de balayage : l'onboarding d'avant n'en avait pas.
 */

/*
 * LES SIX UNIVERS DE L'ÉCRAN « TON STYLE » (04/11/2026, brief « Évolution de l'écran de présentation Ton style ») : trois visuels
 * femme et trois visuels homme, pour montrer d'emblée que Capsela habille les deux. Écran de PRÉSENTATION : aucun choix, aucune
 * donnée lue ni écrite. « Créatif » remplace « Bohème ». Les visuels sont ceux de l'étape Style du profil, chacun dans son univers.
 */
const STYLES_ONBOARDING: { id: StyleId; univers: "femme" | "homme" }[] = [
  { id: "minimaliste", univers: "femme" },
  { id: "casual_chic", univers: "homme" },
  { id: "creatif", univers: "femme" },
  { id: "classique_chic", univers: "homme" },
  { id: "streetwear", univers: "homme" },
  { id: "glamour", univers: "femme" },
];

/**
 * Le visuel d'un style : le même que l'étape Style du profil, jamais un second jeu d'images — les visuels de l'étape Style
 * (VISUELS_ETAPE_STYLE_FEMME) depuis le 30/10/2026 (demandé : « mets à jour ces visuels avec les derniers visuels de styles »), comme les
 * cartes « Explore un autre univers ». Repli sur l'aplat si le fichier ne charge pas.
 */
function TuileStyle({ id, univers, decale }: { id: StyleId; univers: "femme" | "homme"; decale?: boolean }) {
  const cfg = STYLE_CONFIG[univers][id];
  // Côté femme, le visuel de l'étape Style (VISUELS_ETAPE_STYLE_FEMME) ; côté homme, celui de STYLE_CONFIG.homme, le même que l'étape
  // Style d'un profil homme (public/images/styles/homme/).
  const visuel = univers === "femme" ? VISUELS_ETAPE_STYLE_FEMME[id] ?? cfg.asset : cfg.asset;
  const [echec, setEchec] = useState(false);
  return (
    <div className={"relative rounded-bloc overflow-hidden bg-border aspect-[4/5] " + (decale ? "translate-y-[12px]" : "")}>
      {visuel && !echec && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={visuel} alt="" onError={() => setEchec(true)} className="absolute inset-0 w-full h-full object-cover" />
      )}
      <div className="absolute bottom-0 left-0 right-0 px-[8px] pt-[14px] pb-[7px] bg-gradient-to-t from-black/45 to-transparent">
        <div className="text-[10.5px] text-white font-medium leading-[1.2]">{t(cfg.label)}</div>
      </div>
    </div>
  );
}

/** Une image de pièce ou de look, cadrée pleine tuile ; décorative. */
function Photo({ src, className = "", position = "center" }: { src: string; className?: string; position?: string }) {
  return (
    <div className={"relative overflow-hidden rounded-bloc bg-border " + className}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: position }} />
    </div>
  );
}

// ── 1 · Ton style : six univers ─────────────────────────────────────────

function VisuelStyle() {
  return (
    <div
      role="img"
      aria-label={t("Six univers de style, femme et homme : Minimaliste, Casual chic, Créatif, Classique chic, Streetwear et Glamour")}
      className="grid grid-cols-3 gap-[8px] [@media(max-width:340px)]:gap-[6px] pb-[12px]"
    >
      {STYLES_ONBOARDING.map(({ id, univers }, i) => (
        <TuileStyle key={id} id={id} univers={univers} decale={i % 3 === 1} />
      ))}
    </div>
  );
}

// ── 2 · Ton dressing : une capsule exemple ──────────────────────────────

const REPERES_CAPSULE: { glyphe: string; libelle: string; texte: string }[] = [
  { glyphe: "✓", libelle: aTraduire("Cohérent"), texte: aTraduire("Tout s’accorde facilement") },
  { glyphe: "✦", libelle: aTraduire("Polyvalent"), texte: aTraduire("Des pièces faciles à porter") },
  { glyphe: "↻", libelle: aTraduire("Évolutif"), texte: aTraduire("Garde, remplace et personnalise") },
];

function VisuelDressing() {
  return (
    <div role="img" aria-label={t("Exemple de capsule : une penderie de pièces qui vont ensemble")}>
      <div className="relative rounded-carte overflow-hidden bg-border" style={{ height: "var(--h-visuel)" }}>
        {/* Visuel fourni le 20/11/2026 (généré d'après le brief Capsela : penderie capsule, pièces femme et homme mêlées, sans texte),
            900 × 1125 : nette à 2× sur un téléphone, contrairement à la penderie d'avant (368 px de large). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/onboarding/dressing-capsule.webp" alt="" width={900} height={1125} decoding="async" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: "center 42%" }} />
        {/* La pastille centrée (20/11/2026, signalé : « le texte dans la pastille n'est pas bien centré ») : posée à left 50 %, elle ne
            disposait que de la moitié de la largeur et son texte débordait à droite (320 px) ; w-max lui rend sa largeur, et le texte est
            centré en hauteur sur la marque (leading-none). */}
        <div className="absolute bottom-[10px] left-1/2 -translate-x-1/2 w-max inline-flex items-center justify-center gap-[6px] bg-card border border-border rounded-full py-[7px] px-[13px] whitespace-nowrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/capsela-c.png" alt="" className="block flex-shrink-0" style={{ width: 13, height: "auto" }} />
          <span className="text-[11px] leading-none text-ink font-medium">{t("36 pièces · exemple")}</span>
        </div>
      </div>
      <div className="flex justify-between mt-[12px]">
        {REPERES_CAPSULE.map((r) => (
          <div key={r.libelle} className="flex flex-col items-center text-center w-1/3 px-[4px]">
            <div className="w-7 h-7 rounded-full bg-card border border-border flex items-center justify-center text-terracotta text-[13px] flex-shrink-0">{r.glyphe}</div>
            <div className="text-[11px] text-ink font-medium mt-[6px] leading-[1.2]">{t(r.libelle)}</div>
            <div className="text-[10px] text-muted mt-[2px] leading-[1.3]">{t(r.texte)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 3 · Tes tenues : la carte de l'accueil ─────────────────────────────

/*
 * LA CARTE DE L'ACCUEIL, TELLE QU'ELLE EST (20/11/2026, signalé : « je ne suis pas fan de ce visuel », l'écran montrait une ancienne
 * version de l'accueil — carte terracotta, « Ton look du jour », « Voir le détail », jean et baskets pour le bureau). La carte de l'accueil
 * d'aujourd'hui (CarteHero, option B) : le surtitre de l'occasion, le titre en deux temps, la tenue, puis Sauvegarder · Avis d'un
 * proche · Autre tenue, en ligne discrète. Inerte : c'est une image d'exemple (role="img"), pas un écran — sans « Voir la tenue »,
 * qui avait l'air cliquable (20/11/2026).
 * La photo (fournie le 20/11/2026, générée d'après le brief Capsela) est une tenue de QUOTIDIEN — chemise, pull sans manches, pantalon à
 * pinces, baskets, sac seau — : l'occasion annoncée est la sienne. Le titre et la phrase sont ceux que le texte éditorial donnerait à
 * ces pièces (editorialLook.ts : une couleur forte accordée aux neutres, « nuancé »).
 */
const ICONES_ACTIONS: { libelle: string; d: React.ReactNode }[] = [
  { libelle: aTraduire("Sauvegarder"), d: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /> },
  { libelle: aTraduire("Avis d'un proche"), d: <path d="M4.5 6.5A2.5 2.5 0 0 1 7 4h10a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 17 16h-6l-4 3.5V16a2.5 2.5 0 0 1-2.5-2.5z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /> },
  { libelle: aTraduire("Autre tenue"), d: <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /> },
];

function VisuelTenue() {
  return (
    <div
      role="img"
      aria-label={t("Exemple de tenue du jour : une tenue du quotidien, chemise, pull sans manches, pantalon à pinces, baskets et sac, avec les actions Sauvegarder, Avis d'un proche et Autre tenue")}
      className="rounded-hero px-[14px] pt-[12px] pb-[8px] [@media(max-height:700px)]:pb-[14px]"
      style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-[7px]">
          <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" className="flex-shrink-0 text-terracotta-deep" style={{ display: "block" }}>
            <path d="M12 3.5l1.7 5.1 5.3 1.7-5.3 1.7L12 17.1l-1.7-5.1L5 10.3l5.3-1.7z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="t-surtitre text-ink whitespace-nowrap">{t("Pour le quotidien")}</span>
        </div>
        <span className="text-[10.5px] text-muted">{t("exemple")}</span>
      </div>
      <div className="font-serif text-[21px] leading-[1.15] text-ink mt-[6px]">
        Casual <em className="italic text-terracotta">{t("et nuancé")}</em>
      </div>
      <div className="relative rounded-bloc overflow-hidden bg-warm-bg mt-[10px]" style={{ height: "var(--h-visuel)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/onboarding/tenue-quotidien.webp" alt="" width={900} height={1200} decoding="async" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: "center 45%" }} />
      </div>
      {/* PAS DE BOUTON DANS UNE IMAGE D'EXEMPLE (20/11/2026, signalé : « le CTA est tellement présent que l'on a l'impression qu'on peut
          cliquer dessus ») : « Voir la tenue » est retiré ; les trois actions restent, en ligne discrète, pour dire ce que l'on peut faire
          d'une tenue — sans fond ni filet, rien qui ressemble à un bouton. Sur un écran bas (moins de 700 px), elles laissent la place au texte. */}
      <div aria-hidden="true" className="grid grid-cols-3 mt-[6px] [@media(max-height:700px)]:hidden">
        {ICONES_ACTIONS.map((a) => (
          <div key={a.libelle} className="flex flex-col items-center gap-[3px] pt-[6px] pb-[4px] text-[11px] leading-[1.2] text-center text-muted">
            <svg width="14" height="14" viewBox="0 0 24 24" className="text-terracotta" style={{ display: "block" }}>
              {a.d}
            </svg>
            {t(a.libelle)}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 4 · Planifier : la semaine prête d'avance ──────────────────────────

/*
 * PLANIFIER (20/11/2026, arbitré : un 6ᵉ écran). Le visuel fourni le même jour (généré d'après le brief Capsela) : trois tenues à plat,
 * bureau, quotidien, soirée. Les étiquettes du jour et de l'occasion sont du HTML posé sur la photo (jamais du texte dans l'image), petites
 * et sans fond plein : on lit une semaine, rien qui ressemble à un bouton. Cadre au format de la photo (3:2) : aucune tenue n'est coupée.
 */
const JOURS_PLANIFIES: { jour: string; occasion: string; x: string }[] = [
  { jour: aTraduire("Lun."), occasion: aTraduire("Bureau"), x: "19%" },
  { jour: aTraduire("Mer."), occasion: aTraduire("Quotidien"), x: "50%" },
  { jour: aTraduire("Sam."), occasion: aTraduire("Soirée"), x: "80%" },
];

function VisuelPlanifier() {
  return (
    <div
      role="img"
      aria-label={t("Exemple de semaine planifiée : une tenue de bureau le lundi, une tenue du quotidien le mercredi, une tenue de soirée le samedi")}
      className="relative rounded-carte overflow-hidden bg-border w-full"
      style={{ aspectRatio: "3 / 2", maxHeight: "calc(var(--h-visuel) + 20px)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/onboarding/planifier-semaine.webp" alt="" width={1200} height={800} decoding="async" className="absolute inset-0 w-full h-full object-cover" />
      {JOURS_PLANIFIES.map((j) => (
        <span
          key={j.jour}
          aria-hidden="true"
          className="absolute top-[8px] -translate-x-1/2 flex flex-col items-center rounded-[10px] px-[8px] py-[4px] whitespace-nowrap"
          style={{ left: j.x, background: "rgba(251,248,243,.9)" }}
        >
          <span className="text-[10.5px] font-semibold text-ink leading-[1.15]">{t(j.jour)}</span>
          <span className="text-[9.5px] text-terracotta leading-[1.15]">{t(j.occasion)}</span>
        </span>
      ))}
    </div>
  );
}

// ── 5 · Tes valises : destination → pièces → tenues du séjour ───────────

/** La répartition d'une valise exemple de 24 pièces : le total est la somme des lignes. */
const REPARTITION_VALISE: { libelle: string; n: number; couleur: string }[] = [
  { libelle: aTraduire("robes"), n: 4, couleur: "var(--color-terracotta-deep)" },
  { libelle: aTraduire("hauts"), n: 6, couleur: "var(--color-terracotta)" },
  { libelle: aTraduire("bas"), n: 4, couleur: "var(--color-gold)" },
  { libelle: aTraduire("vestes"), n: 3, couleur: "var(--color-sand-border)" },
  { libelle: aTraduire("chaussures"), n: 3, couleur: "var(--color-warm-border)" },
  { libelle: aTraduire("accessoires"), n: 4, couleur: "var(--color-border)" },
];

function VisuelValise() {
  const total = REPARTITION_VALISE.reduce((s, r) => s + r.n, 0);
  return (
    <Card rayon="carte" className="overflow-hidden" role="img" aria-label={t("Exemple de valise : Rhodes, sept jours, 23 degrés, 24 pièces sélectionnées et les tenues du séjour")}>
      {/* La valise ouverte : de la photo seulement, sur les écrans assez hauts. */}
      <div className="relative h-[82px] [@media(max-height:760px)]:hidden bg-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/onboarding/valise-bagage.webp" alt="" width={324} height={224} decoding="async" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: "center 35%" }} />
      </div>
      <div className="p-[14px] [@media(max-height:700px)]:p-[11px]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="t-label text-terracotta">{t("1 · Destination")}</div>
            <div className="t-titre-section text-ink mt-[4px]">Rhodes</div>
            <div className="text-[11px] text-muted mt-[2px]">{t("7 jours · 23° · exemple")}</div>
          </div>
          <div className="flex gap-[3px] text-[15px] leading-none flex-shrink-0 mt-[4px]" aria-hidden="true">
            <span>☀️</span>
            <span>☀️</span>
            <span>☀️</span>
            <span>🌤️</span>
          </div>
        </div>

        <div className="border-t border-divider mt-[12px] [@media(max-height:700px)]:mt-[8px] pt-[10px] [@media(max-height:700px)]:pt-[7px]">
          <div className="t-label text-terracotta">{t("2 · Pièces")}</div>
          <div className="flex items-baseline gap-[6px] mt-[4px]">
            <span className="t-chiffre text-ink">{total}</span>
            <span className="text-[12px] text-ink">{t("pièces sélectionnées")}</span>
          </div>
          <div className="flex h-[7px] rounded-full overflow-hidden mt-[8px]" aria-hidden="true">
            {REPARTITION_VALISE.map((r) => (
              <span key={r.libelle} style={{ flex: r.n, background: r.couleur }} />
            ))}
          </div>
          <div className="mt-[7px] text-[10.5px] text-muted leading-[1.5] [@media(max-height:760px)]:hidden">
            {REPARTITION_VALISE.map((r) => `${r.n} ${t(r.libelle)}`).join(" · ")}
          </div>
        </div>

        <div className="border-t border-divider mt-[10px] [@media(max-height:700px)]:mt-[7px] pt-[10px] [@media(max-height:700px)]:pt-[7px]">
          <div className="t-label text-terracotta">{t("3 · Tenues du séjour")}</div>
          <div className="flex gap-[8px] mt-[7px]">
            {(
              [
                [t("Jour {n}", { n: 1 }), "/onboarding/valise-look-1.webp"],
                [t("Jour {n}", { n: 2 }), "/onboarding/valise-look-2.webp"],
              ] as const
            ).map(([jour, src]) => (
              <div key={jour} className="w-[78px] [@media(max-height:700px)]:w-[60px] flex-shrink-0">
                <Photo src={src} className="aspect-square" />
                <div className="text-[10px] text-muted mt-[3px]">{jour}</div>
              </div>
            ))}
            <div className="flex-1 min-w-0 text-[11px] text-muted leading-[1.4] self-center">{t("Une tenue pour chaque jour du séjour.")}</div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── 6 · Le compte : une composition éditoriale ──────────────────────────

function VisuelCompte() {
  return (
    <div
      role="img"
      aria-label={t("Un téléphone posé sur un lin terracotta, à côté de lunettes de soleil et de créoles dorées, affiche l'écran de création de compte de Capsela")}
      className="relative rounded-carte overflow-hidden bg-border mx-auto"
      // Au format du visuel (portrait) et à la hauteur réglée : le téléphone reste entier à toutes les hauteurs d'écran.
      style={{ height: "calc(var(--h-visuel) + 10px)", aspectRatio: "1024 / 1100" }}
    >
      {/* LA VRAIE CAPTURE DANS LE TÉLÉPHONE (20/11/2026, demandé : « il faut intégrer la vraie capture de l'application dans le téléphone
          du visuel »). Visuel fourni le même jour ; son écran inventé (« CAPSELA », champs et boutons qui n'existent pas) est remplacé par
          l'écran réel « Crée ton compte » (rendu à 390 px, 3×, sans la mention du mode démo), posé en perspective sur l'écran du téléphone,
          l'encoche gardée. Remplace la photo du 30/10/2026 (compte-telephone.webp, gardée dans public/onboarding/). À refaire si l'écran
          de création de compte change. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/onboarding/compte-capture.webp" alt="" width={1024} height={1100} decoding="async" className="absolute inset-0 w-full h-full object-cover" />
    </div>
  );
}

// ── L'écran ─────────────────────────────────────────────────────────────

/**
 * La hauteur que le texte, l'en-tête et le pied retirent à l'écran, par écran : le titre « Tout ce que tu peux porter. » tient
 * sur trois lignes sur un téléphone étroit, il laisse moins de place à son visuel. Mesuré en rendu à 320, 360, 375 et 390 px.
 */
const RESERVE_VISUEL = [470, 545, 560, 470, 470, 500];

export default function OnboardingScreen() {
  const { state, actions } = useCapsela();
  const indice = Math.min(state.onbStep, ONBOARDING_SLIDES.length - 1);
  const slide = ONBOARDING_SLIDES[indice];
  const dernier = indice === ONBOARDING_SLIDES.length - 1;
  const nbEcrans = ONBOARDING_SLIDES.length;

  const visuels = [<VisuelStyle key="s" />, <VisuelDressing key="d" />, <VisuelTenue key="t" />, <VisuelPlanifier key="p" />, <VisuelValise key="v" />, <VisuelCompte key="c" />];

  /*
   * NAVIGUER COMME DANS UN CARROUSEL (retours du test fermé, 04/11/2026 : « visuels non cliquables », « revenir en arrière pas
   * possible »). Un balayage vers la gauche avance, vers la droite recule ; toucher le visuel avance. Un geste surtout vertical
   * reste un défilement. Les points de progression, en bas, mènent à l'écran touché (comme le carrousel de l'accueil) : c'est
   * aussi le moyen de revenir en arrière (arbitré le 04/11/2026 : pas de bouton Retour en haut).
   */
  const depart = useRef<{ x: number; y: number } | null>(null);
  const auDebutDuGeste = (e: React.TouchEvent) => {
    const t = e.touches[0];
    depart.current = { x: t.clientX, y: t.clientY };
  };
  const aLaFinDuGeste = (e: React.TouchEvent) => {
    const d = depart.current;
    depart.current = null;
    if (!d) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - d.x;
    const dy = t.clientY - d.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0 && !dernier) actions.onbNext();
    else if (dx > 0 && indice > 0) actions.onbBack();
  };

  return (
    <div
      className="absolute inset-0 flex flex-col"
      // La hauteur que se partagent les visuels à hauteur réglable : l'écran moins l'en-tête, le texte et le pied, bornée.
      style={{ ["--h-visuel" as string]: `clamp(140px, calc(100svh - ${RESERVE_VISUEL[indice]}px), 300px)` }}
    >
      {/* Zone de contenu défilante au-dessus d'un pied fixe (recette 26/08/2026) : le bouton n'est jamais poussé vers le bas ni
          recouvert, quelle que soit la hauteur du contenu. */}
      <div className="scrollarea flex-1 overflow-y-auto">
        <div className="min-h-full flex flex-col px-7 pt-2 pb-5">
          <AppHeader showAvatar={false} />
          <div className="flex justify-between items-center flex-shrink-0">
            <div className="w-[34px] h-[34px]" />
            {!dernier && (
              <button onClick={actions.onbPasser} className="text-[13px] text-muted cursor-pointer py-2 pl-4">
                {t("Passer")}
              </button>
            )}
          </div>

          {/* Une clé par écran : sans elle, l'animation, de même nom, ne se rejouerait pas d'un écran à l'autre. */}
          <div key={indice} className="flex-1 flex flex-col justify-center" onTouchStart={auDebutDuGeste} onTouchEnd={aLaFinDuGeste}>
            {/* Toucher le visuel avance, comme « Continuer » ; sur le dernier écran, il ne fait rien (deux choix : créer ou se connecter). */}
            <div
              className={"motion-safe:animate-[capsule-apparition_320ms_ease-out_80ms_both]" + (dernier ? "" : " cursor-pointer")}
              onClick={dernier ? undefined : actions.onbNext}
            >
              {visuels[indice]}
            </div>
            <div className="mt-[clamp(14px,3.2svh,28px)] motion-safe:animate-[capsule-apparition_320ms_ease-out_both]">
              <div className="t-surtitre text-terracotta">{t(slide.kicker)}</div>
              <h1
                className="t-display text-ink mt-[10px]"
                // 34 px sur un écran courant, un peu moins sur un petit : « Tout ce que tu peux porter. » tient en deux lignes.
                style={{ fontSize: "clamp(26px, 8.4vw, 34px)", textWrap: "balance" }}
              >
                {slide.title.map((ligne, i) => (
                  <span key={ligne} className={"block " + (i === slide.title.length - 1 ? "italic text-terracotta" : "")}>
                    {t(ligne)}
                  </span>
                ))}
              </h1>
              <p className="text-[14px] [@media(max-height:700px)]:text-[13px] text-muted mt-3 [@media(max-height:700px)]:mt-2 leading-[1.5]" style={{ textWrap: "pretty" }}>
                {t(slide.body)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pied fixe : même hauteur et mêmes marges (px-7) sur tous les écrans, safe-area incluse ; filet comme TabBar. */}
      <div className="flex-shrink-0 px-7 bg-cream border-t border-border" style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}>
        {/* Les cinq positions de la progression, sur tous les écrans : le dernier est le compte. */}
        {(() => {
          const points = (
            // Cliquables (04/11/2026, comme le carrousel de l'accueil) : chaque point ouvre son écran. La zone touchable déborde du
            // point (pseudo-élément, 22 px de haut) : on le touche sans viser, et l'écart visuel entre les points ne change pas.
            <div className="flex items-center gap-[7px]" role="group" aria-label={t("Écran {i} sur {n}", { i: indice + 1, n: nbEcrans })}>
              {Array.from({ length: nbEcrans }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => actions.onbAller(i)}
                  aria-label={t("Écran {i} sur {n}", { i: i + 1, n: nbEcrans })}
                  aria-current={i === indice}
                  className="relative flex items-center cursor-pointer before:absolute before:content-[''] before:-inset-x-[4px] before:-inset-y-[8px]"
                >
                  <span
                    className="rounded-full inline-block transition-[width,background-color] duration-300"
                    style={i === indice ? { width: 22, height: 7, background: "var(--color-terracotta)" } : { width: 7, height: 7, background: "var(--color-warm-border)" }}
                  />
                </button>
              ))}
            </div>
          );
          return dernier ? (
            <div className="flex flex-col gap-[10px] pt-4">
              <div className="flex justify-center pb-[2px]">{points}</div>
              <Button variante="sombre" onClick={actions.onbNext}>
                {t("Créer mon compte")}
              </Button>
              <Button variante="contour" onClick={actions.goLogin}>
                {t("J'ai déjà un compte")}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between pt-4">
              {points}
              <Button variante="sombre" pleine={false} className="px-[26px]" onClick={actions.onbNext}>
                {t("Continuer")}
              </Button>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
