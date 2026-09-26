"use client";

import { useRef, useState } from "react";
import BottomSheet from "@/components/BottomSheet";
import { consommerApresVideo, consommerGeneration, generationAutorisee, type QuotaGeneration } from "@/lib/generations";
import { GENERATIONS_GRATUITES_PAR_JOUR } from "@/lib/premium";
import { useCapsela } from "@/lib/store";
import { fournisseurVideo, peutProposerVideo } from "@/lib/videoRecompense";

/**
 * QUOTA DES TENUES ET SON GATE — sortis de TenuesScreen le 26/09/2026 pour
 * que « Pas pour moi » (accueil) décompte exactement comme « Autre tenue » :
 * même appel à la base, même feuille, même vidéo récompensée. Rien n'a
 * changé dans le comportement, seulement l'endroit où il vit.
 *
 * `demander(rejouer)` consomme une génération puis, si la base l'accorde,
 * rejoue le tirage fourni par l'écran ; sinon, ouvre la feuille. `feuille` est
 * à rendre une fois dans l'écran appelant.
 */
export function useQuotaTenues() {
  const { actions } = useCapsela();

  /**
   * LIMITE DE GÉNÉRATIONS — « Autre tenue », 2 par jour sans abonnement.
   *
   * Le décompte est fait par la base (`consommer_generation`, migration 0032),
   * jamais ici : un compteur côté navigateur se remet à zéro en vidant le
   * stockage, ce qui n'est pas une limite mais une gêne pour les seules
   * personnes honnêtes.
   *
   * SEULS « AUTRE TENUE » (écran Tenue) ET « PAS POUR MOI » (accueil, recette
   * du 26/09/2026 : un refus redemande une tenue, il compte comme une
   * alternative) DÉCOMPTENT. La tenue du jour, générée à l'ouverture, ne passe
   * pas par là et n'est donc jamais bloquée — quelqu'un qui ouvre l'app et
   * porte ce qu'on lui propose ne rencontre jamais cette limite.
   *
   * `generationAutorisee(null)` vaut true : tant que la migration 0032 n'est
   * pas exécutée, l'appel échoue et personne n'est limité. C'est ce qui rend
   * l'écran livrable avant la table.
   */
  const [quotaAtteint, setQuotaAtteint] = useState(false);
  const [tirageEnCours, setTirageEnCours] = useState(false);
  /** Dernier quota connu — sert à savoir si le bonus vidéo du jour est déjà pris. */
  const [dernierQuota, setDernierQuota] = useState<QuotaGeneration | null>(null);
  // La limite que la base a appliquée (2 + bonus vidéo), pas la constante
  // d'affichage : le Gate dit ce qui vient réellement de se passer.
  const limiteDuJour = dernierQuota?.limite ?? GENERATIONS_GRATUITES_PAR_JOUR;
  /**
   * LES TROIS TEMPS DE LA VIDÉO RÉCOMPENSÉE (maquette Premium Gates).
   * "propose" — la carte dans la feuille ; "lecture" — la vidéo tourne ;
   * "echec"   — elle n'a pas pu se charger, et on le dit UNE fois.
   */
  const [tempsVideo, setTempsVideo] = useState<"propose" | "lecture" | "echec">("propose");

  // Le tirage à rejouer une fois la génération accordée — fourni par l'écran
  // appelant, et gardé pour le cas où l'accord arrive après une vidéo.
  const rejouerRef = useRef<() => void>(() => {});

  const demander = async (rejouer: () => void) => {
    rejouerRef.current = rejouer;
    if (tirageEnCours) return;
    setTirageEnCours(true);
    try {
      const quota = await consommerGeneration();
      setDernierQuota(quota);
      if (!generationAutorisee(quota)) {
        setTempsVideo("propose");
        setQuotaAtteint(true);
        return;
      }
      rejouer();
    } finally {
      setTirageEnCours(false);
    }
  };

  /**
   * REGARDER UNE VIDÉO POUR UNE TENUE DE PLUS.
   *
   * L'app ne s'accorde rien : elle lance la vidéo, puis redemande son quota.
   * C'est le réseau publicitaire qui constate le visionnage et appelle notre
   * fonction Edge, laquelle seule peut accorder (migration 0033 —
   * `accorder_bonus_generation` est révoquée à `authenticated`).
   *
   * D'où `consommerApresVideo`, qui redemande quelques fois : la confirmation
   * du réseau peut arriver après la fin de la vidéo. Redemander est sans
   * danger, la base n'incrémente rien tant que le bonus n'est pas là.
   *
   * ÉCHEC SANS PERTE ET SANS BOUCLE : ni la tenue ni le quota ne bougent, le
   * message est affiché une fois, et aucun nouvel essai n'est relancé tout
   * seul — la maquette le demande explicitement.
   */
  const regarderVideo = async () => {
    const f = fournisseurVideo();
    if (!f || tempsVideo === "lecture") return;
    setTempsVideo("lecture");
    const issue = await f.montrer();
    if (issue !== "vue") {
      setTempsVideo("echec");
      return;
    }
    const quota = await consommerApresVideo();
    setDernierQuota(quota);
    if (!generationAutorisee(quota)) {
      setTempsVideo("echec");
      return;
    }
    setQuotaAtteint(false);
    setTempsVideo("propose");
    rejouerRef.current();
  };

  const videoProposable = peutProposerVideo(fournisseurVideo(), (dernierQuota?.bonus ?? 0) > 0);

  const feuille = (
    <>
        {/* LA LIMITE ATTEINTE — feuille du même composant que les occasions,
            comme la maquette Premium Gates le demande : « un seul composant, la
            bottom sheet déjà utilisée ».

            CE QUI MANQUE VOLONTAIREMENT PAR RAPPORT À LA MAQUETTE : la carte
            « Regarder une vidéo » pour débloquer un tirage. Aucun SDK
            publicitaire n'existe dans l'app, aucun fournisseur n'est choisi, et
            un bouton qui n'ouvre aucune vidéo est exactement le genre de
            promesse qu'on ne peut pas afficher. La maquette prévoit d'ailleurs
            elle-même ce cas — « si la vidéo du jour a déjà été utilisée, la carte
            disparaît : seul Premium reste proposé » : c'est cet état-là qui est
            rendu, en attendant qu'un fournisseur soit arbitré.

            Le compteur 2/2 est écrit à partir de la constante partagée avec
            l'écran Premium, pas recopié. */}
        <BottomSheet title="Tu as fait le tour pour aujourd'hui" open={quotaAtteint} onClose={() => setQuotaAtteint(false)}>
          <div className="flex flex-col">
            <div className="text-[13px] text-muted-3 leading-[1.5]" style={{ textWrap: "pretty" }}>
              Tu as utilisé tes {limiteDuJour} alternatives gratuites du jour. Ta tenue reste là,
              et de nouvelles propositions arrivent demain matin.
            </div>
            <div className="flex items-center gap-[10px] mt-4 bg-warm-bg rounded-[14px] px-[14px] py-3">
              <span className="t-surtitre text-terracotta">
                {limiteDuJour} / {limiteDuJour}
              </span>
              <span className="flex-1 min-w-0 text-[12px] text-muted-3 leading-[1.45]">
                Avec Premium, autant de tenues que tu veux.
              </span>
            </div>

            {/* LA CARTE VIDÉO N'EXISTE QUE SI UNE VIDÉO EXISTE.
                `peutProposerVideo` est faux tant qu'aucun fournisseur n'est
                enregistré — c'est-à-dire toujours, au 24/09/2026. Elle est donc
                invisible en production, et le restera jusqu'à ce qu'un SDK soit
                arbitré. Un bouton « Regarder une vidéo » qui n'ouvre aucune
                vidéo est exactement la promesse qu'on ne peut pas afficher.

                Elle disparaît aussi quand le bonus du jour est déjà pris : c'est
                ce que la maquette décrit — « seul Premium reste proposé ».

                Et elle disparaît APRÈS UN ÉCHEC. La maquette demande « pas de
                nouvel essai en boucle » ; laisser la carte sous le message
                d'échec reviendrait à inviter à retaper sur un fournisseur qui
                vient de ne pas répondre. Rouvrir la feuille la ramène — ce
                n'est pas une porte fermée, c'est une relance qui ne se fait pas
                toute seule. */}
            {videoProposable && tempsVideo === "propose" && (
              <button
                onClick={regarderVideo}
                className="w-full flex items-center gap-[11px] text-left mt-3 bg-card border border-border rounded-[16px] px-[14px] py-[13px] cursor-pointer"
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-medium text-ink">Regarder une vidéo</span>
                  <span className="block text-[11px] text-muted leading-[1.45] mt-[2px]">
                    Environ 30 secondes, une seule fois par jour.
                  </span>
                </span>
                <span className="flex-shrink-0 t-surtitre text-terracotta bg-warm-bg rounded-full px-[9px] py-[4px]">
                  +1 tenue
                </span>
              </button>
            )}

            {/* Deuxième temps. La feuille reste ouverte : revenir sur une feuille
                fermée puis rouverte ferait clignoter l'écran. */}
            {tempsVideo === "lecture" && (
              <div className="mt-3 bg-card border border-border rounded-[16px] px-[14px] py-[13px]" aria-live="polite">
                <div className="text-[13px] font-medium text-ink">Vidéo en cours…</div>
                <div className="text-[11px] text-muted leading-[1.45] mt-[2px]">
                  Encore quelques secondes avant ta nouvelle tenue.
                </div>
              </div>
            )}

            {/* Troisième temps, cas d'échec. Dit UNE fois, sans perte — la tenue
                et le quota sont intacts — et sans nouvel essai automatique. */}
            {tempsVideo === "echec" && (
              <div className="mt-3 bg-card border border-border rounded-[16px] px-[14px] py-[13px]" aria-live="polite">
                <div className="text-[12px] text-muted-3 leading-[1.45]">
                  La vidéo n&apos;a pas pu se charger. Rien n&apos;est perdu : ta tenue et tes tirages du jour sont
                  intacts.
                </div>
              </div>
            )}
            <button
              onClick={() => {
                setQuotaAtteint(false);
                actions.goPremium();
              }}
              className="w-full rounded-full bg-terracotta-deep text-cream t-bouton cursor-pointer mt-4"
              style={{ minHeight: 52 }}
            >
              Découvrir Premium
            </button>
            <button
              onClick={() => setQuotaAtteint(false)}
              className="w-full rounded-full text-[12px] text-muted-3 cursor-pointer mt-1"
              style={{ minHeight: 44 }}
            >
              Plus tard
            </button>
          </div>
        </BottomSheet>
    </>
  );

  return { demander, tirageEnCours, feuille };
}
