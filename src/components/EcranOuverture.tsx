"use client";

import { useEffect, useState } from "react";
import { t } from "@/lib/langue";
import LogoCapsela from "@/components/LogoCapsela";
import { FOND_CREME, FOND_ENCRE, poserFondSysteme } from "@/lib/fondSysteme";

/**
 * L'ÉCRAN D'OUVERTURE (24/11/2026, demandé : « à l'affichage volontaire de l'app, on affiche l'écran » — celui sur fond noir avec le
 * logo, qu'une personne connectée ne revoyait jamais : l'écran de bienvenue n'existe que déconnecté). À CHAQUE LANCEMENT de l'app
 * (pas au retour depuis l'arrière-plan : le composant n'est monté qu'une fois par lancement), le logo et la promesse de l'écran de
 * bienvenue, sans ses boutons, pendant 1,4 s, puis un fondu vers l'écran de l'app — qui s'est chargé derrière, rien n'attend.
 * Affiché dès le montage, avant que la session ne décide de l'écran (qui vaut « bienvenue » tant qu'elle n'a rien dit) : sur l'écran
 * de bienvenue, même fond et même logo, le fondu ne se voit presque pas. Toucher l'écran le referme aussitôt.
 */
const DUREE_MS = 1400;
const FONDU_MS = 400;

export default function EcranOuverture({ surBienvenue }: { surBienvenue: boolean }) {
  const [etape, setEtape] = useState<"visible" | "fondu" | "fini">("visible");
  useEffect(() => {
    if (etape === "fini") return;
    poserFondSysteme(FOND_ENCRE);
    const a = setTimeout(() => setEtape("fondu"), etape === "visible" ? DUREE_MS : 0);
    const b = setTimeout(() => setEtape("fini"), (etape === "visible" ? DUREE_MS : 0) + FONDU_MS);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [etape]);
  useEffect(() => {
    // Les barres système rendues au fond de l'écran affiché (App.tsx les repose à chaque changement d'écran).
    if (etape === "fini") poserFondSysteme(surBienvenue ? FOND_ENCRE : FOND_CREME);
  }, [etape, surBienvenue]);
  if (etape === "fini") return null;
  return (
    <div
      aria-hidden="true"
      onClick={() => setEtape("fondu")}
      className="absolute inset-0 z-[70] flex flex-col justify-center items-center text-center px-[34px] bg-ink transition-opacity ease-out motion-reduce:transition-none"
      style={{ opacity: etape === "fondu" ? 0 : 1, transitionDuration: `${FONDU_MS}ms` }}
    >
      <LogoCapsela taille="lg" claire />
      <div className="font-serif italic text-[21px] text-cream-dark-soft mt-5 leading-[1.35]">
        {t("La bonne tenue,")}
        <br />
        {t("au bon moment")}
      </div>
    </div>
  );
}
