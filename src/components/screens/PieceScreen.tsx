"use client";

import { useEffect, useState } from "react";
import { CATLABEL, OCC_LABELS, wornAgo } from "@/lib/data";
import { bestStyleFor } from "@/lib/capsule";
import { isCoupeApplicable, isSizeApplicable, suggestName } from "@/lib/attributes";
import { daysSinceWorn } from "@/lib/selectors";
import { useCapsela } from "@/lib/store";
import { resolveItemImage } from "@/lib/catalogImages";
import BottomSheet from "@/components/BottomSheet";

/** Pièce jamais portée depuis au moins ce délai avant que le module revente contextuel s'affiche (recette 24/08/2026, point 7 du brief PieceScreen) — première approche heuristique, comme suggestOccasions ; ajustable plus tard sans changer la logique. */
const DORMANT_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-[11px] tracking-[.08em] uppercase text-placeholder flex-shrink-0">{label}</span>
      <span className="text-[13px] text-ink text-right">{value}</span>
    </div>
  );
}

function CharRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-[8px] text-[11px] tracking-[.08em] uppercase text-placeholder flex-shrink-0">
        <span className="text-terracotta flex-shrink-0">{icon}</span>
        {label}
      </span>
      <span className="text-[13px] text-ink text-right">{value}</span>
    </div>
  );
}

function TicketIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h15A1.5 1.5 0 0 1 21 8.5v1.6a1.9 1.9 0 0 0 0 3.8v1.6A1.5 1.5 0 0 1 19.5 17h-15A1.5 1.5 0 0 1 3 15.5v-1.6a1.9 1.9 0 0 0 0-3.8V8.5z" />
      <path d="M9 7v10" strokeDasharray="1.6 2.2" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 9.5h17M8 3v3.4M16 3v3.4" />
    </svg>
  );
}
function LeafIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15c0-7 5.5-11 16-11 0 11-4.5 16.5-11.5 16.5C5 20.5 4 18 4 15z" />
      <path d="M5 20L15 10" />
    </svg>
  );
}
function FabricIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M4 8l16 8M4 12l16 8M4 4l16 8M8 4L4 8m16 8l-4 4" />
    </svg>
  );
}
function TshirtIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 4L4 7.2l2.4 2.6L8 8.4V20h8V8.4l1.6 1.4 2.4-2.6L16 4l-4 1.8L8 4z" />
    </svg>
  );
}
function HangerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3.2a1.5 1.5 0 1 1 1.3 2.3L12 7" />
      <path d="M12 7l9.3 6.6a1.4 1.4 0 0 1-.9 2.5H3.6a1.4 1.4 0 0 1-.9-2.5L12 7z" />
    </svg>
  );
}
function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20l.9-4L16.5 4.4a1.4 1.4 0 0 1 2 0l1.1 1.1a1.4 1.4 0 0 1 0 2L8 19 4 20z" />
      <path d="M14.5 6.4l3 3" />
    </svg>
  );
}
function CameraIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h3l1.6-2.4h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.4" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 .8 12.1A2 2 0 0 0 7.8 21h8.4a2 2 0 0 0 2-1.9L19 7" />
    </svg>
  );
}
function BulbIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6M10 21h4M8 14.5A5.5 5.5 0 1 1 16 14.5c-.7.8-1.3 1.6-1.4 2.5H9.4c-.1-.9-.7-1.7-1.4-2.5z" />
    </svg>
  );
}

export default function PieceScreen() {
  const { state, actions, vestiairePool } = useCapsela();
  const [suggestionInfoOpen, setSuggestionInfoOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lookSheetOpen, setLookSheetOpen] = useState(false);
  const [dormant, setDormant] = useState(false);
  const active = state.activeSuggested
    ? vestiairePool.find((i) => i.id === state.activeId)
    : state.items.find((i) => i.id === state.activeId);

  useEffect(() => {
    if (!active || !state.activeSuggested) return;
    if (
      resolveItemImage(active).kind === "placeholder" &&
      active.imageStatus !== "generating" &&
      active.imageStatus !== "error" &&
      active.imageStatus !== "invalid"
    ) {
      actions.requestCatalogImage(active.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, state.activeSuggested]);

  // Module revente contextuel (recette 24/08/2026, point 7 du brief PieceScreen)
  // — Date.now() est impur, jamais lu directement pendant le rendu : calculé
  // dans un effet, pas de compte à rebours en direct nécessaire, une seule
  // évaluation après montage/changement de pièce suffit.
  useEffect(() => {
    const next = Boolean(
      active &&
        !state.activeSuggested &&
        active.worn == null &&
        active.createdAt != null &&
        Date.now() - active.createdAt > DORMANT_THRESHOLD_MS
    );
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDormant(next);
  }, [active, state.activeSuggested]);

  if (!active) return null;

  const suggested = state.activeSuggested;
  const pNever = active.worn == null;
  // Jours réels depuis le dernier port, dérivés de l'historique plutôt que
  // du champ worn stocké (correctif 25/08/2026, même cause que "Mes
  // pièces" : worn est figé par la dernière action "porter" et ne vieillit
  // jamais tout seul — "Porté aujourd'hui" restait sinon affiché
  // indéfiniment). Non calculé pour une pièce suggérée, qui n'affiche pas
  // ce statut.
  const daysWorn = !suggested && !pNever ? daysSinceWorn(state.history, active.id) : null;
  const resolvedImage = resolveItemImage(active);

  // Type unifié (chaussure/sac/bijou/accessoire/sous-type générique) — même
  // hiérarchie que typeOptionsFor/typeValue côté AddScreen, en lecture seule ici.
  const typeValue = active.shoeType || active.sacType || active.bijouType || active.accessoireType || active.subtype || null;
  const eyebrow = (typeValue || CATLABEL[active.cat]).toUpperCase();
  const displayName =
    active.name && active.name !== "Nouvelle pièce"
      ? active.name
      : suggestName(active.cat, active.subtype, active.matiere, active.color);
  const synthesis = [CATLABEL[active.cat], active.matiere, active.color].filter(Boolean).join(" · ");

  const sizeApplicable = isSizeApplicable(active.cat);
  const coupeApplicable = isCoupeApplicable(active.cat);
  const isShoe = active.cat === "chaussures";

  const addableLooks = state.savedLooks.filter((l) => !l.pieceIds.includes(active.id));

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-[100px]">
      <div className="flex items-center justify-between">
        <button
          onClick={() => actions.go(state.pieceReturn)}
          className="w-[38px] h-[38px] rounded-full bg-card border border-border flex items-center justify-center text-[17px] text-ink cursor-pointer"
        >
          ←
        </button>
        {!suggested && (
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Options"
            className="w-[38px] h-[38px] rounded-full bg-card border border-border flex items-center justify-center text-[17px] text-ink cursor-pointer"
          >
            ⋯
          </button>
        )}
      </div>

      <div
        className="w-full rounded-[18px] border border-border overflow-hidden mt-[14px] relative"
        style={
          resolvedImage.kind === "generated"
            ? { aspectRatio: "4/5", background: "#F3EDE1" }
            : resolvedImage.url
              ? { aspectRatio: "4/5", backgroundImage: `url(${resolvedImage.url})`, backgroundSize: "cover", backgroundPosition: "center" }
              : { aspectRatio: "4/5", background: active.hex, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.06)" }
        }
      >
        {resolvedImage.kind === "generated" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolvedImage.url}
            alt={active.name}
            style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center", padding: 18, boxSizing: "border-box" }}
          />
        )}
        {resolvedImage.kind === "placeholder" && active.imageStatus === "generating" && (
          <span className="absolute inset-0 animate-pulse" style={{ background: "rgba(243,238,229,.35)" }} />
        )}
      </div>

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

      <div className="text-[11px] tracking-[.14em] uppercase text-muted mt-[14px]">{eyebrow}</div>
      <div className="font-serif text-[24px] text-ink mt-1">{displayName}</div>
      {synthesis && <div className="text-[13px] text-warm-text mt-[6px]">{synthesis}</div>}

      {!suggested && (
        <div className="flex items-center justify-center gap-[9px] mt-5 bg-card border border-border rounded-full px-4 py-[13px]">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: pNever ? "#A66950" : "#7B7366" }}
          />
          <span className="text-[13px]" style={{ color: pNever ? "#A66950" : "#7B7366" }}>
            {pNever ? "Jamais porté" : wornAgo(daysWorn ?? active.worn)}
          </span>
        </div>
      )}

      {suggested ? (
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
      ) : (
        <div className="flex flex-col gap-[11px] mt-3 bg-card border border-border rounded-[14px] px-4 py-[14px]">
          {active.brand && <InfoRow label="Marque" value={active.brand} />}
          {sizeApplicable && (
            <CharRow icon={<TicketIcon />} label={isShoe ? "Pointure" : "Taille"} value={active.size || "Non renseignée"} />
          )}
          <CharRow
            icon={<CalendarIcon />}
            label="Occasions"
            value={active.occasion && active.occasion.length ? active.occasion.map((o) => OCC_LABELS[o]).join(", ") : "Non renseignée"}
          />
          <CharRow icon={<LeafIcon />} label="Saison" value={active.season} />
          <CharRow icon={<FabricIcon />} label="Matière" value={active.matiere || "Non renseignée"} />
          {coupeApplicable && <CharRow icon={<TshirtIcon />} label="Coupe" value={active.coupe || "Non renseignée"} />}
          <CharRow icon={<HangerIcon />} label="Type" value={typeValue || CATLABEL[active.cat]} />
        </div>
      )}

      {suggested ? (
        <>
          <button
            onClick={() => actions.startReplace(active)}
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
          <button
            onClick={() => actions.openItemOutfits(active.id, false)}
            className="mt-[18px] w-full bg-ink text-cream text-center rounded-full py-[15px] text-[13px] tracking-[.1em] uppercase cursor-pointer"
          >
            ✦ Voir des tenues avec cette pièce
          </button>
          <button
            onClick={() => setLookSheetOpen(true)}
            className="mt-[10px] w-full border border-border-soft text-terracotta text-center rounded-full py-[14px] text-[12.5px] tracking-[.08em] uppercase cursor-pointer"
          >
            ♡ Ajouter à un look
          </button>

          {dormant && (
            <button
              onClick={actions.goNeverWorn}
              className="mt-[14px] w-full flex items-center gap-[12px] bg-warm-bg border border-warm-border rounded-[16px] px-4 py-[13px] cursor-pointer text-left"
            >
              <span className="w-[32px] h-[32px] rounded-full bg-terracotta text-cream flex items-center justify-center flex-shrink-0">
                <BulbIcon />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-ink">Cette pièce dort dans ton dressing.</div>
                <div className="text-[11.5px] text-terracotta mt-[3px]">Que faire avec ? →</div>
              </div>
              <span className="text-terracotta text-[16px] flex-shrink-0">›</span>
            </button>
          )}
        </>
      )}

      {!suggested && (
        <BottomSheet title="Cette pièce" open={menuOpen} onClose={() => setMenuOpen(false)}>
          <div className="flex flex-col">
            <button
              onClick={() => {
                setMenuOpen(false);
                actions.startEditItem(active);
              }}
              className="flex items-center gap-[13px] py-[15px] text-[14px] text-ink border-b border-border cursor-pointer text-left"
            >
              <EditIcon /> Modifier les informations
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                actions.startEditItem(active);
              }}
              className="flex items-center gap-[13px] py-[15px] text-[14px] text-ink border-b border-border cursor-pointer text-left"
            >
              <CameraIcon /> Changer la photo
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                actions.removeActive();
              }}
              className="flex items-center gap-[13px] py-[15px] text-[14px] text-rust cursor-pointer text-left"
            >
              <TrashIcon /> Retirer de mon dressing
            </button>
          </div>
        </BottomSheet>
      )}

      {!suggested && (
        <BottomSheet title="Ajouter à un look" open={lookSheetOpen} onClose={() => setLookSheetOpen(false)}>
          <div className="flex flex-col gap-[8px]">
            {addableLooks.length === 0 && state.savedLooks.length > 0 && (
              <div className="text-[12.5px] text-muted mb-[6px]">Cette pièce fait déjà partie de tous tes looks enregistrés.</div>
            )}
            {addableLooks.map((look) => (
              <button
                key={look.id}
                onClick={() => {
                  actions.addPieceToLook(look.id, active.id);
                  setLookSheetOpen(false);
                }}
                className="flex items-center justify-between gap-3 bg-card border border-border rounded-[14px] px-4 py-[13px] cursor-pointer text-left"
              >
                <div className="min-w-0">
                  <div className="text-[13.5px] text-ink truncate">{look.name}</div>
                  <div className="text-[11px] text-muted mt-[2px]">
                    {look.pieceIds.length} {look.pieceIds.length > 1 ? "pièces" : "pièce"}
                  </div>
                </div>
                <span className="text-terracotta text-[13px] flex-shrink-0">Ajouter</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              setLookSheetOpen(false);
              actions.goCreateLook(active.id);
            }}
            className="mt-[14px] w-full bg-terracotta text-cream text-center rounded-full py-[14px] text-[12.5px] tracking-[.1em] uppercase cursor-pointer"
          >
            + Créer un nouveau look
          </button>
        </BottomSheet>
      )}
    </div>
  );
}
