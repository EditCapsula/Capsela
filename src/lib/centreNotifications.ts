import { joursAvantDepart, etatDeLaValise, FENETRE_RAPPEL_JOURS } from "./rappelsValise";
import type { ValiseGardee } from "./valises";

/**
 * LE CENTRE DE NOTIFICATIONS — LA PARTIE PURE (12/11/2026, brief « Implémentation du centre de notifications »).
 *
 * Trois catégories, chacune née d'un événement RÉEL de l'app, jamais d'un exemple :
 *   · ACTIONS  : ce que la personne a fait et qu'elle voudra retrouver — une pièce remplacée dans une tenue planifiée, une pièce
 *                ajoutée au dressing, un look sauvegardé, une valise enregistrée (arbitré le 12/11/2026 : les quatre).
 *   · CONSEILS : une tenue planifiée que la météo annoncée ne sert plus (alerteMeteo.ts, l'alerte déjà montrée sur l'accueil) ;
 *                la prochaine information du profil à renseigner (prochaineActionProfil, profile.ts).
 *   · VALISE   : un départ dans les sept jours (rappelsValise.ts), dit selon l'état que la valise enregistre (à compléter, prête).
 * « Capsule à enrichir » et « Inspiration du moment » n'existent pas : aucune règle du code ne les calcule, rien n'est inventé.
 *
 * UN ÉVÉNEMENT, UNE NOTIFICATION. `cle` (dedup_key en base) dit l'événement : le noter une seconde fois — détection rejouée à chaque
 * ouverture, deux appareils — ne fait rien (fusionnerNotifications ici, contrainte unique en base, migration 0063).
 *
 * L'app n'a pas d'URL : `cible` est une destination interne (« valise:<id> », « piece:<id> », « looks », « planifier », « profil »),
 * que l'écran traduit en action du store.
 */

export type CategorieNotification = "actions" | "conseils" | "valise";
export type FiltreNotifications = "toutes" | CategorieNotification;

export type TypeNotification =
  | "piece_remplacee_plan"
  | "piece_ajoutee"
  | "look_sauvegarde"
  | "valise_enregistree"
  | "alerte_meteo"
  | "profil_a_completer"
  | "valise_a_completer"
  | "valise_prete"
  | "valise_preparatifs";

export interface NotificationCapsela {
  /** Identifiant du compte (uuid) ou local (« local-… ») tant qu'elle n'y est pas. */
  id: string;
  cle: string;
  type: TypeNotification;
  categorie: CategorieNotification;
  titre: string;
  message: string;
  cible: string | null;
  lue: boolean;
  /** ISO 8601. */
  creeeLe: string;
  meta?: Record<string, unknown>;
}

/** Ce qu'un événement fournit ; l'identifiant, la date et l'état de lecture sont posés à l'enregistrement. */
export type NouvelleNotification = Omit<NotificationCapsela, "id" | "lue" | "creeeLe">;

export const FILTRES: { id: FiltreNotifications; libelle: string }[] = [
  { id: "toutes", libelle: "Toutes" },
  { id: "actions", libelle: "Actions" },
  { id: "conseils", libelle: "Conseils" },
  { id: "valise", libelle: "Valise" },
];

/** Au plus, sur l'appareil : au-delà, les plus anciennes s'en vont (le compte garde tout). */
export const MAX_LOCALES = 150;

export function filtrerNotifications(liste: readonly NotificationCapsela[], filtre: FiltreNotifications): NotificationCapsela[] {
  return filtre === "toutes" ? [...liste] : liste.filter((n) => n.categorie === filtre);
}

export const nombreNonLues = (liste: readonly NotificationCapsela[]): number => liste.filter((n) => !n.lue).length;

export type PeriodeNotifications = "aujourdhui" | "semaine" | "anciennes";
export const LIBELLES_PERIODES: Record<PeriodeNotifications, string> = {
  aujourdhui: "Aujourd'hui",
  semaine: "Cette semaine",
  anciennes: "Plus anciennes",
};

const debutDuJour = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * Aujourd'hui (depuis minuit, heure locale), cette semaine (les six jours d'avant), plus anciennes. Chaque groupe du plus récent au
 * plus ancien ; un groupe vide n'est pas rendu.
 */
export function grouperParPeriode(
  liste: readonly NotificationCapsela[],
  maintenant: Date
): { periode: PeriodeNotifications; notifications: NotificationCapsela[] }[] {
  const minuit = debutDuJour(maintenant).getTime();
  const semaine = minuit - 6 * 86_400_000;
  const groupes: Record<PeriodeNotifications, NotificationCapsela[]> = { aujourdhui: [], semaine: [], anciennes: [] };
  for (const n of trierParDate(liste)) {
    const t = new Date(n.creeeLe).getTime();
    groupes[t >= minuit ? "aujourdhui" : t >= semaine ? "semaine" : "anciennes"].push(n);
  }
  return (Object.keys(groupes) as PeriodeNotifications[]).filter((p) => groupes[p].length).map((p) => ({ periode: p, notifications: groupes[p] }));
}

export const trierParDate = (liste: readonly NotificationCapsela[]): NotificationCapsela[] =>
  [...liste].sort((a, b) => new Date(b.creeeLe).getTime() - new Date(a.creeeLe).getTime());

const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** « À l'instant », « Il y a 12 min », « Il y a 3 h », « Hier », « Il y a 4 j », puis la date (« 3 nov. »). */
export function anciennete(creeeLe: string, maintenant: Date): string {
  const d = new Date(creeeLe);
  const ecart = maintenant.getTime() - d.getTime();
  const minutes = Math.floor(ecart / 60_000);
  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  const jours = Math.round((debutDuJour(maintenant).getTime() - debutDuJour(d).getTime()) / 86_400_000);
  if (jours === 0) return `Il y a ${Math.floor(minutes / 60)} h`;
  if (jours === 1) return "Hier";
  if (jours < 7) return `Il y a ${jours} j`;
  return `${d.getDate()} ${MOIS_COURTS[d.getMonth()]}` + (d.getFullYear() !== maintenant.getFullYear() ? ` ${d.getFullYear()}` : "");
}

/**
 * Réunit ce que l'appareil et le compte connaissent : une notification par clé ; lue si elle l'est d'un côté ou de l'autre (une lecture
 * ne se perd jamais) ; l'identifiant du compte l'emporte sur l'identifiant local. Triée, bornée à `max`.
 */
export function fusionnerNotifications(a: readonly NotificationCapsela[], b: readonly NotificationCapsela[], max = Infinity): NotificationCapsela[] {
  const parCle = new Map<string, NotificationCapsela>();
  for (const n of [...a, ...b]) {
    const deja = parCle.get(n.cle);
    if (!deja) {
      parCle.set(n.cle, n);
      continue;
    }
    const duCompte = deja.id.startsWith("local-") ? n : deja;
    parCle.set(n.cle, { ...duCompte, lue: deja.lue || n.lue, creeeLe: new Date(deja.creeeLe) < new Date(n.creeeLe) ? deja.creeeLe : n.creeeLe });
  }
  return trierParDate([...parCle.values()]).slice(0, max);
}

/** Les notifications locales que le compte n'a pas encore (à lui renvoyer), ou dont il ignore la lecture. */
export function aEnvoyer(locales: readonly NotificationCapsela[], compte: readonly NotificationCapsela[]): { nouvelles: NotificationCapsela[]; lues: string[] } {
  const parCle = new Map(compte.map((n) => [n.cle, n]));
  return {
    nouvelles: locales.filter((n) => !parCle.has(n.cle)),
    lues: locales.filter((n) => n.lue && parCle.get(n.cle) && !parCle.get(n.cle)!.lue).map((n) => n.cle),
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Les notifications des événements (catégorie Actions) : un constructeur par événement, la même écriture partout.

export const notifPieceAjoutee = (id: number, nom: string): NouvelleNotification => ({
  cle: `piece_ajoutee:${id}`,
  type: "piece_ajoutee",
  categorie: "actions",
  titre: "Pièce ajoutée au dressing",
  message: `${nom} est dans ton dressing.`,
  cible: `piece:${id}`,
});

/** `jeton` : ce qui distingue deux remplacements dans la même tenue (l'instant) — chacun est un événement. */
export const notifPieceRemplaceePlan = (planId: string, ancien: string, nouvel: string, jeton: number = Date.now()): NouvelleNotification => ({
  cle: `piece_remplacee_plan:${planId}:${jeton}`,
  type: "piece_remplacee_plan",
  categorie: "actions",
  titre: "Tenue planifiée mise à jour",
  message: `${nouvel} remplace ${ancien}.`,
  cible: "planifier",
});

export const notifLookSauvegarde = (lookId: string, nom: string): NouvelleNotification => ({
  cle: `look_sauvegarde:${lookId}`,
  type: "look_sauvegarde",
  categorie: "actions",
  titre: "Look sauvegardé",
  message: `« ${nom} » t'attend dans Mes looks.`,
  cible: "looks",
});

/** Par destination et date de départ, pas par identifiant : la valise change d'identifiant en entrant dans le compte. */
export const notifValiseEnregistree = (v: Pick<ValiseGardee, "id" | "destination" | "depart">): NouvelleNotification => ({
  cle: `valise_enregistree:${v.depart}:${v.destination}`,
  type: "valise_enregistree",
  categorie: "actions",
  titre: "Valise enregistrée",
  message: `Ta valise pour ${v.destination || "ton séjour"} est enregistrée.`,
  cible: `valise:${v.id}`,
  meta: { depart: v.depart, destination: v.destination },
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Les notifications dérivées (Conseils, Valise) : détectées depuis les données chargées, notées une fois par état.

const libelleDelai = (j: number) => (j === 1 ? "demain" : `dans ${j} jours`);

/**
 * Un départ dans les sept jours (J-7 à J-1, rappelsValise.ts), dit selon l'état enregistré par la valise : à compléter (le nombre de
 * pièces suggérées à ajouter), prête, sinon les préparatifs. Un changement d'état est un nouvel événement (clé avec l'état) ; la même
 * valise au même état n'est notée qu'une fois, quel que soit le nombre d'ouvertures.
 */
export function notificationsDesValises(valises: readonly ValiseGardee[], aujourdhui: string): NouvelleNotification[] {
  const sortie: NouvelleNotification[] = [];
  for (const v of valises) {
    const j = joursAvantDepart(v.depart, aujourdhui);
    if (j < 1 || j > FENETRE_RAPPEL_JOURS) continue;
    const lieu = v.destination || "ton séjour";
    const etat = etatDeLaValise(v);
    const base = { categorie: "valise" as const, cible: `valise:${v.id}`, meta: { depart: v.depart, destination: v.destination } };
    if (etat === "a_completer") {
      const n = v.suggestionIds?.length ?? 0;
      sortie.push({
        ...base,
        cle: `valise:${v.depart}:${v.destination}:a_completer`,
        type: "valise_a_completer",
        titre: "Valise à compléter",
        message: n === 1 ? `Il te reste 1 pièce à ajouter pour ton séjour à ${lieu}.` : `Il te reste ${n} pièces à ajouter pour ton séjour à ${lieu}.`,
      });
    } else if (etat === "prete") {
      sortie.push({
        ...base,
        cle: `valise:${v.depart}:${v.destination}:prete`,
        type: "valise_prete",
        titre: "Valise prête",
        message: `Tout est prêt pour ${lieu}, départ ${libelleDelai(j)}.`,
      });
    } else {
      sortie.push({
        ...base,
        cle: `valise:${v.depart}:${v.destination}:preparatifs`,
        type: "valise_preparatifs",
        titre: "Préparatifs du voyage",
        message: `Départ pour ${lieu} ${libelleDelai(j)} : ta valise t'attend.`,
      });
    }
  }
  return sortie;
}

/** La prochaine information du profil à renseigner (prochaineActionProfil) : une notification par information, notée une fois. */
export const notifProfilACompleter = (cle: string, message: string): NouvelleNotification => ({
  cle: `profil:${cle}`,
  type: "profil_a_completer",
  categorie: "conseils",
  titre: "Ton profil à compléter",
  message,
  cible: "profil",
});

/** L'alerte météo d'une tenue planifiée, telle que l'accueil la montre (alerteMeteo.ts) : une par tenue et par cause. */
export const notifAlerteMeteo = (planId: string, jour: string, cause: string, titre: string, message: string): NouvelleNotification => ({
  cle: `alerte_meteo:${planId}:${jour}:${cause}`,
  type: "alerte_meteo",
  categorie: "conseils",
  titre,
  message,
  cible: "accueil",
});
