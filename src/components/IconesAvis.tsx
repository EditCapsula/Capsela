/**
 * Icônes de la page « Avis de styliste » (02/10/2026, maquette) — dessinées dans le style des icônes de
 * l'app : trait fin de 1,5 px, extrémités arrondies, couleur héritée (currentColor), aucun remplissage.
 */
const TRACES = {
  camera: (
    <>
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  etincelle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
  bulle: <path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-7l-4 3.5V16H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />,
  silhouette: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" />
    </>
  ),
  soleil: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
    </>
  ),
  cadre: <path d="M4 9V5h4M16 5h4v4M20 15v4h-4M8 19H4v-4" />,
  coeur: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  ampoule: <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />,
  cintre: <path d="M12 8a2 2 0 1 1 2-2M12 8v2l8 6a1 1 0 0 1-.6 1.8H4.6A1 1 0 0 1 4 16l8-6" />,
} as const;

export type NomIconeAvis = keyof typeof TRACES;

export function IconeAvis({ nom, taille = 18 }: { nom: NomIconeAvis; taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", flexShrink: 0 }}>
      {TRACES[nom]}
    </svg>
  );
}

/** La pastille ronde de l'icône, dans le ton des pastilles numérotées (bg-warm-bg, terracotta). */
export function PastilleIcone({ nom, taille = 36 }: { nom: NomIconeAvis; taille?: number }) {
  return (
    <span aria-hidden="true" className="rounded-full bg-warm-bg text-terracotta flex items-center justify-center flex-shrink-0" style={{ width: taille, height: taille }}>
      <IconeAvis nom={nom} taille={Math.round(taille * 0.5)} />
    </span>
  );
}
