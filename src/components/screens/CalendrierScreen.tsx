"use client";

import { useMemo, useState } from "react";
import BoutonRetour from "@/components/BoutonRetour";
import Button from "@/components/Button";
import SegmentedControl from "@/components/SegmentedControl";
import { resolveItemImage } from "@/lib/catalogImages";
import {
  grilleDuMois,
  joursDeLaSemaine,
  listeDuCalendrier,
  moisDecale,
  tenueDuCalendrier,
  type TenueDuCalendrier,
} from "@/lib/calendrier";
import { DAYS_FR, MONTHS_FR, occasionShortLabel } from "@/lib/data";
import { dateDuJour } from "@/lib/jourConsulte";
import { jourLocal } from "@/lib/outfitFeedback";
import { useCapsela } from "@/lib/store";
import type { Item } from "@/lib/types";

/*
 * MON CALENDRIER (07/10/2026, brief « Calendrier Capsela ») — la mémoire et le planning des tenues, ouvert par l'icône
 * du bandeau d'accueil (ce n'est pas un onglet). Trois vues d'une même donnée (lib/calendrier.ts) : Mois, Semaine, Liste.
 *
 * Aucune donnée inventée : un jour passé n'est « porté » que s'il a une entrée d'historique ; un jour sans tenue reste
 * vide. L'état d'un jour ne repose jamais sur la seule couleur : le point plein = porté, le point creux = planifié, le
 * cercle autour du chiffre = aujourd'hui, et chaque case porte un nom accessible qui le dit.
 */

type Vue = "mois" | "semaine" | "liste";

const JOURS_ENTETE = ["L", "M", "M", "J", "V", "S", "D"];
const NOM_STATUT = { porte: "Tenue portée", planifiee: "Tenue planifiée", du_jour: "Tenue du jour" } as const;

const dateDe = (jour: string) => new Date(`${jour}T12:00:00`);
const ecartJours = (jour: string, aujourdhui: string) =>
  Math.round((dateDe(jour).getTime() - dateDe(aujourdhui).getTime()) / 86_400_000);
const libelleLong = (jour: string) => {
  const d = dateDe(jour);
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]}`;
};
const libelleMois = (jour: string) => {
  const d = dateDe(jour);
  const m = MONTHS_FR[d.getMonth()];
  return `${m.charAt(0).toUpperCase()}${m.slice(1)} ${d.getFullYear()}`;
};

function Vignettes({ pieces, taille }: { pieces: Item[]; taille: number }) {
  return (
    <span aria-hidden="true" className="flex items-center gap-[4px]">
      {pieces.slice(0, 5).map((p) => {
        const img = resolveItemImage(p);
        return (
          <span
            key={p.id}
            className="rounded-champ bg-warm-bg overflow-hidden flex items-center justify-center flex-shrink-0"
            style={{ width: taille, height: taille }}
          >
            {img.url ? (
              // eslint-disable-next-line @next/next/no-img-element -- export statique, images servies telles quelles
              <img src={img.url} alt="" loading="lazy" className="w-full h-full object-contain" />
            ) : (
              <span className="block w-full h-full" style={{ background: p.hex }} />
            )}
          </span>
        );
      })}
    </span>
  );
}

function Pastille({ statut }: { statut: TenueDuCalendrier["statut"] | null }) {
  if (!statut) return <span className="h-[7px]" />;
  const plein = statut === "porte" || statut === "du_jour";
  return (
    <span
      aria-hidden="true"
      className="block w-[7px] h-[7px] rounded-full"
      style={{ background: plein ? "var(--color-terracotta)" : "transparent", border: "1.5px solid var(--color-terracotta)" }}
    />
  );
}

export default function CalendrierScreen() {
  const { state, actions, vestiairePool } = useCapsela();
  const aujourdhui = jourLocal(dateDuJour(0));
  const [vue, setVue] = useState<Vue>("mois");
  const [selection, setSelection] = useState(aujourdhui);
  const [mois, setMois] = useState(moisDecale(aujourdhui, 0));

  // La tenue proposée aujourd'hui n'est celle de state.outfit que si le jour consulté est aujourd'hui.
  const proposee = useMemo(
    () =>
      state.jourDecalage === 0 && state.outfit.length > 0
        ? { pieceIds: state.outfit, occasion: state.occasion }
        : null,
    [state.jourDecalage, state.outfit, state.occasion]
  );
  const pool = useMemo<Item[]>(() => [...state.items, ...vestiairePool], [state.items, vestiairePool]);
  const piecesDe = (t: TenueDuCalendrier) =>
    t.pieceIds.map((id) => pool.find((i) => i.id === id)).filter((i): i is Item => !!i);
  const tenue = (jour: string) => tenueDuCalendrier(jour, aujourdhui, state.history, state.tenuesPlanifiees, proposee);

  const { avenir, passees } = useMemo(
    () => listeDuCalendrier(aujourdhui, state.history, state.tenuesPlanifiees, proposee),
    [aujourdhui, state.history, state.tenuesPlanifiees, proposee]
  );
  const calendrierVide = avenir.length === 0 && passees.length === 0;

  const ouvrir = (t: TenueDuCalendrier) => {
    if (t.statut === "porte") return actions.goHistory();
    if (t.plan && t.statut === "planifiee") return actions.ouvrirPlan(t.plan, "calendrier");
    if (t.jour === aujourdhui) {
      actions.choisirJour(0);
      return actions.goTenues();
    }
    if (t.plan) actions.ouvrirPlan(t.plan, "calendrier");
  };

  const ecart = ecartJours(selection, aujourdhui);
  const tenueSel = tenue(selection);
  const planifierSel = () => actions.planifierPour(ecart >= 1 ? ecart : 1);

  const Case = ({ jour }: { jour: string }) => {
    const t = tenue(jour);
    const estAujourdhui = jour === aujourdhui;
    const choisie = jour === selection;
    const num = dateDe(jour).getDate();
    return (
      <button
        onClick={() => setSelection(jour)}
        aria-pressed={choisie}
        aria-label={`${libelleLong(jour)}${estAujourdhui ? ", aujourd'hui" : ""}${t ? `, ${NOM_STATUT[t.statut].toLowerCase()}` : ""}`}
        className="flex flex-col items-center justify-center gap-[5px] min-h-[48px] py-[6px] rounded-champ cursor-pointer"
        style={{ background: choisie ? "var(--color-chip-soft-bg)" : "transparent" }}
      >
        <span
          className="w-[28px] h-[28px] rounded-full flex items-center justify-center text-[14px] tabular-nums"
          style={{
            border: estAujourdhui ? "1.5px solid var(--color-terracotta)" : "1.5px solid transparent",
            color: jour < aujourdhui && !t ? "var(--color-muted)" : "var(--color-ink)",
            fontWeight: estAujourdhui || choisie ? 600 : 400,
          }}
        >
          {num}
        </span>
        <Pastille statut={t?.statut ?? null} />
      </button>
    );
  };

  const enteteSemaine = (
    <div className="grid grid-cols-7 mb-1" aria-hidden="true">
      {JOURS_ENTETE.map((j, i) => (
        <span key={i} className="text-center t-surtitre text-muted">
          {j}
        </span>
      ))}
    </div>
  );

  const navigation = (libelle: string, precedent: () => void, suivant: () => void, nom: string) => (
    <div className="flex items-center justify-between mt-5 mb-3">
      <button onClick={precedent} aria-label={`${nom} précédent`} className="w-[44px] h-[44px] flex items-center justify-center text-ink cursor-pointer">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
      </button>
      <h2 className="font-serif text-[20px] text-ink" aria-live="polite">{libelle}</h2>
      <button onClick={suivant} aria-label={`${nom} suivant`} className="w-[44px] h-[44px] flex items-center justify-center text-ink cursor-pointer">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
      </button>
    </div>
  );

  const ligne = (t: TenueDuCalendrier) => (
    <li key={t.jour}>
      <button
        onClick={() => ouvrir(t)}
        className="w-full flex items-center gap-3 py-3 border-b border-divider text-left cursor-pointer"
      >
        <span className="flex-1 min-w-0">
          <span className="block text-[14px] text-ink font-semibold">{libelleLong(t.jour)}</span>
          <span className="block text-[12px] text-muted mt-[2px]">
            {NOM_STATUT[t.statut]} · {occasionShortLabel(t.occasion)}
          </span>
        </span>
        <Vignettes pieces={piecesDe(t)} taille={34} />
      </button>
    </li>
  );

  const panneau = (
    <section aria-label={libelleLong(selection)} className="mt-5 rounded-carte bg-card border border-divider p-5">
      <div className="t-surtitre text-terracotta">{ecart === 0 ? "Aujourd’hui" : libelleLong(selection)}</div>
      {ecart === 0 && <div className="font-serif text-[20px] text-ink mt-1">{libelleLong(selection)}</div>}
      {tenueSel ? (
        <>
          <div className="font-serif text-[20px] text-ink mt-1">{NOM_STATUT[tenueSel.statut]}</div>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="text-[12px] text-ink border border-divider rounded-full px-3 py-[4px]">{occasionShortLabel(tenueSel.occasion)}</span>
            {tenueSel.temp != null && (
              <span className="text-[12px] text-ink border border-divider rounded-full px-3 py-[4px]">
                {Math.round(tenueSel.temp)}°{tenueSel.weatherLabel ? ` · ${tenueSel.weatherLabel}` : ""}
              </span>
            )}
          </div>
          <div className="mt-4"><Vignettes pieces={piecesDe(tenueSel)} taille={56} /></div>
          <div className="mt-4">
            <button onClick={() => ouvrir(tenueSel)} className="t-lien text-terracotta-deep cursor-pointer min-h-[44px]">
              {tenueSel.statut === "porte"
                ? "Voir dans le Journal →"
                : tenueSel.statut === "planifiee" && ecart >= 1
                  ? "Modifier la tenue →"
                  : tenueSel.statut === "planifiee"
                    ? "Voir la tenue →"
                    : "Voir ma tenue →"}
            </button>
          </div>
        </>
      ) : ecart >= 1 ? (
        <>
          <div className="font-serif text-[20px] text-ink mt-1">Rien de prévu</div>
          <p className="text-[14px] text-muted mt-2 leading-[1.5]">Tu n’as pas encore prévu de tenue pour cette journée.</p>
          <div className="mt-4"><Button variante="sombre" onClick={planifierSel}>Planifier une tenue →</Button></div>
        </>
      ) : ecart === 0 ? (
        <>
          <div className="font-serif text-[20px] text-ink mt-1">Ta tenue du jour</div>
          <p className="text-[14px] text-muted mt-2 leading-[1.5]">Capsela te la propose dans l’onglet Aujourd’hui.</p>
          <div className="mt-4"><Button variante="sombre" onClick={actions.goHome}>Voir ma tenue →</Button></div>
        </>
      ) : (
        <p className="text-[14px] text-muted mt-2 leading-[1.5]">Aucune tenue enregistrée pour cette journée.</p>
      )}
    </section>
  );

  const semaine = joursDeLaSemaine(selection);

  return (
    <div className="absolute inset-0 flex flex-col bg-cream">
      <div className="scrollarea flex-1 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
        <div className="flex items-center justify-between mb-3">
          <BoutonRetour onClick={actions.goHome} label="Revenir à l'accueil" taille={34} />
          <h1 className="font-serif text-[20px] text-ink">Mon calendrier</h1>
          <button
            onClick={planifierSel}
            aria-label="Planifier une tenue"
            className="w-[34px] h-[34px] rounded-full border border-divider flex items-center justify-center text-ink cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          </button>
        </div>

        <SegmentedControl
          segments={[{ key: "mois", label: "Mois" }, { key: "semaine", label: "Semaine" }, { key: "liste", label: "Liste" }]}
          actif={vue}
          onChange={setVue}
          ariaLabel="Vue du calendrier"
        />

        {vue === "mois" && (
          <>
            {navigation(libelleMois(mois), () => setMois(moisDecale(mois, -1)), () => setMois(moisDecale(mois, 1)), "Mois")}
            {enteteSemaine}
            <div className="flex flex-col gap-[2px]">
              {grilleDuMois(dateDe(mois).getFullYear(), dateDe(mois).getMonth()).map((sem, i) => (
                <div key={i} className="grid grid-cols-7">
                  {sem.map((j, k) => (j ? <Case key={j} jour={j} /> : <span key={k} />))}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-5 mt-3 text-[12px] text-muted">
              <span className="flex items-center gap-[6px]"><Pastille statut="porte" /> Portée</span>
              <span className="flex items-center gap-[6px]"><Pastille statut="planifiee" /> Planifiée</span>
              <span className="flex items-center gap-[6px]"><span aria-hidden="true" className="w-[12px] h-[12px] rounded-full" style={{ border: "1.5px solid var(--color-terracotta)" }} /> Aujourd’hui</span>
            </div>
            {panneau}
          </>
        )}

        {vue === "semaine" && (
          <>
            {navigation(
              `${dateDe(semaine[0]).getDate()} – ${dateDe(semaine[6]).getDate()} ${MONTHS_FR[dateDe(semaine[6]).getMonth()]}`,
              () => setSelection(jourLocal(new Date(dateDe(selection).getTime() - 7 * 86_400_000))),
              () => setSelection(jourLocal(new Date(dateDe(selection).getTime() + 7 * 86_400_000))),
              "Semaine"
            )}
            {enteteSemaine}
            <div className="grid grid-cols-7">
              {semaine.map((j) => <Case key={j} jour={j} />)}
            </div>
            {panneau}
          </>
        )}

        {vue === "liste" && (
          <div className="mt-5">
            {calendrierVide ? null : (
              <>
                {avenir.length > 0 && (
                  <>
                    <h2 className="t-surtitre text-ink">À venir</h2>
                    <ul className="mb-6">{avenir.map(ligne)}</ul>
                  </>
                )}
                {passees.length > 0 && (
                  <>
                    <h2 className="t-surtitre text-ink">Tenues passées</h2>
                    <ul>{passees.map(ligne)}</ul>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {calendrierVide && (
          <div className="mt-6 text-center">
            <div className="font-serif text-[20px] text-ink">Ton calendrier est encore libre.</div>
            <p className="text-[14px] text-muted mt-2 leading-[1.5]">
              Les tenues que tu portes et celles que tu planifies s’afficheront ici.
            </p>
            <div className="mt-4"><Button variante="sombre" onClick={actions.goPlanifier}>Planifier une tenue</Button></div>
          </div>
        )}
      </div>
    </div>
  );
}
