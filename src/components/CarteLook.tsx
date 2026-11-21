"use client";

import type { Segment } from "@/components/SegmentedControl";
import { resolveItemImage } from "@/lib/catalogImages";
import { occasionShortLabel } from "@/lib/data";
import type { FiltreLooks } from "@/lib/looksFiltre";
import type { Item, SavedLook } from "@/lib/types";

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

/** La source d'un look : sauvegardé (une tenue proposée par Capsela, gardée telle quelle) ou créé par la personne (Créer un look). */
export const LIBELLE_SOURCE: Record<SavedLook["source"], string> = {
  saved: "Look sauvegardé",
  created: "Look créé par toi",
};

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
      aria-label={`Look ${look.name}, ${pieces.length} ${pieces.length <= 1 ? "pièce" : "pièces"}, ${porte > 0 ? `porté ${porte} fois` : "non porté"}${compacte ? (suggere ? ", suggéré par Capsela" : "") : ", " + LIBELLE_SOURCE[look.source].toLowerCase()}`}
      className="text-left cursor-pointer active:opacity-80 min-w-0 w-full"
    >
      <MosaiquePieces pieces={pieces} />
      <div className="px-[2px] pt-[10px]">
        <div className="t-titre-vignette text-ink overflow-hidden text-ellipsis whitespace-nowrap">{look.name}</div>
        <div className="text-[11px] text-muted mt-[3px]">
          {/* L'occasion du look quand il en porte une (onglet Mes looks, 15/11/2026), puis sa date. */}
          {look.occasion && look.occasion !== "all" && `${occasionShortLabel(look.occasion)} · `}
          {date}
          {porte > 0 && ` · Porté ${porte} fois`}
          {compacte && suggere && <span className="text-terracotta"> · ✦ Suggéré par Capsela</span>}
        </div>
        {/* LA SOURCE À LA PLACE DE « LOOK SUGGÉRÉ PAR CAPSELA » (20/11/2026, demandé : « à la place de Look suggéré par Capsela indique la
            source… savoir si le look est créé par l'utilisateur ou si c'est un look sauvegardé »). Le filtre « Suggérés » reste. */}
        {!compacte && <div className="text-[10.5px] text-terracotta mt-[4px]">{look.source === "saved" ? "✦ " : ""}{LIBELLE_SOURCE[look.source]}</div>}
      </div>
    </button>
  );
}
