"use client";

import { useEffect } from "react";
import AppHeader from "@/components/AppHeader";
import { CarteAvis } from "@/components/AvisEnregistresJournal";
import { trierAvisRecents } from "@/lib/avisJournal";
import { useCapsela } from "@/lib/store";

/*
 * TOUS MES AVIS DE STYLISTE — « Voir tout → » de la section du Journal
 * (26/09/2026). Même carte que le Journal (CarteAvis), du plus récent au plus
 * ancien ; un clic rouvre l'avis complet, et son retour ramène ici. En-tête
 * global de Capsela, barre du bas conservée.
 */
export default function AvisTousScreen() {
  const { actions, avisEnregistres } = useCapsela();

  useEffect(() => {
    // Relue aussi quand elle est trop vieille : l'app reste ouverte, les liens signés des photos expirent.
    if (avisEnregistres === null || actions.avisEnregistresPerimes()) actions.chargerAvisEnregistres();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avisEnregistres]);

  const avis = trierAvisRecents(avisEnregistres ?? []);

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
      {/* « Mes avis. » dans le bandeau, sans surtitre (13/11/2026, tableau validé). */}
      <AppHeader onBack={actions.goHistory} backLabel="Revenir au journal" titre={<>Mes <span className="italic">avis</span></>} />
      {avis.length > 0 && (
        <div className="t-chapeau text-muted-3">
          {avis.length} {avis.length > 1 ? "avis gardés" : "avis gardé"} dans ton Journal, du plus récent au plus ancien.
        </div>
      )}
      <div className="flex flex-col gap-[10px] mt-[20px]">
        {avis.map((a) => (
          <CarteAvis key={a.id} avis={a} onOuvrir={actions.ouvrirAvisEnregistre} />
        ))}
      </div>
    </div>
  );
}
