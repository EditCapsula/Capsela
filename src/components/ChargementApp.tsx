"use client";

import { useEffect, useState } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { ASTUCES, CLE_DERNIERE_ASTUCE, choisirAstuce } from "@/lib/astuces";
import { t } from "@/lib/langue";

/*
 * L'ÉCRAN DE CHARGEMENT DE L'APPLICATION (05/11/2026) : le monogramme qui tourne, et dessous une astuce sur une fonction de
 * Capsela (lib/astuces.ts). Affiché avant que l'app ne soit chargée (AppLoader) puis tant que la session n'est pas lue (App).
 *
 * L'astuce est choisie APRÈS le montage : ce composant est aussi rendu dans la page statique (export Next), où un tirage au
 * hasard figerait une astuce dans le HTML et différerait du rendu côté navigateur.
 */
export default function ChargementApp() {
  const [astuce, setAstuce] = useState<string | null>(null);
  useEffect(() => {
    let precedente: number | null = null;
    try {
      const lue = Number.parseInt(localStorage.getItem(CLE_DERNIERE_ASTUCE) ?? "", 10);
      precedente = Number.isFinite(lue) ? lue : null;
    } catch {
      precedente = null;
    }
    const i = choisirAstuce(precedente, Math.random());
    try {
      localStorage.setItem(CLE_DERNIERE_ASTUCE, String(i));
    } catch {
      // Stockage indisponible : l'astuce s'affiche quand même.
    }
    // Lu sur l'appareil après le montage : il n'existe pas pendant le rendu statique.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAstuce(t(ASTUCES[i]));
  }, []);

  return (
    <div className="relative w-full max-w-[480px] mx-auto h-dvh flex flex-col items-center justify-center bg-cream px-8">
      <LoadingSpinner size={76} />
      {/* Hauteur réservée : le monogramme ne bouge pas quand l'astuce apparaît. */}
      <div className="mt-8 min-h-[92px] max-w-[320px] text-center" aria-live="polite">
        {astuce && (
          <div className="motion-safe:animate-[capsule-apparition_320ms_ease-out_both]">
            <div className="t-surtitre text-terracotta">{t("Le savais-tu ?")}</div>
            <p className="mt-[8px] text-[14px] leading-[1.5] text-muted-3">{astuce}</p>
          </div>
        )}
      </div>
    </div>
  );
}
