"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Filet de sécurité d'affichage (ajouté le 09/09/2026, audit avant
 * lancement) : l'app est une seule route dont tous les écrans sont des
 * composants client. Sans cette limite, une erreur de rendu dans n'importe
 * lequel d'entre eux remontait jusqu'à la page d'erreur par défaut de Next —
 * sans en-tête, sans typographie, sans aucun retour possible vers l'app.
 * Sentry l'enregistrait ; l'utilisatrice, elle, voyait un écran technique.
 *
 * `reset()` remonte le sous-arbre : l'état du store est reconstruit depuis le
 * stockage local, donc une erreur passagère se répare sans quitter l'app.
 * Le message reste volontairement non technique — le détail part à Sentry,
 * pas à l'écran.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="absolute inset-0 bg-cream flex flex-col items-center justify-center px-9 text-center">
      <div className="text-[12px] tracking-[.2em] uppercase text-terracotta">Un instant</div>
      <h1 className="font-serif text-[28px] leading-[1.2] text-ink mt-4">
        L&apos;édit n&apos;a pas pu s&apos;afficher.
      </h1>
      <p className="text-[13px] text-[#6B6459] mt-3 leading-[1.55] max-w-[300px]">
        Rien n&apos;est perdu — ton dressing et tes tenues enregistrées sont intacts.
      </p>
      <button
        onClick={reset}
        className="mt-8 bg-terracotta active:bg-terracotta-hover text-cream rounded-full py-4 px-10 text-[13px] tracking-[.1em] uppercase cursor-pointer"
      >
        Réessayer
      </button>
    </div>
  );
}
