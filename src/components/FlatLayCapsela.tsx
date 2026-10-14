"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DESSINS_SILHOUETTE } from "@/lib/silhouetteFlatLay";
import { margesDe, objectBounds, ratioHero } from "@/lib/catalogMarges";
import { resolveHeroImage } from "@/lib/catalogImages";
import { composerFlatLay, hauteurDuContexte, type ContexteFlatLay } from "@/lib/flatLay";
import { choisirTemplate } from "@/lib/flatLayTemplates";
import type { CategoryKey, Item } from "@/lib/types";

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
const AUCUNE_CATEGORIE: CategoryKey[] = [];
const AUCUN_AJOUT: { item: Item; onAjouter: () => void }[] = [];
/** Ce que dit le bouton d'une silhouette actionnable (lecteur d'écran) : seules les catégories posées en silhouette par un écran. */
const LIBELLE_AJOUT: Partial<Record<CategoryKey, string>> = { veste: "une veste", manteau: "un manteau", chaussures: "une paire de chaussures" };

export function FlatLayCapsela({
  items,
  context = "hero-home",
  layoutSeed,
  attendre = false,
  onPret,
  ombre = "douce",
  templates = true,
  fantomes = AUCUNE_CATEGORIE,
  onPiece,
  ajouts = AUCUN_AJOUT,
  onFantome,
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
  /**
   * Les six templates (flatLayTemplates.ts, 13/10/2026) : le gabarit est choisi sur les pièces réellement posées ; sans template adapté, ou
   * `false`, le moteur compose comme avant. Le contexte décide s'il en accepte un (look-detail, hero-home).
   */
  templates?: boolean;
  /**
   * Des pièces MANQUANTES posées en silhouette (14/10/2026, demandé : « intègre dans le hero une paire de chaussures comme sur l'écran de
   * chargement ») : le dessin de chargement de la catégorie, à la place et à la taille qu'aurait la pièce, estompé. Jamais une pièce de
   * la tenue : elle n'est ni comptée, ni cliquable, ni enregistrée.
   */
  fantomes?: CategoryKey[];
  /** Rend chaque pièce cliquable (hero) : elle ouvre sa fiche. Les silhouettes ne le sont jamais. */
  onPiece?: (it: Item) => void;
  /**
   * Des pièces CONSEILLÉES, pas encore dans la tenue (14/10/2026, demandé : « la veste à ajouter, directement dans le hero, avec un + ») :
   * posées à leur place, estompées, avec un « + » qui les ajoute. Elles ne comptent dans la tenue qu'une fois ajoutées.
   */
  ajouts?: { item: Item; onAjouter: () => void }[];
  /**
   * Rend les silhouettes actionnables (14/10/2026, demandé : « quand il manque une pièce, ajouter une pièce veste avec un + dans le
   * hero ; au clic, l'ajout de pièces ») : un « + » sur la silhouette, qui ouvre l'ajout d'une pièce de SA catégorie. Sans lui, elles
   * restent décoratives.
   */
  onFantome?: (cat: CategoryKey) => void;
}) {
  // LA ZONE PREND LE FORMAT DE SON CADRE (14/10/2026, « exploiter tout l'espace alloué au flat lay ») : la planche gardait le format fixe
  // du contexte et laissait vides les bords d'un cadre plus large ou plus haut. Mesurée avant la peinture ; bornée entre le carré et
  // 140 (au-delà, les gabarits n'ont pas été pensés pour). Sans mesure (premier rendu, cadre nul) : le format du contexte.
  const cadre = useRef<HTMLDivElement>(null);
  const [formatCadre, setFormatCadre] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = cadre.current;
    if (!el) return;
    const lire = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) setFormatCadre(Math.round(Math.min(140, Math.max(100, (100 * height) / width))));
    };
    lire();
    const ro = new ResizeObserver(lire);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const HAUTEUR = formatCadre ?? hauteurDuContexte(context);
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
    const base = avecImage.length ? avecImage : toutes;
    const ombres = fantomes.flatMap((cat, i) => {
      const dessin = DESSINS_SILHOUETTE[cat];
      if (!dessin) return [];
      const it = { id: -(i + 1), cat, name: "Pièce à ajouter", hex: "#d9cbb6" } as unknown as Item;
      return [{ it, img: { kind: "generated" as const, url: dessin.src }, fantome: dessin.ratio }];
    });
    const conseils = ajouts
      .filter(({ item }) => !items.some((i) => i.id === item.id))
      .map(({ item, onAjouter }) => ({ it: item, img: resolveHeroImage(item), fantome: undefined as number | undefined, ajout: onAjouter }))
      // Comme les pièces de la tenue : sans visuel, la pièce n'est posée que si AUCUNE pièce n'en a (pastilles du mode démo).
      .filter(({ img }) => img.url || avecImage.length === 0);
    return [...base.map((e) => ({ ...e, fantome: undefined as number | undefined, ajout: undefined as (() => void) | undefined })), ...ombres.map((o) => ({ ...o, ajout: undefined as (() => void) | undefined })), ...conseils];
  }, [items, context, fantomes, ajouts]);
  const template = useMemo(
    // Pas de template sur l'accueil (14/10/2026) : jamais validé en rendu réel dans ce contexte (seul look-detail l'a été), et une tenue y a
    // paru sans ses chaussures. Le moteur d'origine y compose seul ; le moteur de templates sait le faire (flatLay.ts), il faut juste le valider.
    () => (templates && context !== "hero-home" ? choisirTemplate(images.map(({ it }) => ({ cat: it.cat, subtype: it.subtype, name: it.name }))) : null),
    [images, templates, context]
  );
  const composition = useMemo(
    () =>
      composerFlatLay(
        images.map(({ it, img, fantome }) => {
          if (fantome) return { id: it.id, cat: it.cat, ratio: fantome, visualScale: 1.35 };
          // La boîte réelle de l'objet (objectBounds) : son format fait la taille. Photo du dressing sans boîte connue : un portrait courant ; sans visuel : un carré.
          const b = objectBounds(img.url);
          const ratio = b ? (b.width * (ratioHero(img.url) ?? 1)) / b.height : img.kind === "placeholder" ? 1 : 0.8;
          return { id: it.id, cat: it.cat, ratio, accessoireType: it.accessoireType, photoBrute: img.kind === "photo" };
        }),
        graine,
        { contexte: context, template, piecesEnPlus: images.filter((e) => e.ajout).length, hauteurZone: HAUTEUR }
      ).pieces,
    [images, graine, context, template, HAUTEUR]
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

  return (
    <div
      ref={cadre}
      className="absolute inset-0 w-full h-full flex items-center justify-center transition-opacity duration-[420ms] ease-out motion-reduce:transition-none"
      // `isolation` : les profondeurs des pièces (jusqu'à 60) restent DANS la planche. Sans elle, le sac passait par-dessus la barre
      // du bas (z-20) dès que la planche défilait dessous — corrigé le 08/10/2026 après le passage des profondeurs en dizaines.
      // Une planche vide reste montée (le cadre se mesure) mais ne capte aucun geste destiné à ce qui est dessous.
      style={{ containerType: "size", opacity: attendre ? 0 : 1, isolation: "isolate", pointerEvents: composition.length ? undefined : "none" }}
    >
      <div style={{ position: "relative", width: `min(100cqw, calc(100cqh * ${100 / HAUTEUR}))`, aspectRatio: `100 / ${HAUTEUR}` }}>
        {composition.map((p) => {
          const entree = images.find(({ it }) => it.id === p.id)!;
          const { it, img, fantome, ajout } = entree;
          const m = fantome ? null : margesDe(img.url);
          const cliquable = onPiece && !fantome
            ? {
                role: "button" as const,
                tabIndex: 0,
                "aria-label": `${it.name}. Voir le détail`,
                onClick: () => onPiece(it),
                onKeyDown: (e: React.KeyboardEvent) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onPiece(it);
                  }
                },
              }
            : {};
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
          if (fantome) {
            // La silhouette : estompée, sans ombre portée — elle dit ce qui manque, elle ne prétend pas être une pièce.
            const dessin = (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img.url} alt="" onLoad={aCharge} onError={aCharge} style={{ display: "block", width: "100%", height: "100%", objectFit: "contain", opacity: 0.5 }} />
            );
            if (!onFantome) {
              return (
                <div key={it.id} aria-hidden="true" style={{ ...base, filter: "none" }}>
                  {dessin}
                </div>
              );
            }
            // Actionnable : toute la silhouette ouvre l'ajout d'une pièce de sa catégorie. Son « + » est posé dans le calque du dessus
            // (cf. plus bas), avec celui des pièces conseillées.
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => onFantome(it.cat)}
                aria-label={`Ajouter ${LIBELLE_AJOUT[it.cat] ?? "une pièce"} à ton dressing`}
                className="cursor-pointer"
                style={{ ...base, filter: "none", padding: 0, border: "none", background: "transparent" }}
              >
                {dessin}
              </button>
            );
          }
          if (ajout) {
            // La pièce conseillée : estompée à sa place, un « + » pour l'ajouter. Le reste de la pièce ouvre sa fiche, comme les autres.
            const lc = m ? 1 - m.g - m.d : 1;
            const hc = m ? 1 - m.h - m.b : 1;
            return (
              <div key={it.id} data-peint="" style={{ ...base, overflow: "visible" }}>
                <div {...cliquable} style={{ position: "absolute", inset: 0, overflow: "hidden", opacity: 0.55, cursor: onPiece ? "pointer" : undefined, ...(img.url ? {} : { borderRadius: 14, background: it.hex }) }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {img.url && <img
                    src={img.url}
                    alt={it.name}
                    onLoad={aCharge}
                    onError={aCharge}
                    style={
                      m
                        ? { position: "absolute", display: "block", maxWidth: "none", width: `${100 / lc}%`, height: `${100 / hc}%`, left: `${(-m.g / lc) * 100}%`, top: `${(-m.h / hc) * 100}%` }
                        : { display: "block", width: "100%", height: "100%", objectFit: "contain" }
                    }
                  />}
                </div>
              </div>
            );
          }
          if (img.url && m) {
            const lc = 1 - m.g - m.d;
            const hc = 1 - m.h - m.b;
            return (
              <div key={it.id} data-peint="" {...cliquable} style={{ ...base, overflow: "hidden", cursor: onPiece ? "pointer" : undefined }}>
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
              <div key={it.id} data-peint="" {...cliquable} style={{ ...base, borderRadius: img.kind === "photo" ? 14 : undefined, overflow: "hidden", cursor: onPiece ? "pointer" : undefined }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={it.name} onLoad={aCharge} onError={aCharge} style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }} />
              </div>
            );
          }
          return <div key={it.id} data-peint="" role={onPiece ? "button" : "img"} aria-label={it.name} {...(onPiece ? { tabIndex: 0, onClick: () => onPiece(it) } : {})} style={{ ...base, borderRadius: 14, background: it.hex, opacity: 0.9, cursor: onPiece ? "pointer" : undefined }} />;
        })}
        {/* LES « + » DANS UN CALQUE AU-DESSUS DE LA PLANCHE (14/10/2026) : posés dans leur pièce, ils prenaient sa profondeur et passaient
            sous les pièces voisines (capture : la silhouette de veste, son « + » couvert par le haut). Au coin haut droit de la boîte de la
            pièce, sans suivre son inclinaison (quelques degrés). */}
        {composition.map((p) => {
          const { it, fantome, ajout } = images.find(({ it }) => it.id === p.id)!;
          const action = ajout ?? (fantome && onFantome ? () => onFantome(it.cat) : null);
          if (!action) return null;
          return (
            <button
              key={`plus-${it.id}`}
              type="button"
              onClick={action}
              // La silhouette est déjà un bouton (même action) : son « + » ne fait pas double emploi au clavier ni au lecteur d'écran.
              {...(ajout ? { "aria-label": `Ajouter ${it.name} à la tenue` } : { "aria-hidden": true, tabIndex: -1 })}
              className="absolute flex items-center justify-center rounded-full bg-terracotta-deep text-cream cursor-pointer"
              style={{
                left: `${p.x + p.l / 2}%`,
                top: `${((p.y - p.h / 2) / HAUTEUR) * 100}%`,
                transform: "translate(-70%, -30%)",
                width: 30,
                height: 30,
                zIndex: 100,
                boxShadow: "0 2px 6px rgba(29,26,22,.25)",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
                <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
}
