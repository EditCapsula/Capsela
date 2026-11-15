import { useEffect, useLayoutEffect, useRef, useState, type RefObject, type UIEvent } from "react";

/*
 * LE CONTEXTE D'UN ÉCRAN, RETROUVÉ AU RETOUR (22/10/2026, brief « Harmonisation UX de la navigation »).
 *
 * L'app n'a qu'un écran monté à la fois (App.tsx, `state.screen`) : ouvrir la fiche d'une pièce démonte le Dressing, et son état local
 * (catégorie, recherche, tri, défilement) repartait de zéro au retour. Mesuré avant ce module : Dressing filtré sur « Robes » → fiche →
 * Retour = « Tout », défilement 400 → 0 ; Capsule défilée à 700 → fiche → Retour = 0 ; Planifier, onglet Valise → valise → Retour =
 * onglet Tenue.
 *
 * Un écran garde ici son contexte quand il se démonte, et le reprend au montage suivant. La barre du bas OUBLIE le contexte de l'écran
 * qu'elle ouvre (`oublierContexte`) : un onglet touché ouvre son écran à neuf, comme avant ; seul un RETOUR retrouve l'écran tel qu'il
 * était. Mémoire de la session seulement (pas de stockage) : rien n'est gardé d'un lancement à l'autre.
 */

const memoire = new Map<string, unknown>();

export const lireContexte = <T>(cle: string): T | null => (memoire.has(cle) ? (memoire.get(cle) as T) : null);
export const garderContexte = (cle: string, contexte: unknown): void => void memoire.set(cle, contexte);
export const oublierContexte = (cle: string): void => void memoire.delete(cle);

/*
 * SEUL UN RETOUR RETROUVE LE CONTEXTE (14/11/2026, signalé : « lorsque je clique sur une action m'amenant sur une autre page, sauf
 * spécificité, je dois arriver en haut de la page souhaitée, pas au milieu »). Jusqu'ici, seul un onglet de la barre du bas oubliait
 * le contexte : toute AUTRE entrée — un raccourci de l'accueil, une action, une notification, « Voir mes looks » — rouvrait l'écran
 * au défilement de la visite précédente, souvent au milieu de la page. Le contexte n'est désormais repris qu'au RETOUR : un appui sur
 * BoutonRetour (le bouton Retour de tous les écrans, que le retour Android touche aussi) ou le retour Android vers l'accueil. Toute
 * autre navigation ouvre l'écran en haut.
 *
 * Le drapeau vit le temps de l'appui : React rend l'écran de destination dans le même événement (mise à jour discrète, rendue avant
 * la fin de la tâche), donc avant que le minuteur ne l'efface ; un retour qui ne change pas d'écran (une étape d'un parcours) ne
 * laisse rien derrière lui.
 */
let retourEnCours = false;
export function marquerRetour(): void {
  retourEnCours = true;
  setTimeout(() => {
    retourEnCours = false;
  }, 0);
}
export const estUnRetour = (): boolean => retourEnCours;

/**
 * Le contexte gardé pour `cle`, lu UNE fois au montage — null s'il n'y en a pas, quand `ignorer` (une entrée explicite prime), ou
 * quand l'écran n'est pas ouvert par un retour (voir marquerRetour).
 */
export function useContexteRepris<T>(cle: string, ignorer = false): T | null {
  const [repris] = useState<T | null>(() => (ignorer || !retourEnCours ? null : lireContexte<T>(cle)));
  return repris;
}

/** Garde le contexte de l'écran à son démontage : `courant` est relu à ce moment-là (appelé après la déclaration de l'état qu'il lit). */
export function useGarderContexte<T>(cle: string, courant: () => T): void {
  const lire = useRef(courant);
  useEffect(() => {
    lire.current = courant;
  });
  useEffect(() => () => garderContexte(cle, lire.current()), [cle]);
}

/**
 * Le défilement d'une zone : suivi pendant la visite (onScroll, la zone peut être déjà détachée au démontage), rétabli au montage.
 * `restaurer` est la position reprise ; renvoie le gestionnaire à poser sur la zone et la position courante, à garder.
 */
export function useDefilementRepris(zone: RefObject<HTMLElement | null>, restaurer: number | null | undefined) {
  const position = useRef(restaurer ?? 0);
  useLayoutEffect(() => {
    if (restaurer) zone.current?.scrollTo({ top: restaurer });
    // Une seule fois, au montage : la position reprise ne doit pas ramener la zone en arrière ensuite.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return {
    onScroll: (e: UIEvent<HTMLElement>) => {
      position.current = e.currentTarget.scrollTop;
    },
    position,
  };
}
