"use client";

import { useEffect, useRef, useState } from "react";
import TenuesScreen, { type DispositionTenue } from "@/components/screens/TenuesScreen";
import { dispositionTenueMaquette } from "@/components/maquettes/AccueilMaquettes";

/**
 * L'ÉCRAN D'ESSAI DE LA PAGE « MA TENUE DU JOUR » (18/11/2026, brief « Exploration UX de la page Ma tenue du jour »). Hors production :
 * monté par App.tsx seulement avec `?maquettes`, en démo ou en développement (maquettesAccueilActives).
 *
 * Un sélecteur en haut passe de la page actuelle aux variantes A, B, C SANS RECHARGER : la tenue du store ne change pas, les quatre
 * versions montrent donc la même tenue, les mêmes données et les mêmes actions. « Mesures » affiche les mesures de la version à
 * l'écran (mesurerTenueMaquette), les mêmes que celles du script de capture. `?nu` masque le sélecteur.
 */

type Version = "actuelle" | DispositionTenue;

const HAUTEUR_SELECTEUR = 46;

export type MesuresTenue = {
  largeurEcran: number;
  hauteurVisible: number;
  hauteurPage: number;
  carte: number | null;
  planche: { largeur: number; hauteur: number; partLargeur: number } | null;
  occasion: { haut: number; forme: string } | null;
  cta: { haut: number; hauteur: number; entierAuPremierEcran: boolean } | null;
  secondaires: { nombre: number; auPremierEcran: number; cibleMin: number } | null;
  reco: { haut: number; hauteur: number; auPremierEcran: boolean } | null;
  piecesPlancheAuPremierEcran: number;
  piecesPlanche: number;
  detailsHaut: number | null;
  piecesDetailsAuPremierEcran: number;
  defilementVersDetails: number | null;
  ecransVersDetails: number | null;
  blocsAuPremierEcran: string[];
};

/**
 * Les mesures de la version à l'écran, défilement en haut. Positions en px depuis le haut de la zone qui défile ; le premier écran
 * s'arrête au haut de la barre de navigation. Une pièce compte comme visible quand elle est entière dans le premier écran.
 */
export function mesurerTenueMaquette(): MesuresTenue | null {
  const zone = document.querySelector<HTMLElement>("[data-ecran-tenue] > .scrollarea");
  if (!zone) return null;
  const rz = zone.getBoundingClientRect();
  const nav = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--bottom-nav-height")) || 0;
  const visible = Math.round(window.innerHeight - nav - rz.top);
  const pos = (el: Element) => {
    const r = el.getBoundingClientRect();
    return { haut: Math.round(r.top - rz.top + zone.scrollTop), bas: Math.round(r.bottom - rz.top + zone.scrollTop), largeur: Math.round(r.width), hauteur: Math.round(r.height), gauche: r.left, droite: r.right };
  };
  const q = (sel: string) => zone.querySelector(sel);
  const entier = (p: { haut: number; bas: number; gauche: number; droite: number }) => p.haut >= 0 && p.bas <= visible && p.gauche >= -1 && p.droite <= window.innerWidth + 1;

  const carte = q('[data-maquette="carte"]');
  const planche = q('[data-maquette="planche"]');
  const onglet = q('[role="tablist"][aria-label="Occasion"] [aria-selected="true"]');
  // La page actuelle n'a que les repères de la carte et de la planche (attributs posés sans rien changer à son DOM) : ses autres blocs
  // se retrouvent par leur texte, le même qu'à l'écran.
  const parTexte = (selecteur: string, motif: RegExp, racine: Element = zone) => Array.from(racine.querySelectorAll(selecteur)).filter((e) => motif.test(e.textContent ?? ""));
  const cta = q('[data-maquette="cta"]') ?? (carte ? parTexte("button, [role=status]", /^(Porter cette tenue|Bonne journée)/, carte)[0] ?? null : null);
  const secondaires = q('[data-maquette="secondaires"]') ?? (carte ? (parTexte("button", /^.?\s*(Enregistr)/, carte)[0]?.parentElement ?? null) : null);
  const reco = q('[data-maquette="reco"]') ?? parTexte("button", /^Pour l.extérieur/)[0] ?? null;
  const details = q('[data-maquette="details"]') ?? parTexte("div", /^Les pièces de ton look/).at(-1)?.nextElementSibling ?? null;

  const boutonsSecondaires = secondaires ? Array.from(secondaires.querySelectorAll("button")).filter((b) => !b.closest('[data-maquette="cta"]') && !b.hasAttribute("data-maquette")) : [];
  const imgsPlanche = planche ? Array.from(planche.querySelectorAll("img")) : [];
  const piecesDetails = details ? Array.from(details.querySelectorAll("li")) : [];
  const detailsHaut = details ? pos(details).haut : null;
  const seuilDetails = detailsHaut == null ? null : detailsHaut + 80;

  const blocs: [string, Element | null][] = [
    ["jour et météo", q('[data-tour="jour-meteo"]')],
    ["occasions", onglet],
    ["carte", carte],
    ["planche", planche],
    ["CTA", cta],
    ["actions secondaires", boutonsSecondaires[0] ?? null],
    ["recommandation", reco],
    ["détails des pièces", details],
  ];

  return {
    largeurEcran: window.innerWidth,
    hauteurVisible: visible,
    hauteurPage: zone.scrollHeight,
    carte: carte ? pos(carte).hauteur : null,
    planche: planche ? { largeur: pos(planche).largeur, hauteur: pos(planche).hauteur, partLargeur: Math.round((pos(planche).largeur / window.innerWidth) * 100) } : null,
    occasion: onglet ? { haut: pos(onglet).haut, forme: onglet.closest(".rounded-full.flex") ? "segmented control" : onglet.className.includes("rounded-full") ? "pastilles" : "onglets" } : null,
    cta: cta ? { haut: pos(cta).haut, hauteur: pos(cta).hauteur, entierAuPremierEcran: pos(cta).bas <= visible } : null,
    secondaires: secondaires
      ? { nombre: boutonsSecondaires.length, auPremierEcran: boutonsSecondaires.filter((b) => pos(b).bas <= visible).length, cibleMin: Math.min(...boutonsSecondaires.map((b) => pos(b).hauteur)) }
      : null,
    reco: reco ? { haut: pos(reco).haut, hauteur: pos(reco).hauteur, auPremierEcran: pos(reco).bas <= visible } : null,
    piecesPlanche: imgsPlanche.length,
    piecesPlancheAuPremierEcran: imgsPlanche.filter((i) => entier(pos(i))).length,
    detailsHaut,
    piecesDetailsAuPremierEcran: piecesDetails.filter((li) => entier(pos(li))).length,
    defilementVersDetails: seuilDetails == null ? null : Math.max(0, seuilDetails - visible),
    ecransVersDetails: seuilDetails == null ? null : Math.max(0, Math.ceil((seuilDetails - visible) / visible)),
    blocsAuPremierEcran: blocs.filter(([, el]) => el && pos(el).haut < visible).map(([nom]) => nom),
  };
}

function Pastille({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className="min-h-[32px] px-3 rounded-full text-[12px] whitespace-nowrap cursor-pointer" style={on ? { background: "var(--color-ink)", color: "var(--color-cream)" } : { border: "1px solid var(--color-border)", color: "var(--color-ink)" }}>
      {children}
    </button>
  );
}

export default function TenueMaquettes() {
  const [version, setVersion] = useState<Version>(() => dispositionTenueMaquette() ?? "actuelle");
  const [mesures, setMesures] = useState<MesuresTenue | null>(null);
  const [panneau, setPanneau] = useState(false);
  const cadre = useRef<HTMLDivElement>(null);
  const nu = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("nu");


  const choisir = (v: Version) => {
    setVersion(v);
    setPanneau(false);
    const zone = cadre.current?.querySelector<HTMLElement>(":scope > .scrollarea");
    if (zone) zone.scrollTop = 0;
  };
  // Pour le script de capture (avec `?nu`, sans sélecteur à l'écran) : mesurer, et changer de version sans recharger.
  useEffect(() => {
    const w = window as unknown as { __mesurerTenue?: typeof mesurerTenueMaquette; __choisirTenue?: (v: Version) => void };
    w.__mesurerTenue = mesurerTenueMaquette;
    w.__choisirTenue = choisir;
  });
  const ouvrirMesures = () => {
    const zone = cadre.current?.querySelector<HTMLElement>(":scope > .scrollarea");
    if (zone) zone.scrollTop = 0;
    setMesures(mesurerTenueMaquette());
    setPanneau((o) => !o);
  };

  const ligne = (nom: string, valeur: React.ReactNode) => (
    <div className="flex justify-between gap-3 py-[3px] border-b border-border text-[12px]">
      <span className="text-muted">{nom}</span>
      <span className="text-ink text-right">{valeur}</span>
    </div>
  );

  return (
    <div className="absolute inset-0">
      {!nu && (
        <div className="absolute top-0 inset-x-0 z-40 bg-cream/95 border-b border-border px-3 flex items-center gap-[6px] overflow-x-auto" style={{ height: HAUTEUR_SELECTEUR }}>
          {(["actuelle", "A", "B", "C"] as const).map((v) => (
            <Pastille key={v} on={version === v} onClick={() => choisir(v)}>
              {v === "actuelle" ? "Actuelle" : v === "A" ? "A · Éditoriale" : v === "B" ? "B · Composition" : "C · Compacte"}
            </Pastille>
          ))}
          <Pastille on={panneau} onClick={ouvrirMesures}>
            Mesures
          </Pastille>
        </div>
      )}
      {panneau && mesures && (
        <div className="absolute inset-x-3 z-40 rounded-bloc bg-card border border-border shadow-lg p-3" style={{ top: HAUTEUR_SELECTEUR + 6 }}>
          {ligne("Page", `${mesures.hauteurPage} px`)}
          {ligne("Carte principale", mesures.carte != null ? `${mesures.carte} px` : "—")}
          {ligne("Composition", mesures.planche ? `${mesures.planche.largeur} × ${mesures.planche.hauteur} px (${mesures.planche.partLargeur} % de la largeur)` : "—")}
          {ligne("Occasion active, haut", mesures.occasion ? `${mesures.occasion.haut} px · ${mesures.occasion.forme}` : "—")}
          {ligne("CTA principal, haut", mesures.cta ? `${mesures.cta.haut} px${mesures.cta.entierAuPremierEcran ? " · au premier écran" : " · sous le pli"}` : "—")}
          {ligne("Actions secondaires", mesures.secondaires ? `${mesures.secondaires.auPremierEcran}/${mesures.secondaires.nombre} au premier écran · cible ${mesures.secondaires.cibleMin} px` : "—")}
          {ligne("Recommandation", mesures.reco ? `${mesures.reco.hauteur} px${mesures.reco.auPremierEcran ? " · au premier écran" : ""}` : "aucune aujourd'hui")}
          {ligne("Pièces de la planche au premier écran", `${mesures.piecesPlancheAuPremierEcran}/${mesures.piecesPlanche}`)}
          {ligne("Pièces du détail au premier écran", mesures.piecesDetailsAuPremierEcran)}
          {ligne("Défilement jusqu'aux détails", mesures.defilementVersDetails != null ? `${mesures.defilementVersDetails} px · ${mesures.ecransVersDetails} écran(s)` : "—")}
          {ligne("Au premier écran", mesures.blocsAuPremierEcran.join(", "))}
        </div>
      )}
      <div ref={cadre} data-ecran-tenue className="absolute inset-x-0 bottom-0" style={{ top: nu ? 0 : HAUTEUR_SELECTEUR }}>
        <TenuesScreen disposition={version === "actuelle" ? undefined : version} />
      </div>
    </div>
  );
}
