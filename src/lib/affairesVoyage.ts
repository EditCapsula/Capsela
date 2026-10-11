import type { ItemProgramme } from "./programmeValise";
import type { MeteoJour, TailleBagage } from "./valise";

/*
 * LES AFFAIRES DE VOYAGE (11/10/2026, demandé : « intégrer toutes les pièces liées aux vacances — chaussures de randonnée, parfum, dentifrice,
 * crème solaire… »). Une couche À PART des vêtements : le moteur de tenues ne connaît que le dressing, et ces affaires n'ont ni catégorie, ni
 * volume dans le barème de la valise. Elles ne changent donc ni la capacité, ni « prête », ni les looks.
 *
 * Deux sortes :
 *   - les ESSENTIELS, qui ne dépendent de rien (papiers, brosse à dents…) ;
 *   - les affaires CONDITIONNELLES, chacune liée à une donnée RÉELLE du séjour — le programme, la météo prévue ou habituelle — et qui DIT
 *     pourquoi elle est proposée (« Plage au programme »). Aucune affaire n'est devinée : sans la donnée, elle n'apparaît pas.
 *
 * Le catalogue est ÉDITORIAL (arbitrage du 11/10/2026, à valider et compléter par la propriétaire). Les affaires que la personne ajoute ou
 * masque sont gardées avec la valise (ValiseGardee.affaires).
 */

export type GroupeAffaire = "documents" | "toilette" | "sante" | "electronique" | "equipement";

export const GROUPES_AFFAIRES: { id: GroupeAffaire; libelle: string }[] = [
  { id: "documents", libelle: "Documents et paiement" },
  { id: "toilette", libelle: "Toilette" },
  { id: "sante", libelle: "Soin et santé" },
  { id: "electronique", libelle: "Électronique" },
  { id: "equipement", libelle: "Équipement du séjour" },
];

export interface AffaireVoyage {
  id: string;
  libelle: string;
  groupe: GroupeAffaire;
  /** Pourquoi elle est proposée, quand elle dépend d'une donnée du séjour ; absent pour un essentiel. */
  raison?: string;
}

/** Le contexte réel du séjour : ce que la valise sait déjà, rien de plus. */
export interface ContexteSejour {
  programme: readonly ItemProgramme[];
  meteos: readonly MeteoJour[];
}

const au = (programme: readonly ItemProgramme[], ...ids: string[]) => ids.find((id) => programme.some((p) => p.id === id));

const LIBELLE_PROGRAMME: Record<string, string> = { plage: "Plage", piscine: "Piscine", randonnee: "Randonnée", spa: "Spa", sport: "Sport" };

/** Chaleur à partir de laquelle on propose la crème solaire sans plage ni piscine au programme (°C, prévue ou habituelle du lieu). */
export const SEUIL_CHALEUR = 24;
/** Froid en dessous duquel on propose gants et bonnet (°C). */
export const SEUIL_FROID = 5;

const ESSENTIELS: AffaireVoyage[] = [
  { id: "papiers", libelle: "Papiers d'identité", groupe: "documents" },
  { id: "paiement", libelle: "Carte bancaire et moyens de paiement", groupe: "documents" },
  { id: "reservations", libelle: "Billets et réservations", groupe: "documents" },
  { id: "brosse", libelle: "Brosse à dents", groupe: "toilette" },
  { id: "dentifrice", libelle: "Dentifrice", groupe: "toilette" },
  { id: "deodorant", libelle: "Déodorant", groupe: "toilette" },
  { id: "parfum", libelle: "Parfum", groupe: "toilette" },
  { id: "soins", libelle: "Soins habituels", groupe: "toilette" },
  { id: "medicaments", libelle: "Médicaments personnels", groupe: "sante" },
  { id: "chargeur", libelle: "Chargeur de téléphone", groupe: "electronique" },
];

/**
 * Les affaires d'un séjour : les essentiels, puis celles que le programme et la météo justifient. L'ordre est celui des groupes.
 * Les températures de `meteos` sont les prévisions ou, à défaut, les températures habituelles du lieu (jamais celles d'aujourd'hui quand on
 * part ailleurs) : `pluie` n'est lue que dans une PRÉVISION, comme partout dans la valise.
 */
export function affairesDuSejour(ctx: ContexteSejour): AffaireVoyage[] {
  const { programme, meteos } = ctx;
  const out: AffaireVoyage[] = [...ESSENTIELS];
  const max = meteos.length ? Math.max(...meteos.map((m) => m.temp)) : null;
  const min = meteos.length ? Math.min(...meteos.map((m) => m.temp)) : null;
  const pluie = meteos.some((m) => m.prevue && /pluie|pluvieux|averse|orage|bruine/i.test(m.label));

  const eau = au(programme, "plage", "piscine");
  if (eau) {
    out.push({ id: "maillot", libelle: "Maillot de bain", groupe: "equipement", raison: `${LIBELLE_PROGRAMME[eau]} au programme` });
    out.push({ id: "serviette", libelle: "Serviette de plage", groupe: "equipement", raison: `${LIBELLE_PROGRAMME[eau]} au programme` });
  }
  if (eau) out.push({ id: "creme_solaire", libelle: "Crème solaire", groupe: "sante", raison: `${LIBELLE_PROGRAMME[eau]} au programme` });
  else if (max !== null && max >= SEUIL_CHALEUR) out.push({ id: "creme_solaire", libelle: "Crème solaire", groupe: "sante", raison: `Chaleur attendue (jusqu'à ${max}°)` });

  if (au(programme, "randonnee")) {
    out.push({ id: "chaussures_rando", libelle: "Chaussures de randonnée", groupe: "equipement", raison: "Randonnée au programme" });
    out.push({ id: "gourde", libelle: "Gourde", groupe: "equipement", raison: "Randonnée au programme" });
  }
  if (au(programme, "spa")) out.push({ id: "maillot_spa", libelle: "Maillot de bain pour le spa", groupe: "equipement", raison: "Spa au programme" });
  if (pluie) out.push({ id: "parapluie", libelle: "Parapluie ou imperméable", groupe: "equipement", raison: "Pluie annoncée" });
  if (min !== null && min <= SEUIL_FROID) out.push({ id: "gants_bonnet", libelle: "Gants et bonnet", groupe: "equipement", raison: `Froid attendu (jusqu'à ${min}°)` });

  const ordre = GROUPES_AFFAIRES.map((g) => g.id);
  // Tri stable par groupe ; une même affaire n'apparaît qu'une fois.
  const vus = new Set<string>();
  return out
    .filter((a) => (vus.has(a.id) ? false : (vus.add(a.id), true)))
    .sort((a, b) => ordre.indexOf(a.groupe) - ordre.indexOf(b.groupe));
}

/**
 * La règle générale des liquides en cabine : seulement pour une valise S (la cabine) — dite comme règle générale, à vérifier selon la compagnie.
 * Rien pour les autres tailles : on ne sait pas si elles voyagent en soute.
 */
export function noteCabine(bagage: TailleBagage): string | null {
  return bagage === "S" ? "En cabine, les liquides sont généralement limités à 100 ml par contenant : vérifie la règle de ta compagnie." : null;
}

/** L'état des affaires gardé avec la valise : cochées, ajoutées par la personne, masquées. */
export interface EtatAffaires {
  cochees?: string[];
  ajoutees?: { id: string; libelle: string }[];
  masquees?: string[];
}

/** Les affaires affichées : celles du séjour moins les masquées, plus celles que la personne a ajoutées (groupe « Équipement du séjour »). */
export function affairesAffichees(ctx: ContexteSejour, etat: EtatAffaires | undefined): AffaireVoyage[] {
  const masquees = new Set(etat?.masquees ?? []);
  const propres: AffaireVoyage[] = (etat?.ajoutees ?? []).map((a) => ({ id: a.id, libelle: a.libelle, groupe: "equipement" as const, raison: "Ajoutée par toi" }));
  return [...affairesDuSejour(ctx).filter((a) => !masquees.has(a.id)), ...propres];
}

/** Les affaires masquées du séjour (pour pouvoir les réafficher). */
export const affairesMasquees = (ctx: ContexteSejour, etat: EtatAffaires | undefined): AffaireVoyage[] => {
  const masquees = new Set(etat?.masquees ?? []);
  return affairesDuSejour(ctx).filter((a) => masquees.has(a.id));
};

/** Les cases cochées qui existent encore (une affaire masquée ou retirée ne compte plus). */
export function cocheesValides(affichees: readonly AffaireVoyage[], etat: EtatAffaires | undefined): string[] {
  const ids = new Set(affichees.map((a) => a.id));
  return (etat?.cochees ?? []).filter((id) => ids.has(id));
}

export const LIBELLE_AJOUT_MAX = 60;
/** Un libellé ajouté à la main : rogné, sans doublon d'une affaire déjà affichée (sans tenir compte de la casse). */
export function libelleAjoutValide(libelle: string, affichees: readonly AffaireVoyage[]): string | null {
  const net = libelle.trim().replace(/\s+/g, " ").slice(0, LIBELLE_AJOUT_MAX);
  if (net.length < 2) return null;
  return affichees.some((a) => a.libelle.toLowerCase() === net.toLowerCase()) ? null : net;
}
