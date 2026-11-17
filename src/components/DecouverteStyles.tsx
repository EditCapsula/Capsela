"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Card from "@/components/Card";
import { BoutonRond, CarteGlissante, FlecheParcours, IconeCoeur, IconeCroix } from "@/components/ParcoursVote";
import { hauteurVisuelStyle } from "@/lib/tailleConteneur";
import { useTailleConteneur } from "@/lib/useTailleConteneur";
import { MAX_STYLES, exposedStyleIds, looksPortesStyle, retirerStyle, styleConfigFor, visuelEtapeStyle, voterStyle, type Gender, type StyleId } from "@/lib/profile";

/*
 * LA DÉCOUVERTE DES STYLES (14/11/2026, brief « Refonte UX/UI – Onboarding Choix des styles »). L'étape Style de l'onboarding ne montre
 * plus une grille de cartes : les styles défilent un à un, comme les suggestions de pièces de la capsule — même carte qui glisse, mêmes
 * ronds, mêmes flèches (ParcoursVote, partagé avec FicheSuggestion). Deux gestes seulement : « Pas pour moi » et « J'aime » ; pas de « Je
 * possède déjà ». Chacun passe au style suivant. Trois styles au plus (MAX_STYLES), bloqués au-delà, jamais substitués (voterStyle).
 *
 * LES STYLES CHOISIS RESTENT VISIBLES (14/11/2026, demandé : « chaque style sélectionné doit rester visible sur la page ») :
 * MesStylesSelectionnes, plus bas, que l'écran pose dans son pied ; le refus d'un quatrième « J'aime » s'y dit (onRefus).
 *
 * Données inchangées : les ids de StyleId, persistés sur `profiles.styles` par l'écran du questionnaire (le brouillon, puis la fin du
 * parcours) ; les libellés, descriptions et visuels de STYLE_CONFIG ; les styles proposés par genre (exposedStyleIds). Le moteur n'est pas
 * touché. Les looks portés (LOOKS_PORTES_STYLE) ne s'affichent que s'ils existent : Minimaliste, Casual chic, Classique chic, Bohème, Streetwear, Preppy, Créatif, Romantique et Glamour côté femme, Minimaliste, Casual chic, Classique chic, Bohème, Streetwear, Preppy et Créatif côté homme au 15/11/2026.
 */

export default function DecouverteStyles({
  gender,
  styles,
  onChange,
  onRefus,
  cibleGestes,
}: {
  gender: Gender | null;
  /** Les styles choisis, dans l'ordre du choix (le premier est le principal), déjà réduits à ceux du genre. */
  styles: string[];
  onChange: (styles: string[]) => void;
  /** Un quatrième « J'aime » refusé : l'écran le dit dans « Mes styles sélectionnés » (le libellé du style refusé). */
  onRefus: (libelle: string | null) => void;
  /**
   * LES GESTES DANS LE PIED (15/11/2026, signalé : « dès que j'ai choisi un style, celui-ci cache les boutons permettant d'en
   * sélectionner d'autres ») : « Mes styles sélectionnés » grandit le pied fixe, et les deux ronds, posés sous la carte, passaient
   * sous le pli. L'écran fournit ici un emplacement de son pied, juste au-dessus des styles choisis : les gestes y sont toujours
   * visibles, quelle que soit la hauteur. Sans emplacement (null, le temps du premier rendu), ils restent sous la carte.
   */
  cibleGestes?: HTMLElement | null;
}) {
  const ids = exposedStyleIds(gender);
  const config = styleConfigFor(gender);
  const [index, setIndex] = useState(0);
  const i = Math.min(index, ids.length - 1);
  const id: StyleId = ids[i];
  const cfg = config[id];
  const choisi = styles.includes(id);
  const visuel = visuelEtapeStyle(gender, id);
  const looks = looksPortesStyle(gender, id);
  // La largeur de la rangée, mesurée : la hauteur du visuel en pixels (17/11/2026, tailleConteneur.ts — sur iPhone avant iOS 16, le
  // cqw ignoré effondrait la carte). Avant la mesure, l'expression d'origine.
  const [rangee, tailleRangee] = useTailleConteneur<HTMLDivElement>();
  const hauteurVisuel = tailleRangee ? `${Math.round(hauteurVisuelStyle(tailleRangee.w, looks.length > 0))}px` : `clamp(160px, ${looks.length > 0 ? 96 : 110}cqw, 460px)`;
  // Après un vote, le style suivant ; au bout, on repart du premier — revenir sur un style garde les choix déjà faits.
  const suivant = () => setIndex((i + 1) % ids.length);
  const voter = (vote: "aime" | "pasPourMoi") => {
    const r = voterStyle(styles, id, vote);
    // Bloqué : on reste sur le style (on ne l'a pas pris), et on dit quoi faire.
    if (r.bloque) return onRefus(cfg.label);
    onRefus(null);
    onChange(r.styles);
    suivant();
  };
  const gestes = (
      <div className="grid grid-cols-2 items-start pt-[8px]">
        <BoutonRond libelle="Pas pour moi" aria={`Pas pour moi : ${cfg.label}, style suivant`} onClick={() => voter("pasPourMoi")}>
          <IconeCroix />
        </BoutonRond>
        <BoutonRond
          libelle="J'aime"
          aria={choisi ? `${cfg.label} est déjà sélectionné : style suivant` : `J'aime : ajouter ${cfg.label} à ma sélection`}
          onClick={() => voter("aime")}
          principal={choisi}
          actif={choisi}
        >
          <IconeCoeur plein={choisi} />
        </BoutonRond>
      </div>
  );
  return (
    <div className="mt-3">
      <Card rayon="carte" className="relative px-[10px] pt-[10px] pb-[12px]" aria-roledescription="carrousel" aria-label="Styles">
        {/* La clé suit le style : la carte repart au centre et entre en fondu, comme une nouvelle suggestion de pièce. */}
        <div key={id} className="motion-safe:animate-[capsule-apparition_240ms_ease-out_both]" aria-live="polite">
          <CarteGlissante onAimer={() => voter("aime")} onRejeter={() => voter("pasPourMoi")}>
            {/* LE FLAT LAY EN ENTIER, LES LOOKS À CÔTÉ (15/11/2026, demandé : « le flat lay n'est pas suffisamment visible, il faut
                qu'on le voie entièrement », après « aucune marge blanche », « plus important que les 3 visuels » et « les éléments de
                la page visibles »). Le flat lay garde son format 3:4 : rien n'est recadré, rien n'est ajouté autour. Les trois looks
                portés s'empilent à sa droite, sur sa hauteur : il reste le grand visuel. LA RANGÉE PREND TOUTE LA LARGEUR DE LA CARTE
                (15/11/2026, signalé dans le navigateur : « il faut exploiter la largeur, là tout est petit ») : sa hauteur suivait celle
                de l'écran, et la barre d'adresse du navigateur la réduisait de moitié. Elle suit désormais la largeur (cqw) ; sur un
                écran court, la page défile jusqu'aux gestes, et glisser la carte vote sans défiler. Sans looks portés, le flat lay
                seul, centré. */}
            <div ref={rangee} style={{ containerType: "inline-size" }}>
              <div
                className="flex justify-center gap-[8px]"
                style={{ ["--h" as string]: hauteurVisuel }}
              >
                <div className="relative flex-none">
                  <div
                    className="rounded-bloc overflow-hidden bg-border"
                    style={{ height: "var(--h)", aspectRatio: "3 / 4" }}
                    onDragStart={(e) => e.preventDefault()}
                  >
                    {visuel && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={visuel} alt="" width={900} height={1200} decoding="async" className="w-full h-full object-cover block" draggable={false} />
                    )}
                  </div>
                </div>
                {/* LES LOOKS PORTÉS : sans clic (LOOKS_PORTES_STYLE) ; un style sans photo n'a pas de galerie (aucune donnée inventée).
                    En 4:5, calés en haut : la tête n'est jamais coupée, seule la marge sous les pieds se réduit. */}
                {looks.length > 0 && (
                  <div className="flex flex-col gap-[8px] flex-none">
                    {looks.slice(0, 3).map((src, k) => (
                      <div key={src} className="rounded-tuile overflow-hidden bg-border" style={{ height: "calc((var(--h) - 16px) / 3)", aspectRatio: "4 / 5" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt={`${cfg.label}, look ${k + 1}`} width={900} height={1200} loading="lazy" decoding="async" className="w-full h-full object-cover object-top block" draggable={false} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="text-center mt-[8px]">
              <div className="t-titre-section text-ink">{cfg.label}</div>
              <div className="text-[12px] text-muted mt-[5px] leading-[1.45] px-4">{cfg.desc}</div>
              <span className="sr-only">
                Style {i + 1} sur {ids.length}
                {choisi ? ", sélectionné" : ""}
              </span>
            </div>
          </CarteGlissante>
        </div>
        {/* LES FLÈCHES AUX EXTRÉMITÉS DU CARROUSEL (15/11/2026, demandé) : sur les bords de la carte, à mi-hauteur, plus sur le flat lay. */}
        <div className="absolute inset-y-0 -left-[14px] -right-[14px] pointer-events-none">
          <div className="relative h-full pointer-events-none [&>button]:pointer-events-auto">
            <FlecheParcours sens="precedente" libelle="Style précédent" onClick={i > 0 ? () => setIndex(i - 1) : undefined} />
            <FlecheParcours sens="suivante" libelle="Style suivant" onClick={i < ids.length - 1 ? () => setIndex(i + 1) : undefined} />
          </div>
        </div>
      </Card>

      {/* LES DEUX GESTES, ceux du parcours de la capsule ; chacun passe au style suivant. J'aime au trait tant que le style n'est pas
          choisi, plein et terracotta une fois choisi. */}
      {cibleGestes ? createPortal(gestes, cibleGestes) : gestes}
    </div>
  );
}

/**
 * MES STYLES SÉLECTIONNÉS (14/11/2026, maquette de la propriétaire) : « Mes styles sélectionnés (N/3) », puis une pastille par style —
 * sa miniature, son nom, sa croix — sur une ligne qui défile. Posée par l'écran du questionnaire dans son pied, au-dessus du bouton : elle
 * reste visible pendant toute l'étape, quelle que soit la hauteur du téléphone (dans la page, elle sortait de l'écran sous 844 px).
 * Toute la pastille est le bouton de retrait, immédiat, sans confirmation (retirerStyle). Le refus d'un quatrième « J'aime » prend un
 * instant la place du titre : juste au-dessus des styles à retirer.
 */
export function MesStylesSelectionnes({
  gender,
  styles,
  onChange,
  refus,
}: {
  gender: Gender | null;
  styles: string[];
  onChange: (styles: string[]) => void;
  /** Le style dont le « J'aime » vient d'être refusé (plafond atteint), ou null. */
  refus: string | null;
}) {
  const config = styleConfigFor(gender);
  const nb = styles.length;
  return (
    <div className="pt-[10px]">
      <div role="status" aria-live="polite" className="min-h-[20px]">
        {refus ? (
          <span className="text-[12px] leading-[20px] text-terracotta-deep">{`${MAX_STYLES} styles au maximum : retire-en un pour ajouter ${refus}.`}</span>
        ) : (
          <span className="t-titre-ligne text-ink">
            Mes styles sélectionnés <span className="text-terracotta-deep">({nb}/{MAX_STYLES})</span>
          </span>
        )}
      </div>
      {nb > 0 && (
        <ul className="scrollarea flex gap-[8px] overflow-x-auto list-none p-0 m-0 mt-[6px] -mx-7 px-7 pb-[2px]">
          {styles.map((s) => {
            const sid = s as StyleId;
            const mini = visuelEtapeStyle(gender, sid);
            return (
              <li key={s} className="flex-none">
                <button
                  type="button"
                  onClick={() => onChange(retirerStyle(styles, s))}
                  aria-label={`Retirer ${config[sid]?.label ?? s} de ma sélection`}
                  className={`inline-flex items-center gap-[7px] min-h-[40px] pl-[4px] pr-[11px] rounded-full border bg-card text-[13px] text-ink whitespace-nowrap cursor-pointer active:opacity-70 ${refus ? "border-terracotta" : "border-border"}`}
                >
                  <span className="w-[30px] h-[30px] rounded-full overflow-hidden bg-border flex-shrink-0">
                    {mini && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mini} alt="" width={30} height={40} decoding="async" className="w-full h-full object-cover block" />
                    )}
                  </span>
                  {config[sid]?.label ?? s}
                  <svg width="11" height="11" viewBox="0 0 14 14" aria-hidden="true" className="text-muted">
                    <path d="M2.5 2.5l9 9M11.5 2.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
