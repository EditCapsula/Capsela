"use client";

import { useEffect, useRef, useState } from "react";
import BottomSheet from "@/components/BottomSheet";
import Button from "@/components/Button";
import PhotoPiece from "@/components/PhotoPiece";
import { masquerMenuActions } from "@/lib/menuActions";
import { useAuth } from "@/lib/auth";
import { colorimetrieMoteur } from "@/lib/colorimetrieMoteur";
import { paletteHexes } from "@/lib/profile";
import { alternativesClassees, estSuggestion, lienAffiliationValide, poolDeRemplacement, type ContexteLook } from "@/lib/remplacementPiece";
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
 * et laisse quelques secondes « Annuler ». L'écran qui pose le flat lay dit comment le remplacement s'applique (`appliquer`) : la tenue
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

const DUREE_ANNULER_MS = 6000;

/** Une seule feuille par écran ; chaque flat lay passe SON look au toucher (`ouvrir(piece, config)`) — le carrousel en a plusieurs. */
export function useRemplacementPiece(): { ouvrir: (it: Item, config: ConfigRemplacement) => void; rendu: React.ReactNode } {
  const { actions } = useCapsela();
  const [piece, setPiece] = useState<Item | null>(null);
  const [vue, setVue] = useState<"piece" | "remplacer">("piece");
  // Le look où le remplacement a été fait est gardé avec lui : « Annuler » le défait là, même si une autre feuille a été ouverte depuis.
  const [fait, setFait] = useState<{ ancien: Item; nouvel: Item; config: ConfigRemplacement } | null>(null);
  const [echec, setEchec] = useState(false);
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);
  const configRef = useRef<ConfigRemplacement | null>(null);

  // Le menu d'actions flottant s'efface le temps de la confirmation : elle occupe le même bas d'écran.
  useEffect(() => {
    masquerMenuActions("remplacement-piece", Boolean(fait || echec));
    return () => masquerMenuActions("remplacement-piece", false);
  }, [fait, echec]);
  useEffect(() => () => {
    if (minuterie.current) clearTimeout(minuterie.current);
  }, []);

  // Calculées au toucher de « Remplacer », une fois : le classement note le look entier pour chaque candidate.
  const [alternatives, setAlternatives] = useState<Item[]>([]);
  const ouvrirRemplacement = () => {
    const c = configRef.current;
    if (!c || !piece) return;
    setAlternatives(alternativesClassees(c.look, piece, poolDeRemplacement(piece, c.dressing, c.suggestions), c.contexte));
    setVue("remplacer");
  };

  const fermer = () => {
    setPiece(null);
    setVue("piece");
  };
  const montrer = (etat: { ancien: Item; nouvel: Item; config: ConfigRemplacement } | null, rate: boolean) => {
    if (minuterie.current) clearTimeout(minuterie.current);
    setFait(etat);
    setEchec(rate);
    minuterie.current = setTimeout(() => {
      setFait(null);
      setEchec(false);
    }, DUREE_ANNULER_MS);
  };
  const remplacer = async (nouvel: Item) => {
    const c = configRef.current;
    if (!c || !piece) return;
    const ancien = piece;
    fermer();
    const ok = await c.appliquer(ancien.id, nouvel.id);
    montrer(ok ? { ancien, nouvel, config: c } : null, !ok);
  };
  const annuler = async () => {
    if (!fait) return;
    const { ancien, nouvel, config: c } = fait;
    if (minuterie.current) clearTimeout(minuterie.current);
    setFait(null);
    const ok = await c.appliquer(nouvel.id, ancien.id);
    if (!ok) montrer(null, true);
  };

  const suggestion = piece ? estSuggestion(piece) : false;
  const lien = piece && suggestion ? lienAffiliationValide(piece.affLink) : null;

  const rendu = (
    <>
      <BottomSheet title={piece?.name ?? ""} open={Boolean(piece) && vue === "piece"} onClose={fermer}>
        {piece && (
          <>
            <div className="mx-auto" style={{ width: "min(68%, 260px)" }}>
              <PhotoPiece piece={piece} ratio={0.8} rayon={18} />
            </div>
            {(piece.brand || suggestion) && (
              <div className="flex items-center justify-center gap-2 mt-4">
                {piece.brand && <span className="t-surtitre text-muted-3">{piece.brand}</span>}
                {suggestion && <span className="t-pastille text-terracotta bg-warm-bg rounded-full py-1 px-[10px]">Suggestion</span>}
              </div>
            )}
            <div className="grid grid-cols-2 gap-[10px] mt-5">
              <Button
                variante="contour"
                onClick={() => {
                  const id = piece.id;
                  fermer();
                  actions.openItem(id, suggestion);
                }}
              >
                Voir
              </Button>
              <Button variante="principal" onClick={ouvrirRemplacement}>
                Remplacer
              </Button>
            </div>
            {lien && (
              <a
                href={lien}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-[10px] flex items-center justify-center rounded-full border border-border text-terracotta t-bouton cursor-pointer"
                style={{ minHeight: 52 }}
              >
                Acheter cette pièce
              </a>
            )}
          </>
        )}
      </BottomSheet>

      <BottomSheet title="Remplacer" open={Boolean(piece) && vue === "remplacer"} onClose={fermer}>
        {piece && alternatives.length === 0 && (
          <div className="text-[13px] text-muted-3 leading-[1.5]">
            {suggestion ? "Aucune autre pièce ne convient à ce look." : "Aucune autre pièce de ton dressing ne convient à ce look."}
          </div>
        )}
        {alternatives.length > 0 && (
          <div className="grid grid-cols-3 gap-[10px]" role="list" aria-label="Pièces de remplacement">
            {alternatives.map((p) => (
              <button key={p.id} type="button" role="listitem" onClick={() => void remplacer(p)} className="text-left cursor-pointer active:opacity-80 min-w-0">
                <PhotoPiece piece={p} ratio={0.8} rayon={14} />
                <span className="block text-[11.5px] text-ink leading-[1.3] mt-[6px] line-clamp-2">{p.name}</span>
                {estSuggestion(p) && <span className="block t-pastille text-terracotta mt-[3px]">Suggestion</span>}
              </button>
            ))}
          </div>
        )}
      </BottomSheet>

      {(fait || echec) && (
        <div
          className="fixed inset-x-0 mx-auto max-w-[480px] px-6 z-40"
          style={{ bottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 16px)" }}
          role="status"
        >
          <div className="flex items-center gap-3 bg-ink rounded-full py-[12px] pl-4 pr-[6px] shadow-lg">
            <span className="flex-1 min-w-0 text-[12px] text-cream truncate">
              {echec ? "Le remplacement n'a pas pu être enregistré." : `${fait!.nouvel.name} remplace ${fait!.ancien.name}`}
            </span>
            {fait && (
              <button onClick={() => void annuler()} className="flex-shrink-0 rounded-full px-[14px] text-[12px] font-semibold text-cream cursor-pointer" style={{ minHeight: 36 }}>
                Annuler
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );

  return {
    ouvrir: (it: Item, config: ConfigRemplacement) => {
      configRef.current = config;
      setVue("piece");
      setPiece(it);
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
