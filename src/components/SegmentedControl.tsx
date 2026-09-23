"use client";

/**
 * Onglets segmentés — créé le 23/09/2026 avec la maquette « Dressing ».
 *
 * POURQUOI UN COMPOSANT ET PAS DU JSX EN PLACE. Aucun composant de ce type
 * n'existait : le Dressing tenait ses filtres en pastilles dans un scroll
 * horizontal, chacune redéclarant ses couleurs. Il en faudra ailleurs (les
 * mêmes trois axes existent déjà en germe sur d'autres écrans) ; un seul
 * endroit vaut mieux qu'un second jeu de styles, ce que le brief interdit
 * explicitement.
 *
 * LE PIÈGE QU'IL EXISTE POUR ÉVITER : le troisième onglet tronqué. « Créés
 * par moi (3) » est presque deux fois plus long que « Tous (7) », et une
 * répartition en parts égales (`1fr 1fr 1fr`) le coupe sur les petits
 * écrans. Les colonnes sont donc dimensionnées sur leur CONTENU
 * (`auto auto auto`, comme la maquette) : chaque onglet prend la largeur
 * qu'il lui faut, et c'est le libellé lui-même qui rétrécit en dernier
 * recours, jamais la colonne. Vérifié en rendu à 320 px.
 *
 * Le conteneur ne défile pas : trois onglets doivent tenir. S'il en fallait
 * un jour davantage, ce serait un autre motif — une feuille, comme le
 * sélecteur d'occasion de l'écran Tenue.
 */
export interface Segment<K extends string> {
  key: K;
  label: string;
  /** Glyphe optionnel, au trait, qui prend `currentColor` comme partout ailleurs. */
  icone?: React.ReactNode;
}

export default function SegmentedControl<K extends string>({
  segments,
  actif,
  onChange,
  ariaLabel,
}: {
  segments: readonly Segment<K>[];
  actif: K;
  onChange: (key: K) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="grid gap-1 rounded-full p-1"
      style={{
        gridTemplateColumns: `repeat(${segments.length}, auto)`,
        // Jeton existant : le crème sombre déjà utilisé pour les surfaces
        // creuses. Aucune couleur nouvelle.
        background: "var(--color-chip-soft-bg)",
      }}
    >
      {segments.map((s) => {
        const on = s.key === actif;
        return (
          <button
            key={s.key}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(s.key)}
            className={
              "flex items-center justify-center gap-[5px] rounded-full px-2 text-[12px] cursor-pointer transition-colors min-w-0 " +
              (on ? "bg-card text-terracotta-deep" : "text-muted-3 active:bg-[rgba(251,248,243,.5)]")
            }
            /* 44 px et non les 36 de la maquette : c'est le plancher de cible
               tactile retenu pour l'app, et un onglet est petit par nature. */
            style={{ minHeight: 44, boxShadow: on ? "0 1px 3px rgba(29,26,22,.10)" : undefined }}
          >
            {s.icone && <span className="hidden min-[360px]:flex flex-shrink-0">{s.icone}</span>}
            {/* truncate en dernier recours seulement : les colonnes étant
                dimensionnées sur le contenu, il ne mord qu'à des largeurs
                où rien ne tiendrait de toute façon. */}
            <span className="truncate">{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}
