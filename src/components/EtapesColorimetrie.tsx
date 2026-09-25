"use client";

import { useRef, useState } from "react";
import {
  analyserColorimetrie,
  colorimetrieDisponible,
  colorimetrieMockActive,
  colorimetrieUtilisable,
  COLORIMETRIE_VIDE,
  type Colorimetrie,
} from "@/lib/colorimetrie";
import { paletteColorName } from "@/lib/profile";

/**
 * LES DEUX ÉCRANS DE COLORIMÉTRIE (25/09/2026).
 *
 * Sortis de ProfileSetupScreen parce qu'ils portent leur propre machine à
 * états — intro, aperçu, analyse, erreur — là où toutes les autres étapes
 * sont un choix et rien de plus.
 *
 * AUCUN SERVICE D'ANALYSE N'EXISTE. `colorimetrieDisponible()` rend false
 * tant que `NEXT_PUBLIC_COLORIMETRIE_MOCK=1` n'est pas posé, et l'écran ne
 * propose alors PAS de prendre une photo : il annonce que l'analyse arrive et
 * propose de passer. Un bouton « Prendre une photo » qui n'analyse rien
 * demanderait le visage de quelqu'un pour rien — c'est la version la plus
 * coûteuse de la promesse qu'on ne peut pas tenir.
 */

const T = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function Puce({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-[9px]">
      <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" className="flex-shrink-0 text-terracotta" style={{ display: "block" }}>
        <path d="M5 12.5l4.5 4.5L19 7.5" {...T} strokeWidth={1.8} />
      </svg>
      <span className="text-[13px] text-muted-3 leading-[1.4]">{children}</span>
    </div>
  );
}

function Groupe({ titre, sous, hexes }: { titre: string; sous?: string; hexes: string[] }) {
  return (
    <div className="mt-5">
      <div className="text-[10px] tracking-[.14em] uppercase text-terracotta">{titre}</div>
      {sous && <div className="text-[12px] text-muted mt-[3px]">{sous}</div>}
      <div className="flex flex-wrap gap-[10px] mt-[10px]">
        {hexes.map((h) => (
          <div key={h} className="flex flex-col items-center" style={{ width: 62 }}>
            <span
              className="w-[38px] h-[38px] rounded-full"
              style={{ background: h, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.10)" }}
            />
            <span className="text-[10px] text-muted mt-[5px] text-center leading-[1.2]">{paletteColorName(h) ?? ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EtapeColorimetrie({
  colorimetrie,
  onResultat,
  onPasser,
}: {
  colorimetrie: Colorimetrie;
  onResultat: (c: Colorimetrie) => void;
  onPasser: () => void;
}) {
  const [apercu, setApercu] = useState<{ url: string; blob: Blob; source: "camera" | "galerie" } | null>(null);
  const [encours, setEncours] = useState(false);
  const camera = useRef<HTMLInputElement | null>(null);
  const galerie = useRef<HTMLInputElement | null>(null);

  const choisir = (source: "camera" | "galerie") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setApercu({ url: URL.createObjectURL(f), blob: f, source });
  };

  const lancer = async () => {
    if (!apercu || encours) return;
    setEncours(true);
    const c = await analyserColorimetrie(apercu.blob, apercu.source);
    setEncours(false);
    onResultat(c);
    // La photo ne survit pas à l'analyse : ni stockée, ni téléversée. L'URL
    // locale est révoquée dans la foulée.
    URL.revokeObjectURL(apercu.url);
    if (c.statut !== "faite") setApercu(null);
  };

  // ── Aucun service : on le dit, on ne demande pas de photo ────────────────
  if (!colorimetrieDisponible()) {
    return (
      <div className="mt-[26px]">
        <div className="bg-card border border-border rounded-[20px] px-[16px] py-[15px]">
          <div className="font-serif text-[18px] text-ink leading-[1.25]">L&apos;analyse arrive bientôt</div>
          <div className="text-[13px] text-muted leading-[1.5] mt-[6px]" style={{ textWrap: "pretty" }}>
            Elle n&apos;est pas encore disponible. Tes couleurs préférées suffisent pour commencer — tu pourras
            lancer l&apos;analyse depuis ton profil dès qu&apos;elle ouvrira.
          </div>
        </div>
        <button onClick={onPasser} className="w-full text-[13px] text-terracotta cursor-pointer mt-4" style={{ minHeight: 44 }}>
          Passer pour l&apos;instant
        </button>
      </div>
    );
  }

  // ── Analyse en cours ─────────────────────────────────────────────────────
  if (encours) {
    return (
      <div className="mt-[26px] bg-card border border-border rounded-[20px] px-[16px] py-[18px]" aria-live="polite">
        <div className="font-serif text-[18px] text-ink">Analyse en cours…</div>
        <div className="flex flex-col gap-[9px] mt-[14px]">
          <Puce>Tonalités de la peau</Puce>
          <Puce>Couleur des cheveux</Puce>
          <Puce>Couleur des yeux</Puce>
        </div>
      </div>
    );
  }

  // ── Erreur : réessayer ou passer, jamais de relance automatique ──────────
  if (colorimetrie.statut === "erreur") {
    return (
      <div className="mt-[26px]">
        <div className="bg-card border border-border rounded-[20px] px-[16px] py-[15px]">
          <div className="text-[13px] text-muted-3 leading-[1.5]">
            L&apos;analyse n&apos;a pas abouti. Rien n&apos;est perdu : tes couleurs préférées sont conservées.
          </div>
        </div>
        <button
          onClick={() => onResultat(COLORIMETRIE_VIDE)}
          className="w-full rounded-full bg-terracotta-deep text-cream text-[13px] tracking-[.1em] uppercase cursor-pointer mt-4"
          style={{ minHeight: 52 }}
        >
          Reprendre une photo
        </button>
        <button onClick={onPasser} className="w-full text-[13px] text-terracotta cursor-pointer mt-1" style={{ minHeight: 44 }}>
          Passer pour l&apos;instant
        </button>
      </div>
    );
  }

  // ── Aperçu de la photo choisie ───────────────────────────────────────────
  if (apercu) {
    return (
      <div className="mt-[26px]">
        <div className="rounded-[24px] overflow-hidden bg-warm-bg" style={{ aspectRatio: "3 / 4" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={apercu.url} alt="Ta photo" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
        <div className="text-[13px] text-muted leading-[1.5] mt-3" style={{ textWrap: "pretty" }}>
          Vérifie qu&apos;on voit bien ton visage et tes cheveux. Ta photo sert uniquement à l&apos;analyse : elle
          n&apos;est ni conservée, ni publiée, ni partagée.
        </div>
        <button
          onClick={lancer}
          className="w-full rounded-full bg-terracotta-deep text-cream text-[13px] tracking-[.1em] uppercase cursor-pointer mt-4"
          style={{ minHeight: 52 }}
        >
          Analyser ma colorimétrie
        </button>
        <button
          onClick={() => { URL.revokeObjectURL(apercu.url); setApercu(null); }}
          className="w-full text-[13px] text-terracotta cursor-pointer mt-1"
          style={{ minHeight: 44 }}
        >
          Changer de photo
        </button>
      </div>
    );
  }

  // ── Intro ────────────────────────────────────────────────────────────────
  return (
    <div className="mt-[26px]">
      {colorimetrieMockActive() && (
        <div className="bg-warm-bg rounded-[14px] px-[14px] py-[10px] text-[12px] text-terracotta mb-4">
          Résultat de démonstration — le service d&apos;analyse n&apos;est pas branché.
        </div>
      )}
      <div className="bg-card border border-border rounded-[20px] px-[16px] py-[15px]">
        <div className="text-[10px] tracking-[.14em] uppercase text-terracotta">Pour une analyse fiable</div>
        <div className="flex flex-col gap-[9px] mt-[11px]">
          <Puce>Lumière naturelle</Puce>
          <Puce>Visage de face</Puce>
          <Puce>Sans filtre</Puce>
          <Puce>Cheveux visibles</Puce>
        </div>
      </div>
      <div className="text-[12px] text-muted leading-[1.45] mt-3" style={{ textWrap: "pretty" }}>
        Ta photo sert uniquement à l&apos;analyse. Elle n&apos;est ni conservée, ni publiée, ni partagée.
      </div>
      {/* `capture="user"` demande la caméra FRONTALE — même motif que
          AddScreen, qui demande l'arrière avec `capture="environment"`. Le
          second champ, sans `capture`, laisse le système ouvrir la galerie. */}
      <input ref={camera} type="file" accept="image/*" capture="user" onChange={choisir("camera")} className="hidden" />
      <input ref={galerie} type="file" accept="image/*" onChange={choisir("galerie")} className="hidden" />
      <button
        onClick={() => camera.current?.click()}
        className="w-full rounded-full bg-terracotta-deep text-cream text-[13px] tracking-[.1em] uppercase cursor-pointer mt-4"
        style={{ minHeight: 52 }}
      >
        Prendre une photo
      </button>
      <button onClick={() => galerie.current?.click()} className="w-full text-[13px] text-terracotta cursor-pointer mt-1" style={{ minHeight: 44 }}>
        Choisir une photo
      </button>
      <button onClick={onPasser} className="w-full text-[12px] text-muted cursor-pointer mt-2" style={{ minHeight: 44 }}>
        Passer pour l&apos;instant
      </button>
    </div>
  );
}

export function ResultatColorimetrie({
  colorimetrie,
  onRefaire,
}: {
  colorimetrie: Colorimetrie;
  onRefaire: () => void;
}) {
  if (!colorimetrieUtilisable(colorimetrie)) return null;
  const c = colorimetrie;
  return (
    <div className="mt-[26px]">
      {/* Le badge dépend de la PRÉSENCE d'un score, jamais d'un seuil deviné :
          un service qui n'en rend pas ne doit pas faire afficher « fiable ». */}
      {c.confiance !== undefined && (
        <span className="inline-block text-[10px] tracking-[.14em] uppercase text-terracotta bg-warm-bg rounded-full px-[10px] py-[4px]">
          Analyse fiable
        </span>
      )}
      {c.libelle && <div className="font-serif text-[21px] text-ink mt-[10px]">{c.libelle}</div>}

      <Groupe titre="Couleurs signature" hexes={c.signature ?? []} />
      {!!c.neutres?.length && <Groupe titre="Neutres" hexes={c.neutres} />}
      {/* « Avec modération » n'apparaît QUE si le service l'a rendu, et ne dit
          jamais « à éviter » : le sous-titre nomme un placement, pas une
          interdiction. Aucune de ces couleurs n'est retirée du moteur. */}
      {!!c.moderation?.length && (
        <Groupe titre="Avec modération" sous="Plutôt loin du visage" hexes={c.moderation} />
      )}

      <button onClick={onRefaire} className="w-full text-[13px] text-terracotta cursor-pointer mt-5" style={{ minHeight: 44 }}>
        Refaire l&apos;analyse
      </button>
    </div>
  );
}
