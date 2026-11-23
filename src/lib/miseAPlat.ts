import { peutMettreAPlat, type EtatPremium } from "./premium";

/*
 * LA MISE À PLAT EST MASQUÉE TANT QUE LE PLAN PHOTOROOM « PLUS » N'EST PAS PRIS (12/10/2026, demandé). Elle appelle Flat Lay (/v2/edit),
 * qui exige ce plan (≈ 5 fois le prix du plan Basic, suffisant pour le détourage) : sans lui, le bouton ne ferait que dire « le service
 * n'est pas relié ». Le détourage (Basic) n'est pas concerné.
 *
 * POUR LA RÉACTIVER (liste complète au 23/11/2026) :
 *   1. prendre le plan Photoroom Plus (la clé PHOTOROOM_API_KEY de Supabase reste la même) ;
 *   2. site : NEXT_PUBLIC_MISE_A_PLAT=1 dans les variables de Vercel, puis redéployer (lu à la construction du site statique) ;
 *   3. apps : variable du dépôt GitHub MISE_A_PLAT=1 (Settings → Secrets and variables → Actions → Variables), puis relancer les
 *      builds iOS et Android ;
 *   4. textes : dire dans la Politique de confidentialité et les CGU que l'image est générée et peut différer de la pièce, et dans
 *      les CGV qu'elle est sans limite en Premium et limitée à 2 pièces en offre gratuite (docs/legal/README.md).
 * La limite (ci-dessous) s'applique dès la réactivation : rien d'autre à changer dans le code.
 */
export const MISE_A_PLAT_DISPONIBLE = process.env.NEXT_PUBLIC_MISE_A_PLAT === "1";

/*
 * PREMIUM, OU 2 PIÈCES EN OFFRE GRATUITE (23/11/2026, demandé : « seuls les premium… prépare le code et lance plus tard quand
 * l'abonnement [Photoroom] sera prêt », puis : « pour les gratuits, deux pièces uniquement sur leur dressing ; sur d'autres pièces,
 * redirigés vers le premium »). Un Premium confirmé passe toujours ; un compte gratuit passe tant que son dressing garde moins de
 * LIMITE_MISES_A_PLAT_GRATUITES pièces mises à plat (premium.ts), sinon il voit Premium (« Ce que tu voulais faire : mettre ta pièce
 * à plat »). Un statut resté inconnu après vérification laisse passer : le serveur (`detourer-photo`) applique la même limite et
 * refuse, lui, en cas de doute. Tant que MISE_A_PLAT_DISPONIBLE est faux, aucun bouton n'existe : rien de tout cela ne se voit.
 */
type ActionsPremium = { goPremium: (origine?: "valise" | "mise_a_plat") => void; verifierEtatPremium: () => Promise<EtatPremium> };

/** Lance `ouvrir` quand une mise à plat de plus est permise et rend true ; sinon ouvre Premium et rend false. */
export async function ouvrirSiPermis(actions: ActionsPremium, etat: EtatPremium, nbPiecesAPlat: number, ouvrir: () => void): Promise<boolean> {
  const connu = etat === "inconnu" ? await actions.verifierEtatPremium() : etat;
  if (peutMettreAPlat(connu, nbPiecesAPlat)) {
    ouvrir();
    return true;
  }
  actions.goPremium("mise_a_plat");
  return false;
}
