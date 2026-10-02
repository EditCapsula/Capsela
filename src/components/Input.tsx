import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";

/**
 * LE CHAMP DE SAISIE (02/10/2026, audit design system : « chaque écran a ses propres champs stylés en dur »).
 * Un seul style pour les champs de texte, de date et de liste : fond de carte, filet fin, coin `bloc`,
 * 14 px, `font-sans`, pleine largeur. `capin` retire le contour du navigateur et colore le texte d'aide
 * (globals.css). Marges, remplissage horizontal particulier (`pr-[46px]` pour un bouton « œil ») et
 * `ref`, `aria-*`, `type`… se passent comme sur un `<input>`.
 *
 * Non concernés : les champs posés DANS une ligne (fond transparent, sans filet : heure de réception,
 * dates de la valise) — ce ne sont pas des champs autonomes.
 */
const CHAMP = "capin bg-card border border-border rounded-bloc px-[17px] py-[15px] text-[14px] text-ink font-sans";

/** Pleine largeur, sauf si l'appelant impose la sienne (`w-[120px]`). */
const largeur = (className: string) => (/(^|\s)w-/.test(className) ? "" : " w-full");

export default function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={CHAMP + largeur(className) + (className ? " " + className : "")} />;
}

export function Select({ className = "", children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={CHAMP + largeur(className) + (className ? " " + className : "")}>
      {children}
    </select>
  );
}
