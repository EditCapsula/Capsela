"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { margesDe } from "@/lib/catalogMarges";
import { resolveItemImage } from "@/lib/catalogImages";
import { composerFlatLay } from "@/lib/flatLay";
import type { Item } from "@/lib/types";

/** Hauteur de la zone, en unités de sa largeur (100) : le hero de l'accueil est un peu plus haut que large. */
export const HAUTEUR_FLAT_LAY = 134;

/**
 * LE FLAT LAY ÉDITORIAL DE CAPSELA (08/10/2026) — les pièces d'un look posées comme sur une planche de stylisme : une pièce
 * héro plus grande, les autres autour, de légères inclinaisons et chevauchements, une ombre douce. Aucun cadre, aucun
 * libellé, aucun fond par pièce.
 *
 * `graine` est l'identité du look (ses pièces) : la composition est déterministe — la même graine donne la même planche à
 * chaque rendu — et varie d'un look à l'autre (gabarit ou miroir, tailles et inclinaisons dans leurs plages, cf. flatLay.ts).
 *
 * REMPLIT SON PARENT (position relative, hauteur définie) : la planche garde sa proportion et se centre, comme la planche
 * des autres écrans. `attendre` la garde transparente jusqu'à ce que toutes les images soient chargées (ou en échec), puis
 * `onPret` prévient l'appelant (le fondu depuis la silhouette de chargement).
 */
export function FlatLayCapsela({
  pieces,
  graine,
  attendre = false,
  onPret,
}: {
  pieces: Item[];
  graine: string;
  attendre?: boolean;
  onPret?: () => void;
}) {
  const images = useMemo(() => pieces.map((it) => ({ it, img: resolveItemImage(it) })), [pieces]);
  const composition = useMemo(
    () =>
      composerFlatLay(
        images.map(({ it, img }) => {
          const m = margesDe(img.url);
          // Visuel du catalogue : le ratio de la partie visible ; photo du dressing : un portrait courant ; sans visuel : un carré.
          const ratio = m ? (1 - m.g - m.d) / (1 - m.h - m.b) : img.kind === "placeholder" ? 1 : 0.8;
          return { id: it.id, cat: it.cat, ratio };
        }),
        graine,
        HAUTEUR_FLAT_LAY
      ).pieces,
    [images, graine]
  );

  // Toutes les images chargées (ou en échec) : la planche est prête.
  const attendues = images.filter(({ img }) => img.url).length;
  const chargees = useRef(0);
  const prevenu = useRef(false);
  const aCharge = useCallback(() => {
    chargees.current += 1;
    if (!prevenu.current && chargees.current >= attendues) {
      prevenu.current = true;
      onPret?.();
    }
  }, [attendues, onPret]);
  useEffect(() => {
    if (attendues === 0 && !prevenu.current) {
      prevenu.current = true;
      onPret?.();
    }
  }, [attendues, onPret]);

  if (!composition.length) return null;
  return (
    <div
      className="absolute inset-0 w-full h-full flex items-center justify-center transition-opacity duration-[420ms] ease-out motion-reduce:transition-none"
      style={{ containerType: "size", opacity: attendre ? 0 : 1 }}
    >
      <div style={{ position: "relative", width: `min(100cqw, calc(100cqh * ${100 / HAUTEUR_FLAT_LAY}))`, aspectRatio: `100 / ${HAUTEUR_FLAT_LAY}` }}>
        {composition.map((p) => {
          const entree = images.find(({ it }) => it.id === p.id)!;
          const { it, img } = entree;
          const m = margesDe(img.url);
          const base = {
            position: "absolute" as const,
            left: `${p.x}%`,
            top: `${(p.y / HAUTEUR_FLAT_LAY) * 100}%`,
            width: `${p.l}%`,
            aspectRatio: `${p.l} / ${p.h}`,
            transform: `translate(-50%, -50%) rotate(${p.angle}deg)`,
            zIndex: p.z,
            // Ombre douce, jamais noire : 6 px de décalage, 12 px de flou, 12 % d'opacité.
            filter: "drop-shadow(0 6px 12px rgba(29,26,22,.12))",
          };
          if (img.url && m) {
            const lc = 1 - m.g - m.d;
            const hc = 1 - m.h - m.b;
            return (
              <div key={it.id} data-peint="" style={{ ...base, overflow: "hidden" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={it.name}
                  onLoad={aCharge}
                  onError={aCharge}
                  style={{ position: "absolute", display: "block", maxWidth: "none", width: `${100 / lc}%`, height: `${100 / hc}%`, left: `${(-m.g / lc) * 100}%`, top: `${(-m.h / hc) * 100}%` }}
                />
              </div>
            );
          }
          if (img.url) {
            return (
              <div key={it.id} data-peint="" style={{ ...base, borderRadius: img.kind === "photo" ? 14 : undefined, overflow: "hidden" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={it.name} onLoad={aCharge} onError={aCharge} style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }} />
              </div>
            );
          }
          return <div key={it.id} data-peint="" role="img" aria-label={it.name} style={{ ...base, borderRadius: 14, background: it.hex, opacity: 0.9 }} />;
        })}
      </div>
    </div>
  );
}
