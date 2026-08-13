"use client";

import { APP_VERSION } from "@/lib/data";
import { useCapsela } from "@/lib/store";

const LEGAL_ROWS = [
  { label: "Mentions légales", sub: "Éditeur, hébergeur, contact" },
  { label: "Politique de confidentialité", sub: "Données collectées et usages" },
  { label: "Conditions générales d'utilisation", sub: "Règles du service" },
  { label: "Tes droits (RGPD)", sub: "Accès, rectification, suppression" },
  { label: "Cookies et traceurs", sub: "Préférences de mesure" },
];

export default function LegalScreen() {
  const { actions } = useCapsela();

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-[100px]">
      <div className="flex items-center gap-[14px] mt-[10px]">
        <button
          onClick={actions.backFromLegal}
          className="w-[38px] h-[38px] rounded-full bg-card border border-border flex items-center justify-center text-[17px] text-ink cursor-pointer"
        >
          ←
        </button>
        <div className="font-serif text-[24px] text-ink">Informations légales</div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden mt-5">
        {LEGAL_ROWS.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between gap-3 px-4 py-[15px] border-b border-border last:border-b-0 cursor-pointer"
          >
            <div className="min-w-0">
              <div className="text-[13.5px] text-ink">{r.label}</div>
              <div className="text-[11px] text-muted mt-[2px]">{r.sub}</div>
            </div>
            <span className="text-terracotta text-[16px] flex-shrink-0">›</span>
          </div>
        ))}
      </div>

      <div className="text-[11px] text-muted mt-[14px] leading-[1.5]">L&apos;édit Capsela · version {APP_VERSION}</div>
    </div>
  );
}
