"use client";

import { useState } from "react";
import { occasionShortLabel } from "@/lib/data";
import { lireNomEvenement } from "@/lib/lectureEvenement";
import { lireOccasionLocale, type OccasionComprise } from "@/lib/occasionSaisie";
import type { OccasionKey } from "@/lib/types";

/*
 * LA BARRE « DÉCRIS TON OCCASION » DE PLANIFIER (22/11/2026, arbitré : en plus des tuiles, au-dessus). La saisie devient une occasion
 * (occasionSaisie.ts : mots-clés d'abord, lecture IA ensuite) ; l'écran la coche dans les tuiles, qui restent la façon de corriger.
 * Ce qui a été compris est TOUJOURS dit : une mauvaise lecture ne se cache pas derrière une tenue. Rien de compris : rien n'est coché.
 */
export default function SaisieOccasion({ choisies, onComprise }: { choisies: readonly OccasionKey[]; onComprise: (c: OccasionComprise) => void }) {
  const [texte, setTexte] = useState("");
  const [etat, setEtat] = useState<{ nom: "vide" } | { nom: "lecture" } | { nom: "inconnu" } | { nom: "compris"; c: OccasionComprise }>({ nom: "vide" });

  const lire = async () => {
    const saisie = texte.trim();
    if (!saisie || etat.nom === "lecture") return;
    const locale = lireOccasionLocale(saisie);
    if (locale) {
      setEtat({ nom: "compris", c: locale });
      onComprise(locale);
      return;
    }
    setEtat({ nom: "lecture" });
    const lue = await lireNomEvenement(saisie);
    if (lue) {
      const c = { occasion: lue };
      setEtat({ nom: "compris", c });
      onComprise(c);
    } else setEtat({ nom: "inconnu" });
  };

  // La lecture n'est plus dite quand une autre tuile a été choisie depuis : elle ne décrirait plus l'écran.
  const comprisAffiche = etat.nom === "compris" && choisies.includes(etat.c.occasion);

  return (
    <div className="mt-5">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void lire();
        }}
        className="flex items-center gap-[10px] h-[48px] pl-[16px] pr-[6px] rounded-full bg-card border"
        style={{ borderColor: texte ? "var(--color-terracotta-deep)" : "var(--color-border)" }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" className="flex-shrink-0 text-muted-3" style={{ display: "block" }}>
          <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="6" />
            <path d="M20 20l-4.5-4.5" />
          </g>
        </svg>
        <input
          type="search"
          enterKeyHint="search"
          value={texte}
          maxLength={60}
          onChange={(e) => {
            setTexte(e.target.value);
            if (etat.nom !== "lecture") setEtat({ nom: "vide" });
          }}
          placeholder="Décris ton occasion : mariage, entretien…"
          aria-label="Décris ton occasion"
          className="flex-1 min-w-0 h-full bg-transparent outline-none text-[13.5px] font-medium text-ink placeholder:text-placeholder appearance-none [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
        />
        <button
          type="submit"
          disabled={!texte.trim() || etat.nom === "lecture"}
          aria-label="Trouver l'occasion"
          className="w-[36px] h-[36px] flex-shrink-0 rounded-full bg-terracotta text-cream flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-default"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
            <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </form>
      <div role="status" aria-live="polite" className="text-[12px] leading-[1.45] mt-2 px-1 min-h-[18px]">
        {etat.nom === "lecture" && <span className="text-muted-3">Lecture de ton occasion…</span>}
        {comprisAffiche && etat.nom === "compris" && (
          <span className="text-ink-soft">
            Compris : <span className="text-terracotta font-semibold">{occasionShortLabel(etat.c.occasion)}{etat.c.sousChoix ? ` · ${etat.c.sousChoix}` : ""}</span>. Une autre
            occasion ? Choisis-la ci-dessous.
          </span>
        )}
        {etat.nom === "inconnu" && <span className="text-ink-soft">Cette occasion n&apos;a pas été reconnue : choisis la plus proche ci-dessous.</span>}
      </div>
    </div>
  );
}
