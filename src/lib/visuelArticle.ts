import { getSupabase, isSupabaseConfigured } from "./supabase";
import { articleValide, cleVisuel, type ArticleVisuel } from "../../supabase/functions/_shared/visuelArticle.ts";

/*
 * LE VISUEL D'UN ARTICLE DE TICKET (06/11/2026, option 2 arbitrée : « Option 2 » ; docs/visuel-ticket.md). Le ticket ne donne pas de
 * photo : la fonction Edge `visuel-article` crée un visuel INDICATIF de l'article décrit, dans le style des visuels du catalogue, et le
 * range dans le dossier privé de l'utilisatrice. L'écran le présente comme tel et ne l'associe à la pièce qu'une fois confirmé ;
 * l'utilisatrice peut toujours mettre sa propre photo.
 *
 * Jamais d'erreur pour l'appelant : `null` (mode démo, hors ligne, plafond du jour, échec, délai dépassé) fait proposer une photo.
 */

export type { ArticleVisuel };

/** Le délai au-delà duquel on n'attend plus : la génération prend d'ordinaire 10 à 30 secondes. */
export const DELAI_VISUEL_MS = 75_000;

/** Les demandes en cours ou abouties de cette session, par description : une même pièce ne déclenche jamais deux générations. */
const enCours = new Map<string, Promise<string | null>>();

async function demander(article: ArticleVisuel): Promise<string | null> {
  const delai = new Promise<null>((resoudre) => setTimeout(() => resoudre(null), DELAI_VISUEL_MS));
  const appel = getSupabase()
    .functions.invoke("visuel-article", { body: article })
    .then(({ data, error }) => (!error && data && typeof data.url === "string" ? (data.url as string) : null))
    .catch(() => null);
  return Promise.race([appel, delai]);
}

/** Le visuel indicatif de l'article (URL signée), ou null. Un échec n'est pas gardé : la demande suivante réessaie. */
export function visuelArticle(brut: { nom: string; categorie: string; couleur: string | null; genre: string | null }): Promise<string | null> {
  const article = articleValide(brut);
  if (!isSupabaseConfigured || !article) return Promise.resolve(null);
  const cle = cleVisuel(article);
  const deja = enCours.get(cle);
  if (deja) return deja;
  const promesse = demander(article).then((url) => {
    if (!url) enCours.delete(cle);
    return url;
  });
  enCours.set(cle, promesse);
  return promesse;
}
