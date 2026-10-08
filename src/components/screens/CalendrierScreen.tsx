"use client";

import { useMemo, useState } from "react";
import BoutonRetour from "@/components/BoutonRetour";
import Button from "@/components/Button";
import { IconeTuile } from "@/components/PlanifierUI";
import SegmentedControl from "@/components/SegmentedControl";
import { resolveItemImage } from "@/lib/catalogImages";
import {
  dateMoyenne,
  grilleDuMoisComplete,
  historiqueParMois,
  jourAbrege,
  joursDeLaSemaine,
  moisDecale,
  numeroDeSemaine,
  tenueDuCalendrier,
  vueListe,
  type FiltreHistorique,
  type TenueDuCalendrier,
} from "@/lib/calendrier";
import { DAYS_FR, MONTHS_FR, OCC_LABELS, occasionShortLabel } from "@/lib/data";
import { dateDuJour } from "@/lib/jourConsulte";
import { jourLocal } from "@/lib/outfitFeedback";
import { alerteMeteoPlan } from "@/lib/planDuJour";
import { nomCourtPiece } from "@/lib/selectors";
import { useCapsela } from "@/lib/store";
import type { Item } from "@/lib/types";
import { useMeteoDuJourCalendrier } from "@/lib/useMeteoDuJourCalendrier";
import { useMeteoDuPlan } from "@/lib/useMeteoDuPlan";

/*
 * MON PLANNING (07/10/2026 « Mon calendrier » ; refondu le 08/10/2026 sur la maquette « Capsela – Mon planning ») — la mémoire et
 * le planning des tenues, ouvert par l'icône calendrier du bandeau d'accueil (ce n'est pas un onglet, et le hub Planifier ne
 * change pas). Trois vues d'une même donnée (lib/calendrier.ts) : Mois, Semaine, Liste.
 *
 * Aucune donnée inventée : un jour passé n'est « porté » que s'il a une entrée d'historique ; un jour sans tenue reste vide.
 * Un jour PASSÉ sans tenue n'a ni carte ni ligne (décidé le 08/10/2026, comme sur la maquette). La météo d'une pastille est
 * celle enregistrée avec la tenue, ou la prévision de la ville pour un jour à venir dans l'horizon — sinon pas de pastille.
 * L'état d'un jour ne repose jamais sur la seule couleur : le point plein = porté, le point creux = planifié, le cercle
 * autour du chiffre = aujourd'hui, et chaque case porte un nom accessible qui le dit.
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
const memesPieces = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((id, i) => id === b[i]);

function Chevron({ vers }: { vers: "gauche" | "droite" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={vers === "gauche" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
    </svg>
  );
}

/** Le titre d'une carte : la fin en italique terracotta (« Ta tenue *du jour* », « Tenue *planifiée* »). */
function Titre({ debut, accent }: { debut: string; accent: string }) {
  return (
    <div className="t-titre-section text-ink mt-1">
      {debut} <span className="italic text-terracotta">{accent}</span>
    </div>
  );
}

const pastilleChip = "inline-flex items-center gap-[6px] rounded-full px-3 py-[6px] text-[12px] text-ink bg-warm-bg border border-border";

function Vignette({ piece, taille }: { piece: Item; taille?: number }) {
  const img = resolveItemImage(piece);
  return (
    <span
      className="rounded-champ bg-warm-bg overflow-hidden flex items-center justify-center flex-shrink-0"
      style={taille ? { width: taille, height: taille } : { width: "100%", aspectRatio: "1 / 1" }}
    >
      {img.url ? (
        // eslint-disable-next-line @next/next/no-img-element -- export statique, images servies telles quelles
        <img src={img.url} alt="" loading="lazy" className="w-full h-full object-contain" />
      ) : (
        <span className="block w-full h-full" style={{ background: piece.hex }} />
      )}
    </span>
  );
}

/** Les pièces d'une tenue, avec leur nom dessous : quatre au plus, la quatrième place disant « +n » au-delà. */
function Tuiles({ pieces }: { pieces: Item[] }) {
  const visibles = pieces.length > 4 ? pieces.slice(0, 3) : pieces;
  const reste = pieces.length - visibles.length;
  return (
    <ul className="grid grid-cols-4 gap-2 mt-4" aria-label="Pièces de la tenue">
      {visibles.map((p) => (
        <li key={p.id} className="min-w-0 flex flex-col items-center gap-[5px]">
          <Vignette piece={p} />
          <span className="w-full text-center text-[10.5px] leading-[1.2] text-muted-3 truncate">{nomCourtPiece(p.name)}</span>
        </li>
      ))}
      {reste > 0 && (
        <li className="min-w-0 flex flex-col items-center gap-[5px]">
          <span className="w-full rounded-champ border border-dashed border-border flex items-center justify-center text-[13px] text-muted" style={{ aspectRatio: "1 / 1" }}>
            +{reste}
          </span>
          <span className="w-full text-center text-[10.5px] leading-[1.2] text-muted-3">pièces</span>
        </li>
      )}
    </ul>
  );
}

/** L'aperçu d'une ligne de la liste : quatre vignettes au plus, ou une case en pointillés quand il n'y a pas de tenue. */
function MiniTuiles({ pieces }: { pieces: Item[] }) {
  if (!pieces.length) {
    return <span aria-hidden="true" className="rounded-champ border border-dashed border-border flex-shrink-0" style={{ width: 76, height: 30 }} />;
  }
  const visibles = pieces.length > 4 ? pieces.slice(0, 3) : pieces;
  const reste = pieces.length - visibles.length;
  return (
    <span aria-hidden="true" className="flex items-center gap-[4px] flex-shrink-0">
      {visibles.map((p) => (
        <Vignette key={p.id} piece={p} taille={30} />
      ))}
      {reste > 0 && (
        <span className="rounded-champ border border-dashed border-border flex items-center justify-center text-[11px] text-muted" style={{ width: 30, height: 30 }}>
          +{reste}
        </span>
      )}
    </span>
  );
}

function Pastille({ statut, claire = false }: { statut: TenueDuCalendrier["statut"] | null; claire?: boolean }) {
  if (!statut) return <span className="h-[7px]" />;
  const plein = statut === "porte" || statut === "du_jour";
  const couleur = claire ? "var(--color-cream)" : "var(--color-terracotta)";
  return (
    <span
      aria-hidden="true"
      className="block w-[7px] h-[7px] rounded-full"
      style={{ background: plein ? couleur : "transparent", border: `1.5px solid ${couleur}` }}
    />
  );
}

function PastilleMeteo({ temp, label }: { temp: number; label: string | null }) {
  const soleil = !!label && /soleil|dégagé|clair|ensoleill/i.test(label);
  return (
    <span className={pastilleChip}>
      <IconeTuile nom={soleil ? "apresmidi" : "nuage"} taille={14} />
      {Math.round(temp)}°{label ? ` · ${label}` : ""}
    </span>
  );
}

export default function CalendrierScreen() {
  const { state, actions, vestiairePool, geoCity, geoLoading, sourceMeteo, weather } = useCapsela();
  const aujourdhui = jourLocal(dateDuJour(0));
  const [vue, setVue] = useState<Vue>("mois");
  const [selection, setSelection] = useState(aujourdhui);
  const [mois, setMois] = useState(moisDecale(aujourdhui, 0));
  const [alertesIgnorees, setAlertesIgnorees] = useState<string[]>([]);

  // La tenue proposée aujourd'hui n'est celle de state.outfit que si le jour consulté est aujourd'hui.
  // Sa météo est celle d'aujourd'hui, seulement si elle est réellement connue (jamais les valeurs par défaut de l'app).
  const meteoConnue = !geoLoading && sourceMeteo !== "defaut";
  const proposee = useMemo(
    () =>
      state.jourDecalage === 0 && state.outfit.length > 0
        ? { pieceIds: state.outfit, occasion: state.occasion, temp: meteoConnue ? weather.temp : null, weatherLabel: meteoConnue ? weather.label : null }
        : null,
    [state.jourDecalage, state.outfit, state.occasion, meteoConnue, weather.temp, weather.label]
  );
  const pool = useMemo<Item[]>(() => [...state.items, ...vestiairePool], [state.items, vestiairePool]);
  const piecesDe = (t: TenueDuCalendrier) =>
    t.pieceIds.map((id) => pool.find((i) => i.id === id)).filter((i): i is Item => !!i);
  const tenue = (jour: string) => tenueDuCalendrier(jour, aujourdhui, state.history, state.tenuesPlanifiees, proposee);

  // La vue Liste est COURTE (08/10/2026) : les prochaines tenues (dix jours), les quatre dernières passées — le reste vit dans « Voir toutes mes tenues ».
  const vl = useMemo(() => vueListe(aujourdhui, state.history, state.tenuesPlanifiees, proposee), [aujourdhui, state.history, state.tenuesPlanifiees, proposee]);
  const calendrierVide = vl.avenir.length === 0 && vl.nbPassees === 0;
  const [historiqueOuvert, setHistoriqueOuvert] = useState(false);
  const [filtre, setFiltre] = useState<FiltreHistorique>("toutes");
  const historique = useMemo(
    () => historiqueParMois(aujourdhui, state.history, state.tenuesPlanifiees, filtre),
    [aujourdhui, state.history, state.tenuesPlanifiees, filtre]
  );

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
  const piecesSel = tenueSel ? piecesDe(tenueSel) : [];

  // La météo de la carte : celle du lieu et du moment du plan (alerte), ou la prévision de la ville pour un jour à venir sans tenue.
  const meteoDuPlan = useMeteoDuPlan(tenueSel?.plan ?? null);
  const meteoFuture = useMeteoDuJourCalendrier(selection, geoCity.city, ecart >= 1 && !tenueSel);
  const alerte = tenueSel?.plan && meteoDuPlan ? alerteMeteoPlan(piecesSel, meteoDuPlan) : null;
  const cleAlerte = tenueSel?.plan && alerte ? `${tenueSel.plan.id}|${alerte}` : null;
  const alerteVisible = alerte && cleAlerte && !alertesIgnorees.includes(cleAlerte) ? alerte : null;

  const peutPorter =
    ecart === 0 &&
    tenueSel?.statut === "du_jour" &&
    state.jourDecalage === 0 &&
    !state.outfitValidated &&
    memesPieces(tenueSel.pieceIds, state.outfit);

  const Case = ({ jour, horsMois = false }: { jour: string; horsMois?: boolean }) => {
    const num = dateDe(jour).getDate();
    // Les jours du mois voisin complètent la grille, estompés : ils ne se choisissent pas.
    if (horsMois) {
      return (
        <span aria-hidden="true" className="flex flex-col items-center justify-center gap-[5px] min-h-[48px] py-[6px]">
          <span className="w-[32px] h-[32px] flex items-center justify-center text-[13px] tabular-nums" style={{ color: "var(--color-placeholder)" }}>{num}</span>
          <span className="h-[7px]" />
        </span>
      );
    }
    const t = tenue(jour);
    const estAujourdhui = jour === aujourdhui;
    const choisie = jour === selection;
    return (
      <button
        onClick={() => setSelection(jour)}
        aria-pressed={choisie}
        aria-label={`${libelleLong(jour)}${estAujourdhui ? ", aujourd'hui" : ""}${t ? `, ${NOM_STATUT[t.statut].toLowerCase()}` : ""}`}
        className="flex flex-col items-center justify-center gap-[5px] min-h-[48px] py-[6px] cursor-pointer"
      >
        <span
          className="w-[32px] h-[32px] rounded-full flex items-center justify-center text-[13px] tabular-nums"
          style={{
            border: estAujourdhui && !choisie ? "1.5px solid var(--color-terracotta)" : "1.5px solid transparent",
            background: choisie ? "var(--color-terracotta-deep)" : "transparent",
            color: choisie ? "var(--color-cream)" : jour < aujourdhui && !t ? "var(--color-muted)" : "var(--color-ink)",
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
        <Chevron vers="gauche" />
      </button>
      <h2 className="t-titre-section text-ink" aria-live="polite">{libelle}</h2>
      <button onClick={suivant} aria-label={`${nom} suivant`} className="w-[44px] h-[44px] flex items-center justify-center text-ink cursor-pointer">
        <Chevron vers="droite" />
      </button>
    </div>
  );

  /** Une ligne, compacte : la date et « occasion · statut » à gauche, quatre miniatures au plus à droite (« +n » au-delà). */
  const ligne = (t: TenueDuCalendrier) => (
    <li key={t.jour}>
      <button onClick={() => ouvrir(t)} className="w-full flex items-center gap-3 py-3 border-b border-divider text-left cursor-pointer min-h-[60px]">
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] text-ink font-semibold leading-[1.25]">{dateMoyenne(t.jour)}</span>
          <span className="block text-[12px] text-muted mt-[2px] leading-[1.3] truncate">
            {occasionShortLabel(t.occasion)} · {NOM_STATUT[t.statut]}
          </span>
        </span>
        <MiniTuiles pieces={piecesDe(t)} />
      </button>
    </li>
  );

  /** La carte du jour choisi. Un jour PASSÉ sans tenue n'a pas de carte. */
  const panneau =
    ecart < 0 && !tenueSel ? null : (
      <section aria-label={libelleLong(selection)} className="mt-5 rounded-carte bg-card border border-border p-5">
        <div className="t-surtitre text-muted">{libelleLong(selection).toUpperCase()}</div>
        {tenueSel ? (
          <>
            {tenueSel.statut === "du_jour" ? (
              <Titre debut="Ta tenue" accent="du jour" />
            ) : tenueSel.statut === "planifiee" ? (
              <Titre debut="Tenue" accent="planifiée" />
            ) : (
              <Titre debut="Tenue" accent="portée" />
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              <span className={pastilleChip}>{OCC_LABELS[tenueSel.occasion]}</span>
              {tenueSel.temp != null && <PastilleMeteo temp={tenueSel.temp} label={tenueSel.weatherLabel} />}
            </div>
            <Tuiles pieces={piecesSel} />
            <div className="mt-4">
              <Button variante="principal" onClick={() => ouvrir(tenueSel)}>
                {tenueSel.statut === "porte" ? "Voir dans le Journal" : "Voir la tenue"}
              </Button>
            </div>
            {peutPorter && (
              <button onClick={actions.wearOutfitToday} className="mt-1 w-full min-h-[44px] flex items-center justify-center gap-[6px] text-[13px] text-terracotta-deep cursor-pointer">
                <span aria-hidden="true">♡</span> Porter cette tenue
              </button>
            )}
            {tenueSel.statut === "planifiee" && tenueSel.plan && ecart >= 1 && (
              <button onClick={() => ouvrir(tenueSel)} className="mt-1 w-full min-h-[44px] flex items-center justify-center gap-[6px] text-[13px] text-terracotta-deep cursor-pointer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" /></svg>
                Modifier la tenue
              </button>
            )}
            {alerteVisible && cleAlerte && (
              <div className="mt-4 rounded-bloc border border-border bg-card p-4">
                <div className="flex items-start gap-[10px]">
                  <span aria-hidden="true" className="font-serif italic text-[15px] text-terracotta flex-shrink-0">✦</span>
                  <p className="flex-1 min-w-0 text-[12.5px] text-ink-soft leading-[1.5]">{alerteVisible}</p>
                </div>
                <div className="text-right mt-1">
                  <button onClick={() => setAlertesIgnorees((l) => [...l, cleAlerte])} className="text-[12px] text-muted cursor-pointer min-h-[44px] px-1">
                    Ignorer
                  </button>
                </div>
              </div>
            )}
          </>
        ) : ecart >= 1 ? (
          <>
            <Titre debut="Aucune tenue" accent="prévue" />
            <p className="t-chapeau text-muted mt-2">Rien de prévu pour l’instant. Je peux te proposer une tenue adaptée à ta journée et à la météo.</p>
            {meteoFuture && (
              <div className="flex flex-wrap gap-2 mt-3">
                <PastilleMeteo temp={meteoFuture.temp} label={meteoFuture.label} />
              </div>
            )}
            <div className="mt-4"><Button variante="principal" onClick={planifierSel}>Planifier une tenue</Button></div>
          </>
        ) : (
          <>
            <Titre debut="Ta tenue" accent="du jour" />
            <p className="t-chapeau text-muted mt-2">Capsela te la propose dans l’onglet Aujourd’hui.</p>
            <div className="mt-4"><Button variante="principal" onClick={actions.goHome}>Voir ma tenue</Button></div>
          </>
        )}
      </section>
    );

  const semaine = joursDeLaSemaine(selection);
  // « SEMAINE 40 » : le numéro de semaine, court — « 28 septembre au 4 octobre » ne tenait pas sur une ligne (signalé le 08/10/2026).
  // Les dates restent dites aux lecteurs d'écran et se lisent sur les sept tuiles.
  const numeroSemaine = numeroDeSemaine(semaine[0]);
  const surtitreSemaine = `SEMAINE ${numeroSemaine}`;
  const nomSemaine = `Semaine ${numeroSemaine}, du ${libelleLong(semaine[0])} au ${libelleLong(semaine[6])}`;
  const decalerSemaine = (n: number) => setSelection(jourLocal(new Date(dateDe(selection).getTime() + n * 7 * 86_400_000)));

  // L'HISTORIQUE COMPLET (« Voir toutes mes tenues → ») : toutes les tenues passées, regroupées par mois, avec un filtre discret.
  if (historiqueOuvert) {
    const FILTRES: { key: FiltreHistorique; label: string }[] = [
      { key: "toutes", label: "Toutes" },
      { key: "portees", label: "Portées" },
      { key: "planifiees", label: "Planifiées" },
    ];
    return (
      <div className="absolute inset-0 flex flex-col bg-cream">
        <div className="scrollarea flex-1 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
          <div className="flex items-center justify-between mb-3">
            <BoutonRetour onClick={() => setHistoriqueOuvert(false)} label="Revenir à la liste" taille={34} />
            <h1 className="t-titre-carte text-ink">Mon historique</h1>
            <span aria-hidden="true" className="w-[34px]" />
          </div>
          <div role="tablist" aria-label="Filtrer les tenues" className="flex items-center gap-5 mt-2">
            {FILTRES.map((f) => (
              <button
                key={f.key}
                role="tab"
                aria-selected={filtre === f.key}
                onClick={() => setFiltre(f.key)}
                className={"min-h-[44px] text-[13px] cursor-pointer " + (filtre === f.key ? "text-terracotta-deep font-semibold underline underline-offset-[6px]" : "text-muted")}
              >
                {f.label}
              </button>
            ))}
          </div>
          {historique.length === 0 ? (
            <p className="t-chapeau text-muted mt-5">
              {filtre === "portees" ? "Aucune tenue portée pour l’instant." : filtre === "planifiees" ? "Aucune tenue planifiée passée." : "Tes tenues passées s’afficheront ici."}
            </p>
          ) : (
            historique.map((m) => (
              <section key={m.cle} className="mt-5" aria-label={m.libelle}>
                <h2 className="t-surtitre text-muted">{m.libelle}</h2>
                <ul>{m.tenues.map(ligne)}</ul>
              </section>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-cream">
      <div className="scrollarea flex-1 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
        <div className="flex items-center justify-between mb-3">
          <BoutonRetour onClick={actions.goHome} label="Revenir à l'accueil" taille={34} />
          <h1 className="t-titre-carte text-ink">Mon planning</h1>
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
          ariaLabel="Vue du planning"
          variante="pastilles"
        />

        {vue === "mois" && (
          <>
            {navigation(libelleMois(mois), () => setMois(moisDecale(mois, -1)), () => setMois(moisDecale(mois, 1)), "Mois")}
            {enteteSemaine}
            <div className="flex flex-col gap-[2px]">
              {grilleDuMoisComplete(dateDe(mois).getFullYear(), dateDe(mois).getMonth()).map((sem, i) => (
                <div key={i} className="grid grid-cols-7">
                  {sem.map((c) => <Case key={c.jour} jour={c.jour} horsMois={c.horsMois} />)}
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
            <div className="flex items-center justify-between mt-5 mb-3">
              <div className="t-surtitre text-muted" aria-live="polite" aria-label={nomSemaine}>{surtitreSemaine}</div>
              <div className="flex items-center -mr-3">
                <button onClick={() => decalerSemaine(-1)} aria-label="Semaine précédente" className="w-[44px] h-[44px] flex items-center justify-center text-ink cursor-pointer"><Chevron vers="gauche" /></button>
                <button onClick={() => decalerSemaine(1)} aria-label="Semaine suivante" className="w-[44px] h-[44px] flex items-center justify-center text-ink cursor-pointer"><Chevron vers="droite" /></button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {semaine.map((j) => {
                const t = tenue(j);
                const choisie = j === selection;
                const auj = j === aujourdhui;
                return (
                  <button
                    key={j}
                    onClick={() => setSelection(j)}
                    aria-pressed={choisie}
                    aria-label={`${libelleLong(j)}${auj ? ", aujourd'hui" : ""}${t ? `, ${NOM_STATUT[t.statut].toLowerCase()}` : ""}`}
                    className="flex flex-col items-center justify-center gap-[3px] min-h-[64px] rounded-champ cursor-pointer"
                    style={{
                      background: choisie ? "var(--color-terracotta-deep)" : "var(--color-card)",
                      border: `1.5px solid ${choisie ? "var(--color-terracotta-deep)" : auj ? "var(--color-terracotta)" : "var(--color-border)"}`,
                      color: choisie ? "var(--color-cream)" : "var(--color-ink)",
                    }}
                  >
                    <span className="text-[10px]" style={{ color: choisie ? "var(--color-cream)" : "var(--color-muted)" }}>{jourAbrege(j)}</span>
                    <span className="text-[16px] font-semibold tabular-nums leading-none">{dateDe(j).getDate()}</span>
                    <Pastille statut={t?.statut ?? null} claire={choisie} />
                  </button>
                );
              })}
            </div>
            {panneau}
          </>
        )}

        {vue === "liste" && (
          <div className="mt-5">
            <h2 className="t-surtitre text-muted">À venir</h2>
            {vl.avenir.length > 0 ? (
              <ul className="mb-6">{vl.avenir.map(ligne)}</ul>
            ) : (
              <section className="mt-3 mb-6 rounded-carte bg-card border border-border p-5">
                <Titre debut="Aucune tenue" accent="prévue" />
                <p className="t-chapeau text-muted mt-2">Je peux te proposer une tenue adaptée à ta journée et à la météo.</p>
                <div className="mt-4"><Button variante="principal" onClick={() => actions.planifierPour(1)}>Planifier une tenue</Button></div>
              </section>
            )}
            {vl.recentes.length > 0 && (
              <>
                <h2 className="t-surtitre text-muted">Récemment portées</h2>
                <ul>{vl.recentes.map(ligne)}</ul>
                <button
                  onClick={() => {
                    setFiltre("toutes");
                    setHistoriqueOuvert(true);
                  }}
                  className="t-lien text-terracotta-deep min-h-[44px] mt-1 cursor-pointer"
                >
                  Voir toutes mes tenues →
                </button>
              </>
            )}
          </div>
        )}

        {calendrierVide && vue !== "liste" && (
          <div className="mt-6 text-center">
            <div className="t-titre-section text-ink">Ton planning est encore libre.</div>
            <p className="t-chapeau text-muted mt-2">
              Les tenues que tu portes et celles que tu planifies s’afficheront ici.
            </p>
            <div className="mt-4"><Button variante="principal" onClick={actions.goPlanifier}>Planifier une tenue</Button></div>
          </div>
        )}
      </div>
    </div>
  );
}
