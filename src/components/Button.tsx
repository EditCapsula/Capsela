import type { ButtonHTMLAttributes } from "react";

/**
 * LE BOUTON (02/10/2026, audit design system : « chaque écran écrit son propre <button> »). Un seul composant
 * pour les boutons ARRONDIS en capitales (`t-bouton`) : même hauteur, même forme, mêmes états. Les variantes ne
 * changent que la couleur :
 *
 *   principal    crème sur terracotta-deep — l'action de l'écran. `terracotta-deep` et non `terracotta` : le crème
 *                sur #A66950 donne un contraste de 3,82:1 (sous les 4,5:1 du texte courant), sur #9E5B43 de 4,51:1.
 *   sombre       crème sur encre — l'action qui engage (confirmer, valider)
 *   destructif   crème sur rouille — supprimer, retirer
 *   secondaire   texte terracotta, filet — l'alternative à l'action principale
 *   contour      texte et filet terracotta — la seconde action d'une paire
 *
 * Pleine largeur par défaut (`pleine={false}` pour un bouton à sa taille). 52 px de haut au moins : la cible
 * tactile reste confortable. Non migrés volontairement : les actions sans fond (`t-cta`, `t-lien`), les boutons
 * dont la couleur est calculée (désactivation par style en ligne), et les boutons ronds ou à puce.
 */
const VARIANTES = {
  principal: "bg-terracotta-deep active:bg-terracotta-hover text-cream",
  sombre: "bg-ink text-cream",
  destructif: "bg-rust text-cream",
  secondaire: "border border-border text-terracotta",
  contour: "border border-terracotta text-terracotta",
} as const;

export type VarianteBouton = keyof typeof VARIANTES;

export default function Button({
  variante = "principal",
  pleine = true,
  className = "",
  type = "button",
  children,
  ...props
}: {
  variante?: VarianteBouton;
  pleine?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      {...props}
      className={
        "rounded-full t-bouton text-center cursor-pointer min-h-[52px] items-center justify-center gap-[8px] disabled:opacity-50 disabled:cursor-not-allowed " +
        // Un remplissage horizontal imposé par l'appelant (bouton à sa taille) remplace celui par défaut.
        (/(^|\s)px-/.test(className) ? "" : "px-5 ") +
        (pleine ? "flex w-full " : "inline-flex ") +
        VARIANTES[variante] +
        (className ? " " + className : "")
      }
    >
      {children}
    </button>
  );
}
