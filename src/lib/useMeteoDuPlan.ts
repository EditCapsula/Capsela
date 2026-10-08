"use client";

import { useEffect, useState } from "react";
import { jourLocal } from "./outfitFeedback";
import { villeDuLieu, type TenuePlanifiee } from "./planifier";
import { HORIZON_PREVISION_JOURS, previsionPour, type MeteoMoment, type Prevision } from "./prevision";
import { fetchPrevisionByCity } from "./weather";

/*
 * LA MÉTÉO D'UNE TENUE PLANIFIÉE : CELLE DU LIEU ET DU MOMENT DU PLAN (04/10/2026, demandé : « pour la tenue planifiée,
 * il faut utiliser la météo du lieu et du moment »).
 *
 * Avant, la fiche d'un plan ne montrait que la prévision ENREGISTRÉE à la planification, et l'alerte de la tenue du jour
 * jugeait la météo de la ville de la personne, pour toute la journée — alors que le plan dit « Gagny, ce soir ». Ce hook
 * redemande la prévision du lieu du plan et en lit la fenêtre du moment (Matin, Après-midi, Soirée, Toute la journée),
 * pour un plan qui n'est pas passé et dans l'horizon de la prévision. Hors de là, ou sans lieu, ou sans réponse : null —
 * l'appelant n'invente rien, et ne juge jamais une tenue sur la météo d'un autre lieu.
 *
 * Les réponses sont gardées dix minutes par ville : l'Accueil, Tenue et la fiche du plan n'appellent pas trois fois la
 * fonction `weather` pour le même lieu.
 */

const DUREE_CACHE_MS = 10 * 60 * 1000;
const cache = new Map<string, { a: number; p: Promise<Prevision | null> }>();

export function previsionDuLieu(ville: string): Promise<Prevision | null> {
  const cle = ville.toLowerCase();
  const gardee = cache.get(cle);
  if (gardee && Date.now() - gardee.a < DUREE_CACHE_MS) return gardee.p;
  const p = fetchPrevisionByCity(ville).catch(() => null);
  cache.set(cle, { a: Date.now(), p });
  // Une réponse vide n'est pas gardée : le prochain affichage retente.
  void p.then((r) => {
    if (!r) cache.delete(cle);
  });
  return p;
}

/** Jours entre aujourd'hui et le jour du plan (négatif : passé). */
export const ecartJoursDuPlan = (jour: string, aujourdhui: string = jourLocal()): number =>
  Math.round((new Date(`${jour}T12:00:00`).getTime() - new Date(`${aujourdhui}T12:00:00`).getTime()) / 86400000);

export function useMeteoDuPlan(plan: Pick<TenuePlanifiee, "id" | "jour" | "moment" | "lieu"> | null): MeteoMoment | null {
  const ville = plan ? villeDuLieu(plan.lieu) : "";
  const ecart = plan ? ecartJoursDuPlan(plan.jour) : null;
  const eligible = Boolean(plan && ville && ecart != null && ecart >= 0 && ecart <= HORIZON_PREVISION_JOURS);
  const cle = eligible && plan ? `${plan.id}|${ville}` : null;
  const [reponse, setReponse] = useState<{ cle: string; p: Prevision | null } | null>(null);
  useEffect(() => {
    if (!cle) return;
    let annule = false;
    void previsionDuLieu(ville).then((p) => {
      if (!annule) setReponse({ cle, p });
    });
    return () => {
      annule = true;
    };
  }, [cle, ville]);
  return plan && reponse && reponse.cle === cle && reponse.p ? previsionPour(reponse.p, plan.jour, plan.moment) : null;
}
