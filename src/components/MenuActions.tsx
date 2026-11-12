"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useCapsela } from "@/lib/store";
import { abonnerMenuActions, instantaneMenuActions, menuActionsMasque, menuActionsVisible } from "@/lib/menuActions";

/**
 * LE MENU D'ACTIONS FLOTTANT (12/11/2026, brief « Speed Dial », lib/menuActions.ts). Un composant, monté UNE fois par App.tsx.
 *
 * Les quatre actions ouvrent les parcours EXISTANTS, par les actions du store qui les ouvrent déjà ailleurs — aucun parcours
 * parallèle :
 *   1. Ajouter une pièce au dressing → openAddEtRevenir (l'écran d'ajout : photo, catalogue, saisie ; la limite du dressing gratuit
 *      y est vérifiée), et l'on revient d'où l'on vient.
 *   2. Planifier une tenue → planifierDirect (Planifier ouvert à l'étape Occasion, puis date et lieu).
 *   3. Planifier une valise → ouvrirValise(null) (le parcours valise entier, sa règle d'accès comprise).
 *   4. Demander l'avis Capsela → goAvisStyliste (l'avis de styliste sur une photo de tenue : analyse réelle par la fonction Edge,
 *      quota et accès Premium gérés par son écran).
 *
 * Couleurs : uniquement des jetons existants — le bouton reprend le « + » du Dressing qu'il remplace (terracotta-deep, crème), les
 * actions le fond des cartes. La future couleur d'accent n'aura qu'à remplacer `bg-terracotta-deep` du bouton.
 *
 * Accessibilité : bouton nommé et `aria-expanded` ; ouvert, le menu est un dialogue (le retour Android le ferme par Échap,
 * retourSysteme.ts), le focus va à la première action et revient au bouton à la fermeture. Les animations (180 à 220 ms) tombent
 * à zéro si le téléphone demande moins de mouvement.
 */
export default function MenuActions() {
  const { state, actions } = useCapsela();
  const masque = useSyncExternalStore(abonnerMenuActions, () => (instantaneMenuActions(), menuActionsMasque()), () => false);
  const clavier = useClavierOuvert();
  const [ouvert, setOuvert] = useState(false);
  const boutonRef = useRef<HTMLButtonElement>(null);
  const premiereRef = useRef<HTMLButtonElement>(null);
  const visible = menuActionsVisible({ screen: state.screen, masque, clavier });

  // Un changement d'écran (ou le clavier, ou un masque) referme le menu : il ne reste jamais ouvert sur une page qui ne le propose pas.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!visible) setOuvert(false);
  }, [visible]);

  useEffect(() => {
    if (!ouvert) return;
    premiereRef.current?.focus();
    const echap = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOuvert(false);
      boutonRef.current?.focus();
    };
    document.addEventListener("keydown", echap);
    return () => document.removeEventListener("keydown", echap);
  }, [ouvert]);

  if (!visible) return null;

  const lancer = (f: () => void) => () => {
    setOuvert(false);
    f();
  };
  const ACTIONS: { libelle: string; icone: React.ReactNode; onClick: () => void }[] = [
    { libelle: "Ajouter une pièce au dressing", icone: ICONE_CINTRE, onClick: lancer(actions.openAddEtRevenir) },
    { libelle: "Planifier une tenue", icone: ICONE_CALENDRIER_PLUS, onClick: lancer(() => actions.planifierDirect(state.screen)) },
    { libelle: "Planifier une valise", icone: ICONE_VALISE, onClick: lancer(() => void actions.ouvrirValise(null)) },
    { libelle: "Demander l'avis Capsela", icone: ICONE_ETINCELLES, onClick: lancer(actions.goAvisStyliste) },
  ];
  const bas = "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 16px)";

  return (
    <>
      {/* Le voile : au-dessus du contenu et de la barre du bas (z-20), sous le menu. Un toucher le referme. */}
      <div
        aria-hidden="true"
        onClick={() => setOuvert(false)}
        className={
          "absolute inset-0 z-40 transition-opacity duration-200 motion-reduce:transition-none " +
          (ouvert ? "opacity-100" : "opacity-0 pointer-events-none")
        }
        style={{ background: "rgba(29,26,22,.42)" }}
      />
      {ouvert && (
        <div
          id="menu-actions"
          role="dialog"
          aria-label="Actions rapides"
          className="absolute right-4 z-50 flex flex-col items-end gap-[10px]"
          style={{ bottom: `calc(${bas} + 56px + 14px)` }}
        >
          {ACTIONS.map((a, i) => (
            <button
              key={a.libelle}
              ref={i === 0 ? premiereRef : undefined}
              type="button"
              onClick={a.onClick}
              className="flex items-center gap-3 rounded-full bg-card pl-[10px] pr-[18px] text-left cursor-pointer active:opacity-80 motion-safe:animate-[menu-action-apparition_200ms_ease-out_both]"
              // L'ordre d'apparition suit l'ordre de lecture, de haut en bas, 30 ms d'écart : le menu se déplie sans traîner.
              style={{ minHeight: 56, boxShadow: "0 4px 14px rgba(29,26,22,.14)", animationDelay: `${(ACTIONS.length - 1 - i) * 30}ms` }}
            >
              <span aria-hidden="true" className="w-9 h-9 flex-shrink-0 rounded-full bg-warm-bg text-terracotta-deep flex items-center justify-center">
                {a.icone}
              </span>
              <span className="text-[14px] font-semibold text-ink whitespace-nowrap">{a.libelle}</span>
            </button>
          ))}
        </div>
      )}
      <button
        ref={boutonRef}
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        aria-controls="menu-actions"
        aria-label={ouvert ? "Fermer les actions rapides" : "Actions rapides : ajouter une pièce, planifier, demander un avis"}
        // Repère de la visite guidée du Dressing (VisiteGuidee) : ce bouton remplace le « + » qui le portait.
        data-tour={state.screen === "wardrobe" ? "dressing-ajouter" : undefined}
        className="absolute right-4 z-50 flex items-center justify-center rounded-full bg-terracotta-deep active:bg-terracotta-hover text-cream cursor-pointer transition-transform active:scale-[.95]"
        style={{ bottom: bas, width: 56, height: 56, boxShadow: "0 4px 14px rgba(29,26,22,.22)" }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          aria-hidden="true"
          className={"transition-transform duration-200 ease-out motion-reduce:transition-none " + (ouvert ? "rotate-45" : "")}
        >
          <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </>
  );
}

/** Le clavier est ouvert : un champ de saisie a le focus. Le bouton s'efface pour ne pas flotter au-dessus du clavier. */
function useClavierOuvert(): boolean {
  const [ouvert, setOuvert] = useState(false);
  useEffect(() => {
    const champ = (el: EventTarget | null) =>
      el instanceof HTMLElement && (el.tagName === "TEXTAREA" || el.tagName === "SELECT" || (el.tagName === "INPUT" && !["checkbox", "radio", "button", "file"].includes((el as HTMLInputElement).type)) || el.isContentEditable);
    const entree = (e: FocusEvent) => setOuvert(champ(e.target));
    // Après la sortie, le focus peut être passé à un autre champ : relu au tour suivant.
    const sortie = () => setTimeout(() => setOuvert(champ(document.activeElement)), 0);
    document.addEventListener("focusin", entree);
    document.addEventListener("focusout", sortie);
    return () => {
      document.removeEventListener("focusin", entree);
      document.removeEventListener("focusout", sortie);
    };
  }, []);
  return ouvert;
}

const trait = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const ICONE_CINTRE = (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path d="M12 3.2a1.9 1.9 0 00-.6 3.7v1.1L4.6 12.9a1.4 1.4 0 00.8 2.55h13.2a1.4 1.4 0 00.8-2.55L12.6 8V6.9A1.9 1.9 0 0012 3.2z" {...trait} />
    <path d="M4.8 18.6h14.4" {...trait} />
  </svg>
);
const ICONE_CALENDRIER_PLUS = (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <rect x="4" y="6" width="16" height="14" rx="2" {...trait} />
    <path d="M4 10h16M8.5 3.5V7M15.5 3.5V7M12 12.5v5M9.5 15h5" {...trait} />
  </svg>
);
const ICONE_VALISE = (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <rect x="3" y="7.5" width="18" height="13" rx="2.5" {...trait} />
    <path d="M9 7.5V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2.5M9.5 11.5v5M14.5 11.5v5" {...trait} />
  </svg>
);
const ICONE_ETINCELLES = (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path d="M10 4l1.4 4.6L16 10l-4.6 1.4L10 16l-1.4-4.6L4 10l4.6-1.4L10 4zM17.5 14l.7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3z" {...trait} />
  </svg>
);
