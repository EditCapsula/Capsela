"use client";

import { FlatLayCapsela } from "@/components/FlatLayCapsela";
import { IconeCoeur } from "@/components/CarrouselHero";
import Badge from "@/components/Badge";
import { occasionShortLabel } from "@/lib/data";
import { resolveItemImage } from "@/lib/catalogImages";
import { sourcePiece, texteProvenance, type LookNumerote } from "@/lib/ideesLooks";
import type { OutfitStyleInsight } from "@/lib/logic";
import { clePieces } from "@/lib/outfitFeedback";
import { nomCourtPiece } from "@/lib/selectors";
import type { Item } from "@/lib/types";

/**
 * CARTE ÉDITORIALE D'UNE IDÉE DE LOOK (27/09/2026) — « Comment porter … ? »
 * et « D'autres idées avec cette pièce » sur le détail du look : un seul
 * composant pour les deux.
 *
 * La composition est le flat lay éditorial (FlatLayCapsela, contexte « look-detail » — le même que le détail de la tenue et l'accueil,
 * 08/10/2026), posé sur un aplat chaud : aucun texte dans l'image.
 * La provenance est dite une fois, sous le titre, puis pièce par pièce sur
 * les miniatures : « Suggestion » (ex-« À découvrir », 13/10/2026, harmonisé) ne marque que les pièces absentes du
 * dressing (sourcePiece), jamais déduites du nom ou de l'image.
 *
 * Toute la carte est un seul bouton : les miniatures ne sont pas
 * interactives et ne défilent pas (elles se répartissent sur la largeur),
 * donc rien d'imbriqué.
 */
export function CarteIdeeLook({
  look,
  pieces,
  insight,
  dressing,
  onOpen,
  rang = "defaut",
}: {
  look: LookNumerote;
  pieces: Item[];
  insight: OutfitStyleInsight | undefined;
  dressing: Item[];
  onOpen: () => void;
  /**
   * La hiérarchie d'une liste de looks (04/10/2026, parcours Redécouvrir) : « premier » — la tête de l'ordre de
   * ordonnerLooks, celui du dressing d'abord — a plus de place et un titre plus grand ; « suivant » est plus
   * secondaire. Seule la mise en page change, jamais un classement : « défaut » est la carte d'avant.
   */
  rang?: "premier" | "suivant" | "defaut";
}) {
  const { provenance } = look;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Voir le look ${look.numero}${insight ? " : " + insight.title : ""}`}
      className="w-full text-left bg-card border border-border rounded-carte p-[12px] cursor-pointer outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
    >
      {/* Hauteur bornée (ajustee) : à hauteur naturelle, une tenue de cinq
          pièces faisait ~370 px à 390 px de large, et une seule carte
          dépassait l'écran. Les proportions entre pièces restent celles de
          la variante. */}
      <div
        className="relative rounded-bloc bg-warm-bg overflow-hidden"
        style={{ height: rang === "premier" ? "clamp(260px, 76vw, 330px)" : rang === "suivant" ? "clamp(200px, 58vw, 250px)" : "clamp(230px, 68vw, 290px)" }}
      >
        <FlatLayCapsela items={pieces} context="look-detail" layoutSeed={clePieces(pieces.map((p) => p.id)).join(",")} />
      </div>

      <div className="px-[4px]">
        {/* Le numéro, puis l'occasion de ce look — celle que le moteur lui a donnée, rien d'autre. */}
        <div className="t-label text-terracotta mt-[14px]">
          Look {look.numero} · {occasionShortLabel(look.variation.occasion)}
        </div>
        {insight && (
          <>
            <div className={(rang === "premier" ? "t-titre-section" : "t-titre-carte") + " text-ink mt-[5px]"}>{insight.title}</div>
            <div className="text-[13px] text-ink-soft leading-[1.45] mt-[5px] line-clamp-3">{insight.sentence}</div>
          </>
        )}

        <div className="flex items-baseline justify-between gap-3 mt-[12px] text-[12px]">
          <span className={provenance.suggestions === 0 ? "text-ink" : "text-muted"}>
            {provenance.suggestions === 0 && (
              <span className="text-terracotta mr-[5px]" aria-hidden="true">
                ✓
              </span>
            )}
            {texteProvenance(provenance)}
          </span>
          {provenance.suggestions === 0 && (
            <span className="text-muted whitespace-nowrap flex-shrink-0">
              {provenance.dressing}/{provenance.total} pièces
            </span>
          )}
        </div>

        <MiniaturesLook pieces={pieces} dressing={dressing} className="mt-[10px]" />

        <span className="mt-[14px] mb-[2px] inline-block t-cta text-terracotta">Voir le look →</span>
      </div>
    </button>
  );
}

/**
 * LES MINIATURES D'UN LOOK (sorties de CarteIdeeLook le 01/11/2026, pour la slide des « Idées de looks ») : les pièces réparties sur la
 * largeur, sans défilement. « Suggestion » marque une pièce absente du dressing (sourcePiece) ; `pivotId` cerne d'un trait plein la pièce
 * à partir de laquelle le look est construit, et la nomme « Ta pièce » — elle se reconnaît dans chaque proposition.
 */
/** Le nombre de colonnes des miniatures pour n pièces : au moins 4, deux rangées au-delà de 6. */
export const colonnesMiniatures = (n: number) => (n > 6 ? Math.ceil(n / 2) : Math.max(n, 4));

export function MiniaturesLook({
  pieces,
  dressing,
  pivotId,
  marquerSuggestions = true,
  alignerLibelles = false,
  colonnes: colonnesImposees,
  className = "",
}: {
  pieces: Item[];
  dressing: Item[];
  pivotId?: number;
  /**
   * Réserve la hauteur des libellés (deux lignes de nom, une ligne de mention) même quand ils sont plus courts : des cartes posées côte à
   * côte (le carrousel) gardent leurs miniatures et leur bouton à la même hauteur (01/11/2026, demandé).
   */
  alignerLibelles?: boolean;
  /** Faux quand toutes les pièces viennent de la capsule : « Suggestion » sous chacune ne dirait plus rien. */
  marquerSuggestions?: boolean;
  /** Un nombre de colonnes commun à plusieurs cartes : des miniatures de même taille d'une carte à l'autre. */
  colonnes?: number;
  className?: string;
}) {
  const colonnes = colonnesImposees ?? colonnesMiniatures(pieces.length);
  return (
    <div className={`grid gap-[8px] ${className}`} style={{ gridTemplateColumns: `repeat(${colonnes}, minmax(0, 1fr))` }}>
      {pieces.map((it) => {
        const img = resolveItemImage(it);
        const catalogue = marquerSuggestions && sourcePiece(it.id, dressing) === "catalog";
        const pivot = it.id === pivotId;
        return (
          <div key={it.id} className="min-w-0">
            <div
              className="w-full rounded-champ overflow-hidden"
              // Une suggestion se reconnaît d'un trait pointillé terracotta, discret : le dressing est à plat. La pièce choisie : un trait plein.
              style={{
                ...(img.url
                  ? { aspectRatio: "1", background: "var(--color-photo-bg)", padding: img.kind === "photo" ? 0 : 4 }
                  : { aspectRatio: "1", background: it.hex, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.06)" }),
                ...(pivot
                  ? { outline: "1.5px solid var(--color-terracotta)", outlineOffset: -1.5 }
                  : catalogue
                    ? { outline: "1px dashed var(--color-terracotta)", outlineOffset: -1 }
                    : {}),
              }}
            >
              {img.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  loading="lazy"
                  src={img.url}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: img.kind === "photo" ? "cover" : "contain" }}
                />
              )}
            </div>
            <div className="text-[10px] text-ink leading-[1.25] mt-[5px] line-clamp-2 hyphens-auto" style={alignerLibelles ? { minHeight: "2.5em" } : undefined}>
              {nomCourtPiece(it.name)}
            </div>
            {pivot ? (
              <div className="text-[9px] text-terracotta leading-[1.2] mt-[2px] whitespace-nowrap">Ta pièce</div>
            ) : catalogue ? (
              <div className="text-[9px] text-terracotta leading-[1.2] mt-[2px] whitespace-nowrap">Suggestion</div>
            ) : (
              alignerLibelles && <div className="text-[9px] leading-[1.2] mt-[2px]" aria-hidden="true">&nbsp;</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * UNE SLIDE DU CARROUSEL « IDÉES DE LOOKS » (01/11/2026, refonte de la page) — la même idée que CarteIdeeLook, mise en scène comme une
 * page de magazine : la composition domine, l'occasion posée dessus, le numéro du look dans la série affichée, le titre et la phrase de
 * decrireLooks, les miniatures où la pièce choisie se reconnaît, puis les deux actions.
 *
 * Pourquoi un second composant plutôt qu'une variante de CarteIdeeLook : cette carte-là est un seul bouton (rien d'imbriqué), alors
 * qu'ici le cœur et le CTA sont deux actions distinctes. La composition, le titre, la phrase et les miniatures sont les mêmes
 * (FlatLayCapsela, decrireLooks, MiniaturesLook).
 */
export function SlideIdeeLook({
  look,
  position,
  total,
  pieces,
  insight,
  dressing,
  pivotId,
  marquerSuggestions,
  enregistre,
  onOpen,
  onCoeur,
  colonnes,
  avecOuSansVeste = false,
}: {
  look: LookNumerote;
  /** La place du look dans la série affichée (1…total) : « Look 02 / 05 ». */
  position: number;
  total: number;
  pieces: Item[];
  insight: OutfitStyleInsight | undefined;
  dressing: Item[];
  pivotId: number;
  marquerSuggestions: boolean;
  enregistre: boolean;
  onOpen: () => void;
  onCoeur: () => void;
  /** Le même look se porte avec ou sans sa veste (fusionnerAvecOuSansVeste, 06/11/2026) : on le dit. */
  avecOuSansVeste?: boolean;
  /** Le nombre de colonnes de miniatures commun aux slides du carrousel (colonnesMiniatures du look le plus fourni). */
  colonnes?: number;
}) {
  const deux = (n: number) => String(n).padStart(2, "0");
  const occasion = look.variation.occasion !== "all" ? occasionShortLabel(look.variation.occasion) : null;
  return (
    <article className="flex-1 flex flex-col bg-card border border-border rounded-carte p-[12px]">
      <div className="relative">
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Voir le look ${position} en détail${insight ? " : " + insight.title : ""}`}
          className="block w-full relative rounded-bloc bg-warm-bg overflow-hidden cursor-pointer outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
          style={{ height: "clamp(270px, 82vw, 360px)" }}
        >
          <FlatLayCapsela items={pieces} context="look-detail" layoutSeed={clePieces(pieces.map((p) => p.id)).join(",")} />
        </button>
        {(occasion || avecOuSansVeste) && (
          <span className="absolute top-[10px] left-[10px] right-[52px] flex flex-wrap gap-[6px] pointer-events-none">
            {occasion && (
              <Badge tone="carte" taille="s">
                {occasion}
              </Badge>
            )}
            {avecOuSansVeste && (
              <Badge tone="carte" taille="s">
                Avec ou sans veste
              </Badge>
            )}
          </span>
        )}
        <button
          type="button"
          onClick={onCoeur}
          aria-pressed={enregistre}
          aria-label={enregistre ? "Retirer ce look de mes looks" : "Enregistrer ce look dans mes looks"}
          className="absolute top-[4px] right-[4px] w-[44px] h-[44px] flex items-center justify-center cursor-pointer motion-safe:transition-transform motion-safe:active:scale-[.94]"
        >
          <span className="w-[34px] h-[34px] rounded-full bg-card border border-border flex items-center justify-center text-terracotta-deep">
            <IconeCoeur plein={enregistre} />
          </span>
        </button>
      </div>

      <div className="px-[4px] flex-1 flex flex-col">
        <div className="t-label text-terracotta mt-[14px]">
          Look {deux(position)} <span className="text-muted">/ {deux(total)}</span>
        </div>
        {insight && (
          <>
            {/* Hauteurs réservées (01/11/2026, demandé : « bien aligner les cards entre elles ») : deux lignes de titre, trois de phrase. */}
            <h3 className="t-titre-section text-ink mt-[5px] line-clamp-2" style={{ minHeight: "2.36em" }}>
              {insight.title}
            </h3>
            <p className="text-[13px] text-ink-soft leading-[1.45] mt-[5px] line-clamp-3" style={{ minHeight: "4.35em" }}>
              {insight.sentence}
            </p>
          </>
        )}
        <MiniaturesLook pieces={pieces} dressing={dressing} pivotId={pivotId} marquerSuggestions={marquerSuggestions} alignerLibelles colonnes={colonnes} className="mt-[12px]" />
        <button
          type="button"
          onClick={onOpen}
          className="mt-auto pt-[14px] pb-[2px] self-start min-h-[44px] t-cta text-terracotta cursor-pointer"
        >
          Voir le look en détail →
        </button>
      </div>
    </article>
  );
}
