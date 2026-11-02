"use client";

import { useState } from "react";
import { margeVignette } from "@/lib/capsuleEcran";
import { resolvePhotoCatalogue } from "@/lib/catalogImages";
import { analyserImage, placementDansCadre, type Analyse } from "@/lib/cadrageImage";
import type { Item } from "@/lib/types";

/*
 * LA VIGNETTE D'UNE PIÈCE DE LA CAPSULE — sortie de CapsuleScreen le 02/11/2026 pour servir aussi la fiche d'une suggestion
 * (FicheSuggestion), sans la dupliquer. Inchangée : présence normalisée, cadrage mesuré, placeholder pendant la génération.
 */

/**
 * Mesures déjà faites, par URL, pour toute la session : une image n'est
 * analysée qu'une fois, quel que soit le nombre de vignettes qui la montrent.
 * null = mesure impossible, on garde l'affichage contenu.
 */
const cadrages = new Map<string, (Analyse & { ratio: number }) | null>();

/**
 * Seules les images servies par Supabase Storage sont mesurées : il envoie
 * `Access-Control-Allow-Origin: *` (vérifié le 25/09/2026), condition pour lire
 * les pixels. Une image d'un autre domaine (affiliée) chargée en CORS sans
 * cet en-tête ne s'afficherait plus du tout : elle reste en affichage contenu.
 */
function mesurable(url: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Publique ou signée (photos du dressing, bucket privé depuis le 30/09/2026) : même en-tête CORS.
  return Boolean(base) && (url.startsWith(`${base}/storage/v1/object/public/`) || url.startsWith(`${base}/storage/v1/object/sign/`));
}

/** Ratio largeur / hauteur de toutes les vignettes de l'écran. */
const RATIO_VIGNETTE = 4 / 5;

/**
 * Vignette d'une pièce, à présence normalisée (polish du 25/09/2026, cf.
 * cadrageImage.ts) : zone image identique partout, et la pièce — pas l'image —
 * remplit la même part de cette zone, sans déformation ni recadrage.
 *
 * Tant que la mesure n'est pas faite, l'image reste invisible (une fraction de
 * seconde, le temps du chargement) : sinon elle apparaîtrait petite puis
 * sauterait à sa taille normalisée. Mesure impossible : affichage contenu,
 * comme avant.
 */
export default function Vignette({ item, arrondi = 14, marge = margeVignette(item.cat) }: { item: Item; arrondi?: number; marge?: number }) {
  // Les photos du catalogue, pas le visuel du flat lay (14/10/2026, demandé).
  const image = resolvePhotoCatalogue(item);
  return (
    <div
      className="w-full border border-border relative overflow-hidden"
      style={{
        aspectRatio: "4/5",
        borderRadius: arrondi,
        background: image.url ? "var(--color-photo-bg)" : item.hex,
        boxShadow: image.url ? undefined : "inset 0 0 0 1px rgba(29,26,22,.06)",
      }}
    >
      {image.url ? (
        <ImageCadree key={image.url} url={image.url} marge={marge} />
      ) : (
        item.imageStatus === "generating" && (
          <span className="absolute inset-0 animate-pulse" style={{ background: "rgba(243,238,229,.35)" }} />
        )
      )}
    </div>
  );
}

function ImageCadree({ url, marge }: { url: string; marge: number }) {
  const analysable = mesurable(url);
  const [cadrage, setCadrage] = useState(() => (cadrages.has(url) ? cadrages.get(url) : undefined));
  const enAttente = analysable && cadrage === undefined;
  const place = cadrage ? placementDansCadre(cadrage.boite, cadrage.ratio, RATIO_VIGNETTE, marge) : null;
  const pad = `${marge * 100}%`;
  return (
    <>
      {/* Fond opaque mesuré : le cadre le prolonge, pour qu'aucun rectangle
          plus clair ou plus gris ne se découpe autour de la pièce. */}
      {cadrage?.fond && <span className="absolute inset-0" style={{ background: cadrage.fond }} />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        loading="lazy"
        decoding="async"
        crossOrigin={analysable ? "anonymous" : undefined}
        onLoad={(e) => {
          if (!analysable) return;
          // Une autre vignette de la même image a pu mesurer entre-temps :
          // reprendre sa mesure, sans quoi celle-ci resterait invisible.
          const deja = cadrages.get(url);
          const mesure = deja !== undefined ? deja : analyserImage(e.currentTarget);
          cadrages.set(url, mesure);
          setCadrage(mesure);
        }}
        onError={() => {
          cadrages.set(url, null);
          setCadrage(null);
        }}
        className="transition-opacity duration-200"
        style={
          place
            ? { position: "absolute", width: `${place.largeur}%`, height: `${place.hauteur}%`, left: `${place.gauche}%`, top: `${place.haut}%`, maxWidth: "none", opacity: 1 }
            : {
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                objectPosition: "center",
                padding: pad,
                boxSizing: "border-box",
                opacity: enAttente ? 0 : 1,
              }
        }
      />
    </>
  );
}

