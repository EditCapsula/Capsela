"use client";

/**
 * FIL D'ÉTAPES — point unique (24/09/2026, signalé : « il faut harmoniser
 * l'élément permettant d'indiquer le fil d'Ariane, il faut reprendre celui de
 * l'onboarding »).
 *
 * CE QUI COEXISTAIT :
 *
 *   · Onboarding (ProfileSetupScreen) : une PASTILLE allongée de 20 × 6 pour
 *     l'étape en cours, des POINTS de 6 × 6 pour les autres, centrés entre le
 *     retour et sa gouttière miroir.
 *   · « Planifier une tenue » : quatre BARRES pleine largeur de 3 px, celles
 *     déjà parcourues en terracotta — un tout autre objet, écrit trois jours
 *     plus tard sans regarder l'existant.
 *
 * C'est le motif de l'onboarding qui est retenu, et il est repris tel quel :
 * mêmes dimensions, même écart de 6 px. Les deux couleurs passent en revanche
 * par leurs jetons — `--color-terracotta` et `--color-dots` valent exactement
 * les `#A66950` et `#DFD3BE` qui y étaient écrits en dur, donc rien ne change
 * à l'écran.
 *
 * DIFFÉRENCE DE FOND ENTRE LES DEUX MOTIFS, et raison de préférer celui-ci :
 * les barres disaient le CHEMIN PARCOURU (tout ce qui précède reste coloré),
 * la pastille dit OÙ L'ON EST. Sur un parcours court dont on peut revenir en
 * arrière, la seconde lecture est la bonne — une étape repassée en arrière ne
 * se « dé-parcourt » pas visuellement.
 *
 * ACCESSIBILITÉ. Le fil porte son propre libellé : une lectrice d'écran
 * entend « Étape 2 sur 6 » là où elle ne percevait, avant, que six éléments
 * décoratifs muets. Les points eux-mêmes restent hors de l'arbre.
 */
export default function FilEtapes({
  total,
  courante,
  className = "",
}: {
  total: number;
  /** Index de l'étape en cours, à partir de 0. */
  courante: number;
  className?: string;
}) {
  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={courante + 1}
      aria-label={`Étape ${courante + 1} sur ${total}`}
      className={"flex items-center gap-[6px] " + className}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="rounded-full inline-block"
          style={
            i === courante
              ? { width: 20, height: 6, background: "var(--color-terracotta)" }
              : { width: 6, height: 6, background: "var(--color-dots)" }
          }
        />
      ))}
    </div>
  );
}
