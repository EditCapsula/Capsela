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

/** Pièces qu'un dressing gratuit peut contenir — arbitré le 24/09/2026 à 20, porté à 50 le 12/10/2026 (demandé : « élève à 50 le nombre de pièces autorisées, après on bascule sur Premium »). */
export const LIMITE_DRESSING_GRATUIT = 50;
/**
 * Valises qu'un compte gratuit peut GARDER à la fois (23/11/2026, demandé : « limiter à 2 valises par compte avant de basculer au
 * premium » ; arbitré : les valises gardées — en supprimer une libère une place, comme les pièces du dressing). La limite porte sur la
 * création d'une nouvelle valise, jamais sur celles déjà gardées.
 */
export const LIMITE_VALISES_GRATUITES = 2;

/**
 * Pièces qu'un compte gratuit peut garder MISES À PLAT dans son dressing (23/11/2026, demandé : « deux pièces uniquement sur leur
 * dressing ; sur d'autres pièces, redirigés vers le premium »). Une pièce supprimée, ou rendue à sa photo d'origine, libère une place.
 * Le serveur (`detourer-photo`) applique la même limite (copie dans supabase/functions/_shared/premium.ts, test miroir).
 */
export const LIMITE_MISES_A_PLAT_GRATUITES = 2;

/** Peut-on mettre une pièce de plus à plat ? Un statut inconnu ne limite pas ici : le serveur, lui, refuse en cas de doute. */
export function peutMettreAPlat(etat: EtatPremium, nbPiecesAPlat: number): boolean {
  if (etat !== "gratuit") return true;
  return nbPiecesAPlat < LIMITE_MISES_A_PLAT_GRATUITES;
}

/** Peut-on préparer une NOUVELLE valise ? Même règle que peutAjouter : un statut inconnu ne limite pas (le paywall échoue en ouvrant). */
export function peutCreerValise(etat: EtatPremium, nbValises: number): boolean {
  if (etat !== "gratuit") return true;
  return nbValises < LIMITE_VALISES_GRATUITES;
}

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
// 2 depuis le 05/11/2026 (arbitré : « fais 2 »), comme la limite de la base (migration 0059) ; 5 pendant la phase de test (0055),
// 2 déjà à l'origine (0033). Le Centre d'aide lit ce chiffre (centreAide.ts).
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
