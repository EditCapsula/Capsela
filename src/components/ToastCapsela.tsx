"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { masquerMenuActions } from "@/lib/menuActions";

/**
 * LE MESSAGE DE CONFIRMATION, UN SEUL POUR TOUTE L'APP (13/11/2026, mission « Harmonisation du système de fiches ») : « Pièce
 * remplacée », « Ajoutée à ta sélection ! », « Retirée de ta capsule pour cette saison »… avec « Annuler » quand le geste se défait.
 * Même place, même durée (6 s), même forme partout ; un nouveau message remplace le précédent. Monté une fois par App.tsx ; annoncé
 * aux lecteurs d'écran (role="status"). En bas, au-dessus de la barre ; un geste fait DANS une feuille ouverte (« J'aime ») se dit dans la
 * feuille elle-même, pas ici, pour ne jamais couvrir ses actions.
 */
export const DUREE_TOAST_MS = 6000;

interface Toast {
  texte: string;
  annuler?: () => void;
  jeton: number;
}

let courant: Toast | null = null;
const abonnes = new Set<() => void>();
const publier = (t: Toast | null) => {
  courant = t;
  abonnes.forEach((f) => f());
};

/** Affiche un message ; `annuler` pose le bouton « Annuler » pendant la durée du message. */
export function afficherToast(texte: string, annuler?: () => void): void {
  publier({ texte, annuler, jeton: Date.now() });
}

const abonner = (f: () => void) => {
  abonnes.add(f);
  return () => {
    abonnes.delete(f);
  };
};

export default function ToastCapsela() {
  const toast = useSyncExternalStore(abonner, () => courant, () => null);
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Le temps restant se déduit de l'heure du message (jeton) : un nouveau message repart à 6 s sans remise à zéro.
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    if (minuterie.current) clearTimeout(minuterie.current);
    if (!toast) return;
    minuterie.current = setTimeout(() => publier(null), DUREE_TOAST_MS);
    const tic = setInterval(() => setMaintenant(Date.now()), 250);
    return () => {
      if (minuterie.current) clearTimeout(minuterie.current);
      clearInterval(tic);
    };
  }, [toast]);
  // Le menu d'actions flottant s'efface le temps du message : il occupe le même bas d'écran.
  useEffect(() => masquerMenuActions("toast", Boolean(toast)), [toast]);
  if (!toast) return null;
  // Une feuille ouverte (le parcours de la Capsule garde la fiche ouverte après un vote) : en haut, pour ne pas couvrir ses boutons.
  const enHaut = typeof document !== "undefined" && Boolean(document.querySelector('[role="dialog"]'));
  const reste = Math.min(DUREE_TOAST_MS / 1000, Math.max(0, Math.ceil((DUREE_TOAST_MS - (maintenant - toast.jeton)) / 1000)));
  return (
    // EN BAS, AU-DESSUS DE LA BARRE (planche « Remplacement confirmé + Annuler (6 s) ») : il suit un geste qui a refermé sa feuille, il ne
    // couvre donc aucune action. Le décompte se lit (« Annuler (6 s) ») et se voit (la barre) ; sans animation si le téléphone le demande.
    <div className="fixed inset-x-0 mx-auto max-w-[480px] px-4 z-[60] pointer-events-none" style={enHaut ? { top: "calc(env(safe-area-inset-top) + 10px)" } : { bottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 12px)" }} role="status" aria-live="polite">
      <div key={toast.jeton} className="pointer-events-auto rounded-[16px] bg-ink overflow-hidden shadow-lg motion-safe:animate-[capsule-apparition_180ms_ease-out_both]">
        <div className="flex items-center gap-3 py-[10px] pl-4 pr-[6px]">
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" className="flex-shrink-0 text-cream"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M8 12.3l2.6 2.6L16 9.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span className="flex-1 min-w-0 text-[12.5px] text-cream truncate">{toast.texte}</span>
          {toast.annuler && (
            <button
              type="button"
              onClick={() => {
                const a = toast.annuler;
                publier(null);
                a?.();
              }}
              className="flex-shrink-0 rounded-full px-[12px] text-[12.5px] font-semibold text-cream cursor-pointer tabular-nums"
              style={{ minHeight: 44 }}
            >
              Annuler ({reste} s)
            </button>
          )}
        </div>
        {toast.annuler && (
          <div className="h-[3px] bg-[rgba(243,238,229,.18)]" aria-hidden="true">
            <div className="h-full bg-terracotta motion-safe:animate-[decompte-toast_6s_linear_both] motion-reduce:w-full" />
          </div>
        )}
      </div>
    </div>
  );
}
