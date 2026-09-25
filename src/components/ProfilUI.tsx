"use client";

/*
 * Éléments partagés par les écrans du profil (Ton profil, Personnaliser mon
 * profil) : icônes au trait 1,6, surtitre de section, ligne cliquable.
 * Sortis de ProfileScreen le 25/09/2026 pour que les deux écrans affichent
 * les mêmes lignes sans les dupliquer.
 */

const T = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;
export function Icone({ children, taille = 19 }: { children: React.ReactNode; taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
      {children}
    </svg>
  );
}
export const I_GENRE = (
  <>
    <circle cx="12" cy="8" r="3.5" {...T} />
    <path d="M5.5 20c.8-3.6 3.3-5.5 6.5-5.5s5.7 1.9 6.5 5.5" {...T} />
  </>
);
export const I_CINTRE = (
  <>
    <path d="M12 4.2a1.6 1.6 0 1 1 1.4 2.4L12 7.8" {...T} />
    <path d="M12 7.8l8.6 6.1a1.3 1.3 0 0 1-.8 2.3H4.2a1.3 1.3 0 0 1-.8-2.3L12 7.8z" {...T} />
  </>
);
export const I_SILHOUETTE = (
  <>
    <path d="M9 3.5h6M9.5 3.5c0 3 1.2 4.3 1.2 6.2S8 13.4 8 16.2c0 1.9 1.7 3.3 4 3.3s4-1.4 4-3.3c0-2.8-2.7-4.6-2.7-6.5s1.2-3.2 1.2-6.2" {...T} />
    <path d="M12 19.5V21" {...T} />
  </>
);
export const I_PALETTE = (
  <>
    <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.3-1.1-1.6-1.1-2.7 0-1 .8-1.6 1.8-1.6h2.2a3.8 3.8 0 0 0 3.8-3.8c0-4-3.8-7.2-8.5-7.2z" {...T} />
    <circle cx="7.8" cy="11" r="1" {...T} />
    <circle cx="10.5" cy="7.3" r="1" {...T} />
    <circle cx="15" cy="7.8" r="1" {...T} />
  </>
);
export const I_METRE = (
  <>
    <rect x="3.5" y="8" width="17" height="8" rx="1.5" {...T} />
    <path d="M7.5 8v3M11 8v2M14.5 8v3M18 8v2" {...T} />
  </>
);
export const I_INTENSITE = (
  <>
    <circle cx="12" cy="12" r="8" {...T} />
    <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none" />
  </>
);
export const I_CALENDRIER = (
  <>
    <rect x="4" y="6" width="16" height="14" rx="2" {...T} />
    <path d="M4 10h16M8.5 3.5V7M15.5 3.5V7" {...T} />
  </>
);
export const I_DOC = <path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20V3.5zM14 3.5V8h4M9.5 12h5M9.5 15.5h5" {...T} />;
export const I_BOUCLIER = <path d="M12 3.5l7 2.8v5.2c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6.3l7-2.8z" {...T} />;
export const I_TELECHARGER = <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14" {...T} />;
export const I_ETINCELLE = <path d="M12 3l1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8L12 3z" {...T} />;
export const I_TSHIRT = <path d="M8 4L4 7.2l2.4 2.6L8 8.4V20h8V8.4l1.6 1.4 2.4-2.6L16 4l-4 1.8L8 4z" {...T} />;
export const I_COMPTE = (
  <>
    <circle cx="12" cy="8.5" r="3.5" {...T} />
    <path d="M5 20c1-3.3 3.6-5 7-5s6 1.7 7 5" {...T} />
  </>
);
export const I_GRAPHIQUE = <path d="M5 19.5h14M8 16v-4M12 16V8M16 16v-6" {...T} />;

export function Surtitre({ icone, children }: { icone: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-[8px] text-terracotta mt-7 mb-[10px]">
      <Icone taille={16}>{icone}</Icone>
      <span className="text-[11px] tracking-[.16em] uppercase text-muted">{children}</span>
    </div>
  );
}

/** Une ligne du profil : toute la ligne est le bouton qui ouvre l'écran de modification correspondant. */
export function LigneProfil({
  icone,
  titre,
  valeur,
  renseigne,
  explication,
  onClick,
}: {
  icone: React.ReactNode;
  titre: string;
  valeur: React.ReactNode;
  renseigne: boolean;
  explication?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-[13px] px-4 py-[14px] text-left cursor-pointer border-b border-border last:border-b-0"
    >
      <span className="w-11 h-11 flex-shrink-0 rounded-full bg-warm-bg text-terracotta-deep flex items-center justify-center">
        <Icone>{icone}</Icone>
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-serif text-[16px] leading-[1.25] text-ink">{titre}</span>
        <span className={"block text-[13px] leading-[1.4] mt-[2px] " + (renseigne ? "text-ink" : "text-placeholder")}>{valeur}</span>
        {renseigne && explication && <span className="block text-[12px] text-muted leading-[1.4] mt-[3px]">{explication}</span>}
      </span>
      <span aria-hidden="true" className="text-placeholder text-[15px] flex-shrink-0">›</span>
    </button>
  );
}


/**
 * La palette en nuancier : les teintes réellement enregistrées, puis des
 * emplacements vides jusqu'au maximum de 6 — une palette en cours, pas une
 * liste. « Non renseignée » quand il n'y a aucune couleur.
 */
export function PastillesPalette({ couleurs }: { couleurs: string[] }) {
  if (!couleurs.length) return <>Non renseignée</>;
  return (
    <span className="flex items-center gap-[6px] py-[2px]" aria-label={`${couleurs.length} couleurs`}>
      {Array.from({ length: Math.max(6, couleurs.length) }, (_, i) => couleurs[i]).map((hex, i) =>
        hex ? (
          <span key={i} className="w-[20px] h-[20px] rounded-full flex-shrink-0" style={{ background: hex, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.12)" }} />
        ) : (
          <span key={i} className="w-[20px] h-[20px] rounded-full flex-shrink-0 border border-border-soft" />
        )
      )}
    </span>
  );
}

/** Résumé des tailles renseignées : « Haut M · Bas 40 · Chaussures 39 ». */
export function resumeTailles(p: { tailleHaut: string | null; tailleBas: string | null; pointure: string | null }): string[] {
  return [p.tailleHaut && "Haut " + p.tailleHaut, p.tailleBas && "Bas " + p.tailleBas, p.pointure && "Chaussures " + p.pointure].filter(
    Boolean
  ) as string[];
}
