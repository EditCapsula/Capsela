"use client";

import { useEffect, useMemo, useState } from "react";
import AppHeader from "@/components/AppHeader";
import BottomSheet from "@/components/BottomSheet";
import { CATLABEL, CATS } from "@/lib/data";
import {
  CAPSULE_SEASONS,
  computeDefaultCapsule,
  currentSeasonKey,
  morphologieOrienteLaSelection,
  type CapsuleSeason,
} from "@/lib/capsule";
import {
  alternativesDeRemplacement,
  introCapsule,
  margeVignette,
  piecesCles,
  piecesDuDressingPourSaison,
  raisonsSuggestion,
  type AlternativeRemplacement,
} from "@/lib/capsuleEcran";
import { useAuth } from "@/lib/auth";
import { silhouetteForme, styleLabel } from "@/lib/profile";
import { useCapsela } from "@/lib/store";
import { resolveItemImage } from "@/lib/catalogImages";
import { analyserImage, placementDansCadre, type Analyse } from "@/lib/cadrageImage";
import type { CategoryKey, DateContext, Item, OccasionKey, WorkMode } from "@/lib/types";

/*
 * ÉCRAN CAPSULE — refonte éditoriale du 25/09/2026.
 *
 * Ce qui n'a pas bougé : la capsule elle-même. Elle vient toujours de
 * `computeDefaultCapsule`, avec les mêmes arguments qu'avant (profil ou style
 * exploré, météo, exclusions, saison affichée, vestiaire) ; le sélecteur de
 * saison, le bandeau d'exploration et les liens vers le profil sont intacts.
 *
 * Ce qui a changé, c'est la façon de la montrer : une sélection préparée, pas
 * un inventaire. Les dérivés d'affichage (pièces clés, introduction, raisons
 * d'une suggestion, alternatives) sont dans `capsuleEcran.ts`, purs et
 * testés : aucun ne choisit une pièce, aucun n'écrit une raison que le moteur
 * n'a pas lue.
 *
 * LES DEUX ÉTATS D'UNE PIÈCE. Jusqu'ici l'écran n'affichait que des
 * suggestions, toutes marquées « Suggestion » : il ne pouvait pas montrer
 * ce que l'utilisatrice possède. Ses pièces de la saison y entrent désormais,
 * en tête de leur catégorie, marquées « Dans ton dressing » (règle de saison :
 * cf. piecesDuDressingPourSaison). Elles ne prennent la place d'aucune
 * suggestion — le moteur n'est pas modifié — et ne s'affichent pas pendant
 * l'exploration d'un autre style, qui est un aperçu de ce style seul (la
 * tenue explorée n'utilise pas non plus le dressing, cf. viewExploredOutfit).
 */

/**
 * Reprend le libellé naturel de l'occasion (bandeau d'exploration ci-dessous)
 * — même wording que occasionPhrase (logic.ts, non exportée), dupliqué ici
 * volontairement plutôt que d'exporter/toucher logic.ts, hors périmètre de
 * cette correction (recette 24/08/2026, parcours d'exploration).
 */
function occasionPhraseFor(occasion: OccasionKey, workMode: WorkMode, dateContext: DateContext): string {
  switch (occasion) {
    case "quotidien":
      return "ta journée";
    case "travail_formel":
      return workMode === "Télétravail" ? "ta journée en télétravail" : "ta journée au bureau";
    case "entretien":
      return "ton rendez-vous important";
    case "date":
      return dateContext === "Restaurant / date romantique"
        ? "ton dîner"
        : dateContext === "Soirée festive"
          ? "ta soirée"
          : "ton rendez-vous";
    case "soiree":
      return "ta sortie";
    case "festive":
      return "ta sortie festive";
    case "sport":
      return "ta séance de sport";
    case "cocooning":
      return "ta journée cocooning";
    case "voyage":
      return "ton déplacement";
    case "evenement_perso":
      return "ta cérémonie";
    default:
      return "aujourd'hui";
  }
}


/**
 * Visuel de chaque saison (fournis le 25/09/2026 : natures mortes sans
 * personne, 1536 × 1024). Convertis en WebP 1200 × 800, qualité 82 — la
 * largeur couvre le plus grand affichage (432 px de contenu) en écran haute
 * densité ; 617 Ko les quatre au lieu de 10,2 Mo en PNG, PSNR ≥ 34,8 dB
 * (Été, le plus détaillé). Une seule image chargée à la fois : celle de la
 * saison affichée.
 */
const VISUEL_SAISON: Record<CapsuleSeason, string> = {
  Printemps: "/images/saisons/printemps.webp",
  Été: "/images/saisons/ete.webp",
  Automne: "/images/saisons/automne.webp",
  Hiver: "/images/saisons/hiver.webp",
};

/**
 * Catégories ouvertes à l'arrivée (polish V2, 26/09/2026) : les deux
 * premières — les hauts et la maille, dans l'ordre de CATS. Les suivantes
 * sont repliées en une ligne (nom, nombre de pièces) : toutes restent
 * accessibles, mais la page ne s'ouvre plus sur un catalogue.
 */
const OUVERTES_PAR_DEFAUT = 2;

/** Chevron d'une catégorie : › repliée, ˄ ouverte. Il pivote, rien d'autre ne bouge. */
function Chevron({ ouvert }: { ouvert: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: ouvert ? "rotate(180deg)" : "rotate(-90deg)", transition: "transform .2s ease" }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/** « 1 pièce » / « 12 pièces ». */
function pieces(n: number): string {
  return `${n} ${n > 1 ? "pièces" : "pièce"}`;
}

/**
 * Mesures déjà faites, par URL, pour toute la session : une image n'est
 * analysée qu'une fois, quel que soit le nombre de vignettes qui la montrent.
 * null = mesure impossible, on garde l'affichage contenu.
 */
const cadrages = new Map<string, (Analyse & { ratio: number }) | null>();

/**
 * Seules les images servies par Supabase Storage sont mesurées : il envoie
 * `Access-Control-Allow-Origin: *` (vérifié le 25/09/2026), condition pour lire
 * les pixels. Une image d'un autre domaine (affiliée) chargée en CORS sans
 * cet en-tête ne s'afficherait plus du tout : elle reste en affichage contenu.
 */
function mesurable(url: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return Boolean(base) && url.startsWith(`${base}/storage/v1/object/public/`);
}

/** Ratio largeur / hauteur de toutes les vignettes de l'écran. */
const RATIO_VIGNETTE = 4 / 5;

/**
 * Vignette d'une pièce, à présence normalisée (polish du 25/09/2026, cf.
 * cadrageImage.ts) : zone image identique partout, et la pièce — pas l'image —
 * remplit la même part de cette zone, sans déformation ni recadrage.
 *
 * Tant que la mesure n'est pas faite, l'image reste invisible (une fraction de
 * seconde, le temps du chargement) : sinon elle apparaîtrait petite puis
 * sauterait à sa taille normalisée. Mesure impossible : affichage contenu,
 * comme avant.
 */
function Vignette({ item, arrondi = 14, marge = margeVignette(item.cat) }: { item: Item; arrondi?: number; marge?: number }) {
  const image = resolveItemImage(item);
  return (
    <div
      className="w-full border border-border relative overflow-hidden"
      style={{
        aspectRatio: "4/5",
        borderRadius: arrondi,
        background: image.url ? "#F3EDE1" : item.hex,
        boxShadow: image.url ? undefined : "inset 0 0 0 1px rgba(29,26,22,.06)",
      }}
    >
      {image.url ? (
        <ImageCadree key={image.url} url={image.url} marge={marge} />
      ) : (
        item.imageStatus === "generating" && (
          <span className="absolute inset-0 animate-pulse" style={{ background: "rgba(243,238,229,.35)" }} />
        )
      )}
    </div>
  );
}

function ImageCadree({ url, marge }: { url: string; marge: number }) {
  const analysable = mesurable(url);
  const [cadrage, setCadrage] = useState(() => (cadrages.has(url) ? cadrages.get(url) : undefined));
  const enAttente = analysable && cadrage === undefined;
  const place = cadrage ? placementDansCadre(cadrage.boite, cadrage.ratio, RATIO_VIGNETTE, marge) : null;
  const pad = `${marge * 100}%`;
  return (
    <>
      {/* Fond opaque mesuré : le cadre le prolonge, pour qu'aucun rectangle
          plus clair ou plus gris ne se découpe autour de la pièce. */}
      {cadrage?.fond && <span className="absolute inset-0" style={{ background: cadrage.fond }} />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        loading="lazy"
        decoding="async"
        crossOrigin={analysable ? "anonymous" : undefined}
        onLoad={(e) => {
          if (!analysable) return;
          // Une autre vignette de la même image a pu mesurer entre-temps :
          // reprendre sa mesure, sans quoi celle-ci resterait invisible.
          const deja = cadrages.get(url);
          const mesure = deja !== undefined ? deja : analyserImage(e.currentTarget);
          cadrages.set(url, mesure);
          setCadrage(mesure);
        }}
        onError={() => {
          cadrages.set(url, null);
          setCadrage(null);
        }}
        className="transition-opacity duration-200"
        style={
          place
            ? { position: "absolute", width: `${place.largeur}%`, height: `${place.hauteur}%`, left: `${place.gauche}%`, top: `${place.haut}%`, maxWidth: "none", opacity: 1 }
            : {
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                objectPosition: "center",
                padding: pad,
                boxSizing: "border-box",
                opacity: enAttente ? 0 : 1,
              }
        }
      />
    </>
  );
}

/**
 * Statut d'une pièce, identique partout sur l'écran : une ligne de texte sous
 * le nom, pas un badge posé sur l'image. Le glyphe porte la différence autant
 * que la couleur — ✓ pour ce qui est à toi, ✦ terracotta pour ce que Capsela
 * propose — pour rester lisible sans distinguer les couleurs.
 */
function Statut({ possedee }: { possedee: boolean }) {
  // Une seule ligne, de hauteur fixe : « Dans ton dressing » passait sur deux
  // lignes dans une carte de 97 px (360 px d'écran) et rendait les cartes
  // inégales (mesuré : 195 contre 189 px).
  return (
    <span
      className={
        "flex items-center gap-[3px] h-[14px] text-[10px] leading-[14px] whitespace-nowrap overflow-hidden " +
        (possedee ? "text-muted" : "text-terracotta")
      }
    >
      <span aria-hidden="true" className="flex-shrink-0">{possedee ? "✓" : "✦"}</span>
      <span className="truncate">{possedee ? "Dans ton dressing" : "Suggestion"}</span>
    </span>
  );
}

/**
 * Nom d'une pièce : deux lignes au plus, et TOUJOURS la hauteur de deux
 * lignes (min-h = 2 × interligne) — un nom court ne fait pas remonter le
 * statut, un nom long ne déséquilibre pas la rangée.
 */
function NomPiece({ nom }: { nom: string }) {
  return <div className="text-[12px] text-ink leading-[16px] min-h-[32px] line-clamp-2 mt-[8px]">{nom}</div>;
}

function CartePiece({ item, possedee, onClick, className = "" }: { item: Item; possedee: boolean; onClick: () => void; className?: string }) {
  return (
    <button onClick={onClick} className={"min-w-0 text-left cursor-pointer " + className} aria-label={`${item.name}, ${possedee ? "dans ton dressing" : "suggestion"}`}>
      <Vignette item={item} />
      <NomPiece nom={item.name} />
      <div className="mt-[3px]">
        <Statut possedee={possedee} />
      </div>
    </button>
  );
}

type Fiche = { id: number; vue: "detail" | "remplacer" };

export default function CapsuleScreen() {
  const { state, weather, actions, vestiairePool } = useCapsela();
  const { profile } = useAuth();

  const capsuleSeason: CapsuleSeason = state.capsuleSeason || currentSeasonKey();

  // Exploration ponctuelle d'un autre style ("Explorer d'autres styles" depuis
  // l'état vide Tenues, recette 24/08/2026) — state.exploredStyleId ne
  // remplace jamais profile.styles : seule cette variable locale, dérivée à
  // la volée, voit le style temporaire ; aucune écriture profil ici.
  const exploredStyleId = state.exploredStyleId;
  const capsuleProfile = useMemo(
    () => (exploredStyleId ? { ...profile, styles: [exploredStyleId] } : profile),
    [profile, exploredStyleId]
  );
  const capsule = useMemo(
    () => computeDefaultCapsule(capsuleProfile, weather, state.suggestedExcluded, capsuleSeason, vestiairePool),
    [capsuleProfile, weather, state.suggestedExcluded, capsuleSeason, vestiairePool]
  );

  // Affichage seul ici (pas de déclenchement) : la capsule liste 15-30
  // pièces d'un coup, donc y déclencher la génération pour toutes en même
  // temps équivaudrait à une génération en masse, explicitement exclue tant
  // que le système n'est pas validé. Le déclenchement à la demande, pièce
  // par pièce, se fait à l'ouverture d'une fiche (celle de cet écran, comme
  // PieceScreen et ItemOutfitsScreen).

  // Style renseigné en profil (recette 25/08/2026) — premier style choisi,
  // même convention que ProfileScreen (styleLabel(profile.styles[0], ...)) ;
  // "" si aucun style n'a été renseigné, jamais un style inventé.
  const userStyleLabel = styleLabel(profile.styles[0], profile.gender);
  // Style exploré (recette 24/08/2026) — n'affecte que ce libellé d'affichage,
  // jamais profile.styles ; la capsule ci-dessus est déjà calculée sur ce
  // même style temporaire.
  const exploredStyleLabel = exploredStyleId ? styleLabel(exploredStyleId, profile.gender) : null;

  /**
   * Ce à quoi cette sélection doit vraiment quelque chose, et rien d'autre.
   *
   * La morphologie n'apparaît que si elle ORIENTE la sélection
   * (`morphologieOrienteLaSelection` : poire et triangle inversé). Pour
   * rectangle, sablier et pomme, `valeurDirection` rend 0 et la capsule est
   * identique avec ou sans morphologie déclarée — l'annoncer serait promettre
   * une personnalisation qui n'a pas lieu.
   *
   * Chaque valeur est un bouton vers l'étape de profil correspondante, qui
   * revient ici (`goProfileSetup(..., true)` mémorise l'écran d'appel).
   *
   * Sans aucun critère renseigné, la ligne « Pensées pour » ne s'affiche pas
   * (25/09/2026) : l'ancien repli « pensée pour ton style et ta palette »
   * l'affirmait justement quand ni l'un ni l'autre n'était connu.
   */
  const criteres = useMemo(() => {
    const aUnePalette =
      profile.paletteCouleurs.length > 0 || !!profile.paletteAffinite || !!profile.paletteIntensite;
    // « en A » / « en V » plutôt que la proposition entière de
    // MORPHOLOGY_LABELS : « ta morphologie Hanches plus marquées que les
    // épaules » se lit mal au fil d'une phrase.
    const forme = morphologieOrienteLaSelection(profile.morphology)
      ? silhouetteForme(profile.morphology)
      : "";
    return [
      userStyleLabel && { cle: "style", avant: "ton style ", valeur: userStyleLabel, etape: "style" },
      aUnePalette && { cle: "palette", avant: "ta ", valeur: "palette", etape: "pal_couleurs" },
      forme && { cle: "morpho", avant: "ta silhouette ", valeur: forme, etape: "morpho" },
    ].filter((c): c is { cle: string; avant: string; valeur: string; etape: string } => Boolean(c));
  }, [userStyleLabel, profile.paletteCouleurs, profile.paletteAffinite, profile.paletteIntensite, profile.morphology]);

  const possedees = useMemo(
    () => (exploredStyleId ? [] : piecesDuDressingPourSaison(state.items, capsuleSeason)),
    [exploredStyleId, state.items, capsuleSeason]
  );
  const cles = useMemo(() => piecesCles(capsule), [capsule]);
  const intro = useMemo(() => introCapsule(capsule), [capsule]);

  const groups = CATS.map(([key, , plural]) => {
    const siennes = possedees.filter((i) => i.cat === key);
    const suggestions = capsule.filter((i) => i.cat === key);
    return { key, label: plural, siennes, suggestions, total: siennes.length + suggestions.length };
  }).filter((g) => g.total > 0);

  // Catégories ouvertes ou repliées À LA MAIN, par rapport à leur état
  // d'arrivée (OUVERTES_PAR_DEFAUT) : un clic bascule. Sur place, aucune
  // navigation nouvelle ; l'état survit au changement de saison.
  const [bascules, setBascules] = useState<CategoryKey[]>([]);

  const [fiche, setFiche] = useState<Fiche | null>(null);
  // Relue à chaque rendu plutôt que figée à l'ouverture : la génération de son
  // visuel met à jour vestiairePool pendant que la fiche est ouverte.
  const pieceFiche = fiche ? vestiairePool.find((i) => i.id === fiche.id) ?? capsule.find((i) => i.id === fiche.id) ?? null : null;

  useEffect(() => {
    if (!pieceFiche) return;
    if (
      resolveItemImage(pieceFiche).kind === "placeholder" &&
      pieceFiche.imageStatus !== "generating" &&
      pieceFiche.imageStatus !== "error" &&
      pieceFiche.imageStatus !== "invalid"
    ) {
      actions.requestCatalogImage(pieceFiche.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pieceFiche?.id]);

  // Calculées seulement quand la vue « Remplacer » est ouverte : jusqu'à
  // trois appels du moteur, à la demande, jamais au rendu de l'écran.
  const alternatives = useMemo<AlternativeRemplacement[]>(() => {
    if (!fiche || fiche.vue !== "remplacer" || !pieceFiche) return [];
    return alternativesDeRemplacement(pieceFiche, capsule, state.suggestedExcluded, (exclus) =>
      computeDefaultCapsule(capsuleProfile, weather, exclus, capsuleSeason, vestiairePool)
    );
  }, [fiche, pieceFiche, capsule, state.suggestedExcluded, capsuleProfile, weather, capsuleSeason, vestiairePool]);

  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const ouvrir = (item: Item, possedee: boolean) => {
    if (possedee) actions.openItem(item.id, false);
    else setFiche({ id: item.id, vue: "detail" });
  };

  const choisirAlternative = (a: AlternativeRemplacement) => {
    a.exclusions.filter((id) => !state.suggestedExcluded.includes(id)).forEach((id) => actions.dismissSuggested(id));
    setFiche(null);
    setToast("Ta capsule est mise à jour");
  };

  const pasInteressee = (item: Item) => {
    actions.dismissSuggested(item.id);
    setFiche(null);
    setToast("Pièce retirée de ta capsule");
  };

  const raisons = pieceFiche ? raisonsSuggestion(pieceFiche, capsuleProfile) : [];
  const syntheseFiche = pieceFiche ? [CATLABEL[pieceFiche.cat], pieceFiche.color, pieceFiche.matiere].filter(Boolean).join(" · ") : "";

  return (
    <>
      <div
        className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px]"
        // Réserve la barre du bas ET le bouton principal qui flotte au-dessus.
        style={{ paddingBottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 92px)" }}
      >
        <AppHeader />

        <div className="mt-[18px]">
          <div className="t-surtitre text-muted">Ta capsule</div>
          <div className="t-titre-ecran text-ink mt-[6px]">
            Capsule <span className="italic text-terracotta">{capsuleSeason}</span>
          </div>
          {/*
            « N looks possibles » retiré le 22/09/2026. La formule combinatoire
            `(hauts × bas + robes) × chaussures` ignore la formalité par
            occasion, les occasions déclarées, la palette et les bornes météo :
            l'audit `compteur-looks.audit.ts` l'a mesurée contre le nombre de
            tenues que le moteur produit réellement, et l'écart va de ×0,5 à
            ×1,7 selon les profils. Un nombre faux n'est pas rattrapable par une
            formulation, donc c'est le nombre qui part, pas son étiquette. Reste
            `capsule.length`, qui est compté, pas estimé — et présenté depuis le
            25/09/2026 pour ce qu'il est : une sélection, pas un stock.
          */}
          <div className="font-serif text-[17px] text-ink leading-[1.3] mt-[10px]">
            {pieces(capsule.length)} {capsule.length > 1 ? "sélectionnées" : "sélectionnée"}{" "}
            {exploredStyleLabel ? "dans ce style" : "pour toi"}
          </div>
          {possedees.length > 0 && (
            <div className="text-[12px] text-muted mt-[2px]">
              et {pieces(possedees.length)} de ton dressing pour cette saison
            </div>
          )}
          <div className="text-[12px] text-muted leading-[1.5] mt-[8px]">
            {exploredStyleLabel ? (
              <>
                Aperçu du style <span className="text-ink">{exploredStyleLabel}</span> — pas ton style habituel.
              </>
            ) : (
              criteres.length > 0 && (
                <>
                  Pensées pour{" "}
                  {criteres.map((c, i) => (
                    <span key={c.cle}>
                      {i > 0 && <span className="text-placeholder"> · </span>}
                      {c.avant}
                      <button
                        type="button"
                        onClick={() => actions.goProfileSetup(c.etape, true)}
                        className="text-terracotta font-semibold cursor-pointer"
                      >
                        {c.valeur}
                      </button>
                    </span>
                  ))}
                </>
              )
            )}
          </div>
        </div>

        {exploredStyleLabel && (
          <div className="mt-[14px] bg-card border border-border rounded-[14px] px-4 py-[14px]">
            <div className="flex items-start gap-[11px]">
              <span className="font-serif italic text-[15px] text-terracotta flex-shrink-0">✦</span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-ink leading-[1.4]">Tu explores le style {exploredStyleLabel}</div>
                <div className="text-[12px] text-[#3F3B34] leading-[1.45] mt-[3px]">
                  Cette capsule permet de composer une tenue pour{" "}
                  {occasionPhraseFor(state.occasion || "all", state.workMode, state.dateContext)}.
                </div>
              </div>
              <button
                onClick={actions.clearExploredStyle}
                className="flex-shrink-0 text-[12px] text-terracotta cursor-pointer whitespace-nowrap"
              >
                Revenir à mon style
              </button>
            </div>
            <button
              onClick={actions.viewExploredOutfit}
              className="mt-[14px] w-full text-center rounded-full py-4 t-bouton bg-terracotta active:bg-terracotta-hover text-cream cursor-pointer"
            >
              Voir ma tenue
            </button>
          </div>
        )}

        <div className="scrollarea flex gap-2 overflow-x-auto pb-[2px] mt-[18px]">
          {CAPSULE_SEASONS.map((s) => {
            const on = capsuleSeason === s;
            return (
              <button
                key={s}
                onClick={() => actions.setCapsuleSeason(s)}
                aria-pressed={on}
                className={
                  "flex-none py-[9px] px-4 rounded-full text-[12px] cursor-pointer border whitespace-nowrap " +
                  // Actif en terracotta profond (polish V2) : le même fond plein
                  // que le chip d'occasion actif de la Tenue, plutôt que l'encre.
                  (on ? "bg-terracotta-deep border-terracotta-deep text-cream" : "bg-card border-border text-ink")
                }
              >
                {s}
              </button>
            );
          })}
        </div>

        {/* Bandeau de saison, sous le sélecteur : il change avec lui.
            2:1 depuis le polish V2 du 26/09/2026 (16:9 le 25/09, 3:2
            auparavant) : il installe la saison sans monopoliser le premier
            écran — à 390 px, 20 px de moins, pris en haut et en bas, où les
            visuels n'ont que du décor (branchages, ciel, rebord de pierre).
            Dimensions déclarées pour que rien ne saute au chargement. */}
        <div className="mt-[16px] rounded-[20px] overflow-hidden border border-border bg-card" style={{ aspectRatio: "2/1" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={capsuleSeason}
            src={VISUEL_SAISON[capsuleSeason]}
            alt=""
            width={1200}
            height={800}
            decoding="async"
            className="w-full h-full object-cover block"
          />
        </div>

        {/* Introduction : une phrase courte, vraie de la capsule affichée
            (introCapsule). Filet terracotta plutôt qu'un encadré, pour
            qu'elle reste une respiration et pas une carte. */}
        {capsule.length > 0 && (
          <div className="mt-[16px] border-l-2 border-terracotta pl-[12px] font-serif italic text-[14px] text-ink leading-[1.45]">
            {intro}
          </div>
        )}

        {/* PIÈCES CLÉS — trois cartes sur une ligne, strictement identiques
            (même vignette, même nom sur deux lignes réservées), sans
            description : le nom suffit. Masquées sous deux pièces, où
            « pièces clés » ne voudrait plus rien dire. Sous-titre du brief
            polish V2 (26/09/2026). */}
        {cles.length >= 2 && (
          <div className="mt-[30px]">
            <div className="t-surtitre text-muted">Les {cles.length} pièces clés</div>
            <div className="text-[12px] text-muted mt-[4px] mb-[12px]">Celles qui donnent le ton à ta capsule.</div>
            <div className="grid grid-cols-3 gap-[10px]">
              {cles.map((it) => (
                <button key={it.id} onClick={() => ouvrir(it, false)} className="min-w-0 text-left cursor-pointer" aria-label={`${it.name}, pièce clé`}>
                  <Vignette item={it} />
                  <NomPiece nom={it.name} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* CATÉGORIES (polish V2, 26/09/2026). Une liste calme, filet entre
            chaque ligne : les deux premières catégories ouvertes, les autres
            repliées en une ligne — le nom d'abord, le nombre de pièces
            ensuite, le chevron pour l'état. L'en-tête entier ouvre ou referme.
            Ouverte, une catégorie montre TOUTES ses pièces sur une rangée qui
            défile : deux cartes entières et le bord de la troisième, qui dit
            qu'il y en a d'autres sans « Voir tout ». Les cartes d'une
            catégorie repliée ne sont pas montées : aucune image chargée pour
            rien. L'état vit dans l'écran et survit au changement de saison. */}
        <div key={capsuleSeason} className="mt-[30px] border-t border-border">
          {groups.map((g, idx) => {
            const ouverte = idx < OUVERTES_PAR_DEFAUT !== bascules.includes(g.key);
            const cartes = [
              ...g.siennes.map((it) => ({ it, possedee: true })),
              ...g.suggestions.map((it) => ({ it, possedee: false })),
            ];
            const basculer = () => setBascules((b) => (b.includes(g.key) ? b.filter((k) => k !== g.key) : [...b, g.key]));
            return (
              <section key={g.key} className="border-b border-border">
                <button
                  onClick={basculer}
                  aria-expanded={ouverte}
                  aria-label={`${g.label}, ${pieces(g.total)}, ${ouverte ? "replier" : "afficher les pièces"}`}
                  className="w-full min-h-[60px] py-[12px] flex items-center justify-between gap-3 text-left cursor-pointer"
                >
                  <span className="min-w-0">
                    <span className="block t-groupe text-ink">{g.label}</span>
                    <span className="block text-[11px] text-muted mt-[3px]">{pieces(g.total)}</span>
                  </span>
                  <span aria-hidden="true" className="flex-shrink-0 text-muted">
                    <Chevron ouvert={ouverte} />
                  </span>
                </button>
                {ouverte && (
                  <div
                    className={
                      "scrollarea -mx-6 px-6 scroll-px-6 flex gap-[12px] overflow-x-auto snap-x snap-mandatory pt-[2px] pb-[22px] " +
                      // Ouverte à la main : les cartes entrent en fondu ; les
                      // deux catégories ouvertes à l'arrivée, elles, sont là.
                      (bascules.includes(g.key) ? "motion-safe:animate-[capsule-apparition_240ms_ease-out_both]" : "")
                    }
                  >
                    {cartes.map(({ it, possedee }) => (
                      <CartePiece
                        key={it.id}
                        item={it}
                        possedee={possedee}
                        onClick={() => ouvrir(it, possedee)}
                        className="flex-none w-[42%] snap-start"
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {/* Ce à quoi sert la capsule, juste avant l'action principale : elle
            nourrit les tenues (le pool de la tenue du jour est composé depuis
            la capsule et le dressing, composeWardrobePool). */}
        {capsule.length > 0 && <div className="mt-[34px] text-center text-[13px] text-muted-3">Ta capsule sert à composer tes tenues.</div>}

        {/* L'ajout d'une pièce passe après la découverte (25/09/2026) : c'est
            Capsela qui prépare, pas l'utilisatrice qui remplit. Depuis le
            polish, deux lignes centrées sans encadré, pour ne pas concurrencer
            le bouton principal. Même action qu'avant (openAdd). */}
        <div className="mt-[28px] text-center">
          <div className="text-[12px] text-muted">Une pièce manque dans ta capsule ?</div>
          <button onClick={actions.openAdd} className="mt-[2px] text-[13px] text-terracotta cursor-pointer py-[8px] px-2">
            + Ajouter une pièce que je possède
          </button>
        </div>
      </div>

      {/* Bouton principal, fixe au-dessus de la barre du bas. Le dégradé crème
          empêche les cartes qui défilent dessous de se lire à travers. */}
      <div
        className="absolute inset-x-0 z-10 px-6 pt-[14px] pointer-events-none"
        style={{
          bottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom))",
          paddingBottom: 12,
          background: "linear-gradient(to top, var(--color-cream) 70%, rgba(243,238,229,0))",
        }}
      >
        <button
          onClick={actions.goTenues}
          // Terracotta profond (polish V2) : crème sur terracotta ne donnait
          // que 3,8:1 de contraste, sous le seuil AA du texte courant ; 4,5:1
          // sur le fond profond, déjà celui des boutons pleins de Planifier.
          className="pointer-events-auto w-full bg-terracotta-deep active:bg-terracotta-hover text-cream text-center rounded-full py-4 t-bouton cursor-pointer"
        >
          ✦ Découvrir mes tenues
        </button>
      </div>

      {toast && (
        <div
          className="absolute inset-x-0 z-30 px-6"
          style={{ bottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 80px)" }}
          role="status"
        >
          <div className="bg-ink rounded-full py-[12px] px-4 text-[12px] text-cream text-center shadow-lg">{toast}</div>
        </div>
      )}

      <BottomSheet
        title={fiche?.vue === "remplacer" ? "Remplacer cette pièce" : "Suggestion"}
        open={Boolean(fiche && pieceFiche)}
        onClose={() => setFiche(null)}
      >
        {pieceFiche && fiche?.vue === "detail" && (
          <>
            {/* Hiérarchie du polish (25/09/2026) : la pièce d'abord, puis ce
                qu'elle est, pourquoi elle est là, et une seule action
                dominante. Les écarts verticaux séparent ces temps plutôt que
                de tout rapprocher. */}
            <div className="w-[148px] mx-auto">
              <Vignette item={pieceFiche} arrondi={18} marge={0.08} />
            </div>
            <div className="text-center mt-[18px]">
              <div className="flex justify-center">
                <Statut possedee={false} />
              </div>
              <div className="t-titre-section text-ink mt-[8px]">{pieceFiche.name}</div>
              {/* Pas de phrase d'occasions ici : elle redirait mot pour mot la
                  raison « Se porte… » juste en dessous (vu en rendu). */}
              {syntheseFiche && <div className="text-[12px] text-muted mt-[6px]">{syntheseFiche}</div>}
            </div>

            {/* Seulement les raisons que la sélection a réellement lues
                (raisonsSuggestion) ; aucune, et la section disparaît. */}
            {raisons.length > 0 && (
              <div className="mt-[28px]">
                <div className="t-surtitre text-muted mb-[12px]">Pourquoi Capsela te la propose ?</div>
                <ul className="flex flex-col gap-[10px]">
                  {raisons.map((r) => (
                    <li key={r.cle} className="flex items-start gap-[10px] text-[13px] text-ink leading-[1.45]">
                      <span aria-hidden="true" className="text-terracotta text-[11px] mt-[2px]">✦</span>
                      {r.texte}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 1. Seule action dominante : le bouton principal de Capsela,
                terracotta, comme « Découvrir mes tenues » (le noir rompait la
                hiérarchie de l'écran). */}
            <button
              onClick={() => {
                setFiche(null);
                actions.openItemOutfits(pieceFiche.id);
              }}
              className="mt-[30px] w-full bg-terracotta active:bg-terracotta-hover text-cream text-center rounded-full py-4 t-bouton cursor-pointer"
            >
              Voir des tenues avec cette pièce
            </button>
            {/* 2. Secondaire important : contour, sans fond. */}
            <button
              onClick={() => {
                setFiche(null);
                actions.startReplace(pieceFiche, "capsule");
              }}
              className="mt-[12px] w-full border border-border-soft text-terracotta text-center rounded-full py-[13px] text-[13px] cursor-pointer"
            >
              Je possède déjà cette pièce
            </button>
            {/* 3. Secondaire : simple lien. */}
            <button
              onClick={() => setFiche({ id: pieceFiche.id, vue: "remplacer" })}
              className="mt-[6px] w-full text-center text-[13px] text-terracotta py-[11px] cursor-pointer"
            >
              Remplacer cette pièce
            </button>
            {/* 4. Tertiaire, discret. */}
            <button onClick={() => pasInteressee(pieceFiche)} className="w-full text-center text-[12px] text-muted py-[9px] cursor-pointer">
              {profile.gender === "homme" ? "Je ne suis pas intéressé" : "Je ne suis pas intéressée"}
            </button>
          </>
        )}

        {pieceFiche && fiche?.vue === "remplacer" && (
          <>
            <div className="text-[13px] text-ink leading-[1.5]">
              {alternatives.length > 0 ? (
                <>
                  À la place de <span className="font-semibold">{pieceFiche.name}</span>, voici ce que Capsela retient pour ta
                  capsule {capsuleSeason}.
                </>
              ) : (
                <>
                  Capsela n&apos;a pas d&apos;autre pièce de cette catégorie à te proposer pour ta capsule {capsuleSeason}.
                </>
              )}
            </div>
            {alternatives.length > 0 && (
              <div className="flex flex-col gap-[8px] mt-[14px]">
                {alternatives.map((a) => (
                  <button
                    key={a.piece.id}
                    onClick={() => choisirAlternative(a)}
                    className="flex items-center gap-[12px] bg-card border border-border rounded-[16px] px-[12px] py-[10px] text-left cursor-pointer"
                  >
                    <div className="w-[48px] flex-shrink-0">
                      <Vignette item={a.piece} arrondi={10} marge={0.08} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-ink leading-[1.3]">{a.piece.name}</div>
                      <div className="text-[11px] text-muted mt-[2px]">
                        {[CATLABEL[a.piece.cat], a.piece.color].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <span className="text-[12px] text-terracotta flex-shrink-0">Choisir</span>
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setFiche({ id: pieceFiche.id, vue: "detail" })}
              className="mt-[14px] w-full text-center text-[13px] text-muted py-[10px] cursor-pointer"
            >
              Retour
            </button>
          </>
        )}
      </BottomSheet>
    </>
  );
}
