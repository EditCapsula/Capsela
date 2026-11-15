/**
 * PUBLICITÉ — le fournisseur de la vidéo récompensée : Google AdMob (arbitré le 02/11/2026).
 *
 * Arbitrages de la propriétaire, 02/11/2026 :
 * - un seul format, la VIDÉO RÉCOMPENSÉE déjà montée (`videoRecompense.ts`) : une vidéo que l'on CHOISIT de regarder
 *   pour une tenue de plus, jamais une publicité imposée (ni bannière, ni interstitiel) ;
 * - réseau : Google AdMob, par le plugin `@capacitor-community/admob` ;
 * - publicités personnalisées AVEC consentement : le formulaire de Google (UMP, certifié pour le RGPD) est présenté
 *   avant toute demande de publicité ; en cas de refus, AdMob ne sert que des publicités non personnalisées, ou aucune.
 *
 * ANDROID SEULEMENT. Sur le web, AdMob n'existe pas ; sur iOS, l'app n'est pas encore publiée et la demande de suivi
 * d'Apple (ATT) n'est pas écrite. Ailleurs qu'Android, rien ne se charge, aucun fournisseur n'est enregistré, et la
 * carte « Regarder une vidéo » n'existe pas (`peutProposerVideo`).
 *
 * L'APP N'ACCORDE TOUJOURS RIEN. Elle passe l'identifiant du compte à AdMob (vérification côté serveur, « SSV ») :
 * c'est AdMob qui, la vidéo vue jusqu'au bout, appelle la fonction Edge `video-recompense`, qui vérifie la signature
 * de Google puis accorde le bonus. Sans compte connecté, il n'y a donc rien à charger.
 *
 * Premium : pas de publicité chargée. Premium n'a pas de limite de tenues, la feuille qui propose la vidéo ne s'ouvre
 * jamais ; charger une vidéo serait une demande de publicité pour rien.
 */

import { Capacitor } from "@capacitor/core";
import { enregistrerFournisseurVideo, type FournisseurVideo, type IssueVideo } from "./videoRecompense";

/**
 * Le bloc d'annonces de TEST publié par Google pour les vidéos récompensées. Il sert tant que le vrai bloc n'est pas
 * renseigné (`NEXT_PUBLIC_ADMOB_RECOMPENSE_ID`, posé au moment de la construction Android) : des vidéos marquées
 * « Test Ad », jamais rémunérées, et sans risque pour le compte AdMob — cliquer sur ses propres vraies publicités
 * peut le faire suspendre.
 */
export const BLOC_RECOMPENSE_TEST = "ca-app-pub-3940256099942544/5224354917";

/** Le bloc à utiliser, et s'il s'agit du bloc de test. Un identifiant qui n'a pas la forme d'AdMob est ignoré. */
export function blocRecompense(valeur: string | undefined): { id: string; test: boolean } {
  const v = (valeur ?? "").trim();
  if (/^ca-app-pub-\d{16}\/\d{10}$/.test(v) && v !== BLOC_RECOMPENSE_TEST) return { id: v, test: false };
  return { id: BLOC_RECOMPENSE_TEST, test: true };
}

/**
 * Faut-il proposer « Choix publicitaires » dans « Gérer mon compte » ? Le RGPD veut qu'un consentement se retire aussi
 * simplement qu'il se donne : Google le dit par `privacyOptionsRequirementStatus` (REQUIRED dans l'Espace économique
 * européen et au Royaume-Uni). Hors de ces pays, ou hors d'Android, la ligne n'existe pas.
 */
let optionsRequises = false;
const abonnes = new Set<() => void>();

export function choixPublicitairesDisponibles(): boolean {
  return optionsRequises;
}

export function suivreChoixPublicitaires(f: () => void): () => void {
  abonnes.add(f);
  return () => abonnes.delete(f);
}

function poserOptionsRequises(v: boolean) {
  if (v === optionsRequises) return;
  optionsRequises = v;
  abonnes.forEach((f) => f());
}

/**
 * L'ÉTAT DE LA PUBLICITÉ, LISIBLE DANS RÉGLAGES (14/11/2026, signalé : « je n'ai toujours pas les publicités AdMob », accord pour
 * un diagnostic comme celui des notifications). La carte « Regarder une vidéo » n'apparaît qu'avec une vidéo DÉJÀ chargée : sans
 * elle, rien ne disait si Google n'en servait pas, si le consentement manquait ou si l'app n'avait pas démarré la publicité. Chaque
 * étape de `demarrerPublicite` et de chaque chargement pose ici où elle en est, avec la réponse de Google (code ou message).
 */
export type EtapePublicite = "nonDemarree" | "consentementRefuse" | "chargement" | "prete" | "aucuneVideo" | "echec";
export interface EtatPublicite {
  etape: EtapePublicite;
  /** Le bloc de test de Google est utilisé (identifiant réel absent de la construction). */
  test: boolean;
  /** La réponse de Google ou du téléphone, telle quelle, pour « aucuneVideo » et « echec ». */
  detail: string | null;
}
let etat: EtatPublicite = { etape: "nonDemarree", test: false, detail: null };
const abonnesEtat = new Set<() => void>();
export const etatPublicite = (): EtatPublicite => etat;
export function suivreEtatPublicite(f: () => void): () => void {
  abonnesEtat.add(f);
  return () => abonnesEtat.delete(f);
}
function poserEtat(e: Partial<EtatPublicite>) {
  etat = { ...etat, ...e };
  abonnesEtat.forEach((f) => f());
}
function texteErreur(e: unknown): string {
  const err = e as { code?: unknown; message?: unknown } | null;
  const code = typeof err?.code === "string" || typeof err?.code === "number" ? String(err.code) : "";
  const message = typeof err?.message === "string" ? err.message : String(e);
  return code && !message.includes(code) ? `${code} · ${message}` : message;
}
/** Relance le chargement d'une vidéo (bouton « Réessayer » de Réglages) ; sans effet tant que la publicité n'a pas démarré. */
let rechargerVideo: (() => void) | null = null;
export const reessayerVideo = (): void => rechargerVideo?.();

type ModuleAdMob = typeof import("@capacitor-community/admob");

/** Le compte pour lequel la publicité a été démarrée : une seule fois par compte et par lancement. */
let demarreePour: string | null = null;

export function publiciteDisponibleIci(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

/**
 * Démarre la publicité pour un compte connecté, non Premium : consentement, initialisation, première vidéo chargée.
 * Ne jette jamais : un échec laisse simplement la carte vidéo absente, ce qui est l'état d'avant AdMob.
 */
export async function demarrerPublicite(userId: string): Promise<void> {
  if (!publiciteDisponibleIci() || demarreePour === userId) return;
  demarreePour = userId;
  try {
    const m: ModuleAdMob = await import("@capacitor-community/admob");
    const { AdMob, AdmobConsentStatus, MaxAdContentRating } = m;

    // 1. LE CONSENTEMENT, AVANT TOUTE DEMANDE DE PUBLICITÉ. Google ne présente le formulaire que là où il est exigé,
    // et une seule fois : les lancements suivants relisent le choix enregistré.
    let info = await AdMob.requestConsentInfo();
    if (info.isConsentFormAvailable && info.status === AdmobConsentStatus.REQUIRED) {
      info = await AdMob.showConsentForm();
    }
    // L'énumération n'est pas exportée par le plugin (8.2.1) : sa valeur est la chaîne « REQUIRED ».
    poserOptionsRequises(String(info.privacyOptionsRequirementStatus) === "REQUIRED");
    if (!info.canRequestAds) {
      poserEtat({ etape: "consentementRefuse", detail: null });
      return;
    }

    // 2. L'INITIALISATION. Capsela est ouverte dès 15 ans (`ageMinimum.ts`) : contenu publicitaire « Teen » au plus.
    const bloc = blocRecompense(process.env.NEXT_PUBLIC_ADMOB_RECOMPENSE_ID);
    poserEtat({ etape: "chargement", test: bloc.test, detail: null });
    await AdMob.initialize({ initializeForTesting: bloc.test, maxAdContentRating: MaxAdContentRating.Teen });

    // 3. LE FOURNISSEUR. Il ne se dit prêt qu'avec une vidéo DÉJÀ chargée : une vidéo qu'on attend se lit comme une panne.
    enregistrerFournisseurVideo(creerFournisseurAdMob(m, bloc, userId));
  } catch (e) {
    console.warn("[publicite] démarrage impossible", e);
    demarreePour = null;
    poserEtat({ etape: "echec", detail: texteErreur(e) });
  }
}

/** Le compte se déconnecte : plus de vidéo, la prochaine connexion redémarre tout. */
export function arreterPublicite(): void {
  demarreePour = null;
  enregistrerFournisseurVideo(null);
  rechargerVideo = null;
  poserEtat({ etape: "nonDemarree", detail: null });
}

/** Rouvre le formulaire de Google pour changer son choix (ligne « Choix publicitaires » de « Gérer mon compte »). */
export async function ouvrirChoixPublicitaires(): Promise<void> {
  if (!publiciteDisponibleIci()) return;
  try {
    const { AdMob } = await import("@capacitor-community/admob");
    await AdMob.showPrivacyOptionsForm();
  } catch (e) {
    console.warn("[publicite] formulaire de choix indisponible", e);
  }
}

function creerFournisseurAdMob(m: ModuleAdMob, bloc: { id: string; test: boolean }, userId: string): FournisseurVideo {
  const { AdMob, RewardAdPluginEvents } = m;
  let prete = false;
  let chargement = false;

  const charger = async () => {
    if (prete || chargement) return;
    chargement = true;
    poserEtat({ etape: "chargement", detail: null });
    try {
      // `ssv.userId` revient tel quel dans l'appel d'AdMob à `video-recompense` : c'est lui qui désigne le compte à créditer.
      await AdMob.prepareRewardVideoAd({ adId: bloc.id, isTesting: bloc.test, ssv: { userId } });
      prete = true;
      poserEtat({ etape: "prete", detail: null });
    } catch (e) {
      // Pas de vidéo disponible (aucune annonce à servir, réseau absent) : la carte reste absente, on retentera après
      // la prochaine vidéo ou au prochain lancement — jamais en boucle.
      console.warn("[publicite] aucune vidéo chargée", e);
      prete = false;
      poserEtat({ etape: "aucuneVideo", detail: texteErreur(e) });
    } finally {
      chargement = false;
    }
  };
  rechargerVideo = () => void charger();
  void charger();

  return {
    nom: bloc.test ? "admob-test" : "admob",
    pret: () => prete,
    montrer: () =>
      new Promise<IssueVideo>((resolve) => {
        if (!prete) {
          resolve("indisponible");
          return;
        }
        prete = false;
        // `showRewardVideoAd` ne se résout QUE si la récompense est gagnée : une vidéo fermée avant la fin ne le
        // résout jamais. L'issue se lit donc sur les événements — récompense gagnée, puis vidéo fermée.
        let recompensee = false;
        let finie = false;
        const ecoutes: Promise<{ remove: () => Promise<void> }>[] = [];
        const finir = (issue: IssueVideo) => {
          if (finie) return;
          finie = true;
          ecoutes.forEach((h) => void h.then((x) => x.remove()));
          void charger();
          resolve(issue);
        };
        ecoutes.push(AdMob.addListener(RewardAdPluginEvents.Rewarded, () => (recompensee = true)));
        ecoutes.push(AdMob.addListener(RewardAdPluginEvents.Dismissed, () => finir(recompensee ? "vue" : "abandonnee")));
        ecoutes.push(AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => finir("indisponible")));
        AdMob.showRewardVideoAd().then(
          () => (recompensee = true),
          () => finir("indisponible"),
        );
      }),
  };
}
