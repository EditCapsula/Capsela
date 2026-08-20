"use client";

import type { CSSProperties } from "react";
import AppHeader from "@/components/AppHeader";
import { OCC_LABELS } from "@/lib/data";
import { resolveItemImage } from "@/lib/catalogImages";
import { explainRecommendation } from "@/lib/logic";
import { useAuth } from "@/lib/auth";
import { useCapsela, defaultOccasionToday } from "@/lib/store";
import type { CategoryKey, Item } from "@/lib/types";

const GRADIENT_TO = ["#EFE3D3", "#E8DCC9", "#E1D3BC"];

/**
 * Mini flat-lay de la card héros Accueil (recette 20/08/2026, alignement
 * proto) — miroir exact de la logique du prototype (homeCompositionPieces) :
 * les 3 pièces les plus représentatives (robe/combinaison d'abord, puis
 * haut/pull, puis bas, chaussures, sac), en cascade diagonale simple —
 * distinct du cadre héros complet (rôle par pièce) de la page Tenue, pensé
 * pour le petit espace de cette card.
 */
const HOME_COMPOSITION_PRIORITY: CategoryKey[] = [
  "robe",
  "combinaison",
  "haut",
  "pull",
  "pantalon",
  "jean",
  "jupe",
  "short",
  "chaussures",
  "sac",
];

function homeCompositionPiecesOf(items: Item[]): { id: number; style: CSSProperties }[] {
  // Jusqu'à 5 pièces selon la tenue disponible (recette 20/08/2026, brief
  // UX/UI) — réparties à largeur égale plutôt qu'à décalage fixe (qui ne
  // fonctionnait que pour exactement 3 pièces et débordait au-delà).
  const main = [...items]
    .sort((a, b) => HOME_COMPOSITION_PRIORITY.indexOf(a.cat) - HOME_COMPOSITION_PRIORITY.indexOf(b.cat))
    .slice(0, 5);
  const n = main.length;
  const slot = 100 / n;
  return main.map((it, i) => {
    const w = slot - 4;
    const left = i * slot + 2;
    const top = 8 + (i % 2) * 14;
    const height = 76 - (i % 2) * 14;
    const img = resolveItemImage(it);
    const hasImg = Boolean(img.url);
    return {
      id: it.id,
      style: {
        position: "absolute",
        left: left + "%",
        top: top + "%",
        width: w + "%",
        height: height + "%",
        // Couleur toujours posée en repli (recette 20/08/2026, correctif) —
        // même quand une image est disponible, pour ne jamais rendre une
        // pièce invisible si son chargement échoue.
        backgroundColor: it.hex,
        backgroundImage: hasImg ? `url(${img.url})` : undefined,
        backgroundSize: "contain",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        borderRadius: hasImg ? 0 : 8,
      },
    };
  });
}

function HangerIcon() {
  return (
    <svg viewBox="0 0 24 24" width={19} height={19} fill="none" stroke="#F8F3EA" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 6.2a2.1 2.1 0 1 1 2.1-2.1" />
      <path d="M12 6.2v2.1" />
      <path d="M12 8.3 3.6 14.6a1.2 1.2 0 0 0 .72 2.17h15.36a1.2 1.2 0 0 0 .72-2.17Z" />
    </svg>
  );
}

function JournalIcon() {
  return (
    <svg viewBox="0 0 24 24" width={19} height={19} fill="none" stroke="#F8F3EA" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.5 3.5h11.2a1.8 1.8 0 0 1 1.8 1.8v13.4a1.8 1.8 0 0 1-1.8 1.8H5.5Z" />
      <path d="M5.5 3.5a1.6 1.6 0 0 0 0 3.2" />
      <path d="M9 8.6h6" />
      <path d="M9 12h6" />
      <path d="M9 15.4h3.6" />
    </svg>
  );
}

export default function HomeScreen() {
  const { state, geoCity, geoLoading, wardrobePool, actions } = useCapsela();
  const { profile } = useAuth();
  const firstNameOrYou = profile.displayName || "toi";

  // Bloc principal (brief design Homepage, 19/08/2026 ; alignement proto
  // 20/08/2026) : lecture seule des données déjà disponibles ailleurs dans
  // l'app (météo/localisation, occasion auto-sélectionnée, tenue déjà
  // déterminée) — jamais de génération de tenue ni d'appel image depuis cet
  // écran. hasOutfit distingue "tenue déjà déterminée" (visitée au moins
  // une fois cette session) de "pas encore choisie".
  const hasOutfit = state.outfit.length > 0;
  const occasionKey = state.occasion && state.occasion !== "all" ? state.occasion : defaultOccasionToday(profile.prefs);
  const occasionLabel = OCC_LABELS[occasionKey];

  const outfitPieces = hasOutfit
    ? state.outfit.map((id) => wardrobePool.find((i) => i.id === id)).filter((it): it is Item => Boolean(it))
    : [];

  // Même phrase d'explication que la page Tenue (explainRecommendation,
  // jamais un second template) — pas de température affichée tant que la
  // géolocalisation n'a pas résolu la météo réelle du jour.
  const outfitQuote = explainRecommendation(occasionKey, state.workMode, state.dateContext, geoLoading ? null : geoCity.temp);

  const features = [
    {
      title: "Dressing",
      body: "Ajoute tes vêtements et accessoires par photo.",
      onOpen: actions.goWardrobe,
      bg: "#F6F0E6",
      accent: "#1D1A16",
      glyph: "❑" as const,
      ghost: "01",
    },
    {
      title: "Tes capsules",
      body: "Une sélection déjà prête, pensée pour ton style.",
      onOpen: actions.goCapsule,
      bg: "#F0E7D9",
      accent: "#1D1A16",
      glyph: "hanger" as const,
      ghost: "02",
    },
    {
      title: "Journal des tenues",
      body: "L’historique de toutes tes tenues portées.",
      onOpen: actions.goHistory,
      bg: "#E9DECC",
      accent: "#1D1A16",
      glyph: "journal" as const,
      ghost: "03",
    },
  ];

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto pt-[6px] pb-[100px]">
      <div className="px-6">
        <AppHeader />
      </div>

      <div className="px-6 pt-4">
        <div className="text-[11px] tracking-[.18em] uppercase text-muted">Aujourd&apos;hui</div>
        <div className="font-serif text-[30px] leading-[1.12] text-ink mt-[6px]">
          Bonjour, <span className="italic text-terracotta">{firstNameOrYou}</span>
        </div>
      </div>

      <button
        onClick={actions.goTenues}
        className="mx-6 mt-5 bg-terracotta rounded-[22px] p-[22px] cursor-pointer relative overflow-hidden text-left block"
        style={{ width: "calc(100% - 48px)" }}
      >
        <div className="font-serif text-[22px] text-cream leading-[1.25]">
          {hasOutfit ? (
            "Ta tenue est prête"
          ) : (
            <>
              Découvre ta
              <br />
              tenue du jour
            </>
          )}
        </div>
        <div className="text-[12.5px] mt-[7px]" style={{ color: hasOutfit ? "rgba(243,238,229,.82)" : "rgba(243,238,229,.8)", maxWidth: 230 }}>
          {hasOutfit ? outfitQuote : "Une sélection pensée pour toi, ta journée et la météo."}
        </div>
        {hasOutfit && outfitPieces.length > 0 && (
          <div
            style={{
              marginTop: 14,
              position: "relative",
              borderRadius: 14,
              overflow: "hidden",
              background: "rgba(243,238,229,.14)",
              height: 92,
            }}
          >
            {homeCompositionPiecesOf(outfitPieces).map((p) => (
              <div key={"home-comp-" + p.id} style={p.style} />
            ))}
          </div>
        )}
        {hasOutfit && occasionLabel && (
          <div
            className="inline-flex items-center gap-[7px] mt-[14px] text-[10px] tracking-[.08em] uppercase"
            style={{ background: "rgba(243,238,229,.16)", color: "#F3EEE5", borderRadius: 100, padding: "7px 14px" }}
          >
            {occasionLabel}
          </div>
        )}
        <div
          className="inline-flex items-center gap-[7px] bg-cream text-ink rounded-full py-[10px] px-4 text-[12px] tracking-[.04em]"
          style={{ marginTop: hasOutfit ? 14 : 16 }}
        >
          {hasOutfit ? "Voir ma tenue →" : "Découvrir ma tenue →"}
        </div>
      </button>

      <div className="flex items-center justify-between mx-6 mt-[26px] mb-3">
        <span className="text-[11px] tracking-[.16em] uppercase text-muted">Explore L&apos;édit Capsela</span>
      </div>
      <div className="flex flex-col gap-3 px-6">
        {features.map((f, i) => (
          <button
            key={f.title}
            onClick={f.onOpen}
            className="relative overflow-hidden w-full rounded-[18px] cursor-pointer flex items-center justify-between gap-[13px] text-left box-border"
            style={{
              background: "linear-gradient(135deg, " + f.bg + " 0%, " + GRADIENT_TO[i] + " 100%)",
              padding: "16px 18px",
            }}
          >
            <span
              className="absolute pointer-events-none font-serif italic"
              style={{ right: "-16px", bottom: "-34px", fontSize: "76px", lineHeight: 1, color: "rgba(166,105,80,.12)" }}
            >
              {f.ghost}
            </span>
            <div
              className="relative flex-shrink-0 w-[38px] h-[38px] rounded-full flex items-center justify-center text-[16px]"
              style={{ background: "#A66950", color: "#F8F3EA" }}
            >
              {f.glyph === "hanger" ? <HangerIcon /> : f.glyph === "journal" ? <JournalIcon /> : <span>{f.glyph}</span>}
            </div>
            <div className="relative flex-1 min-w-0">
              <div className="font-serif text-[17px]" style={{ color: f.accent }}>
                {f.title}
              </div>
              <div className="text-[11.5px] mt-1 leading-[1.4]" style={{ color: "#7B7366" }}>
                {f.body}
              </div>
            </div>
            <span className="relative flex-shrink-0 text-[15px]" style={{ color: f.accent }}>
              →
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
