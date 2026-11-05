"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { Driver, DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { useAuth } from "@/lib/auth";
import { t } from "@/lib/langue";
import { ecrireVuesLocales, lireVuesLocales, oublierDemande, suivreDemandes, visiteDemandee, vuesReunies } from "@/lib/memoireVisites";
import { useCapsela } from "@/lib/store";
import { selecteurCible, visiteAMontrer, type Visite } from "@/lib/visites";

/*
 * LES VISITES GUIDÉES (05/11/2026, docs/visites-guidees.md) — le SEUL endroit qui manipule Driver.js. Monté une fois dans App.tsx.
 *
 * - Une visite par écran (lib/visites.ts), lancée à la première ouverture de l'écran une fois le compte prêt, ou relancée depuis
 *   l'Aide (Gérer mon compte → Support), même déjà vue.
 * - Elle attend que sa première cible soit affichée (l'écran se monte, les données arrivent), puis ne garde que les étapes dont
 *   l'élément existe : une cible absente (dressing vide, autre onglet) est sautée, jamais une étape vide. Aucune cible : la visite
 *   n'est pas lancée, ni marquée vue.
 * - Fermée de n'importe quelle façon (« Passer », « C'est parti », le voile, Échap, le Retour d'Android, un changement d'écran),
 *   elle est marquée vue — sur l'appareil, puis dans le compte. Rien ne bloque la navigation.
 * - Une seule instance à la fois, détruite au changement d'écran et au démontage.
 */

/** Le temps laissé à l'écran pour s'afficher (son animation d'arrivée) avant la visite. */
const DELAI_AVANT_VISITE = 900;
/** Le temps maximal d'attente de la première cible. */
const ATTENTE_MAX_CIBLE = 4000;

function attendreCible(selecteur: string, max: number, signal: { annule: boolean }): Promise<boolean> {
  return new Promise((resolve) => {
    const debut = Date.now();
    const verifier = () => {
      if (signal.annule) return resolve(false);
      if (document.querySelector(selecteur)) return resolve(true);
      if (Date.now() - debut > max) return resolve(false);
      window.setTimeout(verifier, 150);
    };
    verifier();
  });
}

export default function VisiteGuidee() {
  const { state } = useCapsela();
  const auth = useAuth();
  const ecran = state.screen;
  const pret = auth.signedIn && auth.profileLoaded && auth.profile.completed;
  const userId = auth.userId;
  const demandee = useSyncExternalStore(suivreDemandes, visiteDemandee, () => null);
  const duCompte = auth.profile.prefs.visitesVues;
  // Relue à chaque rendu utile : l'appareil peut avoir marqué une visite que le compte n'a pas encore reçue.
  const vues = useMemo(() => (typeof window === "undefined" ? duCompte ?? [] : vuesReunies(duCompte, lireVuesLocales(userId))), [duCompte, userId]);
  const visite = visiteAMontrer(ecran, vues, pret, demandee);
  const idVisite = visite?.id ?? null;
  // Le profil le plus récent, lu au moment de marquer la visite : jamais celui, peut-être dépassé, de son lancement.
  const profilRef = useRef(auth.profile);
  useEffect(() => {
    profilRef.current = auth.profile;
  });

  useEffect(() => {
    if (!visite) return;
    const signal = { annule: false };
    let instance: Driver | null = null;

    const marquerVue = (v: Visite) => {
      const locales = vuesReunies(lireVuesLocales(userId), [v.id]);
      ecrireVuesLocales(userId, locales);
      const profil = profilRef.current;
      const compte = profil.prefs.visitesVues ?? [];
      if (!compte.includes(v.id)) {
        void auth.saveProfile({ ...profil, prefs: { ...profil.prefs, visitesVues: vuesReunies(compte, [v.id]) } });
      }
    };

    // Le Retour d'Android ferme ce qui est ouvert par-dessus en envoyant Échap (retourSysteme.ts) ; Driver.js n'écoute que le
    // relâchement de la touche : on ferme la visite dès l'appui.
    const surEchap = (e: KeyboardEvent) => {
      if (e.key === "Escape" && instance?.isActive()) instance.destroy();
    };

    const minuteur = window.setTimeout(async () => {
      const premiere = selecteurCible(visite.etapes[0].cible);
      const presente = await attendreCible(premiere, ATTENTE_MAX_CIBLE, signal);
      if (signal.annule) return;
      const etapes = visite.etapes.filter((e) => document.querySelector(selecteurCible(e.cible)));
      if (!presente && etapes.length === 0) return;
      const { driver } = await import("driver.js");
      if (signal.annule) return;
      const steps: DriveStep[] = etapes.map((e, i) => ({
        element: selecteurCible(e.cible),
        popover: {
          title: t(e.titre),
          description: t(e.texte),
          showButtons: i === 0 ? ["next", "close"] : ["next", "previous", "close"],
        },
      }));
      const reduit = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      instance = driver({
        steps,
        animate: !reduit,
        smoothScroll: !reduit,
        overlayColor: "#1d1a16",
        overlayOpacity: 0.34,
        stagePadding: 6,
        stageRadius: 14,
        popoverOffset: 12,
        popoverClass: "capsela-visite",
        showProgress: steps.length > 1,
        progressText: "{{current}} / {{total}}",
        nextBtnText: t("Suivant"),
        prevBtnText: t("Retour"),
        doneBtnText: t("C'est parti"),
        closeBtnLabel: t("Passer la visite"),
        allowKeyboardControl: true,
        overlayClickBehavior: "close",
        onPopoverRender: (popover) => {
          // « Passer » en toutes lettres plutôt que la croix ; la fenêtre est un dialogue (le Retour d'Android la ferme d'abord).
          popover.closeButton.textContent = t("Passer");
          popover.wrapper.setAttribute("role", "dialog");
          popover.wrapper.setAttribute("aria-live", "polite");
        },
        onDestroyed: () => {
          document.removeEventListener("keydown", surEchap, true);
          // La demande de l'Aide est servie : elle ne se rejoue pas. Effacée seulement ici, sinon un rendu pendant la visite la
          // ferait disparaître (une visite déjà vue n'est plus « à montrer »).
          oublierDemande();
          marquerVue(visite);
        },
      });
      document.addEventListener("keydown", surEchap, true);
      instance.drive();
    }, DELAI_AVANT_VISITE);

    return () => {
      signal.annule = true;
      window.clearTimeout(minuteur);
      document.removeEventListener("keydown", surEchap, true);
      if (instance?.isActive()) instance.destroy();
    };
    // La visite se rejoue sur un changement d'écran, de compte ou de demande — pas à chaque rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idVisite, ecran, userId]);

  return null;
}
