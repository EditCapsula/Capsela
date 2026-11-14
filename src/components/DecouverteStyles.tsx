"use client";

import { useState } from "react";
import Card from "@/components/Card";
import { BoutonRond, CarteGlissante, FlecheParcours, IconeCoeur, IconeCroix } from "@/components/ParcoursVote";
import { MAX_STYLES, exposedStyleIds, looksPortesStyle, styleConfigFor, visuelEtapeStyle, voterStyle, type Gender, type StyleId } from "@/lib/profile";

/*
 * LA DÉCOUVERTE DES STYLES (14/11/2026, brief « Refonte UX/UI – Onboarding Choix des styles »). L'étape Style de l'onboarding ne montre
 * plus une grille de cartes : les styles défilent un à un, comme les suggestions de pièces de la capsule — même carte qui glisse, mêmes
 * ronds, mêmes flèches (ParcoursVote, partagé avec FicheSuggestion). Deux gestes seulement : « Pas pour moi » et « J'aime » ; pas de « Je
 * possède déjà ». Trois styles au plus (MAX_STYLES), bloqués au-delà, jamais substitués (voterStyle).
 *
 * Données inchangées : les ids de StyleId, persistés sur `profiles.styles` par l'écran du questionnaire (le brouillon, puis la fin du
 * parcours) ; les libellés, descriptions et visuels de STYLE_CONFIG ; les styles proposés par genre (exposedStyleIds). Le moteur n'est pas
 * touché. Les looks portés (LOOKS_PORTES_STYLE) ne s'affichent que s'ils existent : aucun n'est encore fourni.
 */
export default function DecouverteStyles({
  gender,
  styles,
  onChange,
  onBloque,
}: {
  gender: Gender | null;
  /** Les styles choisis, dans l'ordre du choix (le premier est le principal), déjà réduits à ceux du genre. */
  styles: string[];
  onChange: (styles: string[]) => void;
  /** Un quatrième « J'aime » : l'écran dit pourquoi (la bulle existante de l'étape). */
  onBloque: () => void;
}) {
  const ids = exposedStyleIds(gender);
  const config = styleConfigFor(gender);
  const [index, setIndex] = useState(0);
  const i = Math.min(index, ids.length - 1);
  const id: StyleId = ids[i];
  const cfg = config[id];
  const choisi = styles.includes(id);
  const nb = styles.length;
  const visuel = visuelEtapeStyle(gender, id);
  const looks = looksPortesStyle(gender, id);
  // Après un vote, le style suivant ; au bout, on repart du premier — revenir sur un style garde les choix déjà faits.
  const suivant = () => setIndex((i + 1) % ids.length);
  const voter = (vote: "aime" | "pasPourMoi") => {
    const r = voterStyle(styles, id, vote);
    if (r.bloque) return onBloque();
    onChange(r.styles);
    // Défaire un cœur (J'aime sur un style déjà choisi) reste sur le style : on vient de le regarder.
    if (!(vote === "aime" && choisi)) suivant();
  };

  return (
    <div className="mt-3">
      <Card rayon="carte" className="relative px-[14px] pt-[14px] pb-[16px]" aria-roledescription="carrousel" aria-label="Styles">
        {/* La clé suit le style : la carte repart au centre et entre en fondu, comme une nouvelle suggestion de pièce. */}
        <div key={id} className="motion-safe:animate-[capsule-apparition_240ms_ease-out_both]" aria-live="polite">
          <CarteGlissante onAimer={() => voter("aime")} onRejeter={() => voter("pasPourMoi")}>
            <div className="relative">
              {/* Le flat lay du style, en grand : carré, centré (le visuel 3:4 est recadré au centre), borné par la hauteur de l'écran
                  pour que les deux gestes restent visibles sans défiler. */}
              <div
                className="mx-auto rounded-bloc overflow-hidden bg-border"
                style={{ width: "min(100%, 31vh)", aspectRatio: "1 / 1" }}
                onDragStart={(e) => e.preventDefault()}
              >
                {visuel && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={visuel} alt="" width={900} height={1200} decoding="async" className="w-full h-full object-cover block" draggable={false} />
                )}
              </div>
              <FlecheParcours sens="precedente" libelle="Style précédent" onClick={i > 0 ? () => setIndex(i - 1) : undefined} />
              <FlecheParcours sens="suivante" libelle="Style suivant" onClick={i < ids.length - 1 ? () => setIndex(i + 1) : undefined} />
            </div>
            <div className="text-center mt-[12px]">
              <div className="t-titre-section text-ink">{cfg.label}</div>
              <div className="text-[12px] text-muted mt-[5px] leading-[1.45] px-4">{cfg.desc}</div>
              <span className="sr-only">
                Style {i + 1} sur {ids.length}
                {choisi ? ", sélectionné" : ""}
              </span>
            </div>
            {/* LES LOOKS PORTÉS : trois photos côte à côte, dans la carte, sans clic. Aucune n'est encore fournie : sans photo, pas de
                galerie (aucune donnée inventée). */}
            {looks.length > 0 && (
              <div className="grid grid-cols-3 gap-[8px] mt-[14px]">
                {looks.slice(0, 3).map((src, k) => (
                  <div key={src} className="rounded-tuile overflow-hidden bg-border" style={{ aspectRatio: "3 / 4" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`${cfg.label}, look ${k + 1}`} width={900} height={1200} loading="lazy" decoding="async" className="w-full h-full object-cover block" draggable={false} />
                  </div>
                ))}
              </div>
            )}
          </CarteGlissante>
        </div>
      </Card>

      {/* LES DEUX GESTES, ceux du parcours de la capsule. J'aime au trait tant que le style n'est pas choisi, plein et terracotta une
          fois choisi (un second appui le retire). */}
      <div className="grid grid-cols-2 items-start mt-[10px]">
        <BoutonRond libelle="Pas pour moi" aria={`Pas pour moi : ${cfg.label}, style suivant`} onClick={() => voter("pasPourMoi")}>
          <IconeCroix />
        </BoutonRond>
        <BoutonRond
          libelle="J'aime"
          aria={choisi ? `${cfg.label} est sélectionné : retirer de ma sélection` : `J'aime : ajouter ${cfg.label} à ma sélection`}
          onClick={() => voter("aime")}
          principal={choisi}
          actif={choisi}
        >
          <IconeCoeur plein={choisi} />
        </BoutonRond>
      </div>

      {/* OÙ EN EST LA SÉLECTION : 0/3 à 3/3, toujours visible (le brief), coche dès le premier style. */}
      <div className="flex justify-center mt-2">
        <div
          role="status"
          aria-live="polite"
          className={`inline-flex items-center gap-[7px] rounded-full border px-[14px] min-h-[34px] text-[12.5px] ${nb > 0 ? "border-sand-border bg-warm-bg text-terracotta-deep" : "border-border bg-card text-muted"}`}
        >
          {nb > 0 && (
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="10" fill="currentColor" />
              <path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="var(--color-cream)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {nb}/{MAX_STYLES} styles sélectionnés
        </div>
      </div>
    </div>
  );
}
