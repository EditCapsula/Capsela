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
  libelles,
}: {
  total: number;
  /** Index de l'étape en cours, à partir de 0. */
  courante: number;
  className?: string;
  /**
   * Un nom sous chaque point (parcours Planifier, 07/10/2026) : « Occasion · Quand · Où · Préférences ». Facultatif ; le
   * nom accessible reste « Étape n sur N ».
   */
  libelles?: readonly string[];
}) {
  if (libelles && libelles.length === total) {
    return (
      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={courante + 1}
        aria-label={`Étape ${courante + 1} sur ${total} : ${libelles[courante]}`}
        className={"flex items-start justify-center gap-4 " + className}
      >
        {libelles.map((l, i) => (
          <span key={l} aria-hidden="true" className="flex flex-col items-center gap-[5px]">
            <span
              className="rounded-full inline-block"
              style={
                i === courante
                  ? { width: 20, height: 6, background: "var(--color-terracotta)" }
                  : { width: 6, height: 6, background: i < courante ? "var(--color-terracotta)" : "var(--color-dots)" }
              }
            />
            <span className={"t-pastille " + (i === courante ? "text-ink font-semibold" : "text-muted")}>{l}</span>
          </span>
        ))}
      </div>
    );
  }
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

/**
 * PROGRESSION D'UN QUESTIONNAIRE COURT (30/09/2026, parcours colorimétrie).
 *
 * Le brief l'impose : un seul langage de progression, « 1 / 4 » sur une
 * barre fine, sans fil d'Ariane, sans points, sans « Question 2 sur 4 ».
 * Elle REMPLACE le fil d'étapes de l'onboarding le temps des questions — les
 * deux ensemble seraient deux compteurs pour un même écran. Ici la barre dit
 * le chemin parcouru, et c'est voulu : dans un questionnaire, c'est ce qui
 * reste qui rassure.
 */
export function ProgressionQuestions({ courante, total }: { courante: number; total: number }) {
  const n = Math.min(total, Math.max(1, courante + 1));
  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={n}
      aria-label={`Question ${n} sur ${total}`}
      className="flex flex-col items-center gap-[7px]"
    >
      <div className="w-[120px] h-[2px] rounded-full bg-dots overflow-hidden">
        <div
          className="h-full rounded-full bg-terracotta motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-out"
          style={{ width: `${(n / total) * 100}%` }}
        />
      </div>
      <span aria-hidden="true" className="text-[11px] tracking-[.14em] text-muted tabular-nums">
        {n} / {total}
      </span>
    </div>
  );
}
