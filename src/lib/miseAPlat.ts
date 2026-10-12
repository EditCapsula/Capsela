/*
 * LA MISE À PLAT EST MASQUÉE TANT QUE LE PLAN PHOTOROOM « PLUS » N'EST PAS PRIS (12/10/2026, demandé). Elle appelle Flat Lay (/v2/edit),
 * qui exige ce plan (≈ 5 fois le prix du plan Basic, suffisant pour le détourage) : sans lui, le bouton ne ferait que dire « le service
 * n'est pas relié ». Le détourage (Basic) n'est pas concerné.
 *
 * POUR LA RÉACTIVER : une fois le plan Plus pris, définir NEXT_PUBLIC_MISE_A_PLAT=1 dans les variables de l'hébergeur (Vercel) et
 * redéployer — la valeur est lue à la construction du site statique.
 */
export const MISE_A_PLAT_DISPONIBLE = process.env.NEXT_PUBLIC_MISE_A_PLAT === "1";
