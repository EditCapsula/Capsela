import type { HTMLAttributes } from "react";

/**
 * LA CARTE (02/10/2026, audit design system : « le style bg-card border rounded est répété à la main sur chaque
 * écran », une centaine de fois). Un fond de carte, un filet fin et un coin arrondi de l'échelle de rayons
 * (globals.css) ; tout le reste (marges, remplissage, disposition) se passe en `className`. Pas de bouton ici :
 * une carte qui se touche garde son rôle (`role`, `onClick`) fourni par l'appelant.
 *
 *   champ 12 · bloc 14 · tuile 16 · carte 20 (défaut) · feuille 22 · hero 24 · pilule (rounded-full)
 *
 * Complétée le 04/10/2026 (restes de l'audit) : `feuille` et `pilule` rejoignent l'échelle, `filet="fin"` donne le
 * trait `divider` des cartes de l'avis de styliste (plus clair que `border`), et `as` pose la carte sur le bon
 * élément — `li` dans une liste, `details` pour un bloc repliable, `label` pour une carte qui contient un champ.
 */
const RAYONS = {
  champ: "rounded-champ",
  bloc: "rounded-bloc",
  tuile: "rounded-tuile",
  carte: "rounded-carte",
  feuille: "rounded-feuille",
  hero: "rounded-hero",
  pilule: "rounded-full",
} as const;

export type RayonCarte = keyof typeof RAYONS;

type Element = "div" | "li" | "details" | "label" | "section";

export default function Card({
  rayon = "carte",
  filet = "normal",
  as: Balise = "div",
  className = "",
  children,
  ...props
}: { rayon?: RayonCarte; filet?: "normal" | "fin"; as?: Element } & HTMLAttributes<HTMLElement>) {
  return (
    <Balise {...(props as object)} className={`bg-card border ${filet === "fin" ? "border-divider" : "border-border"} ${RAYONS[rayon]}${className ? " " + className : ""}`}>
      {children}
    </Balise>
  );
}
