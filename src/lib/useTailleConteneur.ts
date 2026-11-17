"use client";

import { useCallback, useLayoutEffect, useState } from "react";

/*
 * La taille mesurée d'un élément, tenue à jour au redimensionnement (17/11/2026, cf. tailleConteneur.ts : les unités de conteneur
 * ne sont pas comprises par Safari avant iOS 16). null tant que l'élément n'est pas mesuré ou n'a pas de taille. La référence est
 * une fonction : un élément remonté (une clé qui change, comme le style affiché de la découverte des styles) est observé à son tour.
 */
export function useTailleConteneur<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null);
  const ref = useCallback((noeud: T | null) => setEl(noeud), []);
  const [taille, setTaille] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    if (!el) return;
    const lire = () => {
      const { width, height } = el.getBoundingClientRect();
      setTaille((t) => (t && t.w === width && t.h === height ? t : width > 0 ? { w: width, h: height } : null));
    };
    lire();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(lire);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [ref, taille] as const;
}
