import type { CSSProperties, ReactNode } from "react";

/**
 * LE BADGE (02/10/2026, audit design system : « quatre traitements visuels non unifiés pour une notion voisine »).
 * Une pastille arrondie, en capitales (`t-pastille`), qui INFORME et ne se touche jamais : un bouton a son propre
 * style. Un seul composant, des TONS nommés qui reprennent exactement les traitements déjà en usage :
 *
 *   doux     terracotta sur beige chaud — le défaut (occasion, statut, Premium sur carte blanche)
 *   carte    terracotta sur fond de carte — la même pastille posée sur un bloc beige ou une photo
 *   plein    crème sur terracotta — « Suggérée », « À découvrir » : ce qui vient de Capsela
 *   possede  encre sur beige, filet — « Ton dressing », « Dressing » : ce qui appartient à la personne
 *   neutre   gris sur fond discret — « Bientôt »
 *   succes   vert de réussite (jetons success) — « Recommandé »
 *   surTerracotta / surTerracottaContour   pastille posée SUR un fond terracotta (carte de la tenue)
 *
 * Deux tailles : `m` (9 × 4 px) et `s` (8 × 3 px, sur photo ou dans une ligne serrée).
 */
const TONS: Record<string, { classe?: string; style?: CSSProperties }> = {
  doux: { classe: "bg-warm-bg text-terracotta" },
  carte: { classe: "bg-card text-terracotta" },
  plein: { classe: "bg-terracotta text-cream" },
  possede: { classe: "bg-warm-bg text-ink border border-warm-border" },
  neutre: { classe: "bg-chip-soft-bg text-muted" },
  succes: { classe: "bg-success-bg text-success" },
  surTerracotta: { style: { background: "rgba(243,238,229,.22)", color: "#FBF3EA" } },
  surTerracottaContour: { style: { border: "1px solid rgba(243,238,229,.38)", color: "#F0DDCF" } },
};

const TAILLES = { m: "px-[9px] py-[4px]", s: "px-[8px] py-[3px]" } as const;

export type TonBadge = keyof typeof TONS;

export default function Badge({
  tone = "doux",
  taille = "m",
  icone,
  className = "",
  children,
}: {
  tone?: TonBadge;
  taille?: keyof typeof TAILLES;
  /** Un glyphe décoratif devant le texte (« ✦ » pour Premium). */
  icone?: string;
  className?: string;
  children: ReactNode;
}) {
  const t = TONS[tone];
  return (
    <span
      className={`inline-flex items-center gap-[4px] rounded-full t-pastille whitespace-nowrap ${TAILLES[taille]} ${t.classe ?? ""} ${className}`}
      style={t.style}
    >
      {icone && <span aria-hidden="true">{icone}</span>}
      {children}
    </span>
  );
}
