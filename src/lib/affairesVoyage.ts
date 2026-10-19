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
 *
 * ÉTOFFÉ LE 19/10/2026 (demandé : « inspire-toi de cette liste », infographie « Les choses à avoir dans sa valise »). Repris de la liste :
 * ce que le dressing ne porte pas (linge, nuit), la toilette, la trousse de secours, la carte Vitale, l'assurance, l'électronique, et, liés
 * à une donnée du séjour, la plage (tongs, sac de plage, lunettes, chapeau) et le trajet (écouteurs, livre, coussin, en-cas). Écartés :
 * les vêtements, sacs, bijoux, montre, ceinture et foulard (la valise les choisit dans le dressing, avec les looks) ; l'adaptateur de
 * prise n'est proposé qu'en essentiel « si tu pars à l'étranger » : la valise ne connaît pas le pays de destination.
 */

export type GroupeAffaire = "documents" | "linge" | "toilette" | "sante" | "electronique" | "trajet" | "equipement";

export const GROUPES_AFFAIRES: { id: GroupeAffaire; libelle: string }[] = [
  { id: "documents", libelle: "Documents et paiement" },
  { id: "linge", libelle: "Linge et nuit" },
  { id: "toilette", libelle: "Toilette" },
  { id: "sante", libelle: "Soin et santé" },
  { id: "electronique", libelle: "Électronique" },
  { id: "trajet", libelle: "Pour le trajet" },
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
  { id: "carte_vitale", libelle: "Carte Vitale", groupe: "documents" },
  { id: "assurance", libelle: "Assurance voyage, si tu en as une", groupe: "documents" },
  { id: "sous_vetements", libelle: "Sous-vêtements", groupe: "linge" },
  { id: "chaussettes", libelle: "Chaussettes", groupe: "linge" },
  { id: "pyjama", libelle: "Pyjama", groupe: "linge" },
  { id: "sac_linge", libelle: "Sac pour le linge sale", groupe: "linge" },
  { id: "brosse", libelle: "Brosse à dents", groupe: "toilette" },
  { id: "dentifrice", libelle: "Dentifrice", groupe: "toilette" },
  { id: "gel_douche", libelle: "Gel douche et shampoing", groupe: "toilette" },
  { id: "deodorant", libelle: "Déodorant", groupe: "toilette" },
  { id: "brosse_cheveux", libelle: "Brosse ou peigne", groupe: "toilette" },
  { id: "elastiques", libelle: "Élastiques et pinces", groupe: "toilette" },
  { id: "parfum", libelle: "Parfum", groupe: "toilette" },
  { id: "maquillage", libelle: "Maquillage et démaquillant", groupe: "toilette" },
  { id: "rasoir", libelle: "Rasoir ou épilateur", groupe: "toilette" },
  { id: "soins", libelle: "Soins habituels", groupe: "toilette" },
  { id: "medicaments", libelle: "Médicaments personnels", groupe: "sante" },
  { id: "trousse_secours", libelle: "Petite trousse de secours", groupe: "sante" },
  { id: "chargeur", libelle: "Chargeur de téléphone", groupe: "electronique" },
  { id: "batterie", libelle: "Batterie externe", groupe: "electronique" },
  { id: "adaptateur", libelle: "Adaptateur de prise, si tu pars à l'étranger", groupe: "electronique" },
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
    const raison = `${LIBELLE_PROGRAMME[eau]} au programme`;
    out.push({ id: "maillot", libelle: "Maillot de bain", groupe: "equipement", raison });
    out.push({ id: "serviette", libelle: "Serviette de plage", groupe: "equipement", raison });
    out.push({ id: "tongs", libelle: "Tongs ou sandales de plage", groupe: "equipement", raison });
    out.push({ id: "sac_plage", libelle: "Sac de plage", groupe: "equipement", raison });
  }
  // Lunettes de soleil et chapeau : l'eau au programme, sinon la chaleur — même règle que la crème solaire.
  const soleil = eau ? `${LIBELLE_PROGRAMME[eau]} au programme` : max !== null && max >= SEUIL_CHALEUR ? `Chaleur attendue (jusqu'à ${max}°)` : null;
  if (soleil) {
    out.push({ id: "lunettes_soleil", libelle: "Lunettes de soleil", groupe: "equipement", raison: soleil });
    out.push({ id: "chapeau", libelle: "Chapeau ou casquette", groupe: "equipement", raison: soleil });
  }
  if (eau) out.push({ id: "creme_solaire", libelle: "Crème solaire", groupe: "sante", raison: `${LIBELLE_PROGRAMME[eau]} au programme` });
  else if (max !== null && max >= SEUIL_CHALEUR) out.push({ id: "creme_solaire", libelle: "Crème solaire", groupe: "sante", raison: `Chaleur attendue (jusqu'à ${max}°)` });

  if (au(programme, "randonnee")) {
    out.push({ id: "chaussures_rando", libelle: "Chaussures de randonnée", groupe: "equipement", raison: "Randonnée au programme" });
    out.push({ id: "gourde", libelle: "Gourde", groupe: "equipement", raison: "Randonnée au programme" });
  }
  if (au(programme, "trajet")) {
    for (const [id, libelle] of [["ecouteurs", "Écouteurs"], ["livre", "Livre ou liseuse"], ["coussin", "Coussin de voyage"], ["en_cas", "En-cas et bouteille d'eau"]] as const) {
      out.push({ id, libelle, groupe: "trajet", raison: "Trajet au programme" });
    }
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
