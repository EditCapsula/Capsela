"use client";

import Rangee from "@/components/Rangee";
import { APP_VERSION } from "@/lib/data";
import { DOCUMENTS_LEGAUX } from "@/lib/legal/documents";
import { useCapsela } from "@/lib/store";
import BoutonRetour from "@/components/BoutonRetour";
import Card from "@/components/Card";

// Les CGV ne figurent pas ici tant que Premium ne s'achète pas (docs/legal/README.md).
const LEGAL_ROWS = DOCUMENTS_LEGAUX.filter((d) => d.slug !== "cgv");

export default function LegalScreen() {
  const { actions } = useCapsela();

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-[100px]">
      <div className="flex items-center gap-[14px] mt-[10px]">
        <BoutonRetour onClick={actions.backFromLegal} label="Revenir à l'écran précédent" />
        <div className="t-titre-section text-ink">Informations légales</div>
      </div>

      <Card rayon="tuile" className="overflow-hidden mt-5">
        {LEGAL_ROWS.map((r) => (
          <Rangee key={r.slug} onClick={() => actions.openLegalDoc(r.slug)} className="justify-between py-[15px]">
            <div className="min-w-0">
              <div className="text-[13px] text-ink">{r.titre}</div>
              <div className="text-[11px] text-muted mt-[2px]">{r.sousTitre}</div>
            </div>
            <span className="text-terracotta text-[16px] flex-shrink-0">›</span>
          </Rangee>
        ))}
      </Card>

      <div className="text-[11px] text-muted mt-[14px] leading-[1.5]">Capsela · version {APP_VERSION}</div>
    </div>
  );
}
