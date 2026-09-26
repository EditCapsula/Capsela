"use client";

import { useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
import AvisEnregistresJournal from "@/components/AvisEnregistresJournal";
import LoadingSpinner from "@/components/LoadingSpinner";
import { resolveItemImage } from "@/lib/catalogImages";
import { useAuth } from "@/lib/auth";
import { DAYS_FR, MONTHS_FR, occasionShortLabel } from "@/lib/data";
import { participePorte, participePorteMaj } from "@/lib/logic";
import { useCapsela } from "@/lib/store";
import {
  capsuleJournal,
  etatDePort,
  journalEntries,
  journalInsights,
  moisAnnee,
  moisDepuis,
  mostWornPieces,
  nomCourtPiece,
  deLaSaisonEnCours,
  styleDuMois,
  STYLE_DU_MOIS_MINIMUM,
  type EtatDePort,
  type JournalEntry,
  type JournalPeriod,
} from "@/lib/selectors";
import { OCCASIONS_EDITORIALES, titreStyle } from "@/lib/occasionEditoriale";
import type { ChoixRevente, Item, OccasionKey } from "@/lib/types";

/*
 * LE JOURNAL — refonte du 25/09/2026 (brief « Refonte UX du Journal »).
 *
 * L'ancien écran empilait quatre tuiles de chiffres, un bandeau, un carrousel
 * d'insights, un top 3 et « À redécouvrir » avant la première tenue : un
 * tableau de bord. L'ordre est désormais celui d'une lecture — ce que tu as
 * porté, ce que ça dit de toi, ce qui attend dans ton placard, ce que tu
 * pourrais laisser partir, puis tes dernières tenues.
 *
 * AUCUN CHIFFRE N'EST ÉCRIT EN DUR. Tout vient de l'historique réel
 * (journalStats, journalInsights, mostWornPieces, journalEntries) et de
 * etatDePort pour le placard et la revente. Une section sans donnée n'est
 * pas affichée — jamais de « 0 pièce » ni de carte vide.
 */

const PERIOD_BUCKETS: { key: JournalPeriod; label: string }[] = [
  { key: "today", label: "Aujourd'hui" },
  { key: "yesterday", label: "Hier" },
  { key: "week", label: "Cette semaine" },
  { key: "earlier", label: "Plus tôt" },
];

/** Tenues visibles sur le Journal avant « Voir tout mon journal » (§12 : pas d'historique interminable). */
const APERCU_HISTORIQUE = 3;
/** Pas de chargement de l'historique complet. */
const HISTORY_PAGE_SIZE = 5;
/** Cartes du carrousel « À sortir du placard » — le compte annoncé, lui, porte sur toutes. */
const PLACARD_MAX = 10;

/**
 * Pour quoi le dressing a surtout servi ce mois-ci, dit comme une phrase et
 * non comme un pourcentage de catégorie (§1 du brief). Une entrée par
 * occasion existante — aucune occasion inventée.
 */
const MOMENT_DE_L_OCCASION: Record<Exclude<OccasionKey, "all">, string> = {
  quotidien: "ton quotidien",
  travail_formel: "tes journées de travail",
  entretien: "tes rendez-vous",
  date: "tes rendez-vous à deux",
  soiree: "tes sorties",
  festive: "tes soirées festives",
  sport: "tes séances de sport",
  cocooning: "tes moments cocooning",
  voyage: "tes voyages",
  evenement_perso: "tes cérémonies",
};

/**
 * Une barre segmentée : un segment par tenue analysée, pleins pour
 * l'occasion principale (brief du 26/09/2026 — les points ronds ne se
 * lisaient pas assez). Le ratio est aussi écrit à côté, en toutes lettres :
 * la couleur ne porte jamais seule l'information.
 */
function BarreTenues({ compte, total }: { compte: number; total: number }) {
  return (
    <div className="flex items-center gap-[10px]">
      <div className={"flex-1 flex " + (total > 15 ? "gap-[2px]" : "gap-[3px]")} aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={"flex-1 h-[6px] rounded-full " + (i < compte ? "bg-terracotta" : "bg-sand-border")} />
        ))}
      </div>
      <span className="text-[12px] text-warm-text-2 whitespace-nowrap flex-shrink-0">
        {compte} sur {total}
      </span>
    </div>
  );
}

const pl = (n: number, un: string, plusieurs: string) => (n <= 1 ? un : plusieurs);

function Surtitre({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`t-surtitre text-muted ${className}`}>{children}</div>;
}

/* Icônes linéaires 1,6 — même trait que le reste de l'app. */
function IconeCintre() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.2a1.5 1.5 0 1 1 1.3 2.3L12 7" />
      <path d="M12 7l9.3 6.6a1.4 1.4 0 0 1-.9 2.5H3.6a1.4 1.4 0 0 1-.9-2.5L12 7z" />
    </svg>
  );
}
function IconeGraphique() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20h16" />
      <path d="M7 16v-4M12 16V8M17 16v-6" />
    </svg>
  );
}
function IconeIdee() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18h6M10 21h4M8 14.5A5.5 5.5 0 1 1 16 14.5c-.7.8-1.3 1.6-1.4 2.5H9.4c-.1-.9-.7-1.7-1.4-2.5z" />
    </svg>
  );
}

/** Visuel d'une pièce : image produit ou photo si elle existe, sinon sa pastille de couleur — jamais une image inventée. */
function Vignette({ item, className = "", pad = 6 }: { item: Item; className?: string; pad?: number }) {
  const img = resolveItemImage(item);
  return (
    <div
      className={`rounded-[12px] overflow-hidden flex-shrink-0 ${className}`}
      style={
        img.url
          ? { aspectRatio: "4/5", background: "var(--color-warm-bg)", padding: img.kind === "photo" ? 0 : pad }
          : { aspectRatio: "4/5", background: item.hex, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.06)" }
      }
    >
      {img.url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          loading="lazy"
          src={img.url}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: img.kind === "photo" ? "cover" : "contain", objectPosition: "center" }}
        />
      )}
    </div>
  );
}

/** « Jamais porté », « portée », « portés », « portées » : accordé au genre et au nombre de la pièce (participePorte). */
function jamaisPorte(item: Item): string {
  return "Jamais " + participePorte(item);
}

/**
 * Le statut d'une pièce qui attend, dit sans mélange (audit du 25/09) :
 * « Jamais porté(e) » ou la durée depuis son dernier port — « 8 mois ».
 */
function statutAttente(item: Item, port: EtatDePort): string {
  if (port.moisSansPort == null) return jamaisPorte(item);
  // Au-delà d'un an, la durée exacte n'apporte plus rien : « 12 mois+ »
  // (brief Journal V2 final). Pas un seuil métier : l'affichage seulement.
  return port.moisSansPort >= 12 ? "12 mois+" : `${port.moisSansPort} mois`;
}

/** Jauge en anneau : la part de la capsule déjà portée, le chiffre écrit au centre. */
function AnneauCapsule({ pourcentage }: { pourcentage: number }) {
  const taille = 92;
  const trait = 7;
  const r = (taille - trait) / 2;
  const c = 2 * Math.PI * r;
  const plein = (Math.min(100, Math.max(0, pourcentage)) / 100) * c;
  return (
    <div className="relative flex-shrink-0" style={{ width: taille, height: taille }} role="img" aria-label={`${pourcentage} % de ta capsule portée`}>
      <svg width={taille} height={taille} viewBox={`0 0 ${taille} ${taille}`} aria-hidden="true" style={{ display: "block" }}>
        <circle cx={taille / 2} cy={taille / 2} r={r} fill="none" stroke="var(--color-warm-bg)" strokeWidth={trait} />
        {plein > 0 && (
          <circle
            cx={taille / 2}
            cy={taille / 2}
            r={r}
            fill="none"
            stroke="var(--color-terracotta)"
            strokeWidth={trait}
            strokeLinecap="round"
            strokeDasharray={`${plein} ${c - plein}`}
            transform={`rotate(-90 ${taille / 2} ${taille / 2})`}
          />
        )}
      </svg>
      <div aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="t-chiffre text-ink">{pourcentage} %</span>
        <span className="text-[9px] text-muted leading-[1.2] mt-[4px]">
          de ta capsule
          <br />
          portée
        </span>
      </div>
    </div>
  );
}

/**
 * Un look de l'historique, son visuel d'abord.
 *
 * LE LOOK COMPLET (audit du 25/09) : toutes ses pièces, sur une seule
 * bande, et non plus les trois premières. Aucune image de tenue n'existe
 * (rien n'est photographié ni généré) — le visuel du look, ce sont ses
 * pièces. Bande à hauteur fixe : la carte ne change pas de taille avec le
 * nombre de pièces, chaque pièce se contient dans sa part de largeur.
 */
function CarteTenue({ entry, onOpen }: { entry: JournalEntry; onOpen: () => void }) {
  // « Aujourd'hui », « Hier », puis le jour de la semaine en toutes lettres
  // pour les sept derniers jours ; au-delà, la date abrégée suffit.
  const quand =
    entry.period === "today"
      ? `Aujourd'hui · ${entry.jour}`
      : entry.period === "yesterday"
        ? `Hier · ${entry.jour}`
        : entry.period === "week"
          ? `${DAYS_FR[new Date(entry.ts).getDay()]} · ${entry.jour}`
          : entry.rel;
  return (
    <button
      onClick={onOpen}
      className="w-full bg-card border border-border rounded-[20px] overflow-hidden text-left cursor-pointer px-3 pt-[12px] pb-[13px]"
      aria-label={`${quand}${entry.hasOccasion ? `, ${entry.occLabel}` : ""} : ${entry.summary}. Voir la tenue`}
    >
      {/* Date et occasion sur une ligne quand elles tiennent ; sinon le badge
          passe dessous. Rien n'est tronqué : mesuré à 360 px, « Quotidien /
          Décontracté » était coupé et la date passait sur deux lignes. */}
      <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-[6px] px-1">
        <span className="text-[13px] text-ink whitespace-nowrap first-letter:uppercase">{quand}</span>
        {entry.hasOccasion && (
          <span className="t-pastille text-terracotta bg-warm-bg rounded-full px-[9px] py-[3px] whitespace-nowrap">
            {entry.occLabel}
          </span>
        )}
      </span>
      <span className="mt-[10px] flex gap-[6px] rounded-[15px] bg-warm-bg p-[8px]" style={{ height: 96 }}>
        {entry.swatches.map((p) => {
          const img = resolveItemImage(p);
          return (
            <span key={p.id} className="flex-1 min-w-0 h-full flex items-center justify-center">
              {img.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img.url}
                  alt=""
                  loading="lazy"
                  className={img.kind === "photo" ? "w-full h-full object-cover" : "max-w-full max-h-full object-contain"}
                  style={{ borderRadius: 8 }}
                />
              ) : (
                <span className="block w-full rounded-[8px]" style={{ height: "80%", maxWidth: 56, background: p.hex }} />
              )}
            </span>
          );
        })}
      </span>
      <span className="flex items-end gap-2 mt-[9px] px-1">
        <span className="flex-1 min-w-0 text-[12px] text-muted-3 leading-[1.45] line-clamp-2">{entry.summary}</span>
        <span aria-hidden="true" className="text-muted text-[15px] flex-shrink-0">›</span>
      </span>
    </button>
  );
}

export default function HistoryScreen() {
  const { state, wardrobePool, vestiairePool, actions, dressingLoaded, avisEnregistres } = useCapsela();

  // Avis de styliste enregistrés : lus au premier affichage du Journal (et
  // relus après un nouvel enregistrement, qui remet la liste à null).
  useEffect(() => {
    if (avisEnregistres === null) actions.chargerAvisEnregistres();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avisEnregistres]);
  const { profile } = useAuth();
  const [vue, setVue] = useState<"journal" | "vendre">("journal");
  const [historiqueComplet, setHistoriqueComplet] = useState(false);
  const [pages, setPages] = useState(1);
  const [filtre, setFiltre] = useState<OccasionKey | "toutes">("toutes");
  const [enCours, setEnCours] = useState<number | null>(null);
  const [avis, setAvis] = useState<{ ton: "ok" | "erreur"; texte: string; annuler?: { id: number; choix: ChoixRevente | null } } | null>(null);

  /* Même règle que `journalGender` sur l'accueil, et même repli sur « femme »
     quand le genre n'est pas renseigné — une seule convention pour les deux
     endroits qui servent ces planches. */
  const visuelVide =
    profile.gender === "homme"
      ? "/editorial/capsela_journal_empty_homme.webp"
      : "/editorial/capsela_journal_empty_femme.webp";

  // Pool de résolution stable (correctif 20/08/2026) : wardrobePool bascule
  // vers les pièces réelles dès qu'il y en a dans une catégorie, ce qui
  // ferait disparaître d'anciennes suggestions pourtant présentes dans
  // l'historique. state.items + vestiairePool couvre toutes les pièces.
  const resolvePool = [...state.items, ...vestiairePool];
  const possedees = new Map(state.items.map((i) => [i.id, i]));
  const ouvrirPiece = (item: Item) => actions.openItem(item.id, !possedees.has(item.id));

  const insights = journalInsights(state.history);
  const entries = journalEntries(state.history, resolvePool);
  const fetiches = mostWornPieces(state.history, resolvePool, 3);
  const style = styleDuMois(state.history);

  // ── À SORTIR DU PLACARD ─────────────────────────────────────────────
  // LES PIÈCES DU DRESSING SEULEMENT (26/09/2026, signalé : « pas logique
  // dans le parcours ») : une suggestion de la capsule n'est pas dans le
  // placard, elle ne peut pas « en sortir ». Jusque-là, le pool affiché
  // (réel + suggestions), comme l'ancien « À redécouvrir ». Pas seulement
  // les jamais portées : aussi celles qui n'ont pas été portées de toute
  // leur dernière saison.
  // Une pièce mise de côté pour vendre n'y figure plus : on ne propose pas
  // de tenue avec ce qu'elle a décidé de laisser partir.
  //
  // TROIS ÉTATS, JAMAIS MÉLANGÉS (audit du 25/09) : le placard montre les
  // pièces JAMAIS PORTÉES et celles À REDÉCOUVRIR (portées, pas depuis leur
  // dernière saison). Celles qui atteignent le seuil de vente vont dans
  // « À envisager de vendre » — sauf si elle a choisi de les garder : elles
  // reviennent alors ici, parmi celles à redécouvrir.
  //
  // SAISON EN COURS SEULEMENT (26/09/2026, signalé : des polos et un top
  // sans manches proposés fin septembre) : même règle que la capsule
  // (deLaSaisonEnCours). Une pièce d'été n'attend pas « son moment » en
  // automne — elle l'attend au printemps, et reviendra ici à ce moment-là.
  const placard = state.items
    .filter((item) => deLaSaisonEnCours(item))
    .filter((item) => item.revente !== "de_cote")
    .map((item) => ({ item, port: etatDePort(item, state.history) }))
    .filter(
      ({ item, port }) =>
        port.etat === "jamais" || port.etat === "delaissee" || (port.etat === "a_vendre" && item.revente === "gardee")
    )
    // Jamais portées d'abord, puis de la plus récente à la plus ancienne
    // absence — l'ordre de l'exemple du brief.
    .sort((a, b) => (a.port.moisSansPort ?? -1) - (b.port.moisSansPort ?? -1));
  const jamaisPortees = placard.filter(({ port }) => port.dernierPort == null).length;
  const aRedecouvrir = placard.length - jamaisPortees;

  // ── REVENTE ─────────────────────────────────────────────────────────
  // Uniquement des pièces du dressing réel : une suggestion ne s'achète pas,
  // elle ne se revend pas. « gardee » : elle a dit non, on ne repropose pas.
  const aVendre = state.items
    .map((item) => ({ item, port: etatDePort(item, state.history) }))
    .filter(({ item, port }) => port.etat === "a_vendre" && !item.revente)
    .sort((a, b) => (b.port.moisSansPort ?? Infinity) - (a.port.moisSansPort ?? Infinity));
  const deCote = state.items.filter((i) => i.revente === "de_cote");

  const choisir = async (item: Item, choix: ChoixRevente | null) => {
    const precedent = item.revente ?? null;
    setEnCours(item.id);
    setAvis(null);
    const ok = await actions.choisirRevente(item.id, choix);
    setEnCours(null);
    if (!ok) {
      setAvis({ ton: "erreur", texte: "Ton choix n'a pas pu être enregistré. Réessaie dans un instant." });
      return;
    }
    // Accordé au genre ET au nombre du vêtement (participePorte) : « Le jean
    // droit est mis de côté », « Les bottines sont mises de côté ».
    const accord = participePorte(item).slice("porté".length);
    const f = accord.startsWith("e");
    const pluriel = accord.endsWith("s");
    const pronom = pluriel ? (f ? "Elles" : "Ils") : f ? "Elle" : "Il";
    const mis = "mis" + (f ? "e" : "") + (f && pluriel ? "s" : "");
    const texte =
      choix === "gardee"
        ? `${item.name} ${pluriel ? "restent" : "reste"} dans ton dressing. ${pronom} ne te ${pluriel ? "seront" : "sera"} plus proposé${accord} ici.`
        : choix === "de_cote"
          ? `${item.name} ${pluriel ? "sont" : "est"} ${mis} de côté pour vendre. ${pronom} ${pluriel ? "restent" : "reste"} dans ton dressing tant que tu ne ${pluriel ? "les" : f ? "la" : "le"} retires pas.`
          : `${item.name} ${pluriel ? "ne sont" : "n'est"} plus ${mis} de côté.`;
    setAvis({ ton: "ok", texte, annuler: choix ? { id: item.id, choix: precedent } : undefined });
  };

  // ── CHARGEMENT ──────────────────────────────────────────────────────
  // Sans cet état, une utilisatrice qui a un historique verrait l'état vide
  // et son « Choisir ma première tenue » le temps du chargement.
  if (!dressingLoaded) {
    return (
      <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
        <AppHeader />
        <div className="flex justify-center mt-16" aria-live="polite">
          <LoadingSpinner size={56} />
          <span className="sr-only">Chargement de ton journal…</span>
        </div>
      </div>
    );
  }

  // ── PIÈCES À VENDRE ─────────────────────────────────────────────────
  if (vue === "vendre") {
    return (
      <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
        <AppHeader
          onBack={() => {
            setVue("journal");
            setAvis(null);
          }}
          backLabel="Revenir au journal"
        />
        <Surtitre className="mt-[18px]">Faire de la place</Surtitre>
        <div className="t-titre-ecran text-ink mt-[6px]" style={{ textWrap: "balance" }}>
          Pièces <span className="italic text-terracotta">à vendre</span>
        </div>
        <div className="t-chapeau text-muted-3 mt-[10px]">
          Ces pièces n&apos;ont pas trouvé leur moment depuis longtemps. Tu décides, pièce par pièce : rien ne quitte
          ton dressing sans toi.
        </div>

        {avis && (
          <div
            role={avis.ton === "erreur" ? "alert" : "status"}
            className={`mt-4 rounded-[16px] px-4 py-[12px] text-[12px] leading-[1.45] flex items-start gap-3 ${
              avis.ton === "erreur" ? "bg-warm-bg border border-warm-border text-rust" : "bg-warm-bg border border-warm-border text-warm-text-2"
            }`}
          >
            <span className="flex-1 min-w-0">{avis.texte}</span>
            {avis.annuler && (
              <button
                onClick={() => {
                  const cible = state.items.find((i) => i.id === avis.annuler!.id);
                  if (cible) void choisir(cible, avis.annuler!.choix);
                }}
                className="text-terracotta underline underline-offset-2 flex-shrink-0 min-h-[24px] cursor-pointer"
              >
                Annuler
              </button>
            )}
          </div>
        )}

        {aVendre.length > 0 ? (
          <div className="flex flex-col gap-3 mt-5">
            {aVendre.map(({ item, port }) => {
              const occupe = enCours === item.id;
              return (
                <div key={item.id} className="bg-card border border-border rounded-[20px] p-[14px]" aria-busy={occupe}>
                  <button onClick={() => ouvrirPiece(item)} className="w-full flex gap-[13px] text-left cursor-pointer">
                    <Vignette item={item} className="w-[72px]" pad={5} />
                    <div className="flex-1 min-w-0 pt-[2px]">
                      <div className="t-titre-carte text-ink">{item.name}</div>
                      <div className="text-[12px] text-muted-3 mt-[5px] leading-[1.4]">
                        {port.dernierPort != null
                          ? `Dernier port : ${moisAnnee(port.dernierPort)}`
                          : `${jamaisPorte(item)} depuis son arrivée${item.createdAt ? ` en ${moisAnnee(item.createdAt)}` : ""}`}
                      </div>
                      <div className="t-label text-terracotta mt-[7px]">
                        {port.moisSansPort != null
                          ? `${port.moisSansPort} mois sans sortie`
                          : item.createdAt
                            ? `Dans ton dressing depuis ${moisDepuis(item.createdAt)} mois`
                            : "Deux saisons sans sortie"}
                      </div>
                    </div>
                  </button>
                  <div className="flex flex-col gap-2 mt-[14px]">
                    <button
                      disabled={occupe}
                      onClick={() => void choisir(item, "gardee")}
                      className="w-full min-h-[46px] rounded-full border border-border-soft text-ink t-bouton cursor-pointer disabled:opacity-50"
                    >
                      Garder dans mon dressing
                    </button>
                    <button
                      disabled={occupe}
                      onClick={() => void choisir(item, "de_cote")}
                      className="w-full min-h-[46px] rounded-full bg-ink text-cream t-bouton cursor-pointer disabled:opacity-50"
                    >
                      Mettre de côté pour vendre
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-6 bg-card border border-border rounded-[20px] px-5 py-[18px] text-[13px] text-muted-3 leading-[1.5]">
            Plus aucune pièce à examiner pour l&apos;instant. Le journal te préviendra si l&apos;une d&apos;elles attend trop longtemps.
          </div>
        )}

        {deCote.length > 0 && (
          <div className="mt-[30px]">
            <Surtitre>Mises de côté pour vendre</Surtitre>
            <div className="text-[12px] text-muted-3 leading-[1.45] mt-[6px]">
              Elles restent dans ton dressing. Capsela ne vend rien pour toi : c&apos;est une simple note.
            </div>
            <div className="flex flex-col gap-[10px] mt-3">
              {deCote.map((item) => (
                <div key={item.id} className="bg-card border border-border rounded-[16px] p-[12px] flex items-center gap-[12px]" aria-busy={enCours === item.id}>
                  <Vignette item={item} className="w-[44px]" pad={3} />
                  <div className="flex-1 min-w-0 text-[13px] text-ink leading-[1.3]">{item.name}</div>
                  <button
                    disabled={enCours === item.id}
                    onClick={() => void choisir(item, null)}
                    className="text-[12px] text-terracotta min-h-[44px] px-1 flex-shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    Annuler
                    <span className="sr-only"> la mise de côté de {item.name}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── ÉTAT VIDE ───────────────────────────────────────────────────────
  // Aucune tenue portée : ni chiffres à zéro, ni « À redécouvrir », ni
  // historique vide (§3). Seulement ce que le journal deviendra.
  if (entries.length === 0) {
    return (
      <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
        <AppHeader />
        <Surtitre className="mt-[18px]">Ton journal</Surtitre>
        <div className="t-titre-ecran text-ink mt-[6px]" style={{ textWrap: "balance" }}>
          Ton style <span className="italic text-terracotta">commence ici</span>
        </div>
        <div className="t-chapeau text-muted-3 mt-[10px]">
          Chaque tenue que tu portes enrichit ton journal et aide Capsela à mieux comprendre ton style.
        </div>

        {/* VISUEL D'ÉTAT VIDE (fournis le 25/09/2026) : des vêtements à
            plat, sans personne — §2 du brief. Choisi sur le genre déclaré,
            comme les photos éditoriales de repli de l'accueil ; « femme »
            par défaut, comme elles. Dimensions écrites : la place est
            réservée avant l'arrivée de l'image (pas de next/image en export
            statique). */}
        <div className="mt-5 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={visuelVide}
            alt="Une planche de styliste à plat : une veste, un haut, un pantalon, des chaussures et un sac posés sur des socles clairs"
            width={720}
            height={731}
            loading="lazy"
            decoding="async"
            className="w-full max-w-[250px] h-auto rounded-[20px]"
          />
        </div>

        <ul className="grid grid-cols-3 gap-2 mt-6">
          {[
            { icone: <IconeCintre />, a: "Garde une trace", b: "de tes tenues" },
            { icone: <IconeGraphique />, a: "Découvre", b: "tes habitudes" },
            { icone: <IconeIdee />, a: "Obtiens des idées", b: "personnalisées" },
          ].map(({ icone, a, b }) => (
            <li key={a} className="flex flex-col items-center text-center">
              <span className="w-[38px] h-[38px] rounded-full bg-[#F0E5D6] text-terracotta flex items-center justify-center">{icone}</span>
              <span className="text-[11px] text-ink leading-[1.35] mt-[8px]">
                {a}
                <br />
                {b}
              </span>
            </li>
          ))}
        </ul>

        <AvisEnregistresJournal
          avis={avisEnregistres}
          onOuvrir={actions.ouvrirAvisEnregistre}
          onVoirTout={actions.goAvisTous}
          onAnalyser={actions.goAvisStyliste}
        />

        {/* Le parcours existant de la tenue du jour — aucun nouveau parcours (§3). */}
        <button
          onClick={actions.goTenues}
          className="mt-7 w-full min-h-[52px] bg-ink text-cream rounded-full t-bouton cursor-pointer"
        >
          Choisir ma première tenue
        </button>
      </div>
    );
  }

  // ── JOURNAL REMPLI ──────────────────────────────────────────────────
  const moment = insights.topOccasion && insights.topOccasion !== "all" ? MOMENT_DE_L_OCCASION[insights.topOccasion] : null;
  const phraseEnTete = moment
    ? `Ce mois-ci, tes tenues ont surtout accompagné ${moment}.`
    : insights.wornThisMonth > 0
      ? `Ce mois-ci, ${insights.wornThisMonth} ${pl(insights.wornThisMonth, "tenue a rejoint", "tenues ont rejoint")} ton journal.`
      : `Ta dernière tenue portée date du ${entries[0].jour}.`;

  // UNE SEULE BASE pour le bilan (cf. capsuleJournal) : le pool affiché et
  // l'historique réel — la même que les pièces fétiches et la timeline (le
  // placard, lui, ne lit plus que le dressing depuis le 26/09/2026). « Pièces utilisées » = pièces uniques portées au moins une
  // fois ; le pourcentage en découle.
  const capsule = capsuleJournal(wardrobePool, state.history);
  // Le mois de référence de journalInsights, et non celui de la dernière
  // tenue : sans tenue ce mois-ci, ce dernier nommait le mois précédent.
  const moisCourant = MONTHS_FR[insights.mois];

  const occasionsPresentes = [...new Set(entries.filter((e) => e.hasOccasion).map((e) => e.occasion))];
  const entreesFiltrees = filtre === "toutes" ? entries : entries.filter((e) => e.occasion === filtre);
  const entreesVisibles = entreesFiltrees.slice(0, pages * HISTORY_PAGE_SIZE);

  // « Voir mes looks travail → » : le journal complet, filtré sur cette
  // occasion — le filtre existant de « Tout mon journal », aucune page de
  // plus. Le défilement amène la liste filtrée à l'écran.
  const voirOccasion = (o: OccasionKey) => {
    setHistoriqueComplet(true);
    setFiltre(o);
    setPages(1);
    requestAnimationFrame(() =>
      document.getElementById("journal-historique")?.closest("section")?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  };
  const ouvrirJournalComplet = () => {
    setHistoriqueComplet(true);
    setPages(1);
    setFiltre("toutes");
  };

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
      <AppHeader />

      {/* EN-TÊTE */}
      <Surtitre className="mt-[18px]">Ton journal</Surtitre>
      <div className="t-titre-ecran text-ink mt-[6px]">
        {entries.length} <span className="italic text-terracotta">{pl(entries.length, "tenue portée", "tenues portées")}</span>
      </div>
      <div className="t-chapeau text-muted-3 mt-[8px]">{phraseEnTete}</div>

      {/* BILAN — une métrique principale, deux secondaires, chacune dite en
          toutes lettres (§6 : pas de petit chiffre sans contexte). */}
      {/* L'ANNEAU de la maquette (signalé le 25/09 : « il manque le graphe »).
          Une jauge, pas un graphique : une seule valeur rapportée à un
          total. Le pourcentage est écrit au centre en toutes lettres — la
          couleur ne porte jamais seule l'information. Arc terracotta sur
          piste sable : 3,4:1, au-dessus du seuil de 3:1 d'un élément
          graphique. Les deux chiffres secondaires sont à droite, séparés par
          des filets, comme sur la maquette. */}
      <div className="mt-5 bg-card border border-border rounded-[20px] px-4 py-4 flex items-center gap-3">
        {capsule.total > 0 && (
          <>
            <AnneauCapsule pourcentage={capsule.pourcentage} />
            <span aria-hidden="true" className="self-stretch w-px bg-border flex-shrink-0" />
          </>
        )}
        <div className="flex-1 min-w-0 grid grid-cols-2">
          <div className="pr-2">
            <div className="t-chiffre text-ink">{entries.length}</div>
            <div className="text-[12px] text-muted leading-[1.3] mt-[6px]">{pl(entries.length, "tenue portée", "tenues portées")}</div>
          </div>
          <div className="pl-3 border-l border-border">
            <div className="t-chiffre text-ink">{capsule.portees}</div>
            <div className="text-[12px] text-muted leading-[1.3] mt-[6px]">{pl(capsule.portees, "pièce utilisée", "pièces utilisées")}</div>
          </div>
        </div>
      </div>

      {/* TON STYLE CE MOIS-CI — une carte éditoriale (26/09/2026) : ce que
          ton mois dit de ton style, puis l'accès aux tenues qui le disent.
          Tout vient de styleDuMois : un ratio en nombres absolus (« 5 / 7 »,
          plus de pourcentage), un point par tenue analysée. Sous 3 tenues,
          sans occasion notée ou à égalité, la carte le dit simplement —
          jamais de conclusion inventée. Le compte des pièces jamais portées
          vit dans « À sortir du placard ». */}
      <section className="mt-[30px]" aria-labelledby="journal-style">
        <Surtitre>
          <span id="journal-style">Ton style ce mois-ci</span>
        </Surtitre>
        {style.etat === "tendance" ? (
          (() => {
            // Tout ce que la carte dit et montre de l'occasion vient d'une
            // seule source (OCCASIONS_EDITORIALES) ; les chiffres, de
            // styleDuMois. Sans visuel pour cette occasion, pas d'image de
            // repli : le texte prend toute la largeur.
            const o = OCCASIONS_EDITORIALES[style.occasion];
            return (
              <div className="mt-3 bg-warm-bg border border-warm-border rounded-[22px] px-5 pt-[16px] pb-[18px] overflow-hidden">
                <div className="flex gap-[14px]">
                  <div className="flex-1 min-w-0">
                    {/* Le nom de l'occasion en pastille, seul : plus de surtitre
                        « Occasion principale » (retiré le 26/09/2026, demandé). */}
                    <span className="inline-block t-pastille text-terracotta bg-card rounded-full px-[9px] py-[4px] whitespace-nowrap">
                      {o.libelle}
                    </span>
                    <div className="t-titre-section text-ink mt-[10px]" style={{ textWrap: "balance" }}>
                      {titreStyle(o, style.majorite)}
                    </div>
                    <div className="mt-[12px]">
                      <span className="sr-only">
                        {style.compte} {pl(style.compte, "tenue", "tenues")} sur {style.total}
                      </span>
                      <span aria-hidden="true" className="t-display text-terracotta whitespace-nowrap">
                        {style.compte} / {style.total}
                      </span>
                    </div>
                    <div className="text-[12px] text-warm-text-2 leading-[1.4] mt-[4px]">
                      {pl(style.compte, "tenue pensée", "tenues pensées")} pour {o.pour}
                    </div>
                  </div>
                  {/* Le visuel en pleine page de magazine : environ 38 % de la
                      carte, collé à son bord droit et à son haut (il déborde
                      de la marge intérieure), entier au format 3:4, sans cadre
                      ni ombre. */}
                  {o.visuel && (
                    <div className="flex-shrink-0 -mr-5 -mt-[16px] self-start" style={{ width: "calc((100% + 20px) * 0.4)" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={o.visuel.src}
                        alt={o.visuel.alt}
                        width={900}
                        height={1200}
                        loading="lazy"
                        decoding="async"
                        className="block w-full h-auto object-cover rounded-bl-[22px]"
                        style={{ aspectRatio: "3 / 4" }}
                      />
                    </div>
                  )}
                </div>
                <div className="mt-[16px]">
                  <BarreTenues compte={style.compte} total={style.total} />
                </div>
                <div className="text-[13px] text-muted-3 leading-[1.45] mt-[12px]">
                  {style.majorite ? o.insight : `Ton dressing accompagne d'abord ${o.pour}.`}
                </div>
                <button
                  onClick={() => voirOccasion(style.occasion)}
                  className="mt-[14px] w-full min-h-[48px] rounded-full bg-terracotta-deep active:bg-terracotta-hover text-cream t-cta cursor-pointer flex items-center justify-center gap-[8px] px-4"
                >
                  {o.cta}
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            );
          })()
        ) : (
          <div className="mt-3 bg-warm-bg border border-warm-border rounded-[20px] px-5 py-[16px]">
            <div className="t-titre-carte text-ink">
              {style.etat === "vide"
                ? `Aucune tenue portée en ${moisCourant} pour l'instant`
                : style.etat === "egalite"
                  ? "Aucune occasion ne se détache encore"
                  : "Pas encore de tendance ce mois-ci"}
            </div>
            <div className="text-[12px] text-warm-text-2 leading-[1.45] mt-[6px]">
              {style.etat === "vide"
                ? "Ton style du mois se dessinera au fil de tes tenues."
                : style.etat === "peu"
                  ? `${style.total} ${pl(style.total, "tenue portée", "tenues portées")} en ${moisCourant} : ton style du mois se dessinera à partir de ${STYLE_DU_MOIS_MINIMUM}.`
                  : style.etat === "egalite"
                    ? `Tes ${style.total} tenues de ${moisCourant} se partagent entre plusieurs occasions, sans qu'une passe devant.`
                    : `${style.total} tenues portées en ${moisCourant}, sans occasion précisée.`}
            </div>
          </div>
        )}
      </section>

      {/* TES PIÈCES FÉTICHES */}
      {fetiches.length > 0 && (
        <section className="mt-[30px]" aria-labelledby="journal-fetiches">
          <Surtitre>
            <span id="journal-fetiches">Tes pièces fétiches</span>
          </Surtitre>
          {/* Vitrine horizontale (26/09/2026) : les trois pièces visibles
              ensemble, sans défilement — une liste verticale à vignettes de
              44 px prenait trop de hauteur pour trois pièces. Même vignette
              4/5 que « À sortir du placard », le rang posé sur l'image. Nom
              court sur deux lignes au plus, hauteur réservée : un nom long ne
              décale ni la carte ni le nombre de ports. */}
          <ol className="mt-3 grid grid-cols-3 gap-[10px]">
            {fetiches.map(({ item, count }, idx) => {
              const ports = `${participePorteMaj(item)} ${count} fois`;
              return (
                <li key={item.id} className="min-w-0">
                  <button
                    onClick={() => ouvrirPiece(item)}
                    className="w-full text-left cursor-pointer"
                    aria-label={`${idx + 1}. ${item.name}, ${ports.toLowerCase()}`}
                  >
                    <span className="relative block">
                      <Vignette item={item} className="w-full" pad={6} />
                      <span
                        aria-hidden="true"
                        className="absolute top-[6px] left-[6px] w-[22px] h-[22px] rounded-full bg-card flex items-center justify-center font-serif text-[13px] leading-none text-terracotta"
                      >
                        {idx + 1}
                      </span>
                    </span>
                    <span className="text-[12px] text-ink leading-[1.25] mt-[7px] line-clamp-2 min-h-[2.5em]">
                      {nomCourtPiece(item.name)}
                    </span>
                    <span className="block text-[11px] text-muted mt-[2px]">{ports}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* À SORTIR DU PLACARD — jamais portées ET pas portées de toute leur
          dernière saison (etatDePort), avec la durée. */}
      {placard.length > 0 && (
        <section className="mt-[30px]" aria-labelledby="journal-placard">
          <Surtitre className="text-terracotta">
            <span id="journal-placard">À sortir du placard</span>
          </Surtitre>
          <div className="text-[13px] text-ink leading-[1.45] mt-[6px]">
            {placard.length} {pl(placard.length, "pièce de ton dressing attend", "pièces de ton dressing attendent")} encore{" "}
            {pl(placard.length, "son", "leur")} moment
            {jamaisPortees > 0 && aRedecouvrir > 0 ? ` : ${jamaisPortees} à porter, ${aRedecouvrir} à redécouvrir.` : "."}
          </div>
          <ul className="scrollarea flex gap-[10px] overflow-x-auto mt-3 pb-[2px]">
            {placard.slice(0, PLACARD_MAX).map(({ item, port }) => (
              <li key={item.id} className="flex-none w-[96px]">
                <button
                  onClick={() => ouvrirPiece(item)}
                  className="w-full text-left cursor-pointer"
                  aria-label={`${item.name}, ${statutAttente(item, port).toLowerCase()}`}
                >
                  <Vignette item={item} className="w-full" pad={6} />
                  {/* Le statut en pastille, comme sur la maquette : « JAMAIS
                      PORTÉE » ou « 8 MOIS » — les deux états ne se confondent
                      jamais. */}
                  <span className="inline-block mt-[7px] rounded-full bg-warm-bg px-[8px] py-[2px] t-pastille text-terracotta">
                    {statutAttente(item, port)}
                  </span>
                  <div className="text-[12px] text-ink mt-[4px] leading-[1.25] line-clamp-2">{item.name}</div>
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={() => actions.openItemOutfits(placard[0].item.id, false)}
            className="mt-3 min-h-[44px] text-[12px] text-terracotta cursor-pointer"
            aria-label={`Voir les idées de tenues avec ${placard[0].item.name}`}
          >
            Voir les idées de tenues →
          </button>
        </section>
      )}

      {/* À ENVISAGER DE VENDRE — seulement si des pièces atteignent
          réellement le seuil (etatDePort « a_vendre » : pas portées des deux
          dernières saisons écoulées). Jamais de section vide, rien
          d'automatique. La phrase ne dit « plus de 12 mois » que si c'est
          vrai pour TOUTES : une pièce jamais portée arrivée en janvier peut
          atteindre le seuil (présente toute la saison chaude et au moins 30
          jours de la froide) sans avoir un an de dressing. */}
      {aVendre.length > 0 && (() => {
        const durees = aVendre.map(({ item, port }) => port.moisSansPort ?? (item.createdAt ? moisDepuis(item.createdAt) : 0));
        const plusDunAn = durees.every((m) => m >= 12);
        const depuis = plusDunAn ? "depuis plus de 12 mois" : "depuis deux saisons";
        return (
          <section className="mt-[22px] bg-warm-bg border border-warm-border rounded-[20px] px-5 py-[18px]" aria-labelledby="journal-revente">
            <div id="journal-revente" className="t-surtitre text-terracotta">
              À envisager de vendre
            </div>
            <div className="t-titre-carte text-ink mt-[8px]">
              {aVendre.length === 1
                ? `Une pièce n'a pas été portée ${depuis}`
                : `${aVendre.length} pièces n'ont pas été portées ${depuis}`}
            </div>
            <div className="text-[13px] text-warm-text-2 leading-[1.5] mt-[6px]">
              {aVendre.length === 1 ? "Elle n'a pas trouvé sa place" : "Elles n'ont pas trouvé leur place"} dans tes tenues depuis longtemps. Tu
              pourrais envisager de {pl(aVendre.length, "la", "les")} vendre pour faire de la place dans ta capsule.
            </div>
            <button
              onClick={() => {
                setAvis(null);
                setVue("vendre");
              }}
              className="mt-[12px] min-h-[44px] t-lien text-terracotta cursor-pointer"
            >
              Voir les pièces →
            </button>
          </section>
        );
      })()}
      {/* Pièces déjà mises de côté, sans candidate nouvelle : un simple lien
          pour y revenir, pas une section « à vendre ». */}
      {aVendre.length === 0 && deCote.length > 0 && (
        <button
          onClick={() => {
            setAvis(null);
            setVue("vendre");
          }}
          className="mt-[14px] min-h-[44px] text-[12px] text-terracotta cursor-pointer"
        >
          {deCote.length} {pl(deCote.length, "pièce mise", "pièces mises")} de côté pour vendre →
        </button>
      )}

      <AvisEnregistresJournal
          avis={avisEnregistres}
          onOuvrir={actions.ouvrirAvisEnregistre}
          onVoirTout={actions.goAvisTous}
          onAnalyser={actions.goAvisStyliste}
        />

      {/* HISTORIQUE — les dernières tenues, visuel en tête (§12). */}
      <section className="mt-[30px]" style={{ scrollMarginTop: 12 }} aria-labelledby="journal-historique">
        {/* « Voir les 23 → » sur la ligne du titre (26/09/2026, règle de
            vocabulaire) : le compte exact de ce que la liste complète ouvre —
            des tenues portées, pas des looks enregistrés (« Mes looks »). Pas
            de compte du mois ici : l'en-tête dit le total, la carte « Ton
            style ce mois-ci » le mois. */}
        <div className="flex items-baseline justify-between gap-3">
          <Surtitre>
            <span id="journal-historique">{historiqueComplet ? "Tout mon journal" : "Tes dernières tenues"}</span>
          </Surtitre>
          {!historiqueComplet && entries.length > APERCU_HISTORIQUE && (
            <button
              onClick={ouvrirJournalComplet}
              aria-label={`Voir les ${entries.length} tenues portées`}
              className="text-[12px] text-terracotta cursor-pointer flex-shrink-0 whitespace-nowrap py-[13px] -my-[13px]"
            >
              Voir les {entries.length} →
            </button>
          )}
        </div>

        {!historiqueComplet ? (
          <div className="flex flex-col gap-3 mt-3">
            {entries.slice(0, APERCU_HISTORIQUE).map((e) => (
              <CarteTenue key={e.id} entry={e} onOpen={() => actions.viewItemOutfit(e.pieceIds, e.occasion)} />
            ))}
          </div>
        ) : (
          <>
            {/* Filtre discret (§13), seulement s'il départage vraiment : au
                moins deux occasions présentes dans l'historique. */}
            {/* Affiché aussi quand un filtre est posé (depuis « Ton style ce
                mois-ci ») : un filtre actif doit se voir et se retirer. */}
            {(occasionsPresentes.length >= 2 || filtre !== "toutes") && (
              <div className="scrollarea flex gap-2 overflow-x-auto mt-3 pb-[2px]">
                {(["toutes", ...occasionsPresentes] as const).map((o) => {
                  const actif = filtre === o;
                  return (
                    <button
                      key={o}
                      aria-pressed={actif}
                      onClick={() => {
                        setFiltre(o);
                        setPages(1);
                      }}
                      className={`flex-none min-h-[36px] px-[14px] rounded-full text-[12px] cursor-pointer border ${
                        actif ? "bg-ink text-cream border-ink" : "bg-card text-ink border-border"
                      }`}
                    >
                      {o === "toutes" ? "Toutes les tenues" : occasionShortLabel(o)}
                    </button>
                  );
                })}
              </div>
            )}
            {PERIOD_BUCKETS.map(({ key, label }) => {
              const groupe = entreesVisibles.filter((e) => e.period === key);
              if (groupe.length === 0) return null;
              return (
                <div key={key} className="mt-4">
                  {/* « Aujourd'hui » et « Hier » sont déjà en tête de leur
                      carte : le titre de groupe les répéterait mot pour mot. */}
                  {key !== "today" && key !== "yesterday" && (
                    <div className="t-label text-muted mb-[10px]">{label}</div>
                  )}
                  <div className="flex flex-col gap-3">
                    {groupe.map((e) => (
                      <CarteTenue key={e.id} entry={e} onOpen={() => actions.viewItemOutfit(e.pieceIds, e.occasion)} />
                    ))}
                  </div>
                </div>
              );
            })}
            {entreesVisibles.length < entreesFiltrees.length && (
              <button onClick={() => setPages((p) => p + 1)} className="mt-3 w-full min-h-[44px] text-[12px] text-terracotta cursor-pointer">
                Afficher plus de tenues
              </button>
            )}
          </>
        )}

        {/* « Voir tout » est monté au-dessus des cartes ; ici ne reste que
            le retour à l'aperçu. */}
        {historiqueComplet && (
          <button
            onClick={() => {
              setHistoriqueComplet(false);
              setPages(1);
              setFiltre("toutes");
            }}
            className="mt-3 w-full min-h-[44px] t-lien text-terracotta cursor-pointer"
          >
            Réduire mon journal
          </button>
        )}
      </section>
    </div>
  );
}
