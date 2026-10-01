"use client";

import { useEffect } from "react";
import BoutonRetour from "@/components/BoutonRetour";
import { RenduMarkdown } from "@/components/legal/RenduMarkdown";
import { DOCUMENTS_LEGAUX, estProvisoire } from "@/lib/legal/documents";
import { CONTENU_LEGAL } from "@/lib/legal/contenu";
import { lireMarkdown } from "@/lib/legal/markdown";
import { useCapsela } from "@/lib/store";

/**
 * Un texte légal, DANS la fenêtre de l'app (01/10/2026, demandé : « dans la même
 * fenêtre que l'app, aux mêmes formats »). Calque par-dessus l'écran courant et
 * non un écran de plus : depuis l'inscription ou la date de naissance, l'écran
 * dessous reste monté, donc la saisie en cours n'est pas perdue. Même gouttière,
 * même bouton de retour, mêmes titres que les autres écrans. Les pages publiques
 * /legal/<slug> restent pour les stores et la LCEN.
 */
export default function LegalDocOverlay() {
  const { state, actions } = useCapsela();
  const slug = state.legalDoc;
  const doc = slug ? DOCUMENTS_LEGAUX.find((d) => d.slug === slug) : undefined;
  const source = slug ? CONTENU_LEGAL[slug] : undefined;

  useEffect(() => {
    if (!slug) return;
    const surEchap = (e: KeyboardEvent) => {
      if (e.key === "Escape") actions.closeLegalDoc();
    };
    window.addEventListener("keydown", surEchap);
    return () => window.removeEventListener("keydown", surEchap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  if (!doc || !source) return null;

  return (
    <div role="dialog" aria-label={doc.titre} className="absolute inset-0 z-[100] bg-cream">
      <div key={doc.slug} className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-[100px]">
        <div className="mt-[10px]">
          <BoutonRetour onClick={actions.closeLegalDoc} label="Fermer et revenir à l'écran précédent" />
        </div>
        {estProvisoire(source) && (
          <div className="mt-5 bg-card border border-border rounded-xl px-4 py-3 text-[12px] text-muted leading-[1.5]">
            Version provisoire : certaines informations de l&apos;éditeur ne sont pas encore renseignées.
          </div>
        )}
        <div className="mt-4">
          <RenduMarkdown blocs={lireMarkdown(source)} />
        </div>
      </div>
    </div>
  );
}
