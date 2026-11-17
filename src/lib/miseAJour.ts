import { Capacitor } from "@capacitor/core";
import { NOM_VERSION, NUMERO_VERSION } from "./versionApp";
import { getSupabase, isSupabaseConfigured } from "./supabase";

/**
 * LA MISE À JOUR DE L'APPLICATION (17/11/2026, demandé : « si j'ai une mise à jour à faire de l'application, l'information doit être
 * affichée dans l'application avec redirection vers la fiche de l'application dans le store, dans les notifications de l'app »).
 *
 * La version publiée vient de la table `versions_app` (migration 0065), une ligne par plateforme, que la propriétaire met à jour quand
 * une version est disponible dans le store. L'app installée connaît la sienne (NUMERO_VERSION, le numéro de build posé par les
 * workflows). Plus récente dans le store : une notification « Mise à jour disponible » (centreNotifications.ts), qui ouvre la fiche
 * du store. Avant la migration, sur le web, ou sans réponse : rien — jamais une mise à jour annoncée sans donnée.
 *
 * Pourquoi une table et non l'interface du store : le module natif qui interroge Google Play et l'App Store n'a pas pu être ajouté
 * (17/11/2026). La table suffit et ne demande aucun module natif.
 */

export type PlateformeStore = "android" | "ios";

export interface VersionPubliee {
  plateforme: PlateformeStore;
  /** Le nom de version affiché (« 2.7 »). */
  version: string;
  /** Le numéro de build (versionCode Android, numéro de build iOS) : c'est lui qui se compare. */
  numero: number;
  /** La fiche de l'app dans le store ; sans elle, l'adresse connue de la plateforme. */
  url: string | null;
}

/** La fiche Google Play, connue par l'identifiant de l'app (capacitor.config.ts : app.capsela). */
export const URL_GOOGLE_PLAY = "https://play.google.com/store/apps/details?id=app.capsela";

export function plateformeStore(): PlateformeStore | null {
  const p = Capacitor.getPlatform();
  return p === "android" || p === "ios" ? p : null;
}

/** Vrai quand le store a une version plus récente que celle installée (numéros de build). Un numéro inconnu ne conclut rien. */
export function miseAJourDisponible(installe: number | null, publiee: Pick<VersionPubliee, "numero"> | null): boolean {
  return installe != null && Number.isFinite(installe) && installe > 0 && publiee != null && Number.isFinite(publiee.numero) && publiee.numero > installe;
}

/** Le numéro de build de l'app installée, ou null sur le web et en développement. */
export function numeroInstalle(): number | null {
  const n = Number(NUMERO_VERSION);
  return Number.isFinite(n) && n > 0 ? n : null;
}
export const nomVersionInstallee = (): string => NOM_VERSION;

/** La version publiée pour cette plateforme, ou null (table absente avant la migration, réseau, aucune ligne). Ne jette jamais. */
export async function lireVersionPubliee(plateforme: PlateformeStore): Promise<VersionPubliee | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await getSupabase().from("versions_app").select("plateforme, version, numero, url").eq("plateforme", plateforme).maybeSingle();
    if (error || !data) return null;
    const numero = Number(data.numero);
    if (!Number.isFinite(numero) || typeof data.version !== "string") return null;
    return { plateforme, version: data.version, numero, url: typeof data.url === "string" && data.url ? data.url : null };
  } catch {
    return null;
  }
}

/** L'adresse de la fiche du store : celle de la table, sinon Google Play. Sans adresse connue pour iOS : null. */
export function urlStore(plateforme: PlateformeStore, url: string | null | undefined): string | null {
  if (url) return url;
  return plateforme === "android" ? URL_GOOGLE_PLAY : null;
}

/** Ouvre la fiche du store dans le navigateur du système (qui la passe à l'app du store). */
export async function ouvrirStore(url: string): Promise<void> {
  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url });
  } catch {
    window.open(url, "_blank");
  }
}
