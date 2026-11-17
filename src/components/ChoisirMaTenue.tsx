"use client";

import BottomSheet from "@/components/BottomSheet";
import { DATE_CONTEXTS, OCCASIONS, WORK_MODES } from "@/lib/data";
import { aTraduire, t } from "@/lib/langue";
import type { DateContext, OccasionKey, WorkMode } from "@/lib/types";

/*
 * « CHOISIR MA TENUE » (17/11/2026, maquette « Capsela — Tenue du jour », validée par la propriétaire). Dans la carte du jour de
 * l'accueil, le surtitre de la tenue devient un sélecteur (« POUR LE TRAVAIL ▾ ») : il ouvre cette feuille, le seul réglage de la carte.
 *
 *   · « Pour quelle occasion ? » : les occasions, chacune avec sa phrase — celle de la table des occasions (OCCASIONS, data.ts), jamais
 *     une phrase écrite pour l'écran ; sous l'occasion cochée, ses sous-choix quand elle en a (Travail : Présentiel, Télétravail,
 *     Entretien ; Rendez-vous : ses contextes), les mêmes listes que la page Tenue ;
 *   · « Ou parmi tes tenues » : Mes looks sauvegardés, Portées récemment (le Journal).
 * Pas de « Valider » : choisir une ligne ferme la feuille et change la tenue (setOccasion, le même chemin que la page Tenue).
 */

/** L'ordre et les noms courts de la maquette ; la phrase vient d'OCCASIONS. */
const OCCASIONS_FEUILLE: { occasion: OccasionKey; libelle: string }[] = [
  { occasion: "quotidien", libelle: aTraduire("Quotidien") },
  { occasion: "travail_formel", libelle: aTraduire("Travail") },
  { occasion: "date", libelle: aTraduire("Rendez-vous") },
  { occasion: "soiree", libelle: aTraduire("Soirée") },
  { occasion: "evenement_perso", libelle: aTraduire("Cérémonie") },
  { occasion: "sport", libelle: aTraduire("Sport") },
  { occasion: "voyage", libelle: aTraduire("Voyage") },
  { occasion: "cocooning", libelle: aTraduire("Cocooning") },
];

const phraseDe = (o: OccasionKey) => OCCASIONS.find(([k]) => k === o)?.[2] ?? "";

/** Le surtitre de la tenue, devenu le sélecteur : le même texte, un chevron, une cible de 44 px. */
export function SelecteurOccasion({ libelle, onClick }: { libelle: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-label={t("{libelle}. Choisir ma tenue", { libelle: t(libelle) })}
      className="inline-flex items-center gap-[6px] min-h-[44px] -my-[12px] self-start cursor-pointer text-ink active:opacity-70"
    >
      <span className="t-surtitre text-ink whitespace-nowrap">{t(libelle)}</span>
      <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
        <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function Radio({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="w-[22px] h-[22px] flex-shrink-0 rounded-full flex items-center justify-center"
      style={{ border: `1.5px solid ${on ? "var(--color-terracotta-deep)" : "var(--color-cream-dark-soft)"}` }}
    >
      <span className="w-3 h-3 rounded-full" style={{ background: on ? "var(--color-terracotta-deep)" : "transparent" }} />
    </span>
  );
}

function Pastille({ libelle, on, onClick }: { libelle: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="min-h-[40px] px-[14px] rounded-full text-[13px] whitespace-nowrap cursor-pointer"
      style={on ? { background: "var(--color-terracotta-deep)", color: "var(--color-cream)" } : { border: "1px solid var(--color-border)", color: "var(--color-ink)", background: "var(--color-card)" }}
    >
      {t(libelle)}
    </button>
  );
}

const ICONE_COEUR = <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />;
const ICONE_HORLOGE = (
  <>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v4l3 2" />
  </>
);

function LigneTenues({ icone, titre, phrase, onClick }: { icone: React.ReactNode; titre: string; phrase: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="w-full flex items-center gap-[14px] py-[11px] text-left cursor-pointer active:opacity-70">
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="flex-shrink-0 text-ink" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {icone}
      </svg>
      <span className="flex-1 min-w-0">
        <span className="block t-titre-ligne text-ink">{t(titre)}</span>
        <span className="block text-[12px] text-muted-3 mt-[2px]">{t(phrase)}</span>
      </span>
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className="flex-shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  );
}

export function FeuilleChoisirTenue({
  open,
  onClose,
  occasion,
  workMode,
  dateContext,
  onOccasion,
  onWorkMode,
  onDateContext,
  onLooks,
  onPortees,
}: {
  open: boolean;
  onClose: () => void;
  /** L'occasion de la tenue affichée. */
  occasion: OccasionKey | null;
  workMode: WorkMode;
  dateContext: DateContext;
  onOccasion: (o: OccasionKey) => void;
  onWorkMode: (m: WorkMode) => void;
  onDateContext: (c: DateContext) => void;
  onLooks: () => void;
  onPortees: () => void;
}) {
  return (
    <BottomSheet title={t("Choisir ma tenue")} open={open} onClose={onClose}>
      <div className="t-surtitre text-ink">{t("Pour quelle occasion ?")}</div>
      <div role="radiogroup" aria-label={t("Pour quelle occasion ?")} className="mt-[4px]">
        {OCCASIONS_FEUILLE.map(({ occasion: o, libelle }, i) => {
          const on = o === occasion;
          const sous: { libelle: string; on: boolean; choisir: () => void }[] =
            o === "travail_formel"
              ? WORK_MODES.map((m) => ({ libelle: m, on: m === workMode, choisir: () => onWorkMode(m) }))
              : o === "date"
                ? DATE_CONTEXTS.map(([c]) => ({ libelle: c, on: c === dateContext, choisir: () => onDateContext(c) }))
                : [];
          return (
            <div key={o} style={i ? { borderTop: "1px solid var(--color-border)" } : undefined}>
              <button type="button" role="radio" aria-checked={on} onClick={() => onOccasion(o)} className="w-full flex items-center gap-[14px] py-[10px] text-left cursor-pointer active:opacity-70">
                <Radio on={on} />
                <span className="flex-1 min-w-0">
                  <span className="block t-titre-ligne text-ink">{t(libelle)}</span>
                  <span className="block text-[12px] text-muted-3 mt-[2px]">{t(phraseDe(o))}</span>
                </span>
              </button>
              {on && sous.length > 0 && (
                <div className="flex flex-wrap gap-[8px] pl-[36px] pb-[12px]" role="group" aria-label={t(libelle)}>
                  {sous.map((s) => (
                    <Pastille key={s.libelle} libelle={s.libelle} on={s.on} onClick={s.choisir} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="t-surtitre text-ink mt-[18px]">{t("Ou parmi tes tenues")}</div>
      <div className="mt-[2px]">
        <LigneTenues icone={ICONE_COEUR} titre={aTraduire("Mes looks sauvegardés")} phrase={aTraduire("Les tenues que tu as gardées")} onClick={onLooks} />
        <div style={{ borderTop: "1px solid var(--color-border)" }}>
          <LigneTenues icone={ICONE_HORLOGE} titre={aTraduire("Portées récemment")} phrase={aTraduire("Ton journal des tenues portées")} onClick={onPortees} />
        </div>
      </div>
    </BottomSheet>
  );
}
