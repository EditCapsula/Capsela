import { Capacitor } from "@capacitor/core";

/*
 * LES ACHATS INTÉGRÉS (17/11/2026, refus App Review 2.1(b) : « the app includes references to premium but the associated In-App
 * Purchase products have not been submitted » ; option retenue par la propriétaire : de vrais abonnements, par RevenueCat).
 *
 * Sur l'App Store, un abonnement numérique passe obligatoirement par l'achat intégré d'Apple (3.1.1). RevenueCat
 * (@revenuecat/purchases-capacitor) porte le paiement, les renouvellements, la vérification des reçus et la restauration ; à chaque
 * événement, il prévient la fonction Supabase `revenuecat-webhook`, qui écrit `premium_access` (source app_store) — la table que
 * lisent déjà toutes les limites (premium.ts). L'identifiant RevenueCat de la personne est son identifiant Supabase : l'événement
 * dit donc à qui revient le droit.
 *
 * Seulement dans l'app iOS, et seulement avec la clé publique iOS de RevenueCat (NEXT_PUBLIC_REVENUECAT_IOS_KEY, posée par le
 * workflow de build) : sans elle, l'écran Premium reste celui d'avant (« Me prévenir à l'ouverture »), sans prix. Android et le web
 * ne changent pas (Google Play viendra par le même module, avec sa propre clé).
 *
 * Tout échoue en douceur : une offre illisible rend null, un achat raté rend un statut — jamais d'exception jusqu'à l'écran.
 */

/** Le droit d'accès configuré dans RevenueCat, auquel les deux abonnements sont rattachés. */
export const DROIT_PREMIUM = "premium";

const CLE_IOS = process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY ?? "";

/** Les achats intégrés sont-ils proposés ici ? L'app iOS, avec sa clé RevenueCat. */
export function achatsIntegresIci(): boolean {
  return Capacitor.getPlatform() === "ios" && CLE_IOS.length > 0;
}

export type DureeFormule = "annuel" | "mensuel";

/** Une formule telle que l'écran l'affiche : les prix viennent du store, dans la devise de la personne. */
export interface FormuleStore {
  duree: DureeFormule;
  /** « 54,99 € » : le prix de la période, écrit par le store. */
  prix: string;
  /** « 4,58 € » : l'équivalent mensuel d'un abonnement annuel, s'il est connu. */
  prixMensuel: string | null;
  /** Le paquet RevenueCat, rendu tel quel à l'achat. */
  paquet: unknown;
}

/** Le type de paquet RevenueCat (PACKAGE_TYPE) vers la durée affichée ; tout autre paquet n'est pas proposé. */
export function dureeDuPaquet(packageType: string): DureeFormule | null {
  if (packageType === "ANNUAL") return "annuel";
  if (packageType === "MONTHLY") return "mensuel";
  return null;
}

/** Les formules d'une offre, annuel d'abord ; une offre sans paquet connu n'en donne aucune. Pure, testée. */
export function formulesDeLOffre(
  paquets: readonly { packageType: string; product: { priceString: string; pricePerMonthString?: string | null } }[]
): FormuleStore[] {
  const out: FormuleStore[] = [];
  for (const p of paquets) {
    const duree = dureeDuPaquet(p.packageType);
    if (!duree || out.some((f) => f.duree === duree)) continue;
    out.push({ duree, prix: p.product.priceString, prixMensuel: duree === "annuel" ? p.product.pricePerMonthString ?? null : null, paquet: p });
  }
  return out.sort((a, b) => (a.duree === b.duree ? 0 : a.duree === "annuel" ? -1 : 1));
}

/** Le droit Premium est-il actif dans les informations client de RevenueCat ? Pure, testée. */
export function droitActif(info: { entitlements?: { active?: Record<string, unknown> } } | null | undefined): boolean {
  return Boolean(info?.entitlements?.active?.[DROIT_PREMIUM]);
}

type Plugin = (typeof import("@revenuecat/purchases-capacitor"))["Purchases"];
let plugin: Promise<Plugin> | null = null;
let utilisateurConfigure: string | null = null;

const charger = (): Promise<Plugin> => (plugin ??= import("@revenuecat/purchases-capacitor").then((m) => m.Purchases));

/**
 * Configure RevenueCat pour la personne connectée (une fois), ou change d'utilisatrice. Rend false si les achats ne sont pas
 * proposés ici ou si la configuration échoue.
 */
export async function configurerAchats(userId: string): Promise<boolean> {
  if (!achatsIntegresIci() || !userId) return false;
  try {
    const P = await charger();
    if (utilisateurConfigure === null) {
      await P.configure({ apiKey: CLE_IOS, appUserID: userId });
      utilisateurConfigure = userId;
    } else if (utilisateurConfigure !== userId) {
      await P.logIn({ appUserID: userId });
      utilisateurConfigure = userId;
    }
    return true;
  } catch {
    return false;
  }
}

/** Les formules de l'offre courante, ou null si elles ne sont pas lisibles (store injoignable, offre absente). */
export async function chargerFormules(userId: string): Promise<FormuleStore[] | null> {
  if (!(await configurerAchats(userId))) return null;
  try {
    const P = await charger();
    const offres = await P.getOfferings();
    const formules = formulesDeLOffre(offres.current?.availablePackages ?? []);
    return formules.length ? formules : null;
  } catch {
    return null;
  }
}

export type ResultatAchat = "premium" | "annule" | "sans_droit" | "erreur";

/** Achète une formule. « annule » : la personne a fermé la fenêtre d'Apple ; rien n'est dit comme une erreur. */
export async function acheter(userId: string, formule: FormuleStore): Promise<ResultatAchat> {
  if (!(await configurerAchats(userId))) return "erreur";
  try {
    const P = await charger();
    const r = await P.purchasePackage({ aPackage: formule.paquet as Parameters<Plugin["purchasePackage"]>[0]["aPackage"] });
    return droitActif(r.customerInfo) ? "premium" : "sans_droit";
  } catch (e) {
    const err = e as { code?: string; userCancelled?: boolean };
    // PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR vaut "1".
    if (err?.userCancelled || err?.code === "1") return "annule";
    return "erreur";
  }
}

/** Restaure les achats (exigé par Apple) : « premium » si un abonnement actif est retrouvé. */
export async function restaurer(userId: string): Promise<ResultatAchat> {
  if (!(await configurerAchats(userId))) return "erreur";
  try {
    const P = await charger();
    const r = await P.restorePurchases();
    return droitActif(r.customerInfo) ? "premium" : "sans_droit";
  } catch {
    return "erreur";
  }
}

/** Le droit Premium d'après RevenueCat, sans attendre que la fonction Supabase ait écrit la table. */
export async function droitPremiumStore(userId: string): Promise<boolean | null> {
  if (!(await configurerAchats(userId))) return null;
  try {
    const P = await charger();
    const { customerInfo } = await P.getCustomerInfo();
    return droitActif(customerInfo);
  } catch {
    return null;
  }
}
