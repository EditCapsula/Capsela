import { labelPrecipitation } from "./data";

/**
 * PRÉVISION MÉTÉO — regroupement des créneaux en jours et en moments.
 *
 * La fonction Edge `weather?mode=forecast` est un proxy mince : elle rend les
 * créneaux d'OpenWeather (un point toutes les 3 h) tels quels, plus le
 * décalage horaire du LIEU. Tout le vocabulaire applicatif — « mardi »,
 * « matin » — est ici, avec ses tests, parce qu'une règle de regroupement se
 * corrige en une PR alors qu'une fonction Edge se redéploie à la main.
 *
 * L'HORIZON N'EST ÉCRIT NULLE PART. Il vaut ce que l'abonnement renvoie :
 * `joursCouverts` le déduit des créneaux reçus. La maquette supposait 7 jours,
 * le palier gratuit d'OpenWeather en donne 5 — coder l'un ou l'autre en dur
 * aurait produit soit une promesse fausse, soit une limite inutile le jour
 * d'un changement d'abonnement.
 */

/** Un point de prévision, tel que la fonction Edge le rend. */
export interface CreneauPrevision {
  /** Horodatage UTC en secondes (`dt` d'OpenWeather). */
  ts: number;
  temp: number;
  label: string;
}

export interface Prevision {
  city: string;
  country: string;
  /** Décalage du LIEU en secondes — pas celui du téléphone. */
  timezone: number;
  slots: CreneauPrevision[];
}

export type MomentJournee = "Matin" | "Après-midi" | "Soirée" | "Toute la journée";

/**
 * Fenêtres horaires, en heures locales AU LIEU. « Toute la journée » couvre
 * les trois autres d'un bloc plutôt que d'être leur moyenne : un créneau ne
 * doit peser qu'une fois.
 */
/**
 * HORIZON RÉEL DE LA PRÉVISION, EN JOURS PLEINS À PARTIR DE DEMAIN.
 *
 * Ce n'est pas un réglage : c'est la capacité de l'endpoint réellement
 * appelé. La fonction Edge `weather` en mode `forecast` interroge
 * /data/2.5/forecast, qui rend 5 jours par pas de 3 h sur le palier gratuit
 * d'OpenWeather (40 créneaux). Aucune ville n'en obtient davantage, donc la
 * borne est connue AVANT même de savoir où l'on va — ce qui permet de
 * l'annoncer dès l'étape « Pour quand ? », avant l'étape « Où ».
 *
 * `joursCouverts` reste la source de vérité une fois la réponse reçue : elle
 * dérive la couverture des créneaux effectivement rendus, qui peuvent être
 * moins nombreux (fin de journée, réponse partielle). Cette constante ne sert
 * qu'à ce qu'on peut dire AVANT l'appel ; elle ne le remplace jamais.
 */
export const HORIZON_PREVISION_JOURS = 5;

const FENETRES: Record<MomentJournee, [number, number]> = {
  Matin: [6, 12],
  "Après-midi": [12, 18],
  Soirée: [18, 24],
  "Toute la journée": [6, 24],
};

export interface MeteoMoment {
  /** Ce que le moteur reçoit : la moyenne de la fenêtre, arrondie. */
  temp: number;
  tempMin: number;
  tempMax: number;
  label: string;
  /** Nombre de créneaux agrégés — 0 est impossible, la fonction rend null. */
  creneaux: number;
}

/** Date locale AU LIEU d'un créneau, sous la forme AAAA-MM-JJ. */
function cleJourLocale(ts: number, timezone: number): string {
  const d = new Date((ts + timezone) * 1000);
  const deux = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${deux(d.getUTCMonth() + 1)}-${deux(d.getUTCDate())}`;
}

/** Heure locale AU LIEU d'un créneau, 0–23. */
function heureLocale(ts: number, timezone: number): number {
  return new Date((ts + timezone) * 1000).getUTCHours();
}

/**
 * Les jours que la prévision couvre réellement, triés. C'est la SEULE
 * définition de l'horizon : au-delà, l'écran dit que la météo n'est pas
 * encore connue plutôt que d'extrapoler.
 */
export function joursCouverts(prevision: Prevision): string[] {
  const jours = new Set<string>();
  for (const s of prevision.slots) jours.add(cleJourLocale(s.ts, prevision.timezone));
  return [...jours].sort();
}

/**
 * Météo agrégée d'un moment, ou null si aucun créneau ne tombe dedans — ce
 * qui arrive normalement : le dernier jour rendu par l'API est tronqué, et le
 * premier l'est aussi quand la requête part en fin de journée. Rendre null
 * plutôt que le jour le plus proche est délibéré : « pas de prévision pour ce
 * créneau » est vrai, « voici celle d'un autre moment » ne l'est pas.
 *
 * ARBITRAGE, la température rendue est la MOYENNE de la fenêtre. Le moteur ne
 * prend qu'un nombre, et aucun n'est parfait : la minimale surhabille les
 * après-midis, la maximale sous-habille les matins. `tempMin`/`tempMax` sont
 * rendus à côté pour que l'écran puisse afficher l'amplitude, qui est
 * l'information réellement utile à lire.
 *
 * Le libellé, lui, n'est pas moyennable : c'est la condition la plus
 * CONTRAIGNANTE qui l'emporte — les précipitations priment, parce que
 * s'habiller pour la pluie sous un ciel finalement dégagé coûte moins que
 * l'inverse. À défaut, le libellé le plus fréquent ; à égalité, le plus
 * précoce.
 *
 * Le test est `labelPrecipitation` et NON `isRainy` : « Pluvieux », le
 * libellé de la pluie ordinaire, ne satisfait pas `isRainy` (cf. le défaut
 * documenté dans data.ts). Utiliser `isRainy` ici aurait fait gagner
 * « Ensoleillé » sur une matinée de pluie — vérifié par un test qui a échoué
 * avant d'être compris.
 */
export function previsionPour(
  prevision: Prevision,
  cleJour: string,
  moment: MomentJournee
): MeteoMoment | null {
  const [debut, fin] = FENETRES[moment];
  const dedans = prevision.slots.filter((s) => {
    if (cleJourLocale(s.ts, prevision.timezone) !== cleJour) return false;
    const h = heureLocale(s.ts, prevision.timezone);
    return h >= debut && h < fin;
  });
  if (!dedans.length) return null;

  const temps = dedans.map((s) => s.temp);
  const pluvieux = dedans.find((s) => labelPrecipitation(s.label));
  let label: string;
  if (pluvieux) {
    label = pluvieux.label;
  } else {
    const comptes = new Map<string, number>();
    for (const s of dedans) comptes.set(s.label, (comptes.get(s.label) ?? 0) + 1);
    // `dedans` est déjà dans l'ordre des créneaux : à égalité, le premier
    // rencontré gagne, donc le plus précoce.
    label = dedans[0].label;
    let meilleur = comptes.get(label) ?? 0;
    for (const s of dedans) {
      const n = comptes.get(s.label) ?? 0;
      if (n > meilleur) {
        meilleur = n;
        label = s.label;
      }
    }
  }

  return {
    temp: Math.round(temps.reduce((a, b) => a + b, 0) / temps.length),
    tempMin: Math.min(...temps),
    tempMax: Math.max(...temps),
    label,
    creneaux: dedans.length,
  };
}
