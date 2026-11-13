"use client";

import { useRef, useState } from "react";
import BottomSheet from "@/components/BottomSheet";
import Button from "@/components/Button";
import PhotoPiece from "@/components/PhotoPiece";
import { afficherToast } from "@/components/ToastCapsela";
import { useAuth } from "@/lib/auth";
import { colorimetrieMoteur } from "@/lib/colorimetrieMoteur";
import { paletteHexes } from "@/lib/profile";
import { alternativesClassees, estSuggestion, justificationRemplacement, lienAffiliationValide, poolDeRemplacement, type ContexteLook } from "@/lib/remplacementPiece";
import { useCapsela } from "@/lib/store";
import type { Item } from "@/lib/types";

/**
 * LE FLAT LAY INTERACTIF (12/11/2026, brief « Flat lay interactif et remplacement des articles », lib/remplacementPiece.ts).
 *
 * Toucher une pièce d'un flat lay ouvre une feuille sur l'écran, le look restant visible dessous : le visuel en grand, la marque
 * (seulement si elle est connue), le nom, et deux actions — « Voir » (la fiche existante) et « Remplacer ». Une SUGGESTION de la capsule
 * garde sa marque « Suggestion », et y ajoute « Acheter cette pièce » quand un lien d'affiliation valide est renseigné (lien ouvert comme
 * partout dans l'app : un lien externe, nouvel onglet ou navigateur du téléphone). Rien d'autre : pas de description.
 *
 * « Remplacer » montre les alternatives en grille, la meilleure d'abord ; en toucher une remplace CETTE pièce seulement, ferme la feuille
 * et laisse six secondes « Annuler » (le message commun, ToastCapsela). L'écran qui pose le flat lay dit comment le remplacement s'applique (`appliquer`) : la tenue
 * du jour, une proposition du carrousel, la tenue proposée par Planifier ou une tenue déjà planifiée (enregistrée). Le score du look
 * se recalcule de lui-même : il est dérivé des pièces affichées.
 *
 * Avant (15/10/2026, demandé) : toucher une pièce ouvrait directement sa fiche. Cette feuille la remplace à la demande du 12/11/2026,
 * sur ces quatre flat lays seulement ; les autres gardent la fiche directe.
 */
export interface ConfigRemplacement {
  /** Les pièces du look affiché. */
  look: Item[];
  contexte: ContexteLook;
  /** Les pièces du dressing (alternatives d'une pièce du dressing). */
  dressing: Item[];
  /** Les suggestions possibles (capsule) pour remplacer une suggestion. */
  suggestions: Item[];
  /** Applique le remplacement ; false si l'écriture a échoué (rien n'est alors annonçable). */
  appliquer: (ancienId: number, nouvelId: number) => boolean | Promise<boolean>;
}

/** Une seule feuille par écran ; chaque flat lay passe SON look au toucher (`ouvrir(piece, config)`) — le carrousel en a plusieurs. */
export function useRemplacementPiece(): {
  ouvrir: (it: Item, config: ConfigRemplacement) => void;
  /** Les alternatives d'emblée (« ⇄ » sur une carte de pièce, 13/11/2026) : la même grille que « Remplacer », sans passer par la pièce. */
  remplacer: (it: Item, config: ConfigRemplacement) => void;
  rendu: React.ReactNode;
} {
  const { actions } = useCapsela();
  const [piece, setPiece] = useState<Item | null>(null);
  const [vue, setVue] = useState<"piece" | "remplacer">("piece");
  // La confirmation passe par le message commun de l'app (ToastCapsela, 13/11/2026) : « Pièce remplacée », « Annuler » pendant 6 s,
  // qui remet exactement la pièce d'origine dans le look où le remplacement a été fait (la configuration est gardée avec lui).
  const configRef = useRef<ConfigRemplacement | null>(null);

  // Calculées au toucher de « Remplacer », une fois : le classement note le look entier pour chaque candidate.
  const [alternatives, setAlternatives] = useState<Item[]>([]);
  // L'alternative choisie avant confirmation ; la meilleure est présélectionnée (planche « Remplacer »).
  const [choix, setChoix] = useState<Item | null>(null);
  const ouvrirRemplacement = () => {
    const c = configRef.current;
    if (!c || !piece) return;
    const alt = alternativesClassees(c.look, piece, poolDeRemplacement(piece, c.dressing, c.suggestions), c.contexte);
    setAlternatives(alt);
    setChoix(alt[0] ?? null);
    setVue("remplacer");
  };

  const fermer = () => {
    setPiece(null);
    setVue("piece");
  };
  const remplacer = async (nouvel: Item) => {
    const c = configRef.current;
    if (!c || !piece) return;
    const ancien = piece;
    fermer();
    const ok = await c.appliquer(ancien.id, nouvel.id);
    if (!ok) return afficherToast("Le remplacement n'a pas pu être enregistré.");
    afficherToast("Pièce remplacée", async () => {
      const retour = await c.appliquer(nouvel.id, ancien.id);
      if (!retour) afficherToast("Le retour à la pièce d'origine n'a pas pu être enregistré.");
    });
  };

  const suggestion = piece ? estSuggestion(piece) : false;

  const rendu = (
    <>
      {/* LA FEUILLE D'UNE PIÈCE, REVUE (12/11/2026, demandé : « image plus grande et entière, c'est l'élément principal ; titre mieux
          intégré, typographie éditoriale ; badge plus discret, Suggestion Capsela »). L'en-tête ne porte plus que la provenance, en petite
          étiquette (le mode `surtitre` de BottomSheet, celui des fiches de suggestion) : « ✦ Suggestion Capsela » ou « Ton dressing ». La
          photo prend toute la largeur, en entier (bornée en hauteur pour laisser voir les actions) ; dessous, la marque en surtitre si elle
          est connue, puis le nom en Bodoni. */}
      <VuePiece
        piece={vue === "piece" ? piece : null}
        onFermer={fermer}
        onVoir={(p) => {
          fermer();
          actions.openItem(p.id, estSuggestion(p));
        }}
        onRemplacer={ouvrirRemplacement}
      />

      {/* REMPLACER (13/11/2026, planche « Remplacer, une seule logique ») : la pièce actuelle, puis les alternatives en liste, la mieux notée
          d'abord (« Meilleur choix », alternativesClassees), chacune avec une justification tirée de ses données ; on en choisit une, puis
          « Remplacer la pièce » l'applique, ferme la feuille et propose « Annuler » six secondes. */}
      <BottomSheet
        title="Remplacer"
        open={Boolean(piece) && vue === "remplacer"}
        onClose={fermer}
        pied={
          alternatives.length > 0 && (
            <Button variante="principal" disabled={!choix} onClick={() => choix && void remplacer(choix)}>
              Remplacer la pièce
            </Button>
          )
        }
      >
        <div className="t-chapeau text-muted-3 -mt-[4px] mb-[12px]">Choisis une alternative pour ton look.</div>
        {piece && (
          <div className="flex items-center gap-3 pb-[12px] mb-[12px] border-b border-divider">
            <div className="w-[48px] flex-shrink-0">
              <PhotoPiece piece={piece} ratio={0.8} rayon={10} entiere />
            </div>
            <div className="min-w-0">
              <div className="t-label text-muted">Pièce actuelle</div>
              <div className="t-titre-vignette text-ink truncate mt-[2px]">{piece.name}</div>
            </div>
          </div>
        )}
        {piece && alternatives.length === 0 && (
          <div className="text-[13px] text-muted-3 leading-[1.5]">
            {suggestion ? "Aucune autre pièce ne convient à ce look." : "Aucune autre pièce de ton dressing ne convient à ce look."}
          </div>
        )}
        {piece && alternatives.length > 0 && (
          <div role="radiogroup" aria-label="Pièces de remplacement" className="flex flex-col gap-[8px]">
            {alternatives.map((p, i) => {
              const actif = choix?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={actif}
                  onClick={() => setChoix(p)}
                  className={"flex items-center gap-3 rounded-tuile border bg-card px-3 py-[8px] text-left cursor-pointer min-h-[64px] " + (actif ? "border-terracotta-deep" : "border-border")}
                >
                  <div className="w-[48px] flex-shrink-0">
                    <PhotoPiece piece={p} ratio={0.8} rayon={10} entiere />
                  </div>
                  <span className="flex-1 min-w-0">
                    {i === 0 && <span className="inline-block rounded-full bg-chip-soft-bg text-terracotta-deep t-pastille px-[7px] py-[3px] mb-[3px]">✦ Meilleur choix</span>}
                    <span className="block t-titre-vignette text-ink truncate">{p.name}</span>
                    <span className="block text-[11.5px] text-muted-3 mt-[1px]">
                      {justificationRemplacement(piece, p)} · {estSuggestion(p) ? "Suggestion" : "Ton dressing"}
                    </span>
                  </span>
                  <span aria-hidden="true" className={"w-[20px] h-[20px] flex-shrink-0 rounded-full border flex items-center justify-center " + (actif ? "border-terracotta-deep bg-terracotta-deep" : "border-border")}>
                    {actif && (
                      <svg width="11" height="11" viewBox="0 0 12 12"><path d="M2.5 6.2l2.3 2.3L9.5 3.8" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </BottomSheet>

    </>
  );

  return {
    ouvrir: (it: Item, config: ConfigRemplacement) => {
      configRef.current = config;
      setVue("piece");
      setPiece(it);
    },
    remplacer: (it: Item, config: ConfigRemplacement) => {
      configRef.current = config;
      const alt = alternativesClassees(config.look, it, poolDeRemplacement(it, config.dressing, config.suggestions), config.contexte);
      setAlternatives(alt);
      setChoix(alt[0] ?? null);
      setPiece(it);
      setVue("remplacer");
    },
    rendu,
  };
}

/** Le contexte de classement d'un look, tiré du profil : palette, silhouette, colorimétrie, univers. */
export function useContexteLook(p: { occasion: ContexteLook["occasion"]; weather: ContexteLook["weather"]; workMode?: ContexteLook["workMode"]; dateContext?: ContexteLook["dateContext"] }): ContexteLook {
  const { profile } = useAuth();
  const { state } = useCapsela();
  return {
    occasion: p.occasion,
    weather: p.weather,
    workMode: p.workMode ?? state.workMode,
    dateContext: p.dateContext ?? state.dateContext,
    palette: paletteHexes(profile),
    morphology: profile.morphology,
    colorimetrie: colorimetrieMoteur(profile.colorimetrie),
    gender: profile.gender,
  };
}

/**
 * LA VUE D'UNE PIÈCE DU LOOK (13/11/2026, harmonisation des fiches) : la même feuille courte partout où une pièce est vue dans un look —
 * flat lays, grille « Les pièces de ton look », idée de look, avis d'un proche. La provenance en tête, la photo entière, la marque, le
 * nom ; « Voir » (la fiche complète, ou la fiche de suggestion), « Remplacer » seulement là où la tenue se modifie, « Acheter cette pièce »
 * pour une suggestion au lien valide.
 */
export function VuePiece({ piece, onFermer, onVoir, onRemplacer }: { piece: Item | null; onFermer: () => void; onVoir: (p: Item) => void; onRemplacer?: () => void }) {
  const suggestion = piece ? estSuggestion(piece) : false;
  const lien = piece && suggestion ? lienAffiliationValide(piece.affLink) : null;
  return (
    <BottomSheet title={suggestion ? "✦ Suggestion Capsela" : "Ton dressing"} surtitre open={Boolean(piece)} onClose={onFermer}>
      {piece && (
        <>
          <div className="mx-auto" style={{ width: "min(100%, calc(46vh * 0.8))" }}>
            <PhotoPiece piece={piece} ratio={0.8} rayon={22} entiere />
          </div>
          <div className="text-center mt-[18px]">
            {piece.brand && <div className="t-surtitre text-muted-3">{piece.brand}</div>}
            <h2 className={"t-titre-ecran text-ink " + (piece.brand ? "mt-[6px]" : "")} style={{ textWrap: "balance" }}>
              {piece.name}
            </h2>
          </div>
          {/* LES ACTIONS (13/11/2026, planche « Feuille courte ») : empilées, pleine largeur ; « Voir » en action principale, « Remplacer »
              là où la tenue se modifie, « Acheter cette pièce » pour une suggestion au lien valide — en contour, avec leur icône. Les
              libellés courts sont demandés ; les lecteurs d'écran entendent le sens complet. */}
          <div className="flex flex-col gap-[10px] mt-5">
            <Button variante="principal" onClick={() => onVoir(piece)} aria-label={`Voir la fiche complète de ${piece.name}`}>
              Voir
            </Button>
            {onRemplacer && (
              <Button variante="contour" onClick={onRemplacer} aria-label={`Remplacer ${piece.name} dans ce look`}>
                <span className="inline-flex items-center gap-[8px]">
                  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9h12l-3-3M19 15H7l3 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Remplacer
                </span>
              </Button>
            )}
            {lien && (
              <a
                href={lien}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="flex items-center justify-center gap-[8px] rounded-full border border-border text-terracotta t-bouton cursor-pointer"
                style={{ minHeight: 52 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8h12l-1 12H7L6 8zM9 8V6.5a3 3 0 016 0V8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
                Acheter cette pièce
              </a>
            )}
          </div>
        </>
      )}
    </BottomSheet>
  );
}
