"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AppHeader from "@/components/AppHeader";
import FilEtapes from "@/components/FilEtapes";
import LoadingSpinner from "@/components/LoadingSpinner";
import { OutfitComposition } from "@/components/OutfitComposition";
import SegmentedControl from "@/components/SegmentedControl";
import TabBar from "@/components/TabBar";
import { useAuth } from "@/lib/auth";
import { resolveItemImage } from "@/lib/catalogImages";
import { OCCASIONS, occasionShortLabel } from "@/lib/data";
import { jourLocal } from "@/lib/outfitFeedback";
import { villeDuLieu } from "@/lib/planifier";
import { previsionPour } from "@/lib/prevision";
import { paletteHexes } from "@/lib/profile";
import { useCapsela } from "@/lib/store";
import type { Item, OccasionKey } from "@/lib/types";
import {
  amplitudePrevue,
  BAGAGES,
  capaciteDe,
  composerValise,
  dateDe,
  DUREE_MAX_JOURS,
  etatJauge,
  generateurMoteur,
  GROUPES_VALISE,
  joursDuSejour,
  LIBELLE_JAUGE,
  libelleDuree,
  libelleSejour,
  looksDeLaValise,
  looksParPiece,
  nbPolyvalentes,
  occasionsDuSejour,
  occasionsRetenues,
  SEJOURS,
  SEUIL_POLYVALENTE,
  situationsDuSejour,
  type LookValise,
  type MeteoJour,
  type SituationValise,
  type TailleBagage,
  type TypeSejour,
} from "@/lib/valise";
import { fetchPrevisionByCity, fetchVilles, libelleVille, type VilleSuggeree } from "@/lib/weather";

/**
 * PRÉPARER SA VALISE — lot 1 (27/09/2026, docs/valise.md), d'après la
 * maquette « Capsela · Exploration · Préparer sa valise ».
 *
 * Ce que le lot 1 fait : quatre questions (destination et dates, bagage, type
 * de séjour, occasions), le choix des pièces (valise.ts), et le résultat en
 * deux onglets, Pièces et Looks, avec la jauge et « Retirer ».
 *
 * CE QUE LE LOT 1 NE FAIT PAS, ET POURQUOI IL NE LE MONTRE PAS :
 * - Pas de question « Comment voyages-tu ? » : elle ne sert qu'à la tenue de
 *   trajet (lot 2). La poser maintenant serait une question sans effet — et
 *   « On s'en sert pour ta tenue de trajet » serait faux.
 * - Pas d'onglets Trajet ni Checklist : ils arrivent au lot 2. Un onglet
 *   vide est une promesse, pas une fonction.
 * - Pas de « Remplacer », « Optimiser », « Porter pendant le trajet ».
 * - Pas de noms de looks inventés (« Balade dans l'Alfama ») : aucune donnée
 *   ne les fournit. Un look porte le nom de son occasion.
 * - Pas de « lieux favoris » : l'app n'en enregistre aucun. Les villes
 *   proposées sont celles de tes tenues planifiées — des lieux que tu as
 *   réellement donnés.
 * - Pas de température inventée : « 16° – 24° » n'apparaît que pour les jours
 *   que la prévision couvre (4 jours). Au-delà, la règle de Planifier :
 *   saison de la date, température d'aujourd'hui, et l'écran le dit.
 *
 * La valise est gardée SUR L'APPAREIL (localStorage) jusqu'au lot 2, qui
 * l'enregistrera en base (migration à venir, montrée avant).
 */

const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const DOW = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."];

/** La valise gardée sur l'appareil — tout ce qu'il faut pour la réafficher sans rien recalculer. */
interface ValiseGardee {
  version: 1;
  destination: string;
  depart: string;
  retour: string;
  bagage: TailleBagage;
  sejour: TypeSejour | null;
  occasions: OccasionKey[];
  meteos: MeteoJour[];
  situations: SituationValise[];
  pieceIds: number[];
  looks: LookValise[];
  situationsSansLook: number[];
}

const cleStockage = (userId: string | null) => `capsela.valise.${userId ?? "demo"}`;

function lireValise(userId: string | null): ValiseGardee | null {
  try {
    const raw = localStorage.getItem(cleStockage(userId));
    if (!raw) return null;
    const v = JSON.parse(raw) as ValiseGardee;
    // Un séjour terminé ne se rouvre pas : on repart d'une valise neuve.
    if (v.version !== 1 || v.retour < jourLocal()) return null;
    return v;
  } catch {
    return null;
  }
}

function garderValise(userId: string | null, v: ValiseGardee | null) {
  try {
    if (v) localStorage.setItem(cleStockage(userId), JSON.stringify(v));
    else localStorage.removeItem(cleStockage(userId));
  } catch {
    // Stockage indisponible : la valise reste affichée, elle ne survivra pas au rechargement.
  }
}

/** « 16 → 20 oct. », « 30 oct. → 2 nov. » */
function libellePeriode(depart: string, retour: string): string {
  const a = dateDe(depart);
  const b = dateDe(retour);
  if (depart === retour) return `${a.getDate()} ${MOIS[a.getMonth()]}`;
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()} → ${b.getDate()} ${MOIS[b.getMonth()]}`
    : `${a.getDate()} ${MOIS[a.getMonth()]} → ${b.getDate()} ${MOIS[b.getMonth()]}`;
}

const plusJours = (jour: string, n: number) => {
  const d = dateDe(jour);
  d.setDate(d.getDate() + n);
  return jourLocal(d);
};

// ── Petits composants, même grammaire que Planifier ─────────────────────

function Surtitre({ children }: { children: React.ReactNode }) {
  return <div className="t-surtitre text-muted">{children}</div>;
}

function TitreEtape({ a, b }: { a: string; b: string }) {
  return (
    <div className="t-titre-ecran text-ink mt-[6px]" style={{ textWrap: "balance" }}>
      {a} <span className="italic text-terracotta">{b}</span>
    </div>
  );
}

function Puce({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={actif}
      className={
        "rounded-full px-[14px] text-[12px] cursor-pointer border transition-colors " +
        (actif ? "bg-terracotta-deep border-terracotta-deep text-cream" : "bg-card border-border text-ink")
      }
      style={{ minHeight: 40 }}
    >
      {children}
    </button>
  );
}

const G_EPINGLE = (
  <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
    <path d="M12 21s6.5-6.1 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 14.9 12 21 12 21z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <circle cx="12" cy="10.4" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

/** Jauge en segments — un segment par place du bagage (maquette 06). */
function Jauge({ nb, capacite }: { nb: number; capacite: number }) {
  return (
    <div className="flex gap-[3px]" aria-hidden="true">
      {Array.from({ length: capacite }, (_, i) => (
        <span
          key={i}
          className="flex-1 h-[5px] rounded-full"
          style={{ background: i < nb ? "var(--color-cream)" : "rgba(251,243,234,.28)" }}
        />
      ))}
    </div>
  );
}

// ── Écran ────────────────────────────────────────────────────────────────

export default function ValiseScreen() {
  const { state, weather, actions } = useCapsela();
  const { profile, userId } = useAuth();
  const dressing = state.items;

  const [vue, setVue] = useState<"etape" | "calcul" | "resultat">("etape");
  const [etape, setEtape] = useState(1);
  const [valise, setValise] = useState<ValiseGardee | null>(null);
  // Relue après montage (jamais pendant le rendu initial : cf. auth.tsx).
  useEffect(() => {
    const v = lireValise(userId);
    if (v) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setValise(v);
      setVue("resultat");
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [userId]);

  // Réponses.
  const aujourdhui = jourLocal();
  const [destination, setDestination] = useState("");
  const [ville, setVille] = useState<VilleSuggeree | null>(null);
  const [suggestions, setSuggestions] = useState<VilleSuggeree[] | null>(null);
  const [depart, setDepart] = useState("");
  const [retour, setRetour] = useState("");
  const [bagage, setBagage] = useState<TailleBagage | null>(null);
  const [sejour, setSejour] = useState<TypeSejour | null>(null);
  const [occasions, setOccasions] = useState<OccasionKey[]>([]);
  // Les occasions suivent le séjour tant qu'on n'y a pas touché.
  const [occasionsTouchees, setOccasionsTouchees] = useState(false);

  const villeChoisieAffichee = ville != null && libelleVille(ville) === destination;
  useEffect(() => {
    if (vue !== "etape" || etape !== 1) return;
    const q = destination.trim();
    if (q.length < 2 || villeChoisieAffichee) return;
    let annule = false;
    const t = setTimeout(() => {
      fetchVilles(q)
        .then((v) => !annule && setSuggestions(v))
        .catch(() => !annule && setSuggestions(null));
    }, 280);
    return () => {
      annule = true;
      clearTimeout(t);
    };
  }, [destination, etape, vue, villeChoisieAffichee]);
  const suggestionsVisibles = destination.trim().length < 2 || villeChoisieAffichee ? [] : (suggestions ?? []);

  /** Villes de tes tenues planifiées : des lieux que tu as réellement donnés (aucun « favori » n'existe). */
  const villesConnues = useMemo(
    () => [...new Set(state.tenuesPlanifiees.map((t) => villeDuLieu(t.lieu)).filter(Boolean))].slice(0, 4),
    [state.tenuesPlanifiees]
  );

  const jours = depart && retour && retour >= depart ? joursDuSejour(depart, retour) : [];
  const dureeOk = jours.length > 0 && dateDe(retour) <= dateDe(plusJours(depart, DUREE_MAX_JOURS - 1));
  const etapeValide =
    etape === 1 ? destination.trim().length > 1 && depart >= aujourdhui && dureeOk : etape === 2 ? bagage != null : etape === 3 ? sejour != null : true;

  const zoneScroll = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    zoneScroll.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [etape, vue]);

  const choisirSejour = (t: TypeSejour) => {
    setSejour(t);
    if (!occasionsTouchees) setOccasions(occasionsDuSejour(t));
  };

  /**
   * LE CALCUL. La prévision du lieu d'abord (une requête), puis le choix des
   * pièces — le moteur tourne sur l'appareil. Une prévision indisponible est
   * une réponse, pas un échec : la règle de Planifier prend le relais et
   * l'écran le dit.
   */
  const preparer = (passer: boolean) => {
    if (!bagage) return;
    const occ = occasionsRetenues(passer ? [] : occasions, sejour);
    const nomVille = ville ? ville.name : villeDuLieu(destination.trim());
    setVue("calcul");
    fetchPrevisionByCity(ville ? ville.name : destination.trim(), ville)
      .catch(() => null)
      .then((prev) => {
        const meteos: MeteoJour[] = jours.map((j) => {
          const m = prev ? previsionPour(prev, j, "Toute la journée") : null;
          return m ? { jour: j, temp: m.temp, label: m.label, prevue: true } : { jour: j, temp: weather.temp, label: weather.label, prevue: false };
        });
        const situations = situationsDuSejour(occ, meteos);
        // Laisse le chargement se peindre avant le calcul, qui est synchrone.
        setTimeout(() => {
          const r = composerValise(dressing, situations, capaciteDe(bagage), generateurMoteur(paletteHexes(profile), profile.gender));
          const v: ValiseGardee = { version: 1, destination: nomVille, depart, retour, bagage, sejour, occasions: occ, meteos, situations, ...r };
          setValise(v);
          garderValise(userId, v);
          setOnglet("pieces");
          setVue("resultat");
        }, 30);
      });
  };

  const retirer = (id: number) => {
    if (!valise) return;
    const r = looksDeLaValise(
      valise.pieceIds.filter((x) => x !== id),
      dressing,
      valise.situations,
      generateurMoteur(paletteHexes(profile), profile.gender),
      valise.looks
    );
    const v = { ...valise, ...r };
    setValise(v);
    garderValise(userId, v);
  };

  const recommencer = () => {
    garderValise(userId, null);
    setValise(null);
    setVue("etape");
    setEtape(1);
  };

  /** Reprendre les réponses de la valise affichée, pour la modifier. */
  const modifier = () => {
    if (!valise) return;
    setDestination(valise.destination);
    setVille(null);
    setDepart(valise.depart);
    setRetour(valise.retour);
    setBagage(valise.bagage);
    setSejour(valise.sejour);
    setOccasions(valise.occasions);
    setOccasionsTouchees(true);
    setVue("etape");
    setEtape(1);
  };

  const revenir = () => {
    if (vue === "etape" && etape > 1) setEtape(etape - 1);
    else actions.goHome();
  };

  const [onglet, setOnglet] = useState<"pieces" | "looks">("pieces");
  const [tousLesLooks, setTousLesLooks] = useState(false);

  // ── Rendu ──
  return (
    <div className="absolute inset-0 flex flex-col bg-cream">
      <div className="flex-shrink-0 px-6 pt-[6px]">
        <AppHeader onBack={vue === "calcul" ? undefined : revenir} backLabel={vue === "etape" && etape > 1 ? "Revenir à l'étape précédente" : "Revenir à l'accueil"} />
      </div>
      {vue === "etape" && (
        <div className="flex-shrink-0 flex justify-center px-6 pb-[2px]">
          <FilEtapes total={4} courante={etape - 1} />
        </div>
      )}

      <div ref={zoneScroll} className={"scrollarea flex-1 min-h-0 overflow-y-auto px-6 pt-4 " + (vue === "resultat" ? "pb-safe-nav" : "pb-5")}>
        {vue === "etape" && etape === 1 && (
          <>
            <Surtitre>Ta valise · 1 / 4</Surtitre>
            <TitreEtape a="Où" b="pars-tu ?" />
            <div className="flex items-center gap-[10px] mt-4 bg-card border border-border rounded-[14px] px-[14px]" style={{ minHeight: 48 }}>
              <span className="flex-shrink-0 text-placeholder">{G_EPINGLE}</span>
              <input
                className="capin flex-1 min-w-0 bg-transparent border-none text-[13px] font-medium text-ink"
                value={destination}
                onChange={(e) => {
                  setDestination(e.target.value);
                  setVille(null);
                }}
                placeholder="Rechercher une ville"
                aria-label="Destination"
                autoComplete="off"
                autoCapitalize="words"
              />
            </div>
            {suggestionsVisibles.length > 0 && (
              <div className="flex flex-col mt-2 bg-card border border-border rounded-[14px] overflow-hidden">
                {suggestionsVisibles.map((v) => (
                  <button
                    key={`${v.lat},${v.lon}`}
                    onClick={() => {
                      setVille(v);
                      setDestination(libelleVille(v));
                    }}
                    className="text-left px-[14px] py-[11px] text-[13px] text-ink border-b border-border last:border-b-0 cursor-pointer"
                  >
                    {libelleVille(v)}
                  </button>
                ))}
              </div>
            )}
            {villesConnues.length > 0 && (
              <>
                <div className="mt-5">
                  <Surtitre>Tes lieux planifiés</Surtitre>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {villesConnues.map((v) => (
                    <Puce
                      key={v}
                      actif={destination === v}
                      onClick={() => {
                        setDestination(v);
                        setVille(null);
                      }}
                    >
                      {v}
                    </Puce>
                  ))}
                </div>
              </>
            )}
            <div className="mt-5">
              <Surtitre>Tes dates</Surtitre>
            </div>
            <div className="grid grid-cols-2 gap-[10px] mt-3">
              {([
                ["Départ", depart, aujourdhui, undefined, (v: string) => {
                  setDepart(v);
                  if (retour && retour < v) setRetour(v);
                }],
                ["Retour", retour, depart || aujourdhui, depart ? plusJours(depart, DUREE_MAX_JOURS - 1) : undefined, setRetour],
              ] as const).map(([titre, valeur, min, max, changer]) => (
                <label key={titre} className="block bg-card border border-border rounded-[20px] px-[14px] py-[11px] cursor-pointer">
                  <span className="block text-[11px] text-muted">{titre}</span>
                  <input
                    type="date"
                    value={valeur}
                    min={min}
                    max={max}
                    onChange={(e) => changer(e.target.value)}
                    aria-label={`Date de ${titre.toLowerCase()}`}
                    className="capin block w-full bg-transparent border-none font-serif text-[16px] text-ink mt-[2px] p-0"
                  />
                </label>
              ))}
            </div>
            {jours.length > 0 && (
              <div className="text-[12px] text-muted mt-3">
                {dureeOk ? libelleDuree(jours.length) : `Un séjour de ${DUREE_MAX_JOURS} jours au plus.`}
              </div>
            )}
          </>
        )}

        {vue === "etape" && etape === 2 && (
          <>
            <Surtitre>Ta valise · 2 / 4</Surtitre>
            <TitreEtape a="Quel bagage" b="prends-tu ?" />
            <div className="grid grid-cols-2 gap-[10px] mt-4">
              {BAGAGES.map(([t, libelle, cap]) => {
                const on = bagage === t;
                return (
                  <button
                    key={t}
                    onClick={() => setBagage(t)}
                    aria-pressed={on}
                    className={
                      "text-left rounded-[20px] px-[14px] py-[14px] cursor-pointer border transition-colors " +
                      (on ? "bg-warm-bg border-terracotta" : "bg-card border-border")
                    }
                    style={{ minHeight: 112 }}
                  >
                    <span className={"block font-serif text-[22px] " + (on ? "text-terracotta" : "text-ink")}>{t}</span>
                    <span className="block text-[13px] text-ink mt-[18px]">{libelle}</span>
                    <span className="block text-[11px] text-muted mt-[2px]">jusqu&apos;à {cap} pièces</span>
                  </button>
                );
              })}
            </div>
            <div className="text-[12px] text-muted leading-[1.45] mt-3">
              Chaussures, sacs et accessoires compris. La capacité ne dépend que de la taille du bagage.
            </div>
          </>
        )}

        {vue === "etape" && etape === 3 && (
          <>
            <Surtitre>Ta valise · 3 / 4</Surtitre>
            <TitreEtape a="Quel type" b="de séjour ?" />
            <div className="flex flex-wrap gap-2 mt-4">
              {SEJOURS.map(([t, libelle]) => (
                <Puce key={t} actif={sejour === t} onClick={() => choisirSejour(t)}>
                  {libelle}
                </Puce>
              ))}
            </div>
            <div className="text-[12px] text-muted leading-[1.45] mt-3">Il présélectionne les occasions de la question suivante.</div>
          </>
        )}

        {vue === "etape" && etape === 4 && (
          <>
            <Surtitre>Ta valise · 4 / 4 · Facultatif</Surtitre>
            <TitreEtape a="Qu'est-ce" b="qui est prévu ?" />
            <div className="t-chapeau text-muted-3 mt-2">Plusieurs choix possibles.</div>
            <div className="flex flex-wrap gap-2 mt-4">
              {OCCASIONS.filter(([k]) => k !== "all").map(([k, libelle]) => (
                <Puce
                  key={k}
                  actif={occasions.includes(k)}
                  onClick={() => {
                    setOccasionsTouchees(true);
                    setOccasions((l) => (l.includes(k) ? l.filter((x) => x !== k) : [...l, k]));
                  }}
                >
                  {libelle}
                </Puce>
              ))}
            </div>
          </>
        )}

        {vue === "calcul" && (
          <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: "60vh" }}>
            <LoadingSpinner size={64} />
            <div className="t-titre-carte text-ink mt-6">
              Je prépare <span className="italic text-terracotta">ta valise</span>
            </div>
            <div className="text-[13px] text-muted leading-[1.5] mt-2 max-w-[260px]">
              Je cherche dans ton dressing les pièces qui se combinent le mieux pour {ville ? ville.name : villeDuLieu(destination.trim())}.
            </div>
          </div>
        )}

        {vue === "resultat" && valise && (
          <Resultat
            valise={valise}
            dressing={dressing}
            onglet={onglet}
            setOnglet={setOnglet}
            tousLesLooks={tousLesLooks}
            setTousLesLooks={setTousLesLooks}
            retirer={retirer}
            ajouterPiece={actions.openAdd}
            modifier={modifier}
            recommencer={recommencer}
          />
        )}
      </div>

      {vue === "etape" && (
        <div className="flex-shrink-0 px-6 pt-[10px] pb-[18px] flex flex-col gap-2 border-t border-border">
          <button
            onClick={() => (etape < 4 ? etapeValide && setEtape(etape + 1) : preparer(false))}
            disabled={!etapeValide}
            className="w-full rounded-full text-cream t-bouton cursor-pointer disabled:cursor-not-allowed"
            style={{ minHeight: 52, background: etapeValide ? "var(--color-terracotta-deep)" : "var(--color-cream-dark-soft)" }}
          >
            {etape < 4 ? "Continuer" : "Préparer ma valise"}
          </button>
          {etape === 4 && (
            <button onClick={() => preparer(true)} className="text-[12px] text-muted cursor-pointer py-[6px]">
              Passer cette étape
            </button>
          )}
        </div>
      )}

      {/* Le résultat est une page à part entière : la barre du bas y revient
          (comme le hub de Planifier), les étapes la laissent au bouton. */}
      {vue === "resultat" && <TabBar />}
    </div>
  );
}

// ── Résultat ─────────────────────────────────────────────────────────────

function Resultat({
  valise,
  dressing,
  onglet,
  setOnglet,
  tousLesLooks,
  setTousLesLooks,
  retirer,
  ajouterPiece,
  modifier,
  recommencer,
}: {
  valise: ValiseGardee;
  dressing: Item[];
  onglet: "pieces" | "looks";
  setOnglet: (o: "pieces" | "looks") => void;
  tousLesLooks: boolean;
  setTousLesLooks: (v: boolean) => void;
  retirer: (id: number) => void;
  ajouterPiece: () => void;
  modifier: () => void;
  recommencer: () => void;
}) {
  const capacite = capaciteDe(valise.bagage);
  // Une pièce supprimée du dressing depuis n'est plus dans la valise.
  const pieces = valise.pieceIds.map((id) => dressing.find((i) => i.id === id)).filter((i): i is Item => !!i);
  const looks = valise.looks.filter((l) => l.ids.every((id) => pieces.some((p) => p.id === id)));
  const parPiece = looksParPiece(looks);
  const polyvalentes = nbPolyvalentes(looks);
  const etat = etatJauge(pieces.length, capacite);
  const amplitude = amplitudePrevue(valise.meteos);
  const nbJours = valise.meteos.length;
  const pieceDe = (id: number) => pieces.find((p) => p.id === id);
  const occasionsSansLook = [...new Set(valise.situationsSansLook.map((i) => valise.situations[i]?.occasion).filter(Boolean))] as OccasionKey[];

  const meteoTexte = amplitude
    ? `${amplitude.min === amplitude.max ? `${amplitude.min}°` : `${amplitude.min}° – ${amplitude.max}°`} prévus ${amplitude.jours === nbJours ? "sur place" : `sur ${amplitude.jours} ${amplitude.jours > 1 ? "jours" : "jour"}`}`
    : null;

  // Dressing vide : rien à emporter — on le dit, avec l'action qui débloque.
  if (!dressing.length) {
    return (
      <>
        <Surtitre>
          {valise.destination} · {libellePeriode(valise.depart, valise.retour)}
        </Surtitre>
        <TitreEtape a="Ta" b="valise" />
        <div className="mt-4 bg-card border border-border rounded-[20px] p-[16px]">
          <div className="t-titre-carte text-ink">Ton dressing est vide</div>
          <div className="text-[13px] text-muted-3 leading-[1.5] mt-2">
            La valise se prépare avec les pièces que tu possèdes. Ajoute-les à ton dressing, et Capsela choisira celles à emporter.
          </div>
          <button onClick={ajouterPiece} className="mt-3 text-[12px] text-terracotta cursor-pointer">
            Ajouter une pièce →
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <Surtitre>
        {valise.destination} · {libellePeriode(valise.depart, valise.retour)}
      </Surtitre>
      <TitreEtape a="Ta" b="valise" />
      <div className="t-chapeau text-muted-3 mt-2">
        {[meteoTexte, valise.sejour ? libelleSejour(valise.sejour) : null, `Valise ${valise.bagage}`].filter(Boolean).join(" · ")}
      </div>
      {amplitude?.jours !== nbJours && (
        <div className="text-[11px] text-placeholder leading-[1.45] mt-[6px]">
          {amplitude
            ? "Les autres jours, au-delà de la prévision, suivent la saison de leur date et la température d'aujourd'hui."
            : "Pas encore de prévision pour ces dates : looks composés sur la saison du séjour et la température d'aujourd'hui."}
        </div>
      )}

      {/* LA CARTE HÉROS — tout y est compté : pièces choisies, looks produits
          par le moteur avec elles, pièces présentes dans 3 looks ou plus. */}
      <div className="mt-4 rounded-[24px] px-[18px] py-[18px] text-cream" style={{ background: "var(--color-terracotta-deep)" }}>
        <div className="t-label" style={{ color: "rgba(251,243,234,.78)" }}>
          Ta valise
        </div>
        <div className="font-serif text-[24px] leading-[1.2] mt-[8px]">
          {pieces.length} {pieces.length > 1 ? "pièces" : "pièce"} <span aria-hidden="true">→</span>{" "}
          <span className="italic">
            {looks.length} {looks.length > 1 ? "looks" : "look"}
          </span>
        </div>
        {polyvalentes > 0 && (
          <div className="text-[12px] leading-[1.45] mt-[6px]" style={{ color: "rgba(251,243,234,.82)" }}>
            {polyvalentes} {polyvalentes > 1 ? "pièces reviennent" : "pièce revient"} dans {SEUIL_POLYVALENTE} looks ou plus.
          </div>
        )}
        <div className="mt-[14px]">
          <Jauge nb={Math.min(pieces.length, capacite)} capacite={capacite} />
        </div>
        <div className="flex justify-between text-[11px] mt-[7px]" style={{ color: "rgba(251,243,234,.82)" }}>
          <span>
            {pieces.length} / {capacite} pièces
          </span>
          <span>{LIBELLE_JAUGE[etat]}</span>
        </div>
      </div>

      <div className="mt-3">
        <span className="inline-flex items-center gap-[6px] rounded-full bg-card border border-border px-[10px] py-[5px] text-[11px] text-ink">
          <span className="w-[6px] h-[6px] rounded-full bg-terracotta" aria-hidden="true" />
          Uniquement ton dressing
        </span>
      </div>

      {occasionsSansLook.length > 0 && (
        <div className="mt-3 flex items-start gap-[10px] bg-card border border-border rounded-[20px] px-[14px] py-[12px]">
          <span className="font-serif italic text-[15px] text-terracotta flex-shrink-0" aria-hidden="true">
            ✦
          </span>
          <div className="text-[12px] text-[#3F3B34] leading-[1.45]">
            Pas encore de look {occasionsSansLook.map((o) => occasionShortLabel(o)).join(", ")} dans cette valise : ton dressing ou la taille du bagage ne le
            permettent pas.
          </div>
        </div>
      )}

      <div className="mt-4">
        <SegmentedControl
          ariaLabel="Contenu de la valise"
          segments={[
            { key: "pieces", label: `Pièces · ${pieces.length}` },
            { key: "looks", label: `Looks · ${looks.length}` },
          ]}
          actif={onglet}
          onChange={setOnglet}
        />
      </div>

      {onglet === "pieces" && (
        <div className="mt-2">
          {GROUPES_VALISE.map(([titre, cats]) => {
            const duGroupe = pieces.filter((p) => cats.includes(p.cat));
            if (!duGroupe.length) return null;
            return (
              <section key={titre} className="mt-4">
                <div className="flex items-baseline justify-between">
                  <h3 className="font-serif text-[16px] text-ink">{titre}</h3>
                  <span className="text-[12px] text-muted">{duGroupe.length}</span>
                </div>
                <div className="flex flex-col gap-2 mt-2">
                  {duGroupe.map((p) => {
                    const img = resolveItemImage(p);
                    const n = parPiece.get(p.id) ?? 0;
                    return (
                      <div key={p.id} className="flex items-center gap-3 bg-card border border-border rounded-[16px] p-[7px] pr-[4px]">
                        <span
                          className="w-[46px] h-[46px] flex-shrink-0 rounded-[11px] overflow-hidden"
                          style={img.url ? { background: "#F3EDE1", padding: img.kind === "photo" ? 0 : 3 } : { background: p.hex }}
                        >
                          {img.url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={img.url} alt="" loading="lazy" className={"w-full h-full " + (img.kind === "photo" ? "object-cover" : "object-contain")} />
                          )}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[13px] text-ink truncate">{p.name}</span>
                          <span className={"block text-[11px] mt-[2px] " + (n ? "text-terracotta" : "text-muted")}>
                            {n ? `Dans ${n} ${n > 1 ? "looks" : "look"}` : "Dans aucun look de la valise"}
                          </span>
                        </span>
                        <button
                          onClick={() => retirer(p.id)}
                          aria-label={`Retirer ${p.name} de la valise`}
                          className="w-[44px] h-[44px] flex items-center justify-center flex-shrink-0 text-muted cursor-pointer"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {onglet === "looks" && (
        <div className="mt-4">
          {looks.length === 0 ? (
            <div className="text-[13px] text-muted leading-[1.5]">Aucun look complet avec les pièces de cette valise.</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-[10px]">
                {(tousLesLooks ? looks : looks.slice(0, 6)).map((l) => {
                  const itemsLook = l.ids.map(pieceDe).filter((i): i is Item => !!i);
                  const occ = valise.situations[l.situations[0]]?.occasion;
                  return (
                    <div key={l.ids.join(",")} className="bg-card border border-border rounded-[18px] p-[8px] min-w-0">
                      <div className="rounded-[12px] bg-warm-bg px-[8px] py-[10px]" style={{ height: 176 }}>
                        <OutfitComposition items={itemsLook} variant="hero" ajustee />
                      </div>
                      <div className="px-[4px] pt-[8px] pb-[2px]">
                        <div className="text-[12px] text-ink truncate">{occ ? occasionShortLabel(occ) : ""}</div>
                        <div className="text-[11px] text-muted truncate">
                          {l.elargie ? "Occasion élargie" : `${itemsLook.length} pièces`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {!tousLesLooks && looks.length > 6 && (
                <button
                  onClick={() => setTousLesLooks(true)}
                  className="w-full mt-3 rounded-full border border-border bg-card text-[12px] text-ink cursor-pointer"
                  style={{ minHeight: 44 }}
                >
                  Voir les {looks.length - 6} autres looks
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Modifier reprend les réponses ; Nouvelle valise repart de zéro. */}
      <div className="flex gap-2 mt-6">
        <button onClick={modifier} className="flex-1 rounded-full border border-border bg-card text-ink t-bouton cursor-pointer" style={{ minHeight: 44 }}>
          Modifier
        </button>
        <button onClick={recommencer} className="flex-1 rounded-full border border-border bg-card text-ink t-bouton cursor-pointer" style={{ minHeight: 44 }}>
          Nouvelle valise
        </button>
      </div>

      {/* Période, pour mémoire : jours et nuits. */}
      <div className="text-[11px] text-placeholder mt-4">
        {DOW[dateDe(valise.depart).getDay()]} {dateDe(valise.depart).getDate()} {MOIS[dateDe(valise.depart).getMonth()]} →{" "}
        {DOW[dateDe(valise.retour).getDay()]} {dateDe(valise.retour).getDate()} {MOIS[dateDe(valise.retour).getMonth()]} · {libelleDuree(nbJours)}
      </div>
    </>
  );
}
