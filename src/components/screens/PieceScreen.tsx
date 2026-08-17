"use client";

import { useState } from "react";
import { CATLABEL, OCC_LABELS, wornAgo } from "@/lib/data";
import { bestStyleFor } from "@/lib/capsule";
import { useCapsela } from "@/lib/store";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[11px] tracking-[.08em] uppercase text-placeholder">{label}</span>
      <span className="text-[13px] text-ink">{value}</span>
    </div>
  );
}

export default function PieceScreen() {
  const { state, actions, vestiairePool } = useCapsela();
  const [suggestionInfoOpen, setSuggestionInfoOpen] = useState(false);
  const active = state.activeSuggested
    ? vestiairePool.find((i) => i.id === state.activeId)
    : state.items.find((i) => i.id === state.activeId);
  if (!active) return null;

  const suggested = state.activeSuggested;
  const pNever = active.worn == null;
  const pToday = active.worn === 0;

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-[100px]">
      <button
        onClick={() => actions.go(state.pieceReturn)}
        className="w-[38px] h-[38px] rounded-full bg-card border border-border flex items-center justify-center text-[17px] text-ink cursor-pointer"
      >
        ←
      </button>

      <div
        className="w-full rounded-[18px] border border-border overflow-hidden mt-[18px]"
        style={{ aspectRatio: "4/5", background: active.hex, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.06)" }}
      />

      {suggested && (
        <div>
          <button
            onClick={() => setSuggestionInfoOpen((v) => !v)}
            className="inline-flex items-center gap-[6px] mt-4 text-[9px] tracking-[.08em] uppercase text-terracotta bg-[#F0E5D6] rounded-full py-1 px-[10px] cursor-pointer"
          >
            Suggestion
            <span className="w-[13px] h-[13px] rounded-full border border-[#C9966F] text-[8px] normal-case flex items-center justify-center">
              i
            </span>
          </button>
          {suggestionInfoOpen && (
            <div className="mt-[9px] bg-[#F0E5D6] rounded-[11px] px-3 py-[11px] text-[11.5px] text-[#3F3B34] leading-[1.5]">
              Cette pièce vient de ta capsule de départ : tu n&apos;as pas encore ajouté de pièce de cette catégorie à
              ton dressing. Ajoute-la si tu l&apos;as déjà, ou remplace-la par une des tiennes.
            </div>
          )}
        </div>
      )}

      <div className="text-[11px] tracking-[.14em] uppercase text-muted mt-[14px]">
        {CATLABEL[active.cat].toUpperCase()}
      </div>
      <div className="font-serif text-[24px] text-ink mt-1">{active.name}</div>
      <div className="text-[13px] text-muted mt-[6px]">{active.color}</div>

      {!suggested && (
        <div className="flex items-center gap-[9px] mt-5 bg-card border border-border rounded-[14px] px-4 py-[14px]">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: pNever ? "#A66950" : "#7B7366" }}
          />
          <span className="text-[13px]" style={{ color: pNever ? "#A66950" : "#7B7366" }}>
            {pNever ? "Jamais porté" : wornAgo(active.worn)}
          </span>
        </div>
      )}

      <div className="flex flex-col gap-[9px] mt-3 bg-card border border-border rounded-[14px] px-4 py-[14px]">
        {active.brand && <InfoRow label="Marque" value={active.brand} />}
        <InfoRow label="Taille" value={active.size || "—"} />
        <InfoRow label="Style" value={bestStyleFor(active)} />
        <InfoRow
          label="Occasion"
          value={active.occasion && active.occasion.length ? active.occasion.map((o) => OCC_LABELS[o]).join(", ") : "—"}
        />
        <InfoRow label="Saison" value={active.season} />
        {active.matiere && <InfoRow label="Matière" value={active.matiere} />}
        {active.coupe && <InfoRow label="Coupe" value={active.coupe} />}
        {active.sacType && <InfoRow label="Type de sac" value={active.sacType} />}
        {active.bijouType && <InfoRow label="Type de bijou" value={active.bijouType} />}
        {active.accessoireType && <InfoRow label="Type d'accessoire" value={active.accessoireType} />}
        {active.subtype && <InfoRow label="Type" value={active.subtype} />}
      </div>

      {suggested ? (
        <>
          <button
            onClick={() => actions.startReplace(active.id, active.cat)}
            className="mt-[18px] w-full bg-terracotta text-cream text-center rounded-full py-[15px] text-[13px] tracking-[.08em] uppercase cursor-pointer"
          >
            J&apos;ai déjà ça
          </button>
          {active.affLink && (
            <a
              href={active.affLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-[10px] block w-full text-center border border-border-soft text-terracotta rounded-full py-[13px] text-[12.5px] cursor-pointer"
            >
              Acheter
            </a>
          )}
        </>
      ) : (
        <>
          {pToday ? (
            <div className="mt-[18px] flex items-center gap-3 bg-ink rounded-2xl px-4 py-[14px]">
              <span className="w-8 h-8 rounded-full bg-terracotta text-cream flex items-center justify-center text-[15px] flex-shrink-0">
                ✓
              </span>
              <div className="flex-1">
                <div className="text-[14px] text-cream">Portée aujourd&apos;hui</div>
                <div className="text-[11px] text-cream-dark-muted mt-[2px]">Ajoutée à ton journal</div>
              </div>
              <button
                onClick={actions.correctActive}
                className="flex items-center gap-1 text-[11px] text-gold cursor-pointer"
              >
                Corriger
              </button>
            </div>
          ) : (
            <button
              onClick={actions.wearActiveToday}
              className="mt-[18px] w-full bg-ink text-cream text-center rounded-full py-[15px] text-[13px] tracking-[.1em] uppercase cursor-pointer"
            >
              Porter aujourd&apos;hui
            </button>
          )}
          {pNever && (
            <button
              onClick={actions.goNeverWorn}
              className="mt-[10px] w-full flex items-center justify-center gap-2 border border-warm-border bg-warm-bg text-terracotta text-center rounded-full py-[14px] text-[12.5px] cursor-pointer"
            >
              <span>↻</span> Envisager de la revendre
            </button>
          )}
          <button
            onClick={actions.removeActive}
            className="mt-[10px] w-full text-center border border-border-soft text-rust rounded-full py-[13px] text-[12.5px] cursor-pointer"
          >
            Retirer de mon dressing
          </button>
        </>
      )}
    </div>
  );
}
