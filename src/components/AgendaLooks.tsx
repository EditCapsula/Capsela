"use client";

import { GlypheOccasion } from "@/components/GlyphesOccasion";
import { OutfitComposition } from "@/components/OutfitComposition";
import {
  composerAgenda,
  detailCapsela,
  echeanceCourte,
  looksDisponibles,
  occasionsDuVoyage,
  sousTitreAgenda,
} from "@/lib/agendaLooks";
import { occasionShortLabel } from "@/lib/data";
import { titreLookDuJour } from "@/lib/logic";
import { jourLocal } from "@/lib/outfitFeedback";
import { villeDuLieu, type TenuePlanifiee } from "@/lib/planifier";
import type { DateContext, Item, WorkMode } from "@/lib/types";
import type { Planification, ValiseGardee } from "@/lib/valises";

/*
 * « MES LOOKS À VENIR » — la page « Mes planifications » de Planifier, refondue
 * le 30/09/2026 (brief « Refonte premium ») : d'une liste de cartes identiques
 * à un agenda de looks. Trois niveaux, jamais la même importance pour tous :
 *
 *   1. LE PROCHAIN LOOK — sa planche en grand, l'occasion, la date, le lieu
 *      et la météo enregistrée, « Le détail Capsela », « Voir le look » ;
 *   2. LES SUIVANTS — une frise discrète, une image plus petite par look ;
 *   3. LES VOYAGES — en contexte, une ligne légère : ils ne concurrencent pas
 *      le look.
 * Au-delà de trois looks suivants, le reste tient en lignes compactes.
 *
 * Rien n'est calculé ici : les planifications arrivent déjà réparties et
 * triées (repartirPlanifications), les pièces résolues par l'écran
 * (piecesDuPlan, pool stable). Les actions sont celles d'avant : ouvrir le
 * détail, le menu « … », ouvrir la valise.
 *
 * TUTOIEMENT : le brief écrivait « Vos prochains looks », « Planifiez » ; toute
 * l'app tutoie, la page aussi.
 */

const DOW = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const DOW_LONG = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const dateDe = (jour: string) => new Date(`${jour}T12:00:00`);
const dateCourte = (jour: string) => {
  const d = dateDe(jour);
  return `${DOW[d.getDay()]}. ${d.getDate()} ${MOIS[d.getMonth()]}`;
};
const dateLongue = (jour: string) => {
  const d = dateDe(jour);
  return `${DOW_LONG[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`;
};

/** Même grammaire que les glyphes de PlanifierScreen (viewBox 24, trait 1,5, currentColor). */
const trait = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function GlypheEpingle() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" aria-hidden="true" className="flex-shrink-0">
      <path d="M12 21s6.5-6.1 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 14.9 12 21 12 21z" {...trait} />
      <circle cx="12" cy="10.4" r="2.3" {...trait} />
    </svg>
  );
}
function Chevron() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" aria-hidden="true" className="flex-shrink-0">
      <path d="M9.5 6l6 6-6 6" {...trait} strokeWidth={1.7} />
    </svg>
  );
}

export default function AgendaLooks({
  onglet,
  onglets,
  aVenir,
  passees,
  piecesDuPlan,
  dressing,
  onOuvrir,
  onMenu,
  onOuvrirValise,
}: {
  onglet: "up" | "past";
  /** Les onglets À venir / Passées de l'écran, partagés avec le hub. */
  onglets: React.ReactNode;
  aVenir: Planification[];
  passees: Planification[];
  piecesDuPlan: (t: TenuePlanifiee) => Item[];
  dressing: Item[];
  onOuvrir: (t: TenuePlanifiee) => void;
  onMenu: (t: TenuePlanifiee) => void;
  onOuvrirValise: (v: ValiseGardee) => void;
}) {
  const passe = onglet === "past";
  const agenda = composerAgenda(passe ? passees : aVenir, onglet);
  const sousTitre = sousTitreAgenda(aVenir.length);
  const aujourdhui = jourLocal();
  const vide = !agenda.voyages.length && !agenda.prochain && !agenda.suivants.length;

  return (
    <>
      {/* L'EN-TÊTE — titre d'écran comme tous les autres (t-titre-ecran, 27 px :
          le brief demandait plus grand, la cohérence avec l'app l'a emporté le
          30/09/2026), « looks » dans l'italique terracotta des mots éditoriaux. */}
      <div className="t-surtitre text-muted">Planifier</div>
      <h1 className="t-titre-ecran text-ink mt-[6px]" style={{ textWrap: "balance" }}>
        Mes <span className="italic text-terracotta">looks</span> à venir
      </h1>
      {sousTitre && <div className="t-chapeau text-muted-3 mt-[8px]">{sousTitre}</div>}

      {(aVenir.length > 0 || passees.length > 0) && <div className="mt-[18px]">{onglets}</div>}

      {vide ? (
        passe ? (
          <div className="mt-[26px] text-center px-4">
            <div className="t-titre-carte text-ink">Aucun look passé</div>
            <div className="t-chapeau text-muted mt-2" style={{ textWrap: "pretty" }}>
              Tes looks et tes voyages viendront ici une fois leur date passée.
            </div>
          </div>
        ) : (
          /* L'ÉTAT VIDE — une invitation, pas un constat, dans la forme des
             autres états vides de l'app (cadre en pointillés, titre de carte :
             Tenue, hub Planifier). Le bouton est celui du pied de page,
             toujours visible : il n'est pas répété ici. */
          <div className="mt-4 rounded-carte px-5 py-[30px] text-center" style={{ border: "1px dashed var(--color-sand-border)" }}>
            <div className="t-titre-carte text-ink">Ton prochain look commence ici.</div>
            <div className="text-[12px] text-muted leading-[1.5] mt-2" style={{ textWrap: "pretty" }}>
              Planifie une tenue pour une occasion, un voyage ou simplement demain.
            </div>
          </div>
        )
      ) : (
        <>
          {/* NIVEAU 3 — LES VOYAGES, EN CONTEXTE. Une ligne légère, sans fond :
              « Capsela a préparé ma garde-robe pour ce voyage », pas une
              seconde carte qui disputerait la place au look. */}
          {agenda.voyages.length > 0 && (
            <div className="mt-[20px] flex flex-col gap-[10px]">
              {agenda.voyages.map((v) => {
                const nb = looksDisponibles(v, dressing);
                const occasions = occasionsDuVoyage(v);
                return (
                  <button
                    key={"voyage-" + v.id}
                    onClick={() => onOuvrirValise(v)}
                    className="w-full text-left rounded-carte border border-border px-4 py-[11px] flex items-center gap-3 cursor-pointer transition-transform active:scale-[.99]"
                    style={{ opacity: passe ? 0.78 : 1 }}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-[7px] t-label">
                        <span className="text-terracotta flex-shrink-0">
                          <GlypheOccasion occasion="voyage" taille={14} />
                        </span>
                        <span className="text-terracotta truncate">{v.destination}</span>
                        <span className="text-muted whitespace-nowrap">
                          {dateCourte(v.depart).replace(/^\S+ /, "")}
                          {v.depart !== v.retour ? ` — ${dateCourte(v.retour).replace(/^\S+ /, "")}` : ""}
                        </span>
                      </span>
                      {nb > 0 && (
                        <span className="block text-[13px] text-ink mt-[6px]">
                          {nb} {nb > 1 ? "looks préparés" : "look préparé"}
                        </span>
                      )}
                      {occasions.length > 0 && (
                        <span className="block text-[12px] text-muted mt-[2px] truncate">{occasions.join(" · ")}</span>
                      )}
                    </span>
                    <span className="text-muted">
                      <Chevron />
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* NIVEAU 1 — LE PROCHAIN LOOK. */}
          {agenda.prochain && (
            <ProchainLook
              t={agenda.prochain}
              pieces={piecesDuPlan(agenda.prochain)}
              echeance={echeanceCourte(agenda.prochain.jour, aujourdhui)}
              onOuvrir={onOuvrir}
              onMenu={onMenu}
            />
          )}

          {/* NIVEAU 2 — LA FRISE DES LOOKS SUIVANTS (ou des looks passés, plus
              discrète). Une ligne verticale très fine relie les dates. */}
          {agenda.suivants.length > 0 && (
            <section className="mt-[34px]">
              {!passe && <div className="t-surtitre text-muted">Tes prochains looks</div>}
              <ol className="relative mt-[16px]" style={{ opacity: passe ? 0.8 : 1 }}>
                <span aria-hidden="true" className="absolute left-[5px] top-[8px] bottom-[26px] w-px bg-border" />
                {agenda.suivants.map((t) => {
                  const pieces = piecesDuPlan(t);
                  const echeance = passe ? null : echeanceCourte(t.jour, aujourdhui);
                  const ville = villeDuLieu(t.lieu);
                  return (
                    <li key={t.id} className="relative pl-[26px] pb-[24px]">
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-[3px] w-[11px] h-[11px] rounded-full border"
                        style={{
                          borderColor: passe ? "var(--color-border)" : "var(--color-terracotta)",
                          background: passe ? "var(--color-border)" : "var(--color-cream)",
                        }}
                      />
                      <div className="t-label text-terracotta">
                        {dateCourte(t.jour)}
                        {echeance && <span className="text-muted"> · {echeance}</span>}
                      </div>
                      <button
                        onClick={() => onOuvrir(t)}
                        aria-label={`Voir le look : ${occasionShortLabel(t.occasion)}, ${dateLongue(t.jour)}`}
                        className="mt-[9px] w-full flex items-center gap-[14px] text-left cursor-pointer transition-transform active:scale-[.99]"
                      >
                        <span className="w-[44%] max-w-[180px] flex-shrink-0 rounded-carte bg-warm-bg p-[8px]" style={{ aspectRatio: "1 / 1" }}>
                          {pieces.length > 0 && <OutfitComposition items={pieces} variant="planche" />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block t-titre-carte text-ink">{occasionShortLabel(t.occasion)}</span>
                          <span className="block text-[12px] text-muted-3 mt-[5px]">
                            {t.moment}
                            {ville ? ` · ${ville}` : ""}
                          </span>
                        </span>
                        <span className="text-muted">
                          <Chevron />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          {/* LE RESTE — une ligne par look : la hiérarchie tient jusqu'au bout. */}
          {agenda.plusTard.length > 0 && (
            <section className="mt-[10px]" style={{ opacity: passe ? 0.8 : 1 }}>
              <div className="t-surtitre text-muted">{passe ? "Plus anciens" : "Plus tard"}</div>
              <div className="mt-[6px]">
                {agenda.plusTard.map((t) => {
                  const ville = villeDuLieu(t.lieu);
                  return (
                    <button
                      key={t.id}
                      onClick={() => onOuvrir(t)}
                      className="w-full flex items-center gap-3 py-[13px] border-b border-border text-left cursor-pointer active:opacity-80"
                    >
                      <span className="t-label text-muted w-[92px] flex-shrink-0 whitespace-nowrap">{dateCourte(t.jour)}</span>
                      <span className="flex-1 min-w-0 truncate">
                        <span className="text-[13px] text-ink">{occasionShortLabel(t.occasion)}</span>
                        {ville && <span className="text-[12px] text-muted"> · {ville}</span>}
                      </span>
                      <span className="text-muted">
                        <Chevron />
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {!passe && (
            <div className="text-[11.5px] text-muted text-center leading-[1.5] mt-[26px]">
              Pour une occasion, une destination
              <br />
              ou simplement demain.
            </div>
          )}
        </>
      )}
    </>
  );
}

/**
 * LE PROCHAIN LOOK. L'image d'abord — la planche de la tenue enregistrée, la
 * même que l'accueil et le détail, sur le fond chaud des cartes éditoriales —,
 * puis l'occasion, la date et le moment, le lieu et la météo ENREGISTRÉE à la
 * planification (dite comme telle, jamais une prévision du jour), puis le
 * conseil, puis l'action. Pas de « Tenue planifiée » : le surtitre dit
 * « Prochain rendez-vous ».
 */
function ProchainLook({
  t,
  pieces,
  echeance,
  onOuvrir,
  onMenu,
}: {
  t: TenuePlanifiee;
  pieces: Item[];
  echeance: string | null;
  onOuvrir: (t: TenuePlanifiee) => void;
  onMenu: (t: TenuePlanifiee) => void;
}) {
  const ville = villeDuLieu(t.lieu);
  const occasion = occasionShortLabel(t.occasion);
  // Le conseil des pièces réelles ; sans lui, la phrase éditoriale de l'occasion (celle du « Look du jour »).
  const detail =
    detailCapsela(pieces, t.occasion) ?? titreLookDuJour(t.occasion, (t.sousChoix ?? "") as WorkMode, (t.sousChoix ?? "") as DateContext);
  const meteo = t.temp != null ? `${t.temp}°${t.weatherLabel ? ` · ${t.weatherLabel}` : ""}` : null;
  const contexte = [ville, meteo].filter(Boolean).join(" · ");
  return (
    <section className="mt-[28px] motion-safe:animate-[capsule-apparition_420ms_ease-out_both]">
      <div className="flex items-baseline justify-between gap-3">
        <div className="t-surtitre text-muted">Prochain rendez-vous</div>
        {echeance && <div className="t-label text-terracotta">{echeance}</div>}
      </div>

      <div className="mt-[12px] bg-card border border-border rounded-hero p-[10px]">
        {/* L'OCCASION ET LA DATE AU-DESSUS DE L'IMAGE : le brief veut qu'on
            sache en trois secondes quel look, pour quoi, quand. Dessous, au
            premier écran d'un téléphone, elles tombaient sous le pli (mesuré
            à 390 × 844). */}
        <div className="px-[8px] pt-[8px] pb-[12px]">
          <div className="t-label text-terracotta">
            {dateCourte(t.jour)} · {t.moment}
          </div>
          <div className="t-titre-ecran text-ink mt-[5px]">{occasion}</div>
        </div>
        <div className="relative">
          <button
            onClick={() => onOuvrir(t)}
            aria-label={`Voir le look : ${occasion}, ${dateLongue(t.jour)}`}
            className="block w-full rounded-carte bg-warm-bg cursor-pointer transition-transform active:scale-[.99]"
            style={{ aspectRatio: "100 / 86", padding: "18px 16px" }}
          >
            {pieces.length > 0 ? (
              <OutfitComposition items={pieces} variant="planche" />
            ) : (
              <span className="h-full flex items-center justify-center text-center px-6 text-[13px] text-muted-3 leading-[1.5]">
                Les pièces de ce look ne sont plus dans ton dressing.
              </span>
            )}
          </button>
          <button
            onClick={() => onMenu(t)}
            aria-label={`Actions pour le look du ${dateLongue(t.jour)}`}
            className="absolute top-[4px] right-[4px] w-11 h-11 flex items-center justify-center cursor-pointer text-muted-3"
          >
            <span aria-hidden="true" className="text-[17px] leading-none">
              ⋯
            </span>
          </button>
        </div>

        <div className="px-[8px] pt-[12px] pb-[8px]">
          {contexte && (
            <div className="flex items-center gap-[6px] text-[12.5px] text-muted-3">
              <span className="text-terracotta">
                <GlypheEpingle />
              </span>
              <span className="truncate">{contexte}</span>
            </div>
          )}
          {meteo && <div className="text-[11px] text-muted mt-[3px]">Météo prévue au moment de planifier</div>}

          {/* LE DÉTAIL CAPSELA — une phrase, celle d'un styliste. */}
          <div className={(contexte ? "mt-[14px] " : "") + "pt-[14px] border-t border-border"}>
            <div className="flex items-center gap-[7px] t-label text-sand-text">
              <span aria-hidden="true" className="font-serif italic text-[13px] leading-none text-terracotta normal-case tracking-normal">
                ✦
              </span>
              Le détail Capsela
            </div>
            <p className="font-serif italic text-[15px] leading-[1.45] text-ink mt-[7px]" style={{ textWrap: "pretty" }}>
              {detail}
            </p>
          </div>

          {/* L'action en bas de carte, sans fond (t-cta) : la même forme que
              « Préparer ma valise → » sur les cartes du hub. */}
          <button
            onClick={() => onOuvrir(t)}
            className="mt-[10px] t-cta text-terracotta min-h-[44px] flex items-center cursor-pointer active:opacity-70"
          >
            Voir le look&nbsp;<span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </section>
  );
}
