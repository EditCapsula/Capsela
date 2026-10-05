"use client";

import { useState } from "react";
import { ONBOARDING_SLIDES } from "@/lib/data";
import AppHeader from "@/components/AppHeader";
import { useCapsela } from "@/lib/store";
import { STYLE_CONFIG, type StyleId } from "@/lib/profile";
import Button from "@/components/Button";
import Card from "@/components/Card";

/*
 * L'ONBOARDING AVANT LE COMPTE (refonte du 05/10/2026, brief « Onboarding premium de L'édit Capsela »).
 *
 * Cinq écrans, une histoire : Capsela comprend ton style → ton dressing → t'aide à t'habiller → t'accompagne quand tu
 * pars → et le compte. Les quatre premiers ont la même forme (logo, « Passer », visuel, sur-titre, titre, phrase, points de
 * progression, « Continuer ») ; le cinquième n'explique plus rien et ne garde que le compte.
 *
 * LES VISUELS : le premier garde les visuels de style du projet ; les suivants sont recadrés depuis les visuels éditoriaux
 * fournis par la propriétaire le 05/10/2026 (public/onboarding/, tirés de « Capsela_Onboarding_Editorial_Assets » : penderie,
 * tenue à plat, valise ouverte, téléphone posé sur un lin). Seule la PHOTO en est gardée : les textes, les puces, les cartes
 * sont du HTML aux jetons de l'app (les images fournies portaient les leurs, coupés à droite sur la valise, non traduisibles,
 * hors du design system). Limite : ces sources font 368 px de large — nettes à 1×, un peu douces sur un écran très dense.
 * Les chiffres montrés (36 pièces, 22°, Rhodes, 24 pièces) sont des EXEMPLES, dits
 * comme tels dans l'écran. Le genre n'est pas connu à ce stade (il se demande après le compte) : les visuels sont ceux du
 * profil femme, comme avant — purement illustratifs.
 *
 * LA HAUTEUR : la zone de contenu défile au-dessus d'un pied fixe (le bouton n'est jamais poussé ni recouvert), mais les
 * visuels se règlent sur la hauteur d'écran (`--h-visuel`) pour que, sur un téléphone courant, rien ne défile. Sur un très
 * petit écran, le visuel rétrécit d'abord, le titre garde sa taille tant que possible, le bouton reste visible.
 *
 * Mouvement : un fondu et 6 px de montée (capsule-apparition, déjà dans l'app), le visuel un peu après le texte ; arrêtés
 * si le téléphone demande moins d'animations. Pas de balayage : l'onboarding d'avant n'en avait pas.
 */

const STYLES_ONBOARDING: StyleId[] = ["minimaliste", "casual_chic", "boheme", "classique_chic", "streetwear", "glamour"];

/** Le visuel d'un style : le même que l'étape Style du profil, jamais un second jeu d'images. Repli sur l'aplat si le fichier ne charge pas. */
function TuileStyle({ id, decale }: { id: StyleId; decale?: boolean }) {
  const cfg = STYLE_CONFIG.femme[id];
  const [echec, setEchec] = useState(false);
  return (
    <div className={"relative rounded-bloc overflow-hidden bg-border aspect-[4/5] " + (decale ? "translate-y-[12px]" : "")}>
      {cfg.asset && !echec && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cfg.asset} alt="" onError={() => setEchec(true)} className="absolute inset-0 w-full h-full object-cover" />
      )}
      <div className="absolute bottom-0 left-0 right-0 px-[8px] pt-[14px] pb-[7px] bg-gradient-to-t from-black/45 to-transparent">
        <div className="text-[10.5px] text-white font-medium leading-[1.2]">{cfg.label}</div>
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
    <div role="img" aria-label="Six univers de style : Minimaliste, Casual chic, Bohème, Classique chic, Streetwear et Glamour" className="grid grid-cols-3 gap-[8px] pb-[12px]">
      {STYLES_ONBOARDING.map((id, i) => (
        <TuileStyle key={id} id={id} decale={i % 3 === 1} />
      ))}
    </div>
  );
}

// ── 2 · Ton dressing : une capsule exemple ──────────────────────────────

const REPERES_CAPSULE: { glyphe: string; libelle: string; texte: string }[] = [
  { glyphe: "✓", libelle: "Cohérent", texte: "Tout s’accorde facilement" },
  { glyphe: "✦", libelle: "Polyvalent", texte: "Des pièces faciles à porter" },
  { glyphe: "↻", libelle: "Évolutif", texte: "Garde, remplace et personnalise" },
];

function VisuelDressing() {
  return (
    <div role="img" aria-label="Exemple de capsule : une penderie de pièces qui vont ensemble">
      <div className="relative rounded-carte overflow-hidden bg-border" style={{ height: "var(--h-visuel)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/onboarding/dressing-penderie.webp" alt="" width={368} height={410} decoding="async" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: "center 40%" }} />
        <div className="absolute bottom-[10px] left-1/2 -translate-x-1/2 flex items-center gap-[6px] bg-card border border-border rounded-full py-[7px] px-[13px] whitespace-nowrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-hanger-only.png" alt="" style={{ width: 13, height: "auto" }} />
          <span className="text-[11px] text-ink font-medium">36 pièces · exemple</span>
        </div>
      </div>
      <div className="flex justify-between mt-[12px]">
        {REPERES_CAPSULE.map((r) => (
          <div key={r.libelle} className="flex flex-col items-center text-center w-1/3 px-[4px]">
            <div className="w-7 h-7 rounded-full bg-card border border-border flex items-center justify-center text-terracotta text-[13px] flex-shrink-0">{r.glyphe}</div>
            <div className="text-[11px] text-ink font-medium mt-[6px] leading-[1.2]">{r.libelle}</div>
            <div className="text-[10px] text-muted mt-[2px] leading-[1.3]">{r.texte}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 3 · Tes tenues : la « Tenue du jour » ───────────────────────────────

const PIECES_EXEMPLE = ["Blazer", "Top rayé", "Jean", "Baskets", "Sac"];

function VisuelTenue() {
  return (
    <div role="img" aria-label="Exemple de tenue du jour : 22 degrés à Paris, occasion travail, une tenue complète de cinq pièces" className="bg-terracotta rounded-hero p-[12px]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-[6px] t-label" style={{ color: "rgba(243,238,229,.86)" }}>
          <span aria-hidden="true" className="font-serif italic text-[13px] leading-none">
            ✦
          </span>
          Ton look du jour
        </div>
        <span className="text-[10px]" style={{ color: "rgba(243,238,229,.7)" }}>
          exemple
        </span>
      </div>
      <div className="grid grid-cols-[1fr_1.05fr] gap-[12px] mt-[10px]" style={{ minHeight: "var(--h-visuel)" }}>
        <Photo src="/onboarding/tenue-exemple.webp" className="h-full min-h-[150px]" />
        <div className="flex flex-col min-w-0">
          <div className="flex flex-col items-start gap-[6px]">
            <span className="inline-flex rounded-full text-[11px] px-[10px] py-[6px] whitespace-nowrap" style={{ background: "rgba(243,238,229,.22)", color: "var(--color-on-terracotta)" }}>
              ☀️ 22° · Paris
            </span>
            <span className="inline-flex rounded-full text-[11px] px-[10px] py-[6px] whitespace-nowrap" style={{ background: "rgba(243,238,229,.22)", color: "var(--color-on-terracotta)" }}>
              Travail / Bureau
            </span>
          </div>
          <div className="mt-[10px] text-[10px] uppercase tracking-[.08em] [@media(max-height:700px)]:hidden" style={{ color: "rgba(243,238,229,.7)" }}>
            Pièces de la tenue
          </div>
          <ul className="mt-[4px] flex flex-col gap-[2px] text-[12px] list-none p-0" style={{ color: "var(--color-on-terracotta)" }}>
            {PIECES_EXEMPLE.map((p) => (
              <li key={p} className="leading-[1.3]">
                {p}
              </li>
            ))}
          </ul>
          <div className="flex-1 min-h-[8px]" />
          <div className="bg-cream text-ink text-center rounded-full py-[8px] text-[11px] tracking-[.06em] uppercase" aria-hidden="true">
            Voir le détail →
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 4 · Tes valises : destination → pièces → tenues du séjour ───────────

/** La répartition d'une valise exemple de 24 pièces : le total est la somme des lignes. */
const REPARTITION_VALISE: { libelle: string; n: number; couleur: string }[] = [
  { libelle: "robes", n: 4, couleur: "var(--color-terracotta-deep)" },
  { libelle: "hauts", n: 6, couleur: "var(--color-terracotta)" },
  { libelle: "bas", n: 4, couleur: "var(--color-gold)" },
  { libelle: "vestes", n: 3, couleur: "var(--color-sand-border)" },
  { libelle: "chaussures", n: 3, couleur: "var(--color-warm-border)" },
  { libelle: "accessoires", n: 4, couleur: "var(--color-border)" },
];

function VisuelValise() {
  const total = REPARTITION_VALISE.reduce((s, r) => s + r.n, 0);
  return (
    <Card rayon="carte" className="overflow-hidden" role="img" aria-label="Exemple de valise : Rhodes, sept jours, 23 degrés, 24 pièces sélectionnées et les tenues du séjour">
      {/* La valise ouverte : de la photo seulement, sur les écrans assez hauts. */}
      <div className="relative h-[82px] [@media(max-height:760px)]:hidden bg-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/onboarding/valise-bagage.webp" alt="" width={324} height={224} decoding="async" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: "center 35%" }} />
      </div>
      <div className="p-[14px] [@media(max-height:700px)]:p-[11px]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="t-label text-terracotta">1 · Destination</div>
            <div className="font-serif text-[22px] text-ink leading-[1.1] mt-[4px]">Rhodes</div>
            <div className="text-[11px] text-muted mt-[2px]">7 jours · 23° · exemple</div>
          </div>
          <div className="flex gap-[3px] text-[15px] leading-none flex-shrink-0 mt-[4px]" aria-hidden="true">
            <span>☀️</span>
            <span>☀️</span>
            <span>☀️</span>
            <span>🌤️</span>
          </div>
        </div>

        <div className="border-t border-divider mt-[12px] [@media(max-height:700px)]:mt-[8px] pt-[10px] [@media(max-height:700px)]:pt-[7px]">
          <div className="t-label text-terracotta">2 · Pièces</div>
          <div className="flex items-baseline gap-[6px] mt-[4px]">
            <span className="t-chiffre text-ink">{total}</span>
            <span className="text-[12px] text-ink">pièces sélectionnées</span>
          </div>
          <div className="flex h-[7px] rounded-full overflow-hidden mt-[8px]" aria-hidden="true">
            {REPARTITION_VALISE.map((r) => (
              <span key={r.libelle} style={{ flex: r.n, background: r.couleur }} />
            ))}
          </div>
          <div className="mt-[7px] text-[10.5px] text-muted leading-[1.5] [@media(max-height:760px)]:hidden">
            {REPARTITION_VALISE.map((r) => `${r.n} ${r.libelle}`).join(" · ")}
          </div>
        </div>

        <div className="border-t border-divider mt-[10px] [@media(max-height:700px)]:mt-[7px] pt-[10px] [@media(max-height:700px)]:pt-[7px]">
          <div className="t-label text-terracotta">3 · Tenues du séjour</div>
          <div className="flex gap-[8px] mt-[7px]">
            {(
              [
                ["Jour 1", "/onboarding/valise-look-1.webp"],
                ["Jour 2", "/onboarding/valise-look-2.webp"],
              ] as const
            ).map(([jour, src]) => (
              <div key={jour} className="w-[78px] [@media(max-height:700px)]:w-[60px] flex-shrink-0">
                <Photo src={src} className="aspect-square" />
                <div className="text-[10px] text-muted mt-[3px]">{jour}</div>
              </div>
            ))}
            <div className="flex-1 min-w-0 text-[11px] text-muted leading-[1.4] self-center">Une tenue pour chaque jour du séjour.</div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── 5 · Le compte : une composition éditoriale ──────────────────────────

function VisuelCompte() {
  return (
    <div role="img" aria-label="Un téléphone affichant L'édit Capsela, posé parmi un sac, des lunettes et un magazine" className="relative rounded-carte overflow-hidden bg-border" style={{ height: "calc(var(--h-visuel) + 10px)" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/onboarding/compte-telephone.webp" alt="" width={310} height={680} decoding="async" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: "center 58%" }} />
    </div>
  );
}

// ── L'écran ─────────────────────────────────────────────────────────────

/**
 * La hauteur que le texte, l'en-tête et le pied retirent à l'écran, par écran : le titre « Tout ce que tu peux porter. » tient
 * sur trois lignes sur un téléphone étroit, il laisse moins de place à son visuel. Mesuré en rendu à 320, 360, 375 et 390 px.
 */
const RESERVE_VISUEL = [470, 545, 495, 470, 500];

export default function OnboardingScreen() {
  const { state, actions } = useCapsela();
  const indice = Math.min(state.onbStep, ONBOARDING_SLIDES.length - 1);
  const slide = ONBOARDING_SLIDES[indice];
  const dernier = indice === ONBOARDING_SLIDES.length - 1;
  const nbExplications = ONBOARDING_SLIDES.length - 1;

  const visuels = [<VisuelStyle key="s" />, <VisuelDressing key="d" />, <VisuelTenue key="t" />, <VisuelValise key="v" />, <VisuelCompte key="c" />];

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
                Passer
              </button>
            )}
          </div>

          {/* Une clé par écran : sans elle, l'animation, de même nom, ne se rejouerait pas d'un écran à l'autre. */}
          <div key={indice} className="flex-1 flex flex-col justify-center">
            <div className="motion-safe:animate-[capsule-apparition_320ms_ease-out_80ms_both]">{visuels[indice]}</div>
            <div className="mt-[clamp(14px,3.2svh,28px)] motion-safe:animate-[capsule-apparition_320ms_ease-out_both]">
              <div className="t-surtitre text-terracotta">{slide.kicker}</div>
              <h1
                className="t-display text-ink mt-[10px]"
                // 34 px sur un écran courant, un peu moins sur un petit : « Tout ce que tu peux porter. » tient en deux lignes.
                style={{ fontSize: "clamp(26px, 8.4vw, 34px)", textWrap: "balance" }}
              >
                {slide.title.map((ligne, i) => (
                  <span key={ligne} className={"block " + (i === slide.title.length - 1 ? "italic text-terracotta" : "")}>
                    {ligne}
                  </span>
                ))}
              </h1>
              <p className="text-[14px] [@media(max-height:700px)]:text-[13px] text-muted mt-3 [@media(max-height:700px)]:mt-2 leading-[1.5]" style={{ textWrap: "pretty" }}>
                {slide.body}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pied fixe : même hauteur et mêmes marges (px-7) sur tous les écrans, safe-area incluse ; filet comme TabBar. */}
      <div className="flex-shrink-0 px-7 bg-cream border-t border-border" style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}>
        {dernier ? (
          <div className="flex flex-col gap-[10px] pt-4">
            <Button variante="principal" onClick={actions.onbNext}>
              Créer mon compte
            </Button>
            <Button variante="contour" onClick={actions.goLogin}>
              J’ai déjà un compte
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between pt-4">
            <div className="flex gap-[7px] items-center" role="img" aria-label={`Étape ${indice + 1} sur ${nbExplications}`}>
              {Array.from({ length: nbExplications }, (_, i) => (
                <span
                  key={i}
                  className="rounded-full inline-block transition-[width,background-color] duration-300"
                  style={i === indice ? { width: 22, height: 7, background: "var(--color-terracotta)" } : { width: 7, height: 7, background: "var(--color-warm-border)" }}
                />
              ))}
            </div>
            <Button variante="sombre" pleine={false} className="px-[26px]" onClick={actions.onbNext}>
              Continuer
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
