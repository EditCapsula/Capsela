"use client";

import { useState } from "react";
import { CATLABEL, OCC_LABELS, isBag } from "@/lib/data";
import { isCatalogId } from "@/lib/catalog";
import { resolveItemImage } from "@/lib/catalogImages";
import { styleDuLook, texteEditorialLook } from "@/lib/editorialLook";
import { clePieces, jourLocal } from "@/lib/outfitFeedback";
import { useCapsela } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";
import Badge from "@/components/Badge";
import BottomSheet from "@/components/BottomSheet";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Input from "@/components/Input";
import { afficherToast } from "@/components/ToastCapsela";
import { ajouterLookAValise, valisesAVenir } from "@/lib/lookEnValise";
import { periodeCourte } from "@/lib/rappelsValise";
import { FlatLayCapsela } from "@/components/FlatLayCapsela";
import { LIBELLE_SOURCE } from "@/components/CarteLook";
import { useOuvrirPiece } from "@/components/useOuvrirPiece";

/**
 * LE DÉTAIL D'UN LOOK (refonte du 20/11/2026, demandé : « une page plus premium que celle actuellement en ligne », maquette « Tenue du
 * 20/11 » à l'appui, avec les composants du design system et la DA Capsela).
 *
 * De haut en bas : le nom (bandeau), la source (« Look sauvegardé » ou « Look créé par toi », la même que la carte de Mes looks), le
 * nombre de pièces et l'occasion ; la planche du look (FlatLayCapsela, la seule règle de composition, docs/flat-lay.md) ; le texte
 * éditorial du look (texteEditorialLook, le même que l'accueil) et ses couleurs réelles ; la liste des pièces (chacune ouvre sa feuille,
 * useOuvrirPiece) ; « Porter aujourd'hui », puis « Planifier » (planifierComposition : Planifier, la tenue préremplie).
 *
 * Écarté de la maquette, faute d'action réelle derrière (aucune donnée ni bouton inventés) : « Ajouter à une valise » (une valise compose
 * ses looks elle-même) et « Créer une variante » ; « Vue liste » (la liste est la seule vue). La suppression passe dans le menu « ••• »
 * et se confirme dans une feuille (BottomSheet, arbitré le 22/10/2026) — elle était un bouton direct, sans confirmation.
 *
 * Pool de résolution stable (correctif du 20/08/2026, cf. HistoryScreen) : `[...state.items, ...vestiairePool]`, jamais wardrobePool —
 * une tenue enregistrée pendant l'exploration d'un autre style y référence des suggestions absentes de wardrobePool une fois revenue.
 */
export default function LookDetailScreen() {
  const { state, actions, vestiairePool } = useCapsela();
  const { profile } = useAuth();
  const ouvrirPiece = useOuvrirPiece();
  // UNE SEULE FEUILLE À LA FOIS (BottomSheet, arbitré le 22/10/2026) : le menu « ••• », puis l'action choisie.
  const [feuille, setFeuille] = useState<null | "menu" | "renommer" | "valise" | "supprimer">(null);
  const [nom, setNom] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const fermer = () => {
    setFeuille(null);
    setMessage(null);
  };
  const look = state.savedLooks.find((l) => l.id === state.activeLookId);
  if (!look) return null;

  const resolvePool = [...state.items, ...vestiairePool];
  const pieces = look.pieceIds
    .map((id) => resolvePool.find((i) => i.id === id))
    .filter((it): it is NonNullable<typeof it> => Boolean(it));
  const occasion = look.occasion && look.occasion !== "all" ? look.occasion : null;
  const texte = pieces.length ? texteEditorialLook(pieces, occasion ?? "all", state.workMode, state.dateContext, styleDuLook(pieces, profile.styles, profile.gender)) : null;
  // Les couleurs du look : celles de ses pièces, chacune une fois (jamais une palette inventée).
  const couleurs = pieces.filter((p, i) => pieces.findIndex((q) => q.hex.toLowerCase() === p.hex.toLowerCase()) === i).slice(0, 6);

  const menu = (
    <button
      type="button"
      onClick={() => setFeuille("menu")}
      aria-label="Plus d'actions pour ce look"
      className="w-[34px] h-[34px] rounded-full bg-card border border-border flex items-center justify-center text-ink cursor-pointer"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="5" cy="12" r="1.6" />
        <circle cx="12" cy="12" r="1.6" />
        <circle cx="19" cy="12" r="1.6" />
      </svg>
    </button>
  );

  /*
   * RENOMMER (20/11/2026, demandé) : le nom change aussitôt ; refusé par le compte, il revient et la feuille le dit. Vide ou inchangé :
   * rien n'est écrit.
   */
  const renommer = async () => {
    const ok = await actions.renommerLook(look.id, nom);
    if (ok) {
      fermer();
      afficherToast("Look renommé");
    } else setMessage("Le nouveau nom n'a pas pu être enregistré. Réessaie dans un instant.");
  };
  /* AJOUTER À UNE VALISE (20/11/2026, demandé, lookEnValise.ts) : les valises à venir ; le look s'y range comme un des siens. */
  const aVenir = valisesAVenir(state.valises, jourLocal());
  const ajouterA = (id: string) => {
    const v = state.valises.find((x) => x.id === id);
    if (!v) return;
    const r = ajouterLookAValise(v, look.pieceIds, look.occasion);
    if (!r.ok) {
      setMessage(
        r.raison === "deja"
          ? `Ce look est déjà dans ta valise pour ${v.destination}.`
          : `Ta valise pour ${v.destination} n'emporte que des pièces de ton dressing, et ce look contient des suggestions de ta capsule.`
      );
      return;
    }
    actions.sauverValise(r.valise);
    fermer();
    afficherToast(`Ajouté à ta valise pour ${v.destination}`, undefined, { libelle: "Voir", libelleComplet: "Voir la valise", ouvrir: () => void actions.ouvrirValise(id) });
  };
  const ligneMenu = "w-full flex items-center justify-between gap-3 py-[14px] border-b border-border text-left text-[14px] cursor-pointer";

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
      {/* Le nom du look dans le bandeau (13/11/2026, même règle que les autres écrans secondaires). */}
      <AppHeader onBack={actions.closeLookDetail} backLabel="Revenir à Mes looks" titre={look.name} point={false} action={menu} />

      <div className="mt-[10px] flex flex-wrap items-center gap-x-3 gap-y-2">
        <Badge tone="doux" icone={look.source === "saved" ? "✦" : undefined}>
          {LIBELLE_SOURCE[look.source]}
        </Badge>
        <span className="text-[12px] text-muted-3">
          {pieces.length} {pieces.length === 1 ? "pièce" : "pièces"}
          {occasion && <> · {OCC_LABELS[occasion]}</>}
        </span>
      </div>

      {pieces.length > 0 && (
        <Card rayon="bloc" className="mt-4 overflow-hidden">
          <div className="relative bg-warm-bg" style={{ height: "clamp(260px, 78vw, 340px)" }}>
            <div className="absolute inset-y-0 left-2 right-2">
              <FlatLayCapsela items={pieces} context="look-detail" layoutSeed={clePieces(pieces.map((p) => p.id)).join(",")} onPiece={ouvrirPiece} />
            </div>
          </div>
          {texte && (
            <div className="px-[16px] pt-[14px] pb-[16px]">
              <h2 className="font-serif text-[22px] leading-[1.15] text-ink">
                {texte.titre.a} {texte.titre.b && <em className="italic text-terracotta">{texte.titre.b}</em>}
              </h2>
              <p className="text-[13px] leading-[1.5] text-ink-soft mt-[6px]">{texte.phrase}</p>
              {couleurs.length > 1 && (
                <div className="flex items-center gap-[8px] mt-[12px]" aria-label={`Couleurs du look : ${couleurs.map((c) => c.color).join(", ")}`}>
                  {couleurs.map((c) => (
                    <span key={c.id} className="w-[22px] h-[22px] rounded-full" style={{ background: c.hex, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.08)" }} aria-hidden="true" />
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      <h2 className="t-titre-carte text-ink mt-6 mb-3">Les pièces du look</h2>
      <div className="flex flex-col gap-[10px]">
        {pieces.map((it) => {
          const img = resolveItemImage(it);
          // Une pièce suggérée (une tenue enregistrée peut en contenir, 23/08/2026) reste distincte d'une pièce possédée : photo atténuée
          // et pastille « Suggérée », comme partout ailleurs.
          const suggested = isCatalogId(it.id);
          return (
            <button
              type="button"
              key={it.id}
              onClick={() => ouvrirPiece(it)}
              className="text-left cursor-pointer active:opacity-80"
              aria-label={`${it.name}, ${CATLABEL[isBag(it) ? "sac" : it.cat]}, ${it.color}${suggested ? ", suggérée" : ""}`}
            >
              <Card rayon="bloc" className="flex items-center gap-[13px] p-[10px]">
                <div className="flex-shrink-0">
                  <div
                    className="w-[58px] h-[66px] rounded-mini overflow-hidden"
                    style={{
                      background: img.url ? "var(--color-photo-bg)" : it.hex,
                      boxShadow: img.url ? undefined : "inset 0 0 0 1px rgba(29,26,22,.06)",
                      filter: suggested ? "grayscale(55%) opacity(.8)" : undefined,
                    }}
                  >
                    {img.url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img loading="lazy" src={img.url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" }} />
                    )}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="t-titre-ligne text-ink truncate">{it.name}</div>
                  <div className="text-[12px] text-muted mt-[3px] truncate">
                    {CATLABEL[isBag(it) ? "sac" : it.cat]} · {it.color}
                  </div>
                  {/* Sous le nom, plus sur la vignette : posée dessus, la pastille débordait sur le nom (rendu du 20/11/2026). */}
                  {suggested && (
                    <Badge tone="plein" taille="s" className="mt-[6px]">
                      Suggérée
                    </Badge>
                  )}
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" className="flex-shrink-0 text-muted">
                  <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Card>
            </button>
          );
        })}
      </div>

      <Button variante="principal" className="mt-7 !normal-case !tracking-[0.02em] !text-[15px]" onClick={() => actions.wearLookToday(look.id)}>
        Porter aujourd&apos;hui
      </Button>
      <Button variante="secondaire" className="mt-[10px] !normal-case !tracking-[0.02em] !text-[15px]" onClick={() => actions.planifierComposition(look.pieceIds, false)}>
        Planifier
      </Button>
      <Button variante="secondaire" className="mt-[10px] !normal-case !tracking-[0.02em] !text-[15px]" onClick={() => setFeuille("valise")}>
        Ajouter à une valise
      </Button>

      <BottomSheet title="Ce look" open={feuille === "menu"} onClose={fermer}>
        <button type="button" className={ligneMenu + " text-ink"} onClick={() => (setNom(look.name), setFeuille("renommer"))}>
          Renommer <span aria-hidden="true" className="text-muted">›</span>
        </button>
        <button type="button" className={ligneMenu + " text-ink"} onClick={() => setFeuille("valise")}>
          Ajouter à une valise <span aria-hidden="true" className="text-muted">›</span>
        </button>
        <button type="button" className={ligneMenu + " text-rust border-b-0"} onClick={() => setFeuille("supprimer")}>
          Supprimer ce look
        </button>
      </BottomSheet>

      <BottomSheet title="Renommer ce look" open={feuille === "renommer"} onClose={fermer}>
        <Input value={nom} onChange={(e) => (setNom(e.target.value), setMessage(null))} maxLength={60} aria-label="Nom du look" autoFocus onKeyDown={(e) => e.key === "Enter" && void renommer()} />
        {message && <p role="alert" className="text-[12.5px] text-rust mt-3">{message}</p>}
        <Button variante="principal" className="mt-5 !normal-case !tracking-[0.02em] !text-[15px]" disabled={!nom.trim()} onClick={() => void renommer()}>
          Enregistrer
        </Button>
        <Button variante="secondaire" className="mt-[10px] !normal-case !tracking-[0.02em] !text-[15px]" onClick={fermer}>
          Annuler
        </Button>
      </BottomSheet>

      <BottomSheet title="Ajouter à une valise" open={feuille === "valise"} onClose={fermer}>
        {aVenir.length === 0 ? (
          <>
            <p className="text-[13px] leading-[1.5] text-ink-soft">Aucune valise à venir. Prépare-en une : tu pourras ensuite y ajouter ce look.</p>
            <Button variante="principal" className="mt-5 !normal-case !tracking-[0.02em] !text-[15px]" onClick={() => (fermer(), void actions.ouvrirValise(null))}>
              Préparer une valise
            </Button>
          </>
        ) : (
          <>
            <p className="text-[13px] leading-[1.5] text-ink-soft mb-2">Ses pièces rejoignent la valise, et le look s&apos;ajoute à ceux du séjour.</p>
            {aVenir.map((v) => (
              <button key={v.id} type="button" className={ligneMenu + " text-ink last:border-b-0"} onClick={() => ajouterA(v.id)}>
                <span className="min-w-0">
                  <span className="t-titre-ligne block truncate">{v.destination}</span>
                  <span className="block text-[12px] text-muted mt-[2px]">{periodeCourte(v.depart, v.retour)}</span>
                </span>
                <span aria-hidden="true" className="text-muted">›</span>
              </button>
            ))}
            {message && <p role="alert" className="text-[12.5px] text-rust mt-3">{message}</p>}
          </>
        )}
      </BottomSheet>

      <BottomSheet title="Supprimer ce look ?" open={feuille === "supprimer"} onClose={fermer}>
        <p className="text-[13px] leading-[1.5] text-ink-soft">
          « {look.name} » sera retiré de Mes looks. Les pièces de ton dressing n&apos;en sont pas retirées.
        </p>
        <button
          type="button"
          onClick={() => {
            fermer();
            actions.deleteActiveLook();
          }}
          className="mt-5 w-full text-center border border-border text-rust rounded-full py-[13px] text-[13px] font-semibold cursor-pointer"
        >
          Supprimer ce look
        </button>
        <Button variante="secondaire" className="mt-[10px] !normal-case !tracking-[0.02em] !text-[15px]" onClick={fermer}>
          Annuler
        </Button>
      </BottomSheet>
    </div>
  );
}
