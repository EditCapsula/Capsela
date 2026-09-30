import { extraireTexteReponse, lireUsage, MODELE_PAR_DEFAUT, validerImage } from "./avisStyliste.ts";

/*
 * ANALYSE DE COLORIMÉTRIE PAR PHOTO — logique serveur de la fonction Edge
 * « analyser-colorimetrie » (30/09/2026, docs/colorimetrie.md).
 *
 * Même découpage que l'avis de styliste : tout ce qui décide vit ici et se
 * teste depuis src/lib/__tests__ ; index.ts ne fait que brancher les vraies
 * dépendances.
 *
 * EXCEPTION ENCADRÉE À LA RÈGLE DU PROJET (arbitrée le 30/09/2026) : c'est le
 * seul endroit de Capsela où une photo de visage est regardée pour ses
 * couleurs. Le cadre tient dans ce fichier :
 *   - le consentement explicite est exigé AVANT toute lecture de l'image ;
 *   - le modèle ne rend qu'un mot parmi quatre saisons (plus « indetermine »)
 *     et un mot de qualité de photo — sortie structurée stricte, aucun texte
 *     libre : il ne peut rien écrire sur la peau, l'origine ou l'apparence ;
 *   - les couleurs affichées ne viennent jamais du modèle, mais de la table
 *     SAISONS de l'app (src/lib/colorimetrie.ts) ;
 *   - l'image n'est ni stockée, ni journalisée (store: false côté OpenAI, et
 *     le journal ne contient que des comptes et des codes) ;
 *   - le résultat ne sert qu'à l'affichage : le moteur de tenues n'en lit rien.
 */

/** Les quatre saisons — MÊMES CLÉS que SaisonCle côté app (vérifié par les tests). */
export const SAISONS_COLORIMETRIE = ["printemps", "ete", "automne", "hiver"] as const;
export type SaisonColorimetrie = (typeof SAISONS_COLORIMETRIE)[number];

/** Ce qui rend une photo inexploitable — MÊMES CLÉS que MotifPhoto côté app, hors « indetermine ». */
export const QUALITES_PHOTO = ["ok", "lumiere", "filtre", "visage_non_visible", "plusieurs_personnes"] as const;
export type QualitePhoto = (typeof QUALITES_PHOTO)[number];
export type MotifInexploitable = Exclude<QualitePhoto, "ok"> | "indetermine";

export type CodeErreurColorimetrie =
  | "non_authentifie"
  | "consentement_manquant"
  | "fichier_invalide"
  | "photo_inexploitable"
  | "delai_depasse"
  | "erreur_modele"
  | "reponse_invalide"
  | "configuration";

export type ReponseColorimetrie =
  | { ok: true; saison: SaisonColorimetrie }
  | { ok: false; code: CodeErreurColorimetrie; motif?: MotifInexploitable };

/** Délai maximal de l'appel (la réponse est un mot : bien plus court que l'avis). */
export const DELAI_COLORIMETRIE_MS = 30_000;
export { MODELE_PAR_DEFAUT };

export const INSTRUCTIONS_COLORIMETRIE = [
  "Tu aides une application de garde-robe à proposer une palette de couleurs de vêtements, selon la méthode des quatre saisons.",
  "La personne a donné son accord explicite pour que cette photo serve à cela, et à rien d'autre.",
  "Regarde uniquement l'harmonie générale entre le teint, les cheveux et les yeux : sous-ton chaud ou froid, contraste doux ou marqué. Chaud et clair : printemps ; froid et doux : ete ; chaud et profond : automne ; froid et contrasté : hiver.",
  "N'infère jamais, et n'exprime jamais, d'origine, d'ethnie, d'âge, de genre, d'état de santé ni aucune autre caractéristique sensible. Tu ne rends que les deux champs demandés.",
  "qualite : ok si la photo est exploitable ; lumiere si l'éclairage (trop sombre, trop jaune, contre-jour) empêche de lire les couleurs ; filtre si un filtre ou une retouche altère les couleurs ; visage_non_visible si aucun visage n'est net et de face ; plusieurs_personnes si plus d'une personne est visible.",
  "saison : printemps, ete, automne ou hiver quand qualite = ok et que l'harmonie est lisible ; indetermine sinon. En cas de doute réel entre deux saisons, réponds indetermine plutôt que de trancher au hasard.",
].join("\n");

export const SCHEMA_COLORIMETRIE = {
  type: "object",
  additionalProperties: false,
  required: ["qualite", "saison"],
  properties: {
    qualite: { type: "string", enum: [...QUALITES_PHOTO] },
    saison: { type: "string", enum: [...SAISONS_COLORIMETRIE, "indetermine"] },
  },
} as const;

/** Corps de la requête à l'OpenAI Responses API. */
export function construireRequeteColorimetrie(modele: string, imageDataUrl: string) {
  return {
    model: modele,
    // Jamais de conservation côté OpenAI pour une photo de visage.
    store: false,
    instructions: INSTRUCTIONS_COLORIMETRIE,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: "Voici la photo." },
          // "low" suffit à lire une harmonie de couleurs, et c'est le moins de
          // détail du visage transmis. ARBITRAGE : à revoir si les essais
          // réels rendent trop d'« indetermine ».
          { type: "input_image", image_url: imageDataUrl, detail: "low" },
        ],
      },
    ],
    text: { format: { type: "json_schema", name: "colorimetrie", strict: true, schema: SCHEMA_COLORIMETRIE } },
    max_output_tokens: 600,
  };
}

export type VerdictColorimetrie =
  | { etat: "saison"; saison: SaisonColorimetrie }
  | { etat: "inexploitable"; motif: MotifInexploitable }
  | { etat: "invalide" };

/** Lecture du JSON rendu par le modèle — une valeur hors liste est invalide, jamais « réparée ». */
export function lireVerdictColorimetrie(texteJson: string | null): VerdictColorimetrie {
  if (!texteJson) return { etat: "invalide" };
  let v: unknown;
  try {
    v = JSON.parse(texteJson);
  } catch {
    return { etat: "invalide" };
  }
  if (!v || typeof v !== "object") return { etat: "invalide" };
  const o = v as Record<string, unknown>;
  if (!(QUALITES_PHOTO as readonly unknown[]).includes(o.qualite)) return { etat: "invalide" };
  if (o.qualite !== "ok") return { etat: "inexploitable", motif: o.qualite as Exclude<QualitePhoto, "ok"> };
  if ((SAISONS_COLORIMETRIE as readonly unknown[]).includes(o.saison)) return { etat: "saison", saison: o.saison as SaisonColorimetrie };
  if (o.saison === "indetermine") return { etat: "inexploitable", motif: "indetermine" };
  return { etat: "invalide" };
}

/** Ligne de suivi — ni photo, ni saison, ni identité : des codes et des comptes. */
export interface JournalColorimetrie {
  evenement: "colorimetrie_photo";
  statut: "ok" | CodeErreurColorimetrie;
  modele: string;
  tokens_entree: number;
  tokens_sortie: number;
  duree_ms: number;
}

export interface DependancesColorimetrie {
  /** JWT → utilisateur, ou null si absent/invalide/expiré. */
  authentifier(jwt: string): Promise<{ id: string } | null>;
  /** POST à l'API Responses. Lève en cas d'échec réseau ou d'annulation. */
  appelerModele(requete: ReturnType<typeof construireRequeteColorimetrie>, signal: AbortSignal): Promise<{ ok: boolean; json: unknown }>;
  journaliser(ligne: JournalColorimetrie): void;
  maintenant(): number;
  modele: string;
  delaiMs: number;
}

const erreur = (statut: number, code: CodeErreurColorimetrie, motif?: MotifInexploitable) => ({
  statut,
  corps: (motif ? { ok: false, code, motif } : { ok: false, code }) as ReponseColorimetrie,
});

/**
 * Traite une demande d'analyse. Ne lève jamais. Ordre des contrôles :
 * authentification, CONSENTEMENT, fichier — aucun appel au modèle avant que
 * les trois soient acquis. Pas de relance automatique : une seconde lecture
 * du même visage n'est pas ce à quoi la personne a consenti.
 */
export async function traiterDemandeColorimetrie(
  enteteAuthorization: string | null,
  corps: unknown,
  deps: DependancesColorimetrie
): Promise<{ statut: number; corps: ReponseColorimetrie }> {
  const jwt = (enteteAuthorization ?? "").replace(/^Bearer\s+/i, "").trim();
  const user = jwt ? await deps.authentifier(jwt).catch(() => null) : null;
  if (!user) return erreur(401, "non_authentifie");

  const c = (corps && typeof corps === "object" ? corps : {}) as Record<string, unknown>;
  // Strictement true : ni "true", ni 1, ni une case pré-cochée qu'on aurait devinée.
  if (c.consentement !== true) return erreur(400, "consentement_manquant");

  const image = validerImage(c.image);
  if (!image) return erreur(400, "fichier_invalide");

  const debut = deps.maintenant();
  let tokensEntree = 0;
  let tokensSortie = 0;
  const journal = (statut: JournalColorimetrie["statut"]) =>
    deps.journaliser({
      evenement: "colorimetrie_photo",
      statut,
      modele: deps.modele,
      tokens_entree: tokensEntree,
      tokens_sortie: tokensSortie,
      duree_ms: deps.maintenant() - debut,
    });

  const controleur = new AbortController();
  const minuterie = setTimeout(() => controleur.abort(), deps.delaiMs);
  let reponse: { ok: boolean; json: unknown };
  try {
    reponse = await deps.appelerModele(construireRequeteColorimetrie(deps.modele, image), controleur.signal);
  } catch {
    clearTimeout(minuterie);
    const code = controleur.signal.aborted ? "delai_depasse" : "erreur_modele";
    journal(code);
    return erreur(code === "delai_depasse" ? 504 : 502, code);
  }
  clearTimeout(minuterie);
  const usage = lireUsage(reponse.json);
  tokensEntree = usage.entree;
  tokensSortie = usage.sortie;
  if (!reponse.ok) {
    journal("erreur_modele");
    return erreur(502, "erreur_modele");
  }
  const v = lireVerdictColorimetrie(extraireTexteReponse(reponse.json));
  if (v.etat === "saison") {
    journal("ok");
    return { statut: 200, corps: { ok: true, saison: v.saison } };
  }
  if (v.etat === "inexploitable") {
    journal("photo_inexploitable");
    return erreur(422, "photo_inexploitable", v.motif);
  }
  journal("reponse_invalide");
  return erreur(502, "reponse_invalide");
}
