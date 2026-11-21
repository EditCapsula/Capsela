"use client";

import { useState } from "react";
import { jourLocal } from "@/lib/outfitFeedback";
import { useCapsela } from "@/lib/store";
import BottomSheet from "@/components/BottomSheet";
import Button from "@/components/Button";
import Input from "@/components/Input";
import { afficherToast } from "@/components/ToastCapsela";
import { ajouterLookAValise, valisesAVenir } from "@/lib/lookEnValise";
import { periodeCourte } from "@/lib/rappelsValise";
import type { SavedLook } from "@/lib/types";

/**
 * LE MENU « ••• » D'UN LOOK, sur son détail (20/11/2026 : Renommer, Ajouter à une valise, Supprimer). Posé aussi sur les cartes de Mes
 * looks le 21/11/2026, puis retiré le même jour (arbitré : « je ne suis pas fan des ••• sur les looks ») : il reste au détail.
 * Les feuilles passent par BottomSheet, une seule à la fois (arbitré le 22/10/2026). Le parent ne garde que la feuille ouverte ;
 * `onSupprimer` dit ce que la suppression fait de l'écran (le détail se referme).
 */
export type FeuilleLook = null | "menu" | "renommer" | "valise" | "supprimer";

export function BoutonMenuLook({ onClick, nom, className = "" }: { onClick: () => void; nom?: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={nom ? `Plus d'actions pour le look ${nom}` : "Plus d'actions pour ce look"}
      className={"w-[34px] h-[34px] rounded-full bg-card border border-border flex items-center justify-center text-ink cursor-pointer " + className}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="5" cy="12" r="1.6" />
        <circle cx="12" cy="12" r="1.6" />
        <circle cx="19" cy="12" r="1.6" />
      </svg>
    </button>
  );
}

export function FeuillesLook({ look, feuille, setFeuille, onSupprimer }: { look: SavedLook; feuille: FeuilleLook; setFeuille: (f: FeuilleLook) => void; onSupprimer: () => void }) {
  const { state, actions } = useCapsela();
  const [nom, setNom] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const fermer = () => {
    setFeuille(null);
    setMessage(null);
  };

  /* RENOMMER (20/11/2026) : le nom change aussitôt ; refusé par le compte, il revient et la feuille le dit. Vide ou inchangé : rien. */
  const renommer = async () => {
    const ok = await actions.renommerLook(look.id, nom);
    if (ok) {
      fermer();
      afficherToast("Look renommé");
    } else setMessage("Le nouveau nom n'a pas pu être enregistré. Réessaie dans un instant.");
  };
  /* AJOUTER À UNE VALISE (20/11/2026, lookEnValise.ts) : les valises à venir ; le look s'y range comme un des siens. */
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
    <>
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
            onSupprimer();
          }}
          className="mt-5 w-full text-center border border-border text-rust rounded-full py-[13px] text-[13px] font-semibold cursor-pointer"
        >
          Supprimer ce look
        </button>
        <Button variante="secondaire" className="mt-[10px] !normal-case !tracking-[0.02em] !text-[15px]" onClick={fermer}>
          Annuler
        </Button>
      </BottomSheet>
    </>
  );
}
