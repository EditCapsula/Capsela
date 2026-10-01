// Protection des fonctions Edge qui coûtent de l'argent (01/10/2026).
//
// CE QUI MANQUAIT. `analyze-dressing-photo` et `generate-catalog-image` ne
// vérifiaient aucune identité : la clé `anon`, publique dans le navigateur,
// suffisait à les appeler en boucle — chaque appel de la première est un appel
// OpenAI vision payant, et la seconde acceptait même `force_regenerate`, qui
// refait une image déjà prête. Le plafond quotidien de génération existait,
// mais un seul appelant pouvait l'épuiser pour tout le monde.
//
// CE QUE CE MODULE FOURNIT, sans rien lire d'un environnement Deno (donc
// testable) :
//   · l'identité de l'appelant : un JWT d'utilisatrice connectée, jamais la
//     clé `anon` seule ;
//   · la reconnaissance de l'appelant ADMIN (la clé privilégiée elle-même, que
//     les workflows GitHub et les scripts de maintenance emploient) ;
//   · un quota par compte et par jour, tenu en base (migration 0043) ;
//   · la restriction d'une URL de photo à CELLES DE L'APPELANTE.
//
// Règle de repli : si le quota ne peut pas être vérifié (migration 0043 pas
// exécutée, base injoignable), la fonction REFUSE (503). Ces deux fonctions ne
// sont jamais indispensables — l'app saisit une pièce à la main, et affiche un
// visuel de repli — alors que laisser passer, c'est laisser le coût ouvert.

/** Le jeton d'un en-tête `Authorization: Bearer …`, ou null. */
export function jetonDepuisEntete(valeur: string | null | undefined): string | null {
  const jeton = (valeur ?? "").replace(/^Bearer(\s+|$)/i, "").trim();
  return jeton ? jeton : null;
}

/**
 * L'appelant est-il l'administration — la clé privilégiée elle-même ? Elle peut
 * arriver dans `Authorization` ou dans `apikey` selon la bibliothèque qui
 * appelle (supabase-js pose les deux). Sans clé configurée, personne n'est admin.
 */
export function estAppelantAdmin(
  authorization: string | null | undefined,
  apikey: string | null | undefined,
  cleAdmin: string | undefined
): boolean {
  if (!cleAdmin) return false;
  return jetonDepuisEntete(authorization) === cleAdmin || (apikey ?? "").trim() === cleAdmin;
}

/**
 * Une limite lue d'un secret : un entier strictement positif, sinon la valeur
 * par défaut. Une valeur absente, vide, négative ou illisible ne désactive
 * JAMAIS le plafond.
 */
export function limiteDepuisEnv(brut: string | null | undefined, defaut: number): number {
  const n = Number(brut);
  return Number.isInteger(n) && n > 0 ? n : defaut;
}

/**
 * Une photo de dressing de CETTE utilisatrice, et d'elle seule : une URL du
 * stockage du projet, bucket `dressing-photos`, sous le dossier de son id —
 * signée (`/sign/`) ou publique (`/public/`, l'ancien format). Toute autre
 * adresse est refusée : sinon la fonction analyserait n'importe quelle image
 * du web, ou la photo de quelqu'un d'autre.
 */
export function urlPhotoAutorisee(photoUrl: string, supabaseUrl: string, userId: string): boolean {
  let photo: URL;
  let projet: URL;
  try {
    photo = new URL(photoUrl);
    projet = new URL(supabaseUrl);
  } catch {
    return false;
  }
  if (photo.protocol !== "https:" && photo.protocol !== projet.protocol) return false;
  if (photo.origin !== projet.origin) return false;
  if (!userId || /[/\\]/.test(userId)) return false;
  const chemin = photo.pathname;
  return (
    chemin.startsWith(`/storage/v1/object/sign/dressing-photos/${userId}/`) ||
    chemin.startsWith(`/storage/v1/object/public/dressing-photos/${userId}/`)
  );
}

/** Ce que ce module demande à un client Supabase — de quoi le simuler dans un test. */
export interface ClientAdmin {
  auth: { getUser(jwt: string): Promise<{ data: { user: { id: string } | null }; error: unknown }> };
  rpc(
    nom: string,
    args: Record<string, unknown>
  ): PromiseLike<{ data: { consomme: boolean; utilisees: number }[] | { consomme: boolean; utilisees: number } | null; error: unknown }>;
}

/** L'utilisatrice derrière un JWT, ou null (absent, invalide, expiré, ou simple clé `anon`). */
export async function authentifier(admin: ClientAdmin, jwt: string | null): Promise<{ id: string } | null> {
  if (!jwt) return null;
  try {
    const { data, error } = await admin.auth.getUser(jwt);
    if (error || !data?.user?.id) return null;
    return { id: data.user.id };
  } catch {
    return null;
  }
}

export type IssueQuota = "ok" | "limite" | "indisponible";

/**
 * Consomme UNE unité du quota du jour de cette fonction pour ce compte
 * (`consommer_edge_quota`, migration 0043). « limite » : le plafond est atteint ;
 * « indisponible » : la base n'a pas répondu comme prévu — l'appelant refuse.
 */
export async function consommerQuota(admin: ClientAdmin, userId: string, fonction: string, limite: number): Promise<IssueQuota> {
  try {
    const { data, error } = await admin.rpc("consommer_edge_quota", { p_user: userId, p_fonction: fonction, p_limite: limite });
    if (error) return "indisponible";
    const ligne = Array.isArray(data) ? data[0] : data;
    if (!ligne || typeof ligne.consomme !== "boolean") return "indisponible";
    return ligne.consomme ? "ok" : "limite";
  } catch {
    return "indisponible";
  }
}
