"use client";

import type { Segment } from "@/components/SegmentedControl";
import { resolveItemImage } from "@/lib/catalogImages";
import { occasionShortLabel } from "@/lib/data";
import type { FiltreLooks } from "@/lib/looksFiltre";
import { LIBELLE_SOURCE, phraseOrigine } from "@/lib/origineLook";
import type { Item, OrigineLook, SavedLook } from "@/lib/types";

/*
 * Carte d'un look — Dressing et « Mes looks » (refonte du 25/09/2026).
 *
 * Priorité demandée : l'image du look, puis le nom et la date, puis un statut
 * seulement s'il dit quelque chose. Plus de bordure ni de badge par pièce :
 * une pièce suggérée ne porte plus sa pastille « Suggérée » sur la vignette ;
 * le look entier porte UN indicateur, « ✦ Look suggéré par Capsela »
 * (isWishlistLook). La distinction pièce par pièce reste sur le détail du
 * look, où elle sert.
 */

const ETINCELLE = (
  <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
    <path
      d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);
const COEUR = (
  <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
    <path
      d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const trait = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const icone = (d: React.ReactNode, taille = 13) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
    {d}
  </svg>
);
/** La source : un marque-page pour une tenue enregistrée, un crayon pour un look créé (maquette du 20/11/2026). */
const ICONE_SOURCE: Record<SavedLook["source"], React.ReactNode> = {
  saved: icone(<path d="M7 4h10v16l-5-3.6L7 20z" {...trait} />, 11),
  created: icone(<path d="M5 19l1-4L16 5l3 3L9 18zM14 7l3 3" {...trait} />, 11),
};
/** L'origine : l'icône de l'écran d'où vient la tenue. */
const ICONE_ORIGINE: Record<OrigineLook, React.ReactNode> = {
  tenue_du_jour: icone(<path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z" {...trait} />, 12),
  accueil: icone(<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" {...trait} />, 12),
  planifier: icone(<><rect x="4" y="5.5" width="16" height="14.5" rx="2" {...trait} /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" {...trait} /></>, 12),
  composer: icone(<path d="M8 4H5v3M16 4h3v3M8 20H5v-3M16 20h3v-3" {...trait} />, 12),
  idee_look: icone(<path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z" {...trait} />, 12),
  valise: icone(<><rect x="4" y="7.5" width="16" height="12" rx="2" {...trait} /><path d="M9 7.5V5.5h6v2" {...trait} /></>, 12),
};

/** Onglets des looks — sans compteurs : moins d'information concurrente (brief du 25/09/2026). */
export const ONGLETS_LOOKS: Segment<FiltreLooks>[] = [
  { key: "all", label: "Tous" },
  { key: "saved", label: "Enregistrés", icone: COEUR },
  { key: "created", label: "Créés", icone: ETINCELLE },
];

/**
 * Visuel d'une pièce, ou l'aplat de sa couleur dominante quand elle n'en a
 * pas — même repli que partout ailleurs, jamais un trou.
 */
export function VisuelPiece({ piece, alt, radius }: { piece: Item; alt: string; radius: number }) {
  const img = resolveItemImage(piece);
  return (
    <div
      className="w-full h-full overflow-hidden"
      style={{ borderRadius: radius, background: img.url ? "var(--color-cream)" : piece.hex }}
    >
      {img.url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          loading="lazy"
          src={img.url}
          alt={alt}
          style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" }}
        />
      )}
    </div>
  );
}

/** Quatre cases fixes : une tenue de deux pièces garde la hauteur d'une tenue de quatre. */
export function MosaiquePieces({ pieces }: { pieces: Item[] }) {
  return (
    <div className="grid grid-cols-2 gap-[5px] p-[7px] rounded-carte" style={{ background: "var(--color-warm-bg)" }}>
      {Array.from({ length: 4 }, (_, i) => pieces[i]).map((p, i) => (
        <div key={p ? p.id : `vide-${i}`} style={{ aspectRatio: "1" }}>
          {p ? <VisuelPiece piece={p} alt={p.name} radius={13} /> : null}
        </div>
      ))}
    </div>
  );
}

export default function CarteLook({
  look,
  pieces,
  porte,
  suggere,
  onOuvrir,
  compacte = false,
}: {
  look: SavedLook;
  pieces: Item[];
  /** Nombre de fois porté (lookWornCount) — affiché seulement s'il est non nul. */
  porte: number;
  suggere: boolean;
  onOuvrir: () => void;
  /**
   * Carrousel du Dressing (polish V3, 26/09/2026) : l'indicateur devient
   * « ✦ Suggéré par Capsela », sur la ligne de la date — une occurrence discrète, et une
   * ligne de moins par carte. « Mes looks » garde la forme longue.
   */
  compacte?: boolean;
}) {
  const date = new Date(look.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  return (
    <button
      type="button"
      onClick={onOuvrir}
      aria-label={`Look ${look.name}, ${LIBELLE_SOURCE[look.source].toLowerCase()}${phraseOrigine(look) ? ", " + phraseOrigine(look)!.toLowerCase() : ""}, ${pieces.length} ${pieces.length <= 1 ? "pièce" : "pièces"}, ${porte > 0 ? `porté ${porte} fois` : "non porté"}${suggere ? ", suggéré par Capsela" : ""}`}
      className="text-left cursor-pointer active:opacity-80 min-w-0"
    >
      <MosaiquePieces pieces={pieces} />
      <div className="px-[2px] pt-[10px]">
        {/* LA PROVENANCE (20/11/2026, demandé avec maquette : « je veux surtout indiquer la provenance des looks ») — la source, toujours
            connue, puis l'endroit d'où la tenue a été enregistrée quand il a été gardé (origineLook.ts) : rien pour un look plus ancien. */}
        {!compacte && (
          <>
            <span className="inline-flex max-w-full items-center gap-[4px] rounded-full bg-[var(--color-hero-background)] px-[7px] py-[3px] text-[10.5px] font-semibold whitespace-nowrap text-[var(--color-sand-text)]">
              {ICONE_SOURCE[look.source]}
              <span className="truncate">{LIBELLE_SOURCE[look.source]}</span>
            </span>
            {phraseOrigine(look) && look.origine && (
              <div className="mt-[5px] flex items-center gap-[5px] text-[11px] text-muted min-w-0">
                {ICONE_ORIGINE[look.origine]}
                <span className="truncate">{phraseOrigine(look)}</span>
              </div>
            )}
          </>
        )}
        <div className={`t-titre-vignette ${compacte ? "" : "mt-[6px]"} text-ink overflow-hidden text-ellipsis whitespace-nowrap`}>{look.name}</div>
        <div className="text-[11px] text-muted mt-[3px]">
          {/* L'occasion du look quand il en porte une (onglet Mes looks, 15/11/2026), puis sa date. */}
          {look.occasion && look.occasion !== "all" && `${occasionShortLabel(look.occasion)} · `}
          {date}
          {porte > 0 && ` · Porté ${porte} fois`}
          {compacte && suggere && <span className="text-terracotta"> · ✦ Suggéré par Capsela</span>}
        </div>
        {!compacte && suggere && <div className="text-[10.5px] text-terracotta mt-[4px]">✦ Look suggéré par Capsela</div>}
      </div>
    </button>
  );
}
