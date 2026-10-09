"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { margesDe, objectBounds, ratioHero } from "@/lib/catalogMarges";
import { resolveHeroImage } from "@/lib/catalogImages";
import { composerFlatLay, hauteurDuContexte, type ContexteFlatLay } from "@/lib/flatLay";
import type { Item } from "@/lib/types";

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
  items,
  context = "hero-home",
  layoutSeed,
  attendre = false,
  onPret,
  ombre = "douce",
}: {
  items: Item[];
  /** Où la planche s'affiche : elle règle la zone, la marge, le gabarit et le nombre d'accessoires (cf. CONTEXTES dans flatLay.ts). */
  context?: ContexteFlatLay;
  /** L'identité du look : la même graine donne toujours la même planche. */
  layoutSeed: string;
  attendre?: boolean;
  onPret?: () => void;
  /**
   * L'ombre des pièces. « douce » (défaut) : celle du hero et de la Tenue du jour. « marquee » (09/10/2026, « Tes looks » du
   * Dressing, sur un fond plus soutenu) : une ombre de contact serrée sous une ombre diffuse, pour que chaque pièce se
   * détache du fond sans paraître flotter. Jamais noire.
   */
  ombre?: "douce" | "marquee";
}) {
  const HAUTEUR = hauteurDuContexte(context);
  const graine = layoutSeed;
  const images = useMemo(() => {
    const toutes = items.map((it) => {
      const img = resolveHeroImage(it);
      // Sur l'accueil, une photo brute (parfois une personne) cède la place au visuel produit déjà généré pour la même pièce, s'il existe :
      // un asset existant, jamais un nouveau (09/10/2026).
      if (context === "hero-home" && img.kind === "photo" && it.imageUrl && it.imageStatus === "ready")
        return { it, img: { kind: "generated" as const, url: it.imageHeroUrl ?? it.imageUrl } };
      return { it, img };
    });
    // Une pièce sans visuel ne laisse ni vide ni pastille de couleur (calibrage du 08/10/2026) : elle sort de la planche, qui se
    // recalcule avec les pièces qui ont une image. Aucune n'en a (mode démo, catalogue hors ligne) : on garde les pastilles.
    const avecImage = toutes.filter(({ img }) => img.url);
    return avecImage.length ? avecImage : toutes;
  }, [items, context]);
  const composition = useMemo(
    () =>
      composerFlatLay(
        images.map(({ it, img }) => {
          // La boîte réelle de l'objet (objectBounds) : son format fait la taille. Photo du dressing sans boîte connue : un portrait courant ; sans visuel : un carré.
          const b = objectBounds(img.url);
          const ratio = b ? (b.width * (ratioHero(img.url) ?? 1)) / b.height : img.kind === "placeholder" ? 1 : 0.8;
          return { id: it.id, cat: it.cat, ratio, accessoireType: it.accessoireType, photoBrute: img.kind === "photo" };
        }),
        graine,
        { contexte: context }
      ).pieces,
    [images, graine, context]
  );

  // Toutes les images chargées (ou en échec) : la planche est prête.
  // Seules les pièces POSÉES se chargent : une pièce masquée (le t-shirt de l'accueil) ou écartée ne monte jamais son image.
  const attendues = composition.filter((q) => images.find(({ it }) => it.id === q.id)?.img.url).length;
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
      // `isolation` : les profondeurs des pièces (jusqu'à 60) restent DANS la planche. Sans elle, le sac passait par-dessus la barre
      // du bas (z-20) dès que la planche défilait dessous — corrigé le 08/10/2026 après le passage des profondeurs en dizaines.
      style={{ containerType: "size", opacity: attendre ? 0 : 1, isolation: "isolate" }}
    >
      <div style={{ position: "relative", width: `min(100cqw, calc(100cqh * ${100 / HAUTEUR}))`, aspectRatio: `100 / ${HAUTEUR}` }}>
        {composition.map((p) => {
          const entree = images.find(({ it }) => it.id === p.id)!;
          const { it, img } = entree;
          const m = margesDe(img.url);
          const base = {
            position: "absolute" as const,
            left: `${p.x}%`,
            top: `${(p.y / HAUTEUR) * 100}%`,
            width: `${p.l}%`,
            aspectRatio: `${p.l} / ${p.h}`,
            // Une pièce droite n'a aucune rotation CSS (accueil, 09/10/2026) : pas de rotate(0deg) pour autant.
            transform: p.angle === 0 ? "translate(-50%, -50%)" : `translate(-50%, -50%) rotate(${p.angle}deg)`,
            zIndex: p.z,
            // Ombre douce, jamais noire : 6 px de décalage, 12 px de flou, 12 % d'opacité.
            filter:
              ombre === "marquee"
                ? "drop-shadow(0 1px 1.5px rgba(29,26,22,.22)) drop-shadow(0 7px 12px rgba(29,26,22,.18))"
                : "drop-shadow(0 6px 12px rgba(29,26,22,.12))",
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
