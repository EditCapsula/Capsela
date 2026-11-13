"use client";

import { useState } from "react";
import BottomSheet from "@/components/BottomSheet";
import AppHeader from "@/components/AppHeader";
import Card from "@/components/Card";
import { useAuth } from "@/lib/auth";
import {
  FILTRES,
  LIBELLES_PERIODES,
  anciennete,
  filtrerNotifications,
  grouperParPeriode,
  type FiltreNotifications,
  type NotificationCapsela,
} from "@/lib/centreNotifications";
import { chargerNotificationsPlusAnciennes, marquerNotificationLue, toutMarquerLu, useNotifications } from "@/lib/notificationsStore";
import { useCapsela } from "@/lib/store";

/**
 * LE CENTRE DE NOTIFICATIONS (12/11/2026, brief « Implémentation du centre de notifications », lib/centreNotifications.ts).
 *
 * Ouvert par la cloche des pages majeures (AppHeader : Accueil, Dressing, Capsule, Planifier, Journal). En tête : le retour (vers l'écran d'où l'on vient), le titre centré, le menu « ••• »
 * (une feuille, le seul composant posé par-dessus l'écran — règle du 22/10/2026) avec « Tout marquer comme lu ». Dessous, quatre
 * filtres (Toutes, Actions, Conseils, Valise), puis les notifications par période : Aujourd'hui, Cette semaine, Plus anciennes.
 *
 * Toucher une notification la marque lue (la cloche se met à jour aussitôt, notificationsStore.ts) et ouvre l'écran qu'elle concerne,
 * par les actions existantes du store : son retour ramène ici. Une destination disparue (valise supprimée, pièce retirée) ouvre l'écran
 * qui la contenait plutôt que de mener dans le vide.
 *
 * Couleurs et typographie : uniquement les jetons et les niveaux de titre existants. Non lue : un point terracotta et le titre en ink ;
 * lue : le titre en ink adouci, sans point.
 */
export default function NotificationsScreen() {
  const { state, actions } = useCapsela();
  const { userId } = useAuth();
  const { liste, nonLues, chargement, compte, plusAnciennes } = useNotifications();
  const [filtre, setFiltre] = useState<FiltreNotifications>("toutes");
  const [menu, setMenu] = useState(false);
  const [suite, setSuite] = useState(false);
  const maintenant = new Date();
  const groupes = grouperParPeriode(filtrerNotifications(liste, filtre), maintenant);

  const ouvrir = (n: NotificationCapsela) => {
    if (!n.lue) marquerNotificationLue(n.cle);
    const [ecran, id] = (n.cible ?? "").split(":");
    switch (ecran) {
      case "valise": {
        const meta = n.meta as { depart?: string; destination?: string } | undefined;
        // L'identifiant d'une valise change en entrant dans le compte : retrouvée aussi par sa date et sa destination.
        const v = state.valises.find((x) => x.id === id) ?? state.valises.find((x) => meta && x.depart === meta.depart && x.destination === meta.destination);
        if (v) void actions.ouvrirValise(v.id);
        else actions.goPlanifier();
        return;
      }
      case "piece": {
        const pieceId = Number(id);
        if (state.items.some((p) => p.id === pieceId)) actions.openItem(pieceId, false);
        else actions.goWardrobe();
        return;
      }
      case "looks":
        return actions.goLooks();
      case "planifier":
        return actions.goPlanifier();
      case "profil":
        return actions.goProfile();
      default:
        return actions.goHome();
    }
  };

  const vide = !chargement && groupes.length === 0;

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
      {/* « Mes notifications. » dans le bandeau commun, le menu « ••• » à la place de l'avatar (13/11/2026, tableau validé). */}
      <AppHeader
        onBack={actions.quitterNotifications}
        backLabel="Revenir à l'écran précédent"
        titre={<>Mes <span className="italic">notifications</span></>}
        action={
        <button
          type="button"
          onClick={() => setMenu(true)}
          aria-label="Options des notifications"
          aria-haspopup="dialog"
          className="relative justify-self-end w-[34px] h-[34px] rounded-full bg-card border border-border text-ink flex items-center justify-center cursor-pointer before:absolute before:-inset-[5px] before:content-['']"
        >
          <span aria-hidden="true" className="text-[16px] leading-none tracking-[.04em]">
            •••
          </span>
        </button>
        }
      />

      {/* Quatre pastilles de même largeur, toujours sur la largeur de l'écran (13/11/2026) : à 320 px, la rangée défilait. */}
      <div role="tablist" aria-label="Catégories de notifications" className="grid grid-cols-4 gap-[6px] pt-[18px] pb-[6px]">
        {FILTRES.map((f) => {
          const actif = filtre === f.id;
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={actif}
              onClick={() => setFiltre(f.id)}
              className={
                "h-[40px] px-1 rounded-full border text-[12.5px] font-medium whitespace-nowrap cursor-pointer min-w-0 " +
                (actif ? "bg-terracotta-deep border-terracotta-deep text-on-terracotta" : "bg-card border-border text-ink")
              }
            >
              {f.libelle}
            </button>
          );
        })}
      </div>

      {/* Sans le compte (migration pas encore passée, réseau) : rien ne se perd, mais on le dit. Le mode démo n'a pas de compte. */}
      {userId && compte === "indisponible" && (
        <div className="mt-[12px] text-[12px] text-muted-3 leading-[1.45]" role="status">
          Tes notifications sont gardées sur cet appareil pour l&apos;instant ; elles rejoindront ton compte dès qu&apos;il sera joignable.
        </div>
      )}

      {chargement && liste.length === 0 && (
        <div className="mt-[28px] text-[13px] text-muted-3 text-center" role="status">
          Chargement de tes notifications…
        </div>
      )}

      {vide && (
        <div className="mt-[44px] px-4 text-center">
          <div className="t-titre-carte text-ink">{filtre === "toutes" ? "Aucune notification" : `Aucune notification ${FILTRES.find((f) => f.id === filtre)!.libelle.toLowerCase()}`}</div>
          <div className="t-chapeau text-muted-3 mt-[6px]" style={{ textWrap: "pretty" }}>
            {filtre === "valise"
              ? "Un départ dans les sept jours apparaîtra ici, avec l'état de ta valise."
              : filtre === "conseils"
                ? "Les conseils de Capsela sur tes tenues planifiées et ton profil apparaîtront ici."
                : "Tes pièces ajoutées, looks sauvegardés et tenues mises à jour apparaîtront ici."}
          </div>
        </div>
      )}

      {groupes.map((g) => (
        <section key={g.periode} aria-label={LIBELLES_PERIODES[g.periode]} className="mt-[22px]">
          <h2 className="t-surtitre text-muted mb-[10px]">{LIBELLES_PERIODES[g.periode]}</h2>
          <Card className="overflow-hidden">
            <ul>
            {g.notifications.map((n) => (
              <li key={n.cle} className="border-b border-divider last:border-b-0">
                <button type="button" onClick={() => ouvrir(n)} className="w-full flex items-start gap-3 px-4 py-[14px] text-left cursor-pointer active:bg-warm-bg" style={{ minHeight: 64 }}>
                  <span aria-hidden="true" className="w-9 h-9 flex-shrink-0 rounded-full bg-warm-bg text-terracotta-deep flex items-center justify-center">
                    {ICONES[n.categorie === "valise" ? "valise" : n.type === "alerte_meteo" ? "meteo" : n.type === "profil_a_completer" ? "profil" : n.type === "look_sauvegarde" ? "look" : n.type === "piece_remplacee_plan" ? "remplacement" : "cintre"]}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className={"t-titre-vignette min-w-0 " + (n.lue ? "text-ink-soft" : "text-ink")}>{n.titre}</span>
                      <span className="flex-shrink-0 text-[11px] text-muted-3">{anciennete(n.creeeLe, maintenant)}</span>
                    </span>
                    <span className="block text-[12.5px] text-muted-3 leading-[1.45] mt-[3px]" style={{ textWrap: "pretty" }}>
                      {n.message}
                    </span>
                  </span>
                  <span className="w-[8px] flex-shrink-0 self-center flex justify-center">
                    {!n.lue && <span className="w-[7px] h-[7px] rounded-full bg-terracotta" />}
                    <span className="sr-only">{n.lue ? "Lue" : "Non lue"}</span>
                  </span>
                </button>
              </li>
            ))}
            </ul>
          </Card>
        </section>
      ))}

      {plusAnciennes && filtre === "toutes" && (
        <button
          type="button"
          disabled={suite}
          onClick={async () => {
            setSuite(true);
            await chargerNotificationsPlusAnciennes();
            setSuite(false);
          }}
          className="mt-[18px] w-full min-h-[44px] text-[13px] font-semibold text-terracotta-deep cursor-pointer disabled:opacity-60"
        >
          {suite ? "Chargement…" : "Afficher les plus anciennes"}
        </button>
      )}

      <BottomSheet title="Notifications" open={menu} onClose={() => setMenu(false)}>
        <button
          type="button"
          disabled={nonLues === 0}
          onClick={() => {
            toutMarquerLu();
            setMenu(false);
          }}
          className="w-full text-left px-1 py-[14px] text-[13px] text-ink cursor-pointer disabled:text-muted-3 disabled:cursor-default"
          style={{ minHeight: 52 }}
        >
          {nonLues === 0 ? "Tout est déjà lu" : "Tout marquer comme lu"}
        </button>
      </BottomSheet>
    </div>
  );
}

const trait = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const ICONES: Record<"cintre" | "look" | "remplacement" | "valise" | "meteo" | "profil", React.ReactNode> = {
  cintre: (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M12 3.2a1.9 1.9 0 00-.6 3.7v1.1L4.6 12.9a1.4 1.4 0 00.8 2.55h13.2a1.4 1.4 0 00.8-2.55L12.6 8V6.9A1.9 1.9 0 0012 3.2z" {...trait} />
      <path d="M4.8 18.6h14.4" {...trait} />
    </svg>
  ),
  look: (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" {...trait} />
    </svg>
  ),
  remplacement: (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M5 9h12l-3-3M19 15H7l3 3" {...trait} />
    </svg>
  ),
  valise: (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <rect x="3" y="7.5" width="18" height="13" rx="2.5" {...trait} />
      <path d="M9 7.5V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2.5M9.5 11.5v5M14.5 11.5v5" {...trait} />
    </svg>
  ),
  meteo: (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M7 17.5h10a3.5 3.5 0 000-7 5 5 0 00-9.6-1.3A4 4 0 007 17.5z" {...trait} />
    </svg>
  ),
  profil: (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M10 4l1.4 4.6L16 10l-4.6 1.4L10 16l-1.4-4.6L4 10l4.6-1.4L10 4zM17.5 14l.7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3z" {...trait} />
    </svg>
  ),
};
