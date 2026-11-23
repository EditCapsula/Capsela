"use client";

import { useRef, useState } from "react";
import { OCCASIONS } from "@/lib/data";
import { libelleHumeur } from "@/lib/humeur";
import { lireOccasionDecrite } from "@/lib/lectureEvenement";
import { EXEMPLES_OCCASION, EXEMPLES_VEDETTES, exemplesPour, lireNuances, lireOccasionLocale, normaliser, pistesLocales, type OccasionComprise } from "@/lib/occasionSaisie";
import type { OccasionKey } from "@/lib/types";

/*
 * LA BARRE « DÉCRIS TON OCCASION » DE PLANIFIER (22/11/2026, arbitré : en plus des tuiles, au-dessus). La saisie devient une occasion
 * (occasionSaisie.ts : mots-clés d'abord, lecture IA ensuite) ; l'écran la coche dans les tuiles, qui restent la façon de corriger.
 * Ce qui a été compris est TOUJOURS dit : une mauvaise lecture ne se cache pas derrière une tenue. Rien de compris : rien n'est coché.
 *
 * LES PISTES (22/11/2026, demandé : « que le moteur fasse des recommandations d'occasions selon ce qui est saisi ») : quand rien ne
 * tranche, jusqu'à trois occasions plausibles — celles de la lecture IA d'abord, puis les indices locaux (pistesLocales) — en puces à
 * toucher. Rien n'est coché d'office : une piste reste une proposition.
 *
 * PLUS INTELLIGENTE (22/11/2026, demandé ; arbitré : « mieux comprendre », « suggestions en tapant », « exemples cliquables ») :
 *   · barre vide : quelques exemples à toucher (EXEMPLES_VEDETTES) ;
 *   · en tapant : les intitulés qui commencent comme la saisie (exemplesPour), à toucher sans valider ;
 *   · les nuances dites (« chic », « décontracté », « rooftop ») préremplissent la préférence et le lieu (lireNuances) ; quand le texte
 *     est long et que les mots-clés n'en trouvent pas, la lecture IA est aussi consultée pour la nuance, sans changer l'occasion lue.
 */
/** Le nom d'une occasion tel que la tuile le dit, avant son « · » (« Rendez-vous amoureux », « Événement ») : la barre et les tuiles parlent pareil. */
const nomTuile = (o: OccasionKey): string => (OCCASIONS.find(([k]) => k === o)?.[1] ?? o).split(" · ")[0];

type Etat = { nom: "vide" } | { nom: "lecture" } | { nom: "inconnu" } | { nom: "pistes"; pistes: OccasionKey[] } | { nom: "compris"; c: OccasionComprise };

export default function SaisieOccasion({
  choisies,
  gender,
  onComprise,
}: {
  choisies: readonly OccasionKey[];
  gender: "femme" | "homme" | null | undefined;
  /** `texte` : ce que la personne a écrit (ou l'exemple touché), repris au-dessus de la tenue composée (23/11/2026). */
  onComprise: (c: OccasionComprise, texte: string) => void;
}) {
  const [texte, setTexte] = useState("");
  const [etat, setEtat] = useState<Etat>({ nom: "vide" });
  // La saisie lue en dernier : une réponse IA arrivée après une nouvelle frappe ne s'applique pas.
  const derniere = useRef("");

  const choisir = (c: OccasionComprise, lu: string = texte.trim()) => {
    // « Glamour » n'est jamais proposé à un profil homme (humeur.ts) : la nuance n'y est pas reprise.
    const propre = gender === "homme" && c.humeur === "feminin" ? { ...c, humeur: undefined } : c;
    setEtat({ nom: "compris", c: propre });
    onComprise(propre, lu);
  };

  const lire = async (saisie = texte.trim()) => {
    if (!saisie || etat.nom === "lecture") return;
    derniere.current = saisie;
    const locale = lireOccasionLocale(saisie);
    if (locale) {
      choisir(locale, saisie);
      // La nuance par l'IA, seulement si le texte en dit plus que son mot-clé et qu'aucune nuance n'a été lue.
      if (!locale.humeur && normaliser(saisie).split(" ").length >= 3) {
        const lue = await lireOccasionDecrite(saisie);
        if (derniere.current === saisie && lue.humeur && (!lue.occasion || lue.occasion === locale.occasion)) choisir({ ...locale, humeur: lue.humeur }, saisie);
      }
      return;
    }
    setEtat({ nom: "lecture" });
    const lue = await lireOccasionDecrite(saisie);
    if (derniere.current !== saisie) return;
    if (lue.occasion) {
      const nuances = lireNuances(saisie);
      return choisir({
        occasion: lue.occasion,
        ...(nuances.humeur || lue.humeur ? { humeur: nuances.humeur ?? lue.humeur ?? undefined } : {}),
        ...(nuances.typeLieu && lue.occasion === "soiree" ? { typeLieu: nuances.typeLieu } : {}),
      }, saisie);
    }
    const pistes = [...lue.suggestions, ...pistesLocales(saisie)].filter((o, i, t) => t.indexOf(o) === i).slice(0, 3);
    setEtat(pistes.length ? { nom: "pistes", pistes } : { nom: "inconnu" });
  };

  const prendreExemple = (libelle: string) => {
    const e = EXEMPLES_OCCASION.find((x) => x.libelle === libelle);
    if (!e) return;
    setTexte(e.libelle);
    derniere.current = e.libelle;
    const { libelle: _l, titre: _t, ...c } = e;
    void _l;
    void _t;
    choisir(c, e.libelle);
  };

  // La lecture n'est plus dite quand une autre tuile a été choisie depuis : elle ne décrirait plus l'écran.
  const comprisAffiche = etat.nom === "compris" && choisies.includes(etat.c.occasion);
  const propositions = etat.nom === "vide" ? exemplesPour(texte) : [];
  const puce = "inline-flex items-center rounded-full px-[14px] text-[12.5px] font-semibold cursor-pointer border bg-card border-sand-border text-ink";

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
            derniere.current = "";
            setEtat({ nom: "vide" });
          }}
          placeholder="Décris ton occasion…"
          aria-label="Décris ton occasion"
          aria-autocomplete="list"
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

      {/* Barre vide : des exemples à toucher. */}
      {!texte && etat.nom === "vide" && (
        <div className="mt-3 px-1">
          <div className="text-[12px] text-muted-3">Par exemple :</div>
          <div className="flex flex-wrap gap-2 mt-2">
            {EXEMPLES_VEDETTES.map((l) => (
              <button key={l} type="button" onClick={() => prendreExemple(l)} className={puce} style={{ minHeight: 36 }}>
                {l}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* En tapant : les intitulés qui commencent comme la saisie. */}
      {propositions.length > 0 && (
        <ul aria-label="Suggestions d'occasions" className="mt-2 rounded-bloc bg-card border border-border overflow-hidden">
          {propositions.map((e) => (
            <li key={e.libelle} className="border-b border-border last:border-b-0">
              <button type="button" onClick={() => prendreExemple(e.libelle)} className="w-full flex items-center justify-between gap-3 px-4 text-left cursor-pointer" style={{ minHeight: 44 }}>
                <span className="text-[13.5px] text-ink truncate">{e.libelle}</span>
                <span className="text-[11.5px] text-muted-3 flex-shrink-0">{nomTuile(e.occasion)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div role="status" aria-live="polite" className="text-[12px] leading-[1.45] mt-2 px-1">
        {etat.nom === "lecture" && <span className="text-muted-3">Lecture de ton occasion…</span>}
        {comprisAffiche && etat.nom === "compris" && (
          <span className="text-ink-soft">
            Compris :{" "}
            <span className="text-terracotta font-semibold">
              {[nomTuile(etat.c.occasion), etat.c.sousChoix, etat.c.humeur ? libelleHumeur(etat.c.humeur, gender) : null, etat.c.typeLieu].filter(Boolean).join(" · ")}
            </span>
            . Une autre occasion ? Choisis-la ci-dessous.
          </span>
        )}
        {etat.nom === "pistes" && (
          <>
            <span className="text-ink-soft">Ça ressemble à :</span>
            <span className="flex flex-wrap gap-2 mt-2">
              {etat.pistes.map((o) => (
                <button key={o} type="button" onClick={() => choisir({ occasion: o, ...lireNuances(texte) })} className={puce} style={{ minHeight: 40 }}>
                  {nomTuile(o)}
                </button>
              ))}
            </span>
            <span className="block text-muted-3 mt-2">Ou choisis une autre occasion ci-dessous.</span>
          </>
        )}
        {etat.nom === "inconnu" && <span className="text-ink-soft">Cette occasion n&apos;a pas été reconnue : choisis la plus proche ci-dessous.</span>}
      </div>
    </div>
  );
}
