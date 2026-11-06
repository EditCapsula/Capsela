"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/*
 * GLISSER UNE ACTIVITÉ VERS UN AUTRE JOUR (06/11/2026, demandé : « L'utilisateur devrait pouvoir les modifier avec un glisser
 * déposer » ; seules les activités réparties automatiquement se déplacent, arbitré le même jour).
 *
 * Un appui long (APPUI_LONG_MS) saisit la ligne : un geste plus court, ou qui bouge avant, reste un défilement ou un toucher
 * ordinaire. Saisie, la ligne suit le doigt ; la carte du jour sous le doigt (attribut `data-jour-planning`) est la cible, et la
 * page défile d'elle-même près des bords. Lâcher sur un jour possible déplace ; ailleurs, rien ne change. Le bouton « Déplacer »
 * de chaque ligne fait la même chose sans geste (lecteurs d'écran, souris) : ce geste n'en est qu'un raccourci.
 */

const APPUI_LONG_MS = 450;
const TOLERANCE_PX = 8;
const BORD_PX = 90;

export interface Saisie {
  sousId: string;
  de: string;
  libelle: string;
  x: number;
  y: number;
  /** Le jour sous le doigt, s'il en est un. */
  cible: string | null;
}

/** La première zone qui défile au-dessus d'un élément (la page de l'écran), sinon le document. */
function zoneDeDefilement(el: HTMLElement | null): HTMLElement {
  for (let n = el?.parentElement; n; n = n.parentElement) if (n.scrollHeight > n.clientHeight + 1 && getComputedStyle(n).overflowY !== "visible") return n;
  return document.scrollingElement as HTMLElement;
}

export function useGlisserVersJour(onDeposer: (sousId: string, de: string, vers: string) => void) {
  const [saisie, setSaisie] = useState<Saisie | null>(null);
  const saisieRef = useRef<Saisie | null>(null);
  const minuteur = useRef<number | null>(null);
  const depart = useRef<{ x: number; y: number } | null>(null);
  const zone = useRef<HTMLElement | null>(null);
  /** Après un glisser, le « clic » qui suit le lâcher n'ouvre pas le look. */
  const ignorerClic = useRef(false);
  const deposer = useRef(onDeposer);
  useEffect(() => {
    deposer.current = onDeposer;
  }, [onDeposer]);
  const actif = saisie != null;

  const maj = (s: Saisie | null) => {
    saisieRef.current = s;
    setSaisie(s);
  };
  const annulerMinuteur = () => {
    if (minuteur.current != null) window.clearTimeout(minuteur.current);
    minuteur.current = null;
  };

  // Pendant une saisie : suivre le doigt, empêcher la page de défiler sous lui, défiler près des bords, déposer au lâcher.
  useEffect(() => {
    if (!actif) return;
    const jourSous = (x: number, y: number) => (document.elementFromPoint(x, y)?.closest("[data-jour-planning]") as HTMLElement | null)?.dataset.jourPlanning ?? null;
    const bouger = (e: PointerEvent) => {
      const s = saisieRef.current;
      if (s) maj({ ...s, x: e.clientX, y: e.clientY, cible: jourSous(e.clientX, e.clientY) });
    };
    const lacher = () => {
      const s = saisieRef.current;
      maj(null);
      if (s?.cible && s.cible !== s.de) deposer.current(s.sousId, s.de, s.cible);
    };
    const annuler = () => maj(null);
    const bloquer = (e: TouchEvent) => e.preventDefault();
    let image = 0;
    const defiler = () => {
      const s = saisieRef.current;
      if (s && zone.current) {
        const v = s.y < BORD_PX ? -10 : s.y > window.innerHeight - BORD_PX - 60 ? 10 : 0;
        if (v) {
          zone.current.scrollBy(0, v);
          const cible = jourSous(s.x, s.y);
          if (cible !== s.cible) maj({ ...s, cible });
        }
      }
      image = requestAnimationFrame(defiler);
    };
    image = requestAnimationFrame(defiler);
    window.addEventListener("pointermove", bouger);
    window.addEventListener("pointerup", lacher);
    window.addEventListener("pointercancel", annuler);
    window.addEventListener("touchmove", bloquer, { passive: false });
    return () => {
      cancelAnimationFrame(image);
      window.removeEventListener("pointermove", bouger);
      window.removeEventListener("pointerup", lacher);
      window.removeEventListener("pointercancel", annuler);
      window.removeEventListener("touchmove", bloquer);
    };
    // Une seule écoute par saisie : les mouvements passent par saisieRef.
  }, [actif]);

  useEffect(() => annulerMinuteur, []);

  /** Les gestionnaires d'une ligne déplaçable. */
  const poignee = useCallback((sousId: string, de: string, libelle: string) => ({
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      const el = e.currentTarget;
      ignorerClic.current = false;
      depart.current = { x: e.clientX, y: e.clientY };
      annulerMinuteur();
      minuteur.current = window.setTimeout(() => {
        minuteur.current = null;
        zone.current = zoneDeDefilement(el);
        ignorerClic.current = true;
        navigator.vibrate?.(12);
        const p = depart.current ?? { x: 0, y: 0 };
        maj({ sousId, de, libelle, x: p.x, y: p.y, cible: de });
      }, APPUI_LONG_MS);
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const p = depart.current;
      if (minuteur.current != null && p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > TOLERANCE_PX) annulerMinuteur();
    },
    onPointerUp: annulerMinuteur,
    onPointerCancel: annulerMinuteur,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onClickCapture: (e: React.MouseEvent) => {
      if (!ignorerClic.current) return;
      ignorerClic.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  }), []);

  return { saisie, poignee };
}

/** La ligne saisie, qui suit le doigt. */
export function FantomeSaisie({ saisie }: { saisie: Saisie }) {
  return (
    <div
      aria-hidden="true"
      className="fixed z-[60] pointer-events-none px-[14px] py-[10px] rounded-[14px] bg-card text-ink t-label shadow-lg border border-terracotta"
      style={{ left: saisie.x, top: saisie.y, transform: "translate(-50%, -120%)" }}
    >
      {saisie.libelle}
    </div>
  );
}
