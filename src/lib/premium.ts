import { getSupabase, isSupabaseConfigured } from "./supabase";

/**
 * DROITS PREMIUM ET LIMITE DU DRESSING GRATUIT.
 *
 * LE DRAPEAU N'EST PAS SUR `profiles`, délibérément : la policy « Users can
 * update own profile » (migration 0001) laisse chaque utilisatrice écrire
 * n'importe quelle colonne de sa propre ligne. Un booléen premium posé
 * là-bas se falsifierait depuis le navigateur en une requête. Il vit dans
 * `premium_access` (0031), une table sans aucune policy d'écriture : seule
 * la clé de service y écrit.
 */

/** Pièces qu'un dressing gratuit peut contenir — arbitré le 24/09/2026. */
export const LIMITE_DRESSING_GRATUIT = 20;

/**
 * Générations de tenues offertes par jour sans abonnement — arbitré le
 * 24/09/2026.
 *
 * AFFICHAGE SEULEMENT. Le décompte, lui, est fait par la base :
 * `consommer_generation()` (migrations 0032/0033, `security definer`) porte
 * sa propre limite et la lève pour un compte Premium actif. Cette constante
 * écrit le chiffre sur l'écran Premium ; le Gate de TenuesScreen annonce la
 * limite que la base a renvoyée (bonus compris), pas celle-ci.
 */
export const GENERATIONS_GRATUITES_PAR_JOUR = 2;

/**
 * Trois états, et non deux. La distinction porte tout le comportement.
 *
 *   "premium"  — droit vérifié et actif, aucune limite.
 *   "gratuit"  — droit vérifié, absent ou expiré : la limite s'applique.
 *   "inconnu"  — la vérification n'a pas pu avoir lieu (réseau, table pas
 *                encore créée, mode démo). LA LIMITE NE S'APPLIQUE PAS.
 *
 * Le troisième est le plus important. Un paywall doit ÉCHOUER EN OUVRANT :
 * bloquer quelqu'un parce qu'une requête n'est pas passée, ou parce que la
 * table n'est pas encore déployée, coûte une utilisatrice ; la laisser
 * ajouter une pièce de trop pendant une panne ne coûte rien de comparable.
 * C'est aussi ce qui rend cette fonctionnalité déployable avant la table :
 * tant que 0031 n'est pas exécutée, personne n'est limité.
 */
export type EtatPremium = "premium" | "gratuit" | "inconnu";

interface PremiumAccessRow {
  actif: boolean;
  expire_le: string | null;
}

export async function fetchEtatPremium(userId: string): Promise<EtatPremium> {
  if (!isSupabaseConfigured) return "inconnu";
  try {
    const { data, error } = await getSupabase()
      .from("premium_access")
      .select("actif, expire_le")
      .eq("user_id", userId)
      .maybeSingle();
    // Une erreur ici peut vouloir dire « table absente » aussi bien que
    // « réseau coupé ». Les deux se traitent pareil : on ne sait pas, donc
    // on ne limite pas.
    if (error) return "inconnu";
    return estActif(data as PremiumAccessRow | null) ? "premium" : "gratuit";
  } catch {
    return "inconnu";
  }
}

/** Ligne absente, désactivée ou expirée : pas de droit. Pure, donc testable. */
export function estActif(row: { actif: boolean; expire_le: string | null } | null, maintenant = new Date()): boolean {
  if (!row || !row.actif) return false;
  if (!row.expire_le) return true;
  const fin = new Date(row.expire_le);
  return Number.isFinite(fin.getTime()) && fin > maintenant;
}

/**
 * Peut-on encore ajouter une pièce ?
 *
 * LA LIMITE PORTE SUR L'AJOUT, JAMAIS SUR L'EXISTANT. Un dressing déjà
 * au-dessus du plafond garde toutes ses pièces : on ne peut simplement plus
 * en ajouter. Masquer ou supprimer rétroactivement ce que quelqu'un a saisi
 * lui-même serait hostile, et ne rapporterait rien.
 */
export function peutAjouter(etat: EtatPremium, nbPieces: number): boolean {
  if (etat !== "gratuit") return true;
  return nbPieces < LIMITE_DRESSING_GRATUIT;
}

/** Places restantes, ou null quand il n'y a pas de limite à annoncer. */
export function placesRestantes(etat: EtatPremium, nbPieces: number): number | null {
  if (etat !== "gratuit") return null;
  return Math.max(0, LIMITE_DRESSING_GRATUIT - nbPieces);
}
