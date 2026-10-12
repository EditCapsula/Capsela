"use client";

import { estPhotoDetouree } from "@/lib/dressing";
import { fondPhotoPiece } from "@/lib/catalogImages";
import { useEffect, useRef, useState } from "react";
import BottomSheet from "@/components/BottomSheet";
import { useCapsela } from "@/lib/store";
import { daysSinceWorn, wearCounts } from "@/lib/selectors";
import { wornAgo } from "@/lib/data";
import { participePorte, participePorteMaj } from "@/lib/logic";
import BoutonRetour from "@/components/BoutonRetour";
import { teinteDe } from "@/lib/colorimetrieMoteur";
import Button from "@/components/Button";
import EmptyState from "@/components/EmptyState";
import { BoutonAjoutFlottant } from "@/components/screens/WardrobeScreen";
import { groupesDuVestiaire, syntheseDressing } from "@/lib/dressingEcran";
import { useAuth } from "@/lib/auth";
import type { CategoryKey } from "@/lib/types";

/**
 * "Mes pièces" (recette 24/08/2026, mockup fourni) — grille plate 2 colonnes
 * remplaçant le regroupement par catégorie en scroll horizontal : plus
 * lisible pour parcourir tout le dressing d'un coup. "Jamais porté" reste
 * décidé par it.worn (source de vérité déjà utilisée partout ailleurs,
 * ex. PieceScreen) ; le total "Porté X fois" vient de l'historique réel
 * (wearCounts, jamais un compteur séparé désynchronisable).
 *
 * Correctif 25/08/2026 (signalé : "Aujourd'hui" affiché sur plusieurs
 * pièces manifestement pas portées le jour même) — it.worn est figé par la
 * dernière action "porter" et ne "vieillit" jamais tout seul ; le nombre de
 * jours réel vient maintenant de daysSinceWorn (dérivé de la date de la
 * plus récente entrée d'historique). Même correctif que l'ancien "Porté
 * aujourd'hui" qui restait affiché indéfiniment.
 *
 * SUPPRESSION MULTIPLE (09/09/2026, signalé : "je dois pouvoir supprimer des
 * pièces du dressing"). Retirer une pièce était déjà possible, mais seulement
 * une par une et au fond du menu d'une pièce ouverte — invisible depuis cette
 * grille, qui est pourtant l'écran où l'on fait le tri. Le mode sélection
 * s'active depuis l'en-tête ; tant qu'il est actif, toucher une carte la
 * coche au lieu de l'ouvrir, et rien n'est supprimé avant la confirmation.
 * Une suppression est définitive : c'est la seule raison pour laquelle elle
 * passe par une feuille de confirmation, comme la suppression de compte.
 *
 * "Aujourd'hui" affiché en pastille sur la photo plutôt qu'en 3e ligne de
 * légende (correctif 25/08/2026, signalé : cartes désalignées) — une
 * légende à hauteur variable (2 ou 3 lignes selon la pièce) agrandissait la
 * ligne de grille concernée, avec un risque de décalage visuel entre les
 * deux colonnes ; la légende reste maintenant toujours sur 2 lignes,
 * quelle que soit la pièce.
 */
const DUREE_APPUI_LONG_MS = 500;

/** Message d'une catégorie vide, par groupe du Dressing (clés de DRESSING_GROUPS). Aucune pièce n'y est inventée : le texte invite seulement à ajouter. */
const VIDE_PAR_DEFAUT = { titre: "Ici, tout reste à composer.", texte: "Ajoute tes premières pièces pour les retrouver dans tes prochaines tenues." };
const VIDE_CATEGORIE: Record<string, { titre: string; texte: string }> = {
  "bijoux-accessoires": { titre: "Les détails font la différence.", texte: "Ajoute tes bijoux et accessoires pour compléter tes prochaines tenues." },
  sacs: { titre: "Le sac qui finit le look.", texte: "Ajoute tes sacs pour qu'ils accompagnent tes prochaines tenues." },
  chaussures: { titre: "Chaque tenue commence par les pieds.", texte: "Ajoute tes chaussures pour compléter tes prochaines tenues." },
  "vestes-manteaux": { titre: "La couche qui change tout.", texte: "Ajoute tes vestes et manteaux pour composer des tenues pour toutes les météos." },
  "robes-combinaisons": { titre: "Une pièce, une tenue.", texte: "Ajoute tes robes et combinaisons pour des looks faciles à composer." },
  hauts: { titre: "La base de tes looks.", texte: "Ajoute tes hauts et pulls pour les associer à tes prochaines tenues." },
  jupes: { titre: "Du mouvement dans tes tenues.", texte: "Ajoute tes jupes pour varier tes prochaines tenues." },
  "pantalons-jeans-shorts": { titre: "Le socle de tes tenues.", texte: "Ajoute tes pantalons, jeans et shorts pour composer tes prochaines tenues." },
};

export default function WardrobePiecesScreen() {
  const { state, actions, etatPremium } = useCapsela();
  const { profile } = useAuth();
  // Ouvert depuis une carte du vestiaire (refonte Dressing, 25/09/2026) :
  // seules les pièces de ses catégories techniques, et un « Tout afficher »
  // pour revenir à l'ensemble.
  const filtre = state.filtrePieces;
  const parFiltre = filtre
    ? state.items.filter((i) => (!filtre.categories || filtre.categories.includes(i.cat)) && (!filtre.teinte || teinteDe(i) === filtre.teinte))
    : state.items;
  // Recherche par nom (12/10/2026), sans accent ni casse, dans la vue affichée (toutes les pièces ou la catégorie choisie). Proposée à partir de
  // 9 pièces : en dessous, la grille tient presque à l'écran et un champ de plus l'alourdirait.
  const [recherche, setRecherche] = useState("");
  const normaliser = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const terme = normaliser(recherche);
  const items = terme ? parFiltre.filter((i) => normaliser(i.name).includes(terme)) : parFiltre;
  const groupes = groupesDuVestiaire(state.items, profile.gender, { inclureVides: true });
  // Un filtre de catégorie se reconnaît à ses catégories ; une couleur (depuis la tenue) n'a pas de pastille sélectionnée.
  const groupeActif = filtre?.categories ? groupes.find((g) => g.categories.join() === filtre.categories!.join()) : undefined;
  // Position de la liste de pastilles (12/10/2026, signalé : le premier libellé était tronqué à gauche au chargement). La liste déborde des
  // marges de l'écran (-mx-6 / px-6, scroll-padding) : une pastille qui défile passe sous le bord de l'écran, pas sous une coupure à 24 px.
  // À l'ouverture et à chaque changement de catégorie, la pastille active est ramenée au centre de la liste (« Toutes » : tout à gauche) ;
  // le défilement est calculé sur la liste seule, il ne fait jamais défiler l'écran.
  const listeCategories = useRef<HTMLDivElement>(null);
  const cleActive = groupeActif?.id ?? "toutes";
  useEffect(() => {
    const liste = listeCategories.current;
    if (!liste) return;
    const actif = liste.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!actif || cleActive === "toutes") {
      liste.scrollLeft = 0;
      return;
    }
    liste.scrollLeft = Math.max(0, actif.offsetLeft - (liste.clientWidth - actif.offsetWidth) / 2);
  }, [cleActive]);

  // Depuis une catégorie ouverte (vide ou non), l'ajout s'ouvre sur cette catégorie (12/10/2026, demandé) — la première de son groupe
  // (« Bijoux & accessoires » : bijou), modifiable dans le formulaire — et le retour ramène ici ; la catégorie lue sur la photo prend le pas sur ce point de départ. « Toutes » : ajout habituel.
  const ajouter = () => {
    if (syntheseDressing(etatPremium, state.items.length, groupes.length).complet) actions.goPremium();
    else if (groupeActif) actions.openAddForCategory(groupeActif.categories[0], { laPhotoDecide: true });
    else actions.openAdd();
  };
  const counts = wearCounts(state.history);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const quitterSelection = () => {
    setSelectionMode(false);
    setSelection(new Set());
    setConfirmOpen(false);
  };

  const basculer = (id: number) =>
    setSelection((prec) => {
      const suivant = new Set(prec);
      if (suivant.has(id)) suivant.delete(id);
      else suivant.add(id);
      return suivant;
    });

  // Appui long sur une carte = entrée dans la sélection, cette pièce cochée (12/10/2026, demandé : « pour sélectionner une pièce il faut
  // cliquer longtemps dessus » ; le lien « Sélectionner » est supprimé). Le geste de la galerie du téléphone : si le doigt bouge (défilement)
  // ou se relève avant DUREE_APPUI_LONG, rien ne se passe. Le clic qui suit un appui long est avalé, sinon il ouvrirait la pièce.
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appuiLongFait = useRef(false);
  const departAppui = useRef<{ x: number; y: number } | null>(null);
  const annulerAppui = () => {
    if (minuteur.current) clearTimeout(minuteur.current);
    minuteur.current = null;
    departAppui.current = null;
  };
  const commencerAppui = (e: React.PointerEvent, id: number) => {
    if (selectionMode) return;
    appuiLongFait.current = false;
    departAppui.current = { x: e.clientX, y: e.clientY };
    minuteur.current = setTimeout(() => {
      minuteur.current = null;
      appuiLongFait.current = true;
      setSelectionMode(true);
      setSelection(new Set([id]));
    }, DUREE_APPUI_LONG_MS);
  };
  const bougerAppui = (e: React.PointerEvent) => {
    const d = departAppui.current;
    if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10) annulerAppui();
  };

  const supprimer = () => {
    actions.removeItems([...selection]);
    quitterSelection();
  };

  return (
    <>
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px]" style={{ paddingBottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 88px)" }}>
      <div className="flex items-center justify-between gap-3 mt-[10px]">
        <div className="flex items-center gap-[14px] min-w-0">
          <BoutonRetour onClick={filtre?.retour === "tenue" ? actions.goTenues : actions.goWardrobe} label={filtre?.retour === "tenue" ? "Revenir à ma tenue" : "Revenir au dressing"} className="flex-shrink-0" />
          <div className="t-titre-section text-ink truncate">Mes pièces</div>
        </div>
      </div>

      {/* Plus de lien « Sélectionner » (12/10/2026) : la sélection s'ouvre par un appui long sur une carte (cf. commencerAppui). Le
          rappel en gris, à la place du lien, garde le geste découvrable (le lien avait été ajouté le 10/09/2026 parce qu'on ne voyait pas
          comment sélectionner en masse). */}
      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-3">
          <div className="t-surtitre text-muted min-w-0">
            {selectionMode
              ? selection.size === 0
                ? "Touche les pièces à retirer"
                : `${selection.size} ${selection.size === 1 ? "sélectionnée" : "sélectionnées"}`
              : `${filtre?.libelle ?? "Toutes mes pièces"} · ${items.length} ${items.length <= 1 ? "pièce" : "pièces"}`}
          </div>
          {selectionMode && (
            <button onClick={quitterSelection} className="text-[12px] text-muted flex-shrink-0 cursor-pointer py-[4px]">
              Annuler
            </button>
          )}
        </div>
        {!selectionMode && items.length > 0 && <div className="text-[11px] text-placeholder mt-[4px]">Appui long sur une pièce pour la sélectionner</div>}
      </div>

      {/* NAVIGATION PAR CATÉGORIE (12/10/2026) : les catégories du Dressing (mêmes groupes, dressingEcran), avec leur nombre de pièces,
          en pastilles horizontales ; celle qui est ouverte est pleine. Elle remplace le lien « Tout afficher » (la pastille « Toutes » fait
          la même chose), sauf pour un filtre de couleur venu de la tenue, qui n'est pas une catégorie. Les catégories vides du profil restent
          proposées : on y ajoute sa première pièce. */}
      {!selectionMode && !filtre?.teinte && (
        <div ref={listeCategories} role="group" aria-label="Catégories" className="scrollarea relative flex gap-2 overflow-x-auto mt-3 pb-[2px] -mx-6 px-6 scroll-px-6">
          {[{ id: "toutes", libelle: "Toutes", nbPieces: state.items.length, categories: undefined as CategoryKey[] | undefined }, ...groupes].map((g) => {
            const actif = g.id === "toutes" ? !filtre?.categories : groupeActif?.id === g.id;
            return (
              <button
                key={g.id}
                aria-pressed={actif}
                onClick={() => {
                  setRecherche("");
                  actions.goWardrobePieces(g.categories ? { libelle: g.libelle, categories: g.categories, ...(filtre?.retour ? { retour: filtre.retour } : {}) } : filtre?.retour ? { libelle: "Toutes mes pièces", retour: filtre.retour } : undefined);
                }}
                className={`flex-none min-h-[40px] px-[14px] rounded-full text-[12.5px] cursor-pointer border whitespace-nowrap ${
                  actif ? "bg-ink text-cream border-ink" : "bg-card text-ink border-border"
                }`}
              >
                {g.libelle} <span className={actif ? "text-cream/70" : "text-muted"}>{g.nbPieces}</span>
              </button>
            );
          })}
        </div>
      )}

      {!selectionMode && parFiltre.length >= 9 && (
        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher une pièce"
          aria-label="Rechercher une pièce par son nom"
          className="mt-3 w-full min-h-[44px] rounded-full border border-border bg-card px-4 text-[13px] text-ink placeholder:text-placeholder outline-none focus:border-terracotta"
        />
      )}

      {filtre?.teinte && !selectionMode && (
        <div className="flex items-baseline justify-between gap-3 mt-[6px] text-[12px]">
          <span className="text-ink">{filtre.libelle}</span>
          <button onClick={() => actions.goWardrobePieces()} className="text-terracotta flex-shrink-0 cursor-pointer py-[13px] -my-[13px]">
            Tout afficher
          </button>
        </div>
      )}

      {items.length === 0 && terme ? (
        <EmptyState className="mt-3">Aucune pièce ne correspond à « {recherche.trim()} ».</EmptyState>
      ) : items.length === 0 && groupeActif ? (
        // CATÉGORIE VIDE (12/10/2026, resserré le jour même : « pas de grand CTA d'ajout ni d'illustration ») : un court message éditorial,
        // sans bouton ni encart. L'ajout passe par le bouton flottant, le même que sur le Dressing, toujours présent ; l'état disparaît dès
        // qu'une pièce entre dans la catégorie.
        <section className="mt-11 px-1" aria-label={`${groupeActif.libelle} : aucune pièce`}>
          <div className="t-titre-carte text-ink" style={{ textWrap: "balance" }}>
            {(VIDE_CATEGORIE[groupeActif.id] ?? VIDE_PAR_DEFAUT).titre}
          </div>
          <div className="text-[13px] text-muted-3 leading-[1.5] mt-[6px]">{(VIDE_CATEGORIE[groupeActif.id] ?? VIDE_PAR_DEFAUT).texte}</div>
        </section>
      ) : items.length === 0 ? (
        <EmptyState className="mt-3">Tes pièces apparaîtront ici au fur et à mesure que tu les ajoutes à ton dressing.</EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-x-[12px] gap-y-[22px] mt-4">
          {items.map((it) => {
            const count = counts.get(it.id) || 0;
            // it.worn (jamais null si déjà porté) reste la source de vérité
            // de "jamais porté" (correctif 25/08/2026, signalé en revue :
            // wearCounts seul pouvait afficher "Jamais porté" pour une pièce
            // dont worn est renseigné mais dont l'historique n'a pas (ou
            // plus) d'entrée correspondante — ex. fetchOutfitHistory revenu
            // vide sur un aléa réseau).
            const neverWorn = it.worn == null;
            const days = neverWorn ? null : daysSinceWorn(state.history, it.id);
            const isToday = days === 0;
            const selected = selection.has(it.id);
            return (
              <button
                key={it.id}
                onClick={() => {
                  if (appuiLongFait.current) {
                    appuiLongFait.current = false;
                    return;
                  }
                  if (selectionMode) basculer(it.id);
                  else actions.openItem(it.id, false);
                }}
                onPointerDown={(e) => commencerAppui(e, it.id)}
                onPointerMove={bougerAppui}
                onPointerUp={annulerAppui}
                onPointerCancel={annulerAppui}
                onPointerLeave={annulerAppui}
                // Le menu natif d'un appui long (enregistrer l'image…) ne doit pas s'ouvrir par-dessus la sélection.
                onContextMenu={(e) => e.preventDefault()}
                aria-pressed={selectionMode ? selected : undefined}
                className="text-left cursor-pointer select-none [-webkit-touch-callout:none]"
              >
                <div
                  className="relative w-full rounded-bloc border border-border overflow-hidden"
                  style={
                    it.photoUrl
                      ? { aspectRatio: "4/5", ...fondPhotoPiece(it.photoUrl, estPhotoDetouree(it.photoUrl)) }
                      : { aspectRatio: "4/5", background: it.hex, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.06)" }
                  }
                >
                  {selectionMode && (
                    <span
                      className="absolute top-[8px] left-[8px] w-[22px] h-[22px] rounded-full border flex items-center justify-center text-[12px]"
                      style={
                        selected
                          ? { background: "rgba(166,105,80,.95)", borderColor: "rgba(166,105,80,.95)", color: "var(--color-cream)" }
                          : { background: "rgba(243,238,229,.85)", borderColor: "rgba(29,26,22,.18)", color: "transparent" }
                      }
                    >
                      ✓
                    </span>
                  )}
                  {isToday && !selectionMode && (
                    <span
                      className="absolute top-[8px] right-[8px] text-[9px] tracking-[.04em] text-cream rounded-full px-[8px] py-[3px]"
                      style={{ background: "rgba(166,105,80,.92)" }}
                    >
                      Aujourd&apos;hui
                    </span>
                  )}
                </div>
                <div
                  className="text-[13px] text-ink mt-[8px] leading-[1.25] overflow-hidden text-ellipsis whitespace-nowrap"
                  style={selectionMode && !selected ? { opacity: 0.45 } : undefined}
                >
                  {it.name}
                </div>
                <div className="text-[11px] text-placeholder mt-[2px]">
                  {/* Accordé à la pièce (participePorte, 26/09/2026) : « Jamais portées » pour des bottines. */}
                  {neverWorn
                    ? "Jamais " + participePorte(it)
                    : count > 0
                      ? `${participePorteMaj(it)} ${count} fois`
                      : wornAgo(days).replace(/^Porté/, participePorteMaj(it))}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selectionMode && selection.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[480px] px-6 pb-[18px] pt-[14px] bg-gradient-to-t from-cream via-cream to-transparent">
          <Button variante="destructif"
            onClick={() => setConfirmOpen(true)}
          >
            Retirer {selection.size} {selection.size === 1 ? "pièce" : "pièces"}
          </Button>
        </div>
      )}

      <BottomSheet
        title={selection.size === 1 ? "Retirer cette pièce" : `Retirer ${selection.size} pièces`}
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
      >
        <div className="text-[13px] text-ink leading-[1.55]">
          {selection.size === 1 ? "Cette pièce quittera" : "Ces pièces quitteront"} ton dressing et{" "}
          {selection.size === 1 ? "ne sera plus proposée" : "ne seront plus proposées"} dans tes tenues. Ton historique
          reste intact. <span className="text-rust">Cette action est définitive.</span>
        </div>
        <Button variante="destructif" className="mt-[22px]"
          onClick={supprimer}
        >
          Retirer définitivement
        </Button>
        <button
          onClick={() => setConfirmOpen(false)}
          className="mt-[10px] w-full text-center text-[13px] text-muted py-[10px] cursor-pointer"
        >
          Annuler
        </button>
      </BottomSheet>
    </div>
    {!selectionMode && <BoutonAjoutFlottant onClick={ajouter} />}
    </>
  );
}
