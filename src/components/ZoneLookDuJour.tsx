"use client";

import { useCallback, useEffect, useState } from "react";
import { OutfitComposition, SilhouettePlanche } from "@/components/OutfitComposition";
import type { CategoryKey, Item } from "@/lib/types";

/** Au-delà, la planche apparaît même si une image tarde : la silhouette ne doit pas masquer un look prêt. */
const ATTENTE_MAX_IMAGES = 2500;

/**
 * LA ZONE DE COMPOSITION DE LA CARD « LOOK DU JOUR » — du chargement au look
 * (30/09/2026, brief « Optimisation du loading »).
 *
 * Une seule zone, de même proportion dans les deux états et qui reste montée
 * de l'un à l'autre : la card ne change pas de hauteur à l'arrivée du look.
 * Deux calques superposés :
 *   · la SILHOUETTE (SilhouettePlanche), des dessins de vêtements aux
 *     emplacements de la planche ;
 *   · la PLANCHE du look (OutfitComposition "planche"), transparente tant que
 *     ses images ne sont pas chargées et cadrées.
 * Quand la planche est prête, elle apparaît en fondu pendant que la
 * silhouette s'efface (420 ms) ; ses formes étaient aux mêmes emplacements.
 *
 * Les formes suivent ce qu'on sait du look :
 *   · avant la tenue, `categoriesAttendues` (cf. l'appelant) ;
 *   · dès qu'elle est composée, ses catégories réelles — robe, surcouche,
 *     jupe… — et, pour le haut photographié, un cadre de photo : le temps que
 *     ses images arrivent.
 *
 * La chorégraphie ne vaut que pour la PREMIÈRE arrivée d'un look après le
 * chargement : une tenue qui en remplace une autre (« Pas pour moi », autre
 * jour) s'affiche comme avant, sans repasser par la silhouette.
 */
export function ZoneLookDuJour({ pieces, categoriesAttendues, accentHero = false }: { pieces: Item[]; categoriesAttendues: CategoryKey[]; accentHero?: boolean }) {
  const [apparue, setApparue] = useState(false);
  const [effacee, setEffacee] = useState(false);
  // Retour au chargement : la prochaine tenue repassera par la silhouette.
  if (!pieces.length && (apparue || effacee)) {
    setApparue(false);
    setEffacee(false);
  }
  const reveler = useCallback(() => setApparue(true), []);
  useEffect(() => {
    if (!pieces.length || apparue) return;
    const t = setTimeout(reveler, ATTENTE_MAX_IMAGES);
    return () => clearTimeout(t);
  }, [pieces.length, apparue, reveler]);

  const formes = pieces.length ? pieces : categoriesAttendues.map((cat) => ({ cat }));
  return (
    <div className="relative w-full h-full">
      {!effacee && (
        <div
          className="absolute inset-0 transition-opacity duration-[420ms] ease-out motion-reduce:transition-none"
          style={{ opacity: apparue ? 0 : 1 }}
          onTransitionEnd={(e) => {
            if (apparue && e.target === e.currentTarget) setEffacee(true);
          }}
        >
          <SilhouettePlanche formes={formes} accentHero={accentHero} />
        </div>
      )}
      <div className="absolute inset-0">
        <OutfitComposition items={pieces} variant="planche" attendreCadrage={!apparue} onCadree={reveler} accentHero={accentHero} />
      </div>
    </div>
  );
}

/**
 * La ligne d'attente (sur le fond sable du hero depuis la maquette V9, 07/10/2026 : texte en gris foncé, aligné à gauche), sous la composition : une étoile qui pulse, le texte,
 * trois points qui s'allument à tour de rôle — à la place de l'anneau qui
 * tournait. Même hauteur que le CTA « Découvrir le look », dont elle tient la
 * place : la card ne grandit pas quand il arrive.
 */
export function StatutComposition() {
  return (
    <div
      // Même entrée différée que le reste du chargement : rien ne clignote si le look est prêt vite.
      className="mt-[12px] flex items-center gap-[8px] text-[12px] motion-safe:animate-[capsule-apparition_260ms_ease-out_300ms_both]"
      style={{ minHeight: 50, color: "var(--color-muted-3)" }}
    >
      <span aria-hidden="true" className="etoile-pouls font-serif italic text-[13px] leading-none">
        ✦
      </span>
      Sélection des pièces en cours
      <span aria-hidden="true" className="flex items-center gap-[4px] pt-[3px]">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="point-suite block rounded-full"
            style={{ width: 3.5, height: 3.5, background: "currentColor", animationDelay: `${i * 220}ms` }}
          />
        ))}
      </span>
    </div>
  );
}
