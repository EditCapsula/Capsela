"use client";

import { useRef, useState } from "react";
import BottomSheet from "@/components/BottomSheet";
import { consommerApresVideo, consommerGeneration, generationAutorisee, type QuotaGeneration } from "@/lib/generations";
import { GENERATIONS_GRATUITES_PAR_JOUR } from "@/lib/premium";
import { useCapsela } from "@/lib/store";
import { fournisseurVideo, peutProposerVideo } from "@/lib/videoRecompense";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import { I_COURONNE, Icone } from "@/components/ProfilUI";

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
   *
   * Depuis le 05/11/2026 (signalé : deux vidéos regardées jusqu'au bout, deux fois « La vidéo n'a pas pu se charger »), l'échec dit
   * CE QUI s'est passé : "interrompue" (fermée avant la fin), "verification" (vue en entier, l'app attend la confirmation de Google),
   * "nonConfirmee" (vue en entier, la confirmation n'est pas arrivée à temps). Le même message couvrait les trois.
   */
  const [tempsVideo, setTempsVideo] = useState<"propose" | "lecture" | "verification" | "echec" | "interrompue" | "nonConfirmee">("propose");
  /**
   * Une vidéo VUE EN ENTIER dans cette session : la carte ne revient pas. Le bonus est d'une vidéo par jour ; sans ce drapeau, une
   * confirmation en retard laissait la carte réapparaître, et l'on regardait une seconde vidéo pour rien (05/11/2026).
   */
  const [videoVue, setVideoVue] = useState(false);

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
      setTempsVideo(issue === "abandonnee" ? "interrompue" : "echec");
      return;
    }
    setVideoVue(true);
    setTempsVideo("verification");
    // Google confirme le visionnage à notre serveur (vérification côté serveur), et cet appel peut prendre plusieurs secondes : 10 essais
    // espacés de 2 s, au lieu de 4 de 0,9 s (05/11/2026).
    const quota = await consommerApresVideo(10, 2000);
    setDernierQuota(quota);
    if (!generationAutorisee(quota)) {
      setTempsVideo("nonConfirmee");
      return;
    }
    setQuotaAtteint(false);
    setTempsVideo("propose");
    rejouerRef.current();
  };

  const videoProposable = !videoVue && peutProposerVideo(fournisseurVideo(), (dernierQuota?.bonus ?? 0) > 0);
  /** Un fournisseur existe (Android) et le bonus du jour reste à prendre, mais sa vidéo n'est pas encore chargée : on le dit. */
  const videoEnAttente = !videoVue && !videoProposable && fournisseurVideo() !== null && (dernierQuota?.bonus ?? 0) === 0;

  const feuille = (
    <>
        {/* LA LIMITE ATTEINTE — feuille du même composant que les occasions,
            comme la maquette Premium Gates le demande : « un seul composant, la
            bottom sheet déjà utilisée ».

            LA CARTE « Regarder une vidéo » : AdMob depuis le 02/11/2026
            (publicite.ts), sur Android seulement. Sans fournisseur (web, iOS,
            consentement refusé, aucune vidéo chargée), elle n'apparaît pas : un
            bouton qui n'ouvre aucune vidéo est une promesse qu'on ne peut pas
            afficher. La maquette prévoit ce cas — « si la vidéo du jour a déjà
            été utilisée, la carte disparaît : seul Premium reste proposé ».

            Le compteur 2/2 est écrit à partir de la constante partagée avec
            l'écran Premium, pas recopié. */}
        {/* LA FEUILLE DE FIN DE QUOTA (06/11/2026, brief « Écran de limite des alternatives quotidiennes ») : le message, le compteur
            RÉEL (celui que la base vient de rendre), la vidéo récompensée (Android seulement, arbitré le même jour : « on garde la pub que
            dans l'application google »), puis Premium, plus valorisé, et « Plus tard ». La mécanique ne change pas : la vidéo passe par
            le fournisseur AdMob, la tenue n'est accordée que par la base après la confirmation de Google (vérification serveur). */}
        <BottomSheet title="C'est tout pour aujourd'hui" open={quotaAtteint} onClose={() => setQuotaAtteint(false)}>
          <div className="flex flex-col">
            <div className="t-chapeau text-muted-3" style={{ textWrap: "pretty" }}>
              Tu as découvert tes {limiteDuJour} alternatives gratuites du jour. Ta tenue reste disponible et de nouvelles propositions
              arrivent demain matin.
            </div>
            <div className="flex items-center gap-3 mt-4 bg-warm-bg rounded-tuile px-4 py-3">
              <span className="text-[15px] font-semibold text-terracotta tabular-nums flex-shrink-0">
                {dernierQuota?.utilisees ?? limiteDuJour} / {limiteDuJour}
              </span>
              <span aria-hidden="true" className="w-px self-stretch bg-border" />
              <span className="flex-1 min-w-0 text-[12.5px] text-muted leading-[1.45]">Tes alternatives du jour</span>
            </div>

            {/* LA VIDÉO. Elle n'existe que là où un fournisseur existe (Android, compte gratuit, consentement) ; ailleurs, aucune carte.
                Prête : la carte se touche. Pas encore chargée : elle le dit, sans bouton qui n'aboutirait pas. Déjà vue aujourd'hui (bonus
                pris ou vue dans la session) : elle disparaît, seul Premium reste. */}
            {videoProposable && tempsVideo === "propose" && (
              <button
                onClick={regarderVideo}
                className="w-full flex items-center gap-3 text-left mt-3 bg-card border border-border rounded-tuile px-4 py-[14px] cursor-pointer active:opacity-80"
              >
                <span className="w-11 h-11 flex-shrink-0 rounded-full bg-warm-bg text-terracotta-deep flex items-center justify-center" aria-hidden="true">
                  <IconeVideo />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block t-surtitre text-terracotta">Envie d&apos;une tenue supplémentaire ?</span>
                  <span className="flex items-center gap-2 mt-[4px]">
                    <span className="t-titre-ligne text-ink">Regarder une vidéo</span>
                    <Badge tone="doux">Gratuit</Badge>
                  </span>
                  <span className="block text-[12.5px] text-muted leading-[1.45] mt-[2px]">Débloque 1 nouvelle tenue dès maintenant.</span>
                </span>
                <span aria-hidden="true" className="text-placeholder text-[15px] flex-shrink-0">›</span>
              </button>
            )}
            {videoEnAttente && tempsVideo === "propose" && (
              <Card rayon="tuile" className="mt-3 px-4 py-[14px]" aria-live="polite">
                <div className="t-titre-ligne text-ink">Aucune vidéo disponible pour le moment</div>
                <div className="text-[12.5px] text-muted leading-[1.45] mt-[2px]">Rouvre cette fenêtre dans quelques instants pour en regarder une.</div>
              </Card>
            )}

            {/* Deuxième temps. La feuille reste ouverte : revenir sur une feuille
                fermée puis rouverte ferait clignoter l'écran. */}
            {tempsVideo === "lecture" && (
              <Card rayon="tuile" className="mt-3 px-4 py-[14px]" aria-live="polite">
                <div className="t-titre-ligne text-ink">Vidéo en cours…</div>
                <div className="text-[12.5px] text-muted leading-[1.45] mt-[2px]">
                  Encore quelques secondes avant ta nouvelle tenue.
                </div>
              </Card>
            )}

            {/* Troisième temps, cas d'échec. Dit UNE fois, sans perte — la tenue
                et le quota sont intacts — et sans nouvel essai automatique. */}
            {tempsVideo === "verification" && (
              <Card rayon="tuile" className="mt-3 px-4 py-[14px]" aria-live="polite">
                <div className="t-titre-ligne text-ink">Vérification de la vidéo…</div>
                <div className="text-[12.5px] text-muted leading-[1.45] mt-[2px]">
                  Google confirme le visionnage, cela peut prendre quelques secondes.
                </div>
              </Card>
            )}
            {(tempsVideo === "echec" || tempsVideo === "interrompue" || tempsVideo === "nonConfirmee") && (
              <Card rayon="tuile" className="mt-3 px-4 py-[14px]" aria-live="polite">
                <div className="text-[12.5px] text-muted leading-[1.45]">
                  {tempsVideo === "echec" && "La vidéo n'a pas pu se charger. Rien n'est perdu : ta tenue et tes tirages du jour sont intacts."}
                  {tempsVideo === "interrompue" &&
                    "La vidéo s'est arrêtée avant la fin, la tenue de plus n'est donc pas accordée. Ta tenue et tes tirages du jour sont intacts."}
                  {tempsVideo === "nonConfirmee" &&
                    "Ta vidéo a bien été vue, mais Google n'a pas encore confirmé le visionnage. Dès que la confirmation arrive, ta tenue de plus est disponible depuis « Autre tenue »."}
                </div>
              </Card>
            )}

            {/* PREMIUM, plus valorisé que la vidéo : son encart sur fond beige et le bouton principal. */}
            <div className="mt-3 bg-warm-bg rounded-tuile px-4 py-[14px]">
              <div className="flex items-center gap-3">
                {/* La couronne de Premium, la même que « Mon abonnement » (ProfilUI, I_COURONNE). */}
                <span className="w-11 h-11 flex-shrink-0 rounded-full bg-card text-terracotta-deep flex items-center justify-center" aria-hidden="true">
                  <Icone taille={20}>{I_COURONNE}</Icone>
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block t-surtitre text-terracotta">Envie de plus de liberté ?</span>
                  <span className="block t-titre-ligne text-ink mt-[4px]">Passer à Premium</span>
                  <span className="block text-[12.5px] text-muted leading-[1.45] mt-[2px]">Explore autant de tenues que tu le souhaites.</span>
                </span>
              </div>
              <Button
                variante="principal"
                className="mt-[14px]"
                onClick={() => {
                  setQuotaAtteint(false);
                  actions.goPremium();
                }}
              >
                Découvrir Premium
              </Button>
            </div>
            <button
              onClick={() => setQuotaAtteint(false)}
              className="w-full rounded-full text-[13px] text-muted cursor-pointer mt-2"
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

/** Une vidéo : un écran et le triangle de lecture, au trait. */
function IconeVideo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M10.5 9.5v5l4-2.5-4-2.5z" />
    </svg>
  );
}
