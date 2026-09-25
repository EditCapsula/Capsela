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
  descriptionPieceCle,
  introCapsule,
  piecesCles,
  piecesDuDressingPourSaison,
  raisonsSuggestion,
  type AlternativeRemplacement,
} from "@/lib/capsuleEcran";
import { useAuth } from "@/lib/auth";
import { silhouetteForme, styleLabel } from "@/lib/profile";
import { useCapsela } from "@/lib/store";
import { resolveItemImage } from "@/lib/catalogImages";
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

/** « 1 pièce » / « 12 pièces ». */
function pieces(n: number): string {
  return `${n} ${n > 1 ? "pièces" : "pièce"}`;
}

/** Vignette d'une pièce : même rendu qu'avant la refonte (image entière, jamais recadrée, sur fond crème ; à défaut sa couleur). */
function Vignette({ item, arrondi = 12, marge = 8 }: { item: Item; arrondi?: number; marge?: number }) {
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
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image.url}
          alt=""
          loading="lazy"
          decoding="async"
          style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center", padding: marge, boxSizing: "border-box" }}
        />
      ) : (
        item.imageStatus === "generating" && (
          <span className="absolute inset-0 animate-pulse" style={{ background: "rgba(243,238,229,.35)" }} />
        )
      )}
    </div>
  );
}

/**
 * Statut d'une pièce, identique partout sur l'écran : une ligne de texte sous
 * l'image, pas un badge posé dessus. Le glyphe porte la différence autant que
 * la couleur — ✓ encre pour ce qui est à toi, ✦ terracotta pour ce que
 * Capsela propose — pour rester lisible sans distinguer les couleurs.
 */
function Statut({ possedee }: { possedee: boolean }) {
  return possedee ? (
    <span className="inline-flex items-center gap-[4px] text-[10px] text-muted-3">
      <span aria-hidden="true" className="text-ink">✓</span>
      Dans ton dressing
    </span>
  ) : (
    <span className="inline-flex items-center gap-[4px] text-[10px] text-terracotta">
      <span aria-hidden="true">✦</span>
      Suggestion
    </span>
  );
}

function CartePiece({ item, possedee, onClick, className = "" }: { item: Item; possedee: boolean; onClick: () => void; className?: string }) {
  return (
    <button onClick={onClick} className={"text-left cursor-pointer " + className} aria-label={`${item.name}, ${possedee ? "dans ton dressing" : "suggestion"}`}>
      <Vignette item={item} />
      {/* Deux lignes plutôt qu'une ellipse : « T-shirt coton col rond » tient
          entier, un nom plus long ne mange pas le statut. */}
      <div className="text-[11.5px] text-ink mt-[7px] leading-[1.3] line-clamp-2">{item.name}</div>
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
  // même convention que ProfileScreen/ProfileEditScreen (styleLabel(profile.styles[0], ...)) ;
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
  const intro = useMemo(() => introCapsule(capsule, capsuleProfile), [capsule, capsuleProfile]);

  const groups = CATS.map(([key, , plural]) => {
    const siennes = possedees.filter((i) => i.cat === key);
    const suggestions = capsule.filter((i) => i.cat === key);
    return { key, label: plural, siennes, suggestions, total: siennes.length + suggestions.length };
  }).filter((g) => g.total > 0);

  // « Voir tout » déplie la rangée en grille, sur place : aucune navigation
  // nouvelle. Remis à zéro au changement de saison (clé du conteneur).
  const [deplies, setDeplies] = useState<CategoryKey[]>([]);

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
          <div className="text-[11px] tracking-[.16em] uppercase text-muted">Ta capsule</div>
          <div className="font-serif text-[27px] leading-[1.15] text-ink mt-[6px]">
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
              className="mt-[14px] w-full text-center rounded-full py-4 text-[13px] tracking-[.1em] uppercase bg-terracotta active:bg-terracotta-hover text-cream cursor-pointer"
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
                className="flex-none py-[9px] px-4 rounded-full text-[12px] cursor-pointer border whitespace-nowrap"
                style={{ background: on ? "#1D1A16" : "#FBF8F3", borderColor: on ? "#1D1A16" : "#E6DCCB", color: on ? "#F3EEE5" : "#1D1A16" }}
              >
                {s}
              </button>
            );
          })}
        </div>

        {/* Bandeau de saison, sous le sélecteur : il change avec lui. Ratio
            d'origine (3:2) conservé tel quel — aucun recadrage — et
            dimensions déclarées pour que rien ne saute au chargement. */}
        <div className="mt-[16px] rounded-[20px] overflow-hidden border border-border bg-card" style={{ aspectRatio: "3/2" }}>
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

        {/* Introduction : une phrase dont chaque partie est vraie de la
            capsule affichée (introCapsule). Filet terracotta plutôt qu'un
            encadré, pour qu'elle reste une respiration et pas une carte. */}
        {capsule.length > 0 && (
          <div className="mt-[18px] border-l-2 border-terracotta pl-[12px] font-serif italic text-[14px] text-ink leading-[1.5]">
            {intro}
          </div>
        )}

        {/* PIÈCES CLÉS — secondaires par rapport à la capsule : une liste
            compacte dans une seule carte, pas des vignettes géantes. Masquées
            sous deux pièces, où « pièces clés » ne voudrait plus rien dire. */}
        {cles.length >= 2 && (
          <div className="mt-[26px]">
            <div className="text-[11px] tracking-[.16em] uppercase text-muted mb-[10px]">
              {cles.length} pièces clés cette saison
            </div>
            <div className="bg-card border border-border rounded-[20px] overflow-hidden">
              {cles.map((it) => {
                const description = descriptionPieceCle(it);
                return (
                  <button
                    key={it.id}
                    onClick={() => ouvrir(it, false)}
                    className="w-full flex items-center gap-[13px] px-[14px] py-[12px] border-b border-border last:border-b-0 text-left cursor-pointer"
                  >
                    <div className="w-[52px] flex-shrink-0">
                      <Vignette item={it} arrondi={10} marge={5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-ink leading-[1.3]">{it.name}</div>
                      {description && <div className="text-[11px] text-muted leading-[1.4] mt-[3px]">{description}</div>}
                    </div>
                    <span aria-hidden="true" className="text-placeholder text-[15px] flex-shrink-0">›</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div key={capsuleSeason}>
          {groups.map((g) => {
            const deplie = deplies.includes(g.key);
            const cartes = [
              ...g.siennes.map((it) => ({ it, possedee: true })),
              ...g.suggestions.map((it) => ({ it, possedee: false })),
            ];
            return (
              <section key={g.key} className="mt-[28px]">
                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[12px] tracking-[.1em] uppercase font-semibold text-ink">{g.label}</div>
                    <div className="text-[11px] text-muted mt-[2px]">{pieces(g.total)}</div>
                  </div>
                  {/* À partir de trois cartes, la rangée déborde à 360 px. */}
                  {cartes.length >= 3 && (
                    <button
                      onClick={() => setDeplies((d) => (deplie ? d.filter((k) => k !== g.key) : [...d, g.key]))}
                      aria-expanded={deplie}
                      className="flex-shrink-0 text-[12px] text-terracotta cursor-pointer py-[4px]"
                    >
                      {deplie ? "Réduire" : "Voir tout →"}
                    </button>
                  )}
                </div>
                {deplie ? (
                  <div className="grid grid-cols-3 gap-x-[10px] gap-y-[16px] mt-[12px]">
                    {cartes.map(({ it, possedee }) => (
                      <CartePiece key={it.id} item={it} possedee={possedee} onClick={() => ouvrir(it, possedee)} />
                    ))}
                  </div>
                ) : (
                  // Débord `-mx-6 px-6` : la rangée se coupe au bord de l'écran,
                  // et la carte tronquée dit qu'on peut faire défiler. Sans
                  // scroll-padding, l'aimantation collait la première carte au
                  // bord de l'écran, hors de la marge (mesuré à 360 px).
                  <div
                    className="scrollarea flex gap-[10px] overflow-x-auto mt-[12px] pb-[2px] -mx-6 px-6"
                    style={{ scrollSnapType: "x mandatory", scrollPaddingInline: 24 }}
                  >
                    {cartes.map(({ it, possedee }) => (
                      <CartePiece
                        key={it.id}
                        item={it}
                        possedee={possedee}
                        onClick={() => ouvrir(it, possedee)}
                        className="flex-none w-[112px] [scroll-snap-align:start]"
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {/* L'ajout d'une pièce passe après la découverte (25/09/2026) : c'est
            Capsela qui prépare, pas l'utilisatrice qui remplit. Même action
            qu'avant (openAdd). */}
        <div className="mt-[34px] bg-card border border-border rounded-[20px] px-4 py-[16px]">
          <div className="font-serif text-[16px] text-ink leading-[1.3]">Une pièce manque dans ta capsule ?</div>
          <div className="text-[12px] text-muted leading-[1.5] mt-[4px]">
            Ajoute celles que tu possèdes : Capsela les utilise pour composer tes tenues.
          </div>
          <button onClick={actions.openAdd} className="mt-[10px] text-[13px] text-terracotta cursor-pointer py-[4px]">
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
          className="pointer-events-auto w-full bg-terracotta active:bg-terracotta-hover text-cream text-center rounded-full py-4 text-[13px] tracking-[.1em] uppercase cursor-pointer"
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
            <div className="flex items-start gap-[14px]">
              <div className="w-[96px] flex-shrink-0">
                <Vignette item={pieceFiche} arrondi={14} marge={8} />
              </div>
              <div className="flex-1 min-w-0">
                <Statut possedee={false} />
                <div className="font-serif text-[19px] text-ink leading-[1.2] mt-[5px]">{pieceFiche.name}</div>
                {/* Pas de phrase d'occasions ici : elle redirait mot pour mot la
                    raison « Se porte… » juste en dessous (vu en rendu). */}
                {syntheseFiche && <div className="text-[12px] text-muted mt-[4px]">{syntheseFiche}</div>}
              </div>
            </div>

            {/* Seulement les raisons que la sélection a réellement lues
                (raisonsSuggestion) ; aucune, et la section disparaît. */}
            {raisons.length > 0 && (
              <div className="mt-[20px]">
                <div className="text-[11px] tracking-[.16em] uppercase text-muted mb-[8px]">Pourquoi Capsela te la propose ?</div>
                <ul className="flex flex-col gap-[7px]">
                  {raisons.map((r) => (
                    <li key={r.cle} className="flex items-start gap-[9px] text-[13px] text-ink leading-[1.4]">
                      <span aria-hidden="true" className="text-terracotta text-[11px] mt-[2px]">✦</span>
                      {r.texte}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={() => {
                setFiche(null);
                actions.openItemOutfits(pieceFiche.id);
              }}
              className="mt-[22px] w-full bg-ink text-cream text-center rounded-full py-[14px] text-[12px] tracking-[.1em] uppercase cursor-pointer"
            >
              Voir des tenues avec cette pièce
            </button>
            <button
              onClick={() => {
                setFiche(null);
                actions.startReplace(pieceFiche, "capsule");
              }}
              className="mt-[10px] w-full border border-border-soft text-terracotta text-center rounded-full py-[13px] text-[13px] cursor-pointer"
            >
              Je possède déjà cette pièce
            </button>
            <button
              onClick={() => setFiche({ id: pieceFiche.id, vue: "remplacer" })}
              className="mt-[10px] w-full border border-border-soft text-terracotta text-center rounded-full py-[13px] text-[13px] cursor-pointer"
            >
              Remplacer cette pièce
            </button>
            <button onClick={() => pasInteressee(pieceFiche)} className="mt-[8px] w-full text-center text-[12px] text-muted py-[10px] cursor-pointer">
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
                      <Vignette item={a.piece} arrondi={9} marge={4} />
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
