"use client";

import { useState } from "react";
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

/**
 * CHAMP MOT DE PASSE (02/11/2026, demandé : « une icône pour voir le mot de passe dans les champs, pas un lien en dessous »). L'œil est
 * DANS le champ, à droite, dans une cible de 44 px ; il bascule l'affichage de ce seul champ. Connexion, création de compte et
 * nouveau mot de passe l'utilisent tous : un seul dessin, un seul comportement.
 */
export function ChampMotDePasse({ className = "", ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className={"pr-[48px]" + (className ? " " + className : "")} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        aria-pressed={visible}
        className="absolute right-[2px] top-1/2 -translate-y-1/2 w-[44px] h-[44px] flex items-center justify-center text-muted cursor-pointer"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
          {visible && <path d="M4 4l16 16" />}
        </svg>
      </button>
    </div>
  );
}
