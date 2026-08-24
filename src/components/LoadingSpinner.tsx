type Props = {
  size?: number;
  className?: string;
};

/**
 * Icône de chargement de page (cintre + cœur, spec design 23/08/2026,
 * affinée 26/08/2026 : anneau fin façon logo plutôt qu'un spinner
 * technique) : le cintre reste totalement fixe (aucune rotation, aucune
 * pulsation), seul l'arc extérieur tourne. Anneau inactif en terracotta
 * très pâle, arc actif dans le terracotta principal — jamais l'inverse.
 */
export default function LoadingSpinner({ size = 76, className = "" }: Props) {
  const stroke = 2;
  const r = size / 2 - stroke / 2;
  const c = 2 * Math.PI * r;
  const activeLength = c * 0.28;
  const iconSize = size * 0.4;

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F3DED2" strokeWidth={stroke} />
      </svg>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 loading-spinner-arc"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#E07A3C"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${activeLength} ${c - activeLength}`}
        />
      </svg>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-hanger-only.png" alt="" style={{ width: iconSize, height: "auto" }} />
    </div>
  );
}
