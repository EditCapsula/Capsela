import type { HTMLAttributes } from "react";

/**
 * LA CARTE (02/10/2026, audit design system : « le style bg-card border rounded est répété à la main sur chaque
 * écran », une centaine de fois). Un fond de carte, un filet fin et un coin arrondi de l'échelle de rayons
 * (globals.css) ; tout le reste (marges, remplissage, disposition) se passe en `className`. Pas de bouton ici :
 * une carte qui se touche garde son rôle (`role`, `onClick`) fourni par l'appelant.
 *
 *   champ 12 · bloc 14 · tuile 16 · carte 20 (défaut) · hero 24
 */
const RAYONS = {
  champ: "rounded-champ",
  bloc: "rounded-bloc",
  tuile: "rounded-tuile",
  carte: "rounded-carte",
  hero: "rounded-hero",
} as const;

export type RayonCarte = keyof typeof RAYONS;

export default function Card({
  rayon = "carte",
  className = "",
  children,
  ...props
}: { rayon?: RayonCarte } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={`bg-card border border-border ${RAYONS[rayon]}${className ? " " + className : ""}`}>
      {children}
    </div>
  );
}
