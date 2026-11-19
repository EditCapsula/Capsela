"use client";

import { useEffect, useRef, useState } from "react";
import TenuesScreen, { type DispositionTenue } from "@/components/screens/TenuesScreen";
import type { TraitementComposition } from "@/components/maquettes/VariantesTenue";
import { dispositionTenueMaquette } from "@/components/maquettes/AccueilMaquettes";

/**
 * L'ÉCRAN D'ESSAI DE LA PAGE « MA TENUE DU JOUR » (18/11/2026 ; cinq architectures le 19/11/2026, brief « Exploration avancée UX »).
 * Hors production : monté par App.tsx seulement avec `?maquettes`, en démo ou en développement (maquettesAccueilActives).
 *
 * Le sélecteur passe de la page actuelle aux architectures A à E, et d'un traitement de la composition à l'autre, SANS RECHARGER : la
 * tenue du store ne change pas, toutes les versions montrent la même tenue, les mêmes images, les mêmes actions. « Mesures » affiche les
 * hauteurs zone par zone et ce que montre le premier écran (mesurerTenueMaquette), les mêmes que le script de capture. `?nu` masque le
 * sélecteur.
 */

type Version = "actuelle" | DispositionTenue;

const HAUTEUR_SELECTEUR = 84;

type EtatAction = "premier écran" | "sous le pli" | "dans un menu" | "absente";

export type MesuresTenue = {
  largeurEcran: number;
  hauteurVisible: number;
  hauteurPage: number;
  zones: Record<"entete" | "meteo" | "occasions" | "carte" | "actions" | "reco" | "pieces", { haut: number; hauteur: number } | null>;
  composition: { largeur: number; hauteur: number } | null;
  actions: Record<"porter" | "enregistrer" | "avis" | "autre", { etat: EtatAction; haut: number | null }>;
  piecesCompositionAuPremierEcran: number;
  piecesComposition: number;
  piecesDetailAuPremierEcran: number;
  defilementVersPieces: number | null;
  partPremierEcran: number;
  blocsAuPremierEcran: string[];
};

/**
 * Les mesures de la version à l'écran, défilement en haut. Positions en px depuis le haut de la zone qui défile ; le premier écran s'arrête
 * au haut de la barre de navigation. La page actuelle n'a que les repères de la carte et de la planche : ses autres zones se retrouvent par
 * leur texte, le même qu'à l'écran. Une action « dans un menu » est à un appui, sans être visible.
 */
export function mesurerTenueMaquette(): MesuresTenue | null {
  const zone = document.querySelector<HTMLElement>("[data-ecran-tenue] > .scrollarea");
  if (!zone) return null;
  const rz = zone.getBoundingClientRect();
  const nav = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--bottom-nav-height")) || 0;
  const visible = Math.round(window.innerHeight - nav - rz.top);
  const haut = (r: DOMRect) => Math.round(r.top - rz.top + zone.scrollTop);
  const bas = (r: DOMRect) => Math.round(r.bottom - rz.top + zone.scrollTop);
  const boite = (el: Element | null | undefined) => (el ? { haut: haut(el.getBoundingClientRect()), hauteur: Math.round(el.getBoundingClientRect().height) } : null);
  const entre = (a: Element | null | undefined, z: Element | null | undefined) => {
    if (!a || !z) return null;
    const h = haut(a.getBoundingClientRect());
    return { haut: h, hauteur: bas(z.getBoundingClientRect()) - h };
  };
  const q = (sel: string) => zone.querySelector(sel);
  const boutons = Array.from(zone.querySelectorAll<HTMLElement>("button, [role=status]"));
  const libelle = (b: HTMLElement) => (b.getAttribute("aria-label") || b.textContent || "").trim();
  const trouve = (motif: RegExp) => boutons.find((b) => motif.test(libelle(b)) && b.getBoundingClientRect().height > 0);

  const onglet = q('[role="tablist"][aria-label="Occasion"]');
  const ligneOnglets = onglet?.closest(".relative") ?? null;
  const phrase = ligneOnglets?.nextElementSibling ?? null;
  const meteo = q('[data-maquette="meteo"]') ?? q('[data-tour="jour-meteo"]')?.parentElement ?? null;
  const porter = trouve(/^(.?\s*)?(Porter cette tenue|Bonne journée avec cette tenue|✓\s*Bonne)/);
  const enregistrer = trouve(/^(.?\s*)?Enregistr/);
  const avis = trouve(/Avis d'un proche/);
  const autre = trouve(/Autre tenue$/) ?? trouve(/Autre tenue/);
  const menu = q('[aria-haspopup="menu"]');
  const titrePieces = Array.from(zone.querySelectorAll("div")).filter((d) => /^Les pièces de ton look/.test(d.textContent ?? "")).at(-1);
  const piecesZone = q('[data-maquette="details"]') ?? (titrePieces ? titrePieces : null);
  const piecesFin = q('[data-maquette="details"]') ? piecesZone : titrePieces?.nextElementSibling;
  const actionsZone = q('[data-maquette="actions"]');
  const carte = q('[data-maquette="carte"]');
  const planche = q('[data-maquette="planche"]');
  const reco = q('[data-maquette="reco"]') ?? trouve(/^Pour l.extérieur/) ?? null;

  const etat = (b: HTMLElement | undefined, dansMenu = false): { etat: EtatAction; haut: number | null } => {
    if (!b) return { etat: dansMenu ? "dans un menu" : "absente", haut: null };
    const r = b.getBoundingClientRect();
    return { etat: bas(r) <= visible ? "premier écran" : "sous le pli", haut: haut(r) };
  };
  const imgsPlanche = planche ? Array.from(planche.querySelectorAll("img")) : [];
  const entiere = (el: Element) => {
    const r = el.getBoundingClientRect();
    return haut(r) >= 0 && bas(r) <= visible && r.left >= -1 && r.right <= window.innerWidth + 1;
  };
  const piecesDetail = piecesZone ? Array.from((piecesFin ?? piecesZone).querySelectorAll("li")) : [];
  const zones = {
    entete: boite(q('[data-maquette="entete"]') ?? zone.firstElementChild),
    meteo: boite(meteo),
    occasions: entre(ligneOnglets, phrase),
    carte: boite(carte),
    actions: actionsZone ? boite(actionsZone) : entre(porter, enregistrer?.parentElement),
    reco: boite(reco),
    pieces: piecesZone ? entre(piecesZone, piecesFin ?? piecesZone) : null,
  };
  const noms: Record<keyof typeof zones, string> = { entete: "en-tête", meteo: "météo", occasions: "occasions", carte: "carte", actions: "actions", reco: "recommandation", pieces: "pièces" };
  return {
    largeurEcran: window.innerWidth,
    hauteurVisible: visible,
    hauteurPage: zone.scrollHeight,
    zones,
    composition: planche ? { largeur: Math.round(planche.getBoundingClientRect().width), hauteur: Math.round(planche.getBoundingClientRect().height) } : null,
    actions: { porter: etat(porter), enregistrer: etat(enregistrer), avis: etat(avis, Boolean(menu)), autre: etat(autre) },
    piecesComposition: imgsPlanche.length,
    piecesCompositionAuPremierEcran: imgsPlanche.filter(entiere).length,
    piecesDetailAuPremierEcran: piecesDetail.filter(entiere).length,
    defilementVersPieces: zones.pieces ? Math.max(0, zones.pieces.haut + 80 - visible) : null,
    partPremierEcran: Math.round((visible / zone.scrollHeight) * 100),
    blocsAuPremierEcran: (Object.keys(zones) as (keyof typeof zones)[]).filter((k) => zones[k] && zones[k]!.haut < visible).map((k) => noms[k]),
  };
}

function Pastille({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className="flex-shrink-0 min-h-[30px] px-3 rounded-full text-[12px] whitespace-nowrap cursor-pointer" style={on ? { background: "var(--color-ink)", color: "var(--color-cream)" } : { border: "1px solid var(--color-border)", color: "var(--color-ink)" }}>
      {children}
    </button>
  );
}

const NOMS: Record<Version, string> = { actuelle: "Actuelle", A: "A · Immersive", B: "B · Composition", C: "C · Structurée", D: "D · Onglets", E: "E · Compacte" };
const TRAITEMENTS: [TraitementComposition, string][] = [
  ["flatlay", "Flat lay ivoire"],
  ["flatlay-colore", "Flat lay coloré"],
  ["asymetrique", "Asymétrique"],
];

export default function TenueMaquettes() {
  const [version, setVersion] = useState<Version>(() => dispositionTenueMaquette() ?? "actuelle");
  const [traitement, setTraitement] = useState<TraitementComposition>("flatlay");
  const [mesures, setMesures] = useState<MesuresTenue | null>(null);
  const [panneau, setPanneau] = useState(false);
  const cadre = useRef<HTMLDivElement>(null);
  const nu = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("nu");

  const enHaut = () => {
    const zone = cadre.current?.querySelector<HTMLElement>(":scope > .scrollarea");
    if (zone) zone.scrollTop = 0;
  };
  const choisir = (v: Version) => {
    setVersion(v);
    setPanneau(false);
    enHaut();
  };
  // Pour le script de capture (avec `?nu`, sans sélecteur à l'écran) : mesurer, changer de version et de traitement sans recharger.
  useEffect(() => {
    const w = window as unknown as { __mesurerTenue?: typeof mesurerTenueMaquette; __choisirTenue?: (v: Version) => void; __traitementTenue?: (t: TraitementComposition) => void };
    w.__mesurerTenue = mesurerTenueMaquette;
    w.__choisirTenue = choisir;
    w.__traitementTenue = (t) => setTraitement(t);
  });
  const ouvrirMesures = () => {
    enHaut();
    setMesures(mesurerTenueMaquette());
    setPanneau((o) => !o);
  };
  const ligne = (nom: string, valeur: React.ReactNode) => (
    <div className="flex justify-between gap-3 py-[3px] border-b border-border text-[12px]">
      <span className="text-muted">{nom}</span>
      <span className="text-ink text-right">{valeur}</span>
    </div>
  );
  const h = (z: { hauteur: number } | null) => (z ? `${z.hauteur} px` : "—");

  return (
    <div className="absolute inset-0">
      {!nu && (
        <div className="absolute top-0 inset-x-0 z-40 bg-cream/95 border-b border-border px-3 py-[6px] flex flex-col gap-[6px]" style={{ height: HAUTEUR_SELECTEUR }}>
          <div className="flex items-center gap-[6px] overflow-x-auto">
            {(["actuelle", "A", "B", "C", "D", "E"] as const).map((v) => (
              <Pastille key={v} on={version === v} onClick={() => choisir(v)}>
                {NOMS[v]}
              </Pastille>
            ))}
          </div>
          <div className="flex items-center gap-[6px] overflow-x-auto">
            {TRAITEMENTS.map(([cle, nom]) => (
              <Pastille key={cle} on={traitement === cle} onClick={() => setTraitement(cle)}>
                {nom}
              </Pastille>
            ))}
            <Pastille on={panneau} onClick={ouvrirMesures}>
              Mesures
            </Pastille>
          </div>
        </div>
      )}
      {panneau && mesures && (
        <div className="absolute inset-x-3 z-40 rounded-bloc bg-card border border-border shadow-lg p-3" style={{ top: HAUTEUR_SELECTEUR + 6 }}>
          {ligne("Page", `${mesures.hauteurPage} px · ${mesures.partPremierEcran} % au premier écran`)}
          {ligne("En-tête · météo · occasions", `${h(mesures.zones.entete)} · ${h(mesures.zones.meteo)} · ${h(mesures.zones.occasions)}`)}
          {ligne("Carte principale", h(mesures.zones.carte))}
          {ligne("Composition", mesures.composition ? `${mesures.composition.largeur} × ${mesures.composition.hauteur} px` : "—")}
          {ligne("Zone d'actions", h(mesures.zones.actions))}
          {ligne("Recommandation", h(mesures.zones.reco))}
          {ligne("Section pièces", h(mesures.zones.pieces))}
          {ligne("Porter · Enregistrer", `${mesures.actions.porter.etat} · ${mesures.actions.enregistrer.etat}`)}
          {ligne("Avis · Autre tenue", `${mesures.actions.avis.etat} · ${mesures.actions.autre.etat}`)}
          {ligne("Pièces visibles (composition · détail)", `${mesures.piecesCompositionAuPremierEcran}/${mesures.piecesComposition} · ${mesures.piecesDetailAuPremierEcran}`)}
          {ligne("Défilement jusqu'aux pièces", mesures.defilementVersPieces != null ? `${mesures.defilementVersPieces} px` : "—")}
        </div>
      )}
      <div ref={cadre} data-ecran-tenue className="absolute inset-x-0 bottom-0" style={{ top: nu ? 0 : HAUTEUR_SELECTEUR }}>
        <TenuesScreen disposition={version === "actuelle" ? undefined : version} traitement={traitement} />
      </div>
    </div>
  );
}
