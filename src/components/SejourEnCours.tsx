"use client";

import { t, tn } from "@/lib/langue";
import { periodeCourte } from "@/lib/rappelsValise";
import { useCapsela } from "@/lib/store";
import type { SejourEnCours as Sejour } from "@/lib/valiseDuJour";

/*
 * « TON SÉJOUR EN COURS » (17/11/2026, brief « Widget Séjour en cours »). Remplace, sur l'accueil, la ligne « Ta valise · La journée »
 * pendant un séjour. Données de la valise elle-même (sejourEnCours, valiseDuJour.ts) : destination, dates, jour du séjour, tenues
 * préparées. Toute la carte ouvre CETTE valise (son identifiant, ouvrirValise).
 *
 * LA MÊME CARTE QUE « PROCHAIN DÉPART » (arbitré le même jour, maquette fournie : « afin de conserver une cohérence avec le bloc
 * Prochain départ » — une première version, plus éditoriale, avec aperçu des pièces et titre serif, n'a pas été retenue). Même fond,
 * filet, rayon et hauteur que CarteProchainDepart (RappelValise.tsx) : l'icône dans sa pastille (un avion au lieu de la valise), le
 * surtitre de la même couleur que « Prochain départ » (demandé, contrairement à la maquette qui le mettait en terracotta), la destination et ses dates, les tenues préparées et une barre — ici l'avancée du séjour (jour X sur Y) —,
 * puis la pastille « Jour X/Y » et la flèche. Une valise sans look n'affiche pas de nombre de tenues.
 */
export function SejourEnCours({ sejour, className = "" }: { sejour: Sejour; className?: string }) {
  const { actions } = useCapsela();
  const { valise, jour, total, tenues } = sejour;
  const dates = periodeCourte(valise.depart, valise.retour);
  const tenuesTexte = tenues > 0 ? tn(tenues, "{n} tenue préparée", "{n} tenues préparées") : null;
  const avancee = Math.round((100 * jour) / Math.max(1, total));
  const badge = t("Jour {jour}/{total}", { jour: String(jour), total: String(total) });
  return (
    <button
      type="button"
      onClick={() => void actions.ouvrirValise(valise.id)}
      aria-label={t("Ton séjour en cours : {destination}, {dates}, jour {jour} sur {total}{tenues}. Voir ma valise", {
        destination: valise.destination,
        dates,
        jour: String(jour),
        total: String(total),
        tenues: tenuesTexte ? `, ${tenuesTexte}` : "",
      })}
      className={"w-full flex items-center gap-3 rounded-carte bg-card border border-border px-4 py-[11px] text-left cursor-pointer active:opacity-80 " + className}
    >
      <span aria-hidden="true" className="w-11 h-11 flex-shrink-0 rounded-full bg-warm-bg text-terracotta-deep flex items-center justify-center">
        <IconeAvion />
      </span>
      <span aria-hidden="true" className="flex-1 min-w-0">
        {/* Sous 360 px, le surtitre s'efface, comme celui de « Prochain départ » : l'icône et « Jour X/Y » disent déjà le séjour. */}
        <span className="block t-surtitre text-muted max-[359px]:hidden">{t("Ton séjour en cours")}</span>
        <span className="block mt-[2px] max-[359px]:mt-0 truncate">
          <span className="t-titre-ligne text-ink">{valise.destination}</span>
          <span className="text-[12.5px] text-muted"> · {dates}</span>
        </span>
        {tenuesTexte && (
          <span className="flex items-center gap-[10px] mt-[6px]">
            <span className="flex-shrink-0 min-w-[106px] max-[359px]:flex-shrink max-[359px]:min-w-0 max-[359px]:truncate text-[12px] text-muted-3 whitespace-nowrap">
              {/* Sous 360 px, « 2 tenues » : « tenues préparées » y était tronqué (mesuré à 320 px). */}
              <span className="max-[359px]:hidden">{tenuesTexte}</span>
              <span className="hidden max-[359px]:inline">{tn(tenues, "{n} tenue", "{n} tenues")}</span>
            </span>
            {/* Sous 360 px, la barre s'efface : mesurée à 320 px, elle passait sous la pastille « Jour X/Y ». */}
            <span className="flex-1 min-w-[40px] h-[5px] rounded-full bg-warm-bg overflow-hidden max-[359px]:hidden">
              <span className="block h-full rounded-full bg-terracotta" style={{ width: `${avancee}%` }} />
            </span>
          </span>
        )}
      </span>
      <span aria-hidden="true" className="flex-shrink-0 self-center flex items-center gap-[4px]">
        <span className="rounded-full bg-warm-bg text-terracotta text-[11.5px] font-semibold px-[9px] py-[3px] whitespace-nowrap">{badge}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" className="text-muted-3">
          <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}

/** Un avion au trait, dans le style des icônes de l'app (IconeValise). */
function IconeAvion({ taille = 20 }: { taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
    </svg>
  );
}
