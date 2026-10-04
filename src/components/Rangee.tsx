import type { ButtonHTMLAttributes, HTMLAttributes } from "react";

/**
 * LA RANGÉE (04/10/2026, restes de l'audit design system : « lignes de réglage »). La ligne d'une carte de réglages
 * ou de liens — Préférences, Mon profil, Légal — séparée de la suivante par un filet fin, jamais après la dernière.
 * Le même trait était récrit à la main dans une vingtaine d'endroits.
 *
 * Avec `onClick`, la rangée EST le bouton (pleine largeur, texte à gauche, curseur main) ; sans, c'est un simple
 * `div`. Remplissage et écart par défaut (`px-4 py-[14px] gap-3`), qu'un `className` remplace : l'ordre des classes dans
 * la feuille de style décide d'un conflit, pas celui de l'attribut, d'où le retrait du défaut plutôt qu'un doublon.
 * À poser DANS une carte `overflow-hidden`.
 */
const aClasse = (c: string, p: string) => new RegExp(`(^|\\s)${p}`).test(c);

export default function Rangee({
  onClick,
  className = "",
  children,
  ...props
}: { onClick?: () => void } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & HTMLAttributes<HTMLElement>) {
  const classes =
    "flex items-center border-b border-border last:border-b-0" +
    (aClasse(className, "gap-") ? "" : " gap-3") +
    (aClasse(className, "px-") ? "" : " px-4") +
    (aClasse(className, "py-") ? "" : " py-[14px]") +
    (onClick ? " w-full text-left cursor-pointer" : "") +
    (className ? " " + className : "");
  return onClick ? (
    <button type="button" {...(props as ButtonHTMLAttributes<HTMLButtonElement>)} onClick={onClick} className={classes}>
      {children}
    </button>
  ) : (
    <div {...(props as HTMLAttributes<HTMLDivElement>)} className={classes}>
      {children}
    </div>
  );
}
