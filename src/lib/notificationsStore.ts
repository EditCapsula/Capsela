"use client";

import { useSyncExternalStore } from "react";
import {
  MAX_LOCALES,
  aEnvoyer,
  fusionnerNotifications,
  nombreNonLues,
  type NotificationCapsela,
  type NouvelleNotification,
} from "./centreNotifications";
import { PAGE_NOTIFICATIONS, ecrireNotificationsAuCompte, lireNotificationsDuCompte, marquerLuesAuCompte } from "./notificationsCompte";

/**
 * L'ÉTAT DU CENTRE DE NOTIFICATIONS (12/11/2026). Un petit magasin externe (useSyncExternalStore, comme menuActions.ts) plutôt qu'un
 * état du store : la cloche et l'écran se re-rendent quand une notification arrive ou est lue, sans rien recharger et sans re-rendre
 * le reste de l'app.
 *
 * L'appareil d'abord, le compte ensuite. Une notification notée est gardée sur l'appareil tout de suite, puis envoyée au compte ; au
 * démarrage, ce que le compte connaît et ce que l'appareil connaît sont fusionnés (une clé, une notification ; lue d'un côté = lue),
 * et ce que le compte ignorait lui est renvoyé. Tant que la migration 0063 n'est pas passée — ou sans réseau — le compte est
 * « indisponible » : tout marche sur l'appareil, et l'écran le dit.
 */

export type EtatCompte = "inconnu" | "ok" | "indisponible";

interface Etat {
  liste: NotificationCapsela[];
  compte: EtatCompte;
  /** Le premier chargement (appareil puis compte) n'est pas terminé. */
  chargement: boolean;
  /** Le compte a peut-être des notifications plus anciennes que la page chargée. */
  plusAnciennes: boolean;
}

let etat: Etat = { liste: [], compte: "inconnu", chargement: true, plusAnciennes: false };
let utilisateur: string | null = null;
let demarre: string | null | undefined = undefined;
const abonnes = new Set<() => void>();

function publier(suivant: Partial<Etat>) {
  etat = { ...etat, ...suivant };
  abonnes.forEach((f) => f());
}

const cleLocale = (userId: string | null) => `capsela.notifications.${userId ?? "demo"}`;

function lireLocales(userId: string | null): NotificationCapsela[] {
  try {
    const brut = window.localStorage.getItem(cleLocale(userId));
    const l = brut ? (JSON.parse(brut) as NotificationCapsela[]) : [];
    return Array.isArray(l) ? l.filter((n) => n && typeof n.cle === "string") : [];
  } catch {
    return [];
  }
}

function garderLocales(liste: readonly NotificationCapsela[]) {
  try {
    window.localStorage.setItem(cleLocale(utilisateur), JSON.stringify(liste.slice(0, MAX_LOCALES)));
  } catch {
    // Stockage plein ou refusé : la notification reste affichée pour cette session.
  }
}

/** Lancé par App.tsx quand on connaît la personne (null : mode démo ou déconnectée). Rejoué pour une autre personne seulement. */
export async function demarrerNotifications(userId: string | null): Promise<void> {
  if (demarre === userId) return;
  demarre = userId;
  utilisateur = userId;
  const locales = lireLocales(userId);
  publier({ liste: fusionnerNotifications(locales, [], MAX_LOCALES), compte: userId ? "inconnu" : "indisponible", chargement: Boolean(userId), plusAnciennes: false });
  if (!userId) return;
  const compte = await lireNotificationsDuCompte(userId);
  if (utilisateur !== userId) return;
  if (!compte) {
    publier({ compte: "indisponible", chargement: false });
    return;
  }
  const { nouvelles, lues } = aEnvoyer(etat.liste, compte);
  const liste = fusionnerNotifications(etat.liste, compte);
  publier({ liste, compte: "ok", chargement: false, plusAnciennes: compte.length >= PAGE_NOTIFICATIONS });
  garderLocales(liste);
  if (nouvelles.length) await ecrireNotificationsAuCompte(userId, nouvelles);
  if (lues.length) await marquerLuesAuCompte(userId, lues);
}

/**
 * Note un ou plusieurs événements. Une clé déjà connue n'est pas notée de nouveau (ni sur l'appareil ni dans le compte) : la même
 * détection peut donc être rejouée à chaque ouverture sans rien dédoubler.
 */
export function noterNotifications(evenements: NouvelleNotification | readonly NouvelleNotification[]): void {
  const liste = (Array.isArray(evenements) ? evenements : [evenements]) as NouvelleNotification[];
  const connues = new Set(etat.liste.map((n) => n.cle));
  const maintenant = new Date().toISOString();
  const nouvelles: NotificationCapsela[] = [];
  for (const e of liste) {
    if (connues.has(e.cle)) continue;
    connues.add(e.cle);
    nouvelles.push({ ...e, id: `local-${e.cle}`, lue: false, creeeLe: maintenant });
  }
  if (!nouvelles.length) return;
  const suivante = fusionnerNotifications(nouvelles, etat.liste);
  publier({ liste: suivante });
  garderLocales(suivante);
  if (utilisateur && etat.compte !== "indisponible") {
    const u = utilisateur;
    void ecrireNotificationsAuCompte(u, nouvelles).then((ok) => {
      if (!ok && utilisateur === u) publier({ compte: "indisponible" });
    });
  }
}

function marquer(cles: readonly string[] | null) {
  const vise = cles ? new Set(cles) : null;
  const suivante = etat.liste.map((n) => (!n.lue && (!vise || vise.has(n.cle)) ? { ...n, lue: true } : n));
  publier({ liste: suivante });
  garderLocales(suivante);
  if (utilisateur && etat.compte !== "indisponible") {
    const u = utilisateur;
    void marquerLuesAuCompte(u, cles).then((ok) => {
      if (!ok && utilisateur === u) publier({ compte: "indisponible" });
    });
  }
}

export const marquerNotificationLue = (cle: string) => marquer([cle]);
export const toutMarquerLu = () => marquer(null);

/** La page suivante du compte (les plus anciennes). */
export async function chargerNotificationsPlusAnciennes(): Promise<void> {
  const u = utilisateur;
  if (!u || etat.compte !== "ok" || !etat.plusAnciennes) return;
  const derniere = etat.liste[etat.liste.length - 1]?.creeeLe;
  const page = await lireNotificationsDuCompte(u, derniere);
  if (utilisateur !== u) return;
  if (!page) return publier({ compte: "indisponible" });
  publier({ liste: fusionnerNotifications(etat.liste, page), plusAnciennes: page.length >= PAGE_NOTIFICATIONS });
}

const abonner = (f: () => void) => {
  abonnes.add(f);
  return () => {
    abonnes.delete(f);
  };
};
const ETAT_SERVEUR: Etat = { liste: [], compte: "inconnu", chargement: true, plusAnciennes: false };

export function useNotifications(): Etat & { nonLues: number } {
  const e = useSyncExternalStore(abonner, () => etat, () => ETAT_SERVEUR);
  return { ...e, nonLues: nombreNonLues(e.liste) };
}
