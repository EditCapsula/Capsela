import type { CategoryKey, Couche, Item, Longueur } from "./types";

/*
 * LA LONGUEUR ET LA COUCHE D'UNE PIÈCE (12/11/2026, retour d'une testeuse : « robe longue noire + kimono + manteau court » ; choisi par
 * la propriétaire : les demander à l'ajout de la pièce, et les lire sur la photo). Colonnes `longueur` et `couche`, migration 0062.
 *
 *   · LA LONGUEUR (courte, midi, longue) d'une robe, d'une jupe, d'un manteau ;
 *   · LA COUCHE d'une veste : structurée (blazer, perfecto, veste épaisse) ou fluide (veste légère, voile, maille fine). Un kimono peut
 *     être l'un ou l'autre, court ou long, et se porte sous un manteau sur une pièce principale (arbitré le 12/11/2026) ;
 *   · depuis le même jour, LA LONGUEUR d'une veste aussi : une veste portée sous un manteau n'est pas plus longue que lui (validé).
 *
 * Facultatives, jamais déduites d'un nom : une pièce sans valeur est INCONNUE, et le moteur la traite comme avant. L'analyse de la photo
 * les propose (« Détecté par Capsela »), la personne les confirme ou les change. Ce sont des attributs du VÊTEMENT, jamais de la personne.
 *
 * LES LISTES restent identiques à celles des fonctions Edge (supabase/functions/_shared/enumsPiece.ts) : un test le verrouille.
 */
export const LONGUEURS: readonly { valeur: Longueur; libelle: string }[] = [
  { valeur: "courte", libelle: "Courte" },
  { valeur: "midi", libelle: "Midi" },
  { valeur: "longue", libelle: "Longue" },
];
export const COUCHES: readonly { valeur: Couche; libelle: string; aide: string }[] = [
  // Un kimono peut être l'un ou l'autre (12/11/2026, rappelé par la propriétaire) : il n'est l'exemple d'aucun des deux.
  { valeur: "structuree", libelle: "Structurée", aide: "Blazer, perfecto, veste épaisse" },
  { valeur: "fluide", libelle: "Fluide", aide: "Veste légère, voile, maille fine" },
];

// La veste depuis le 12/11/2026 (validé : « une veste portée sous un manteau ne doit pas être plus longue que lui ») : un kimono peut
// être court ou long.
export const CATEGORIES_A_LONGUEUR: readonly CategoryKey[] = ["robe", "jupe", "manteau", "veste"];
export const aUneLongueur = (cat: CategoryKey): boolean => CATEGORIES_A_LONGUEUR.includes(cat);
export const aUneCouche = (cat: CategoryKey): boolean => cat === "veste";

export function longueurDepuis(brut: string | null | undefined): Longueur | undefined {
  return LONGUEURS.find((l) => l.valeur === brut)?.valeur;
}
export function coucheDepuis(brut: string | null | undefined): Couche | undefined {
  return COUCHES.find((c) => c.valeur === brut)?.valeur;
}

export const libelleLongueur = (l: Longueur): string => LONGUEURS.find((x) => x.valeur === l)!.libelle;
export const libelleCouche = (c: Couche): string => COUCHES.find((x) => x.valeur === c)!.libelle;

/** Une veste déclarée fluide. Inconnue : false. */
export const estCoucheFluide = (it: Pick<Item, "cat" | "couche">): boolean => it.cat === "veste" && it.couche === "fluide";

const RANG_LONGUEUR: Record<Longueur, number> = { courte: 0, midi: 1, longue: 2 };
/**
 * UNE VESTE PLUS LONGUE QUE LE MANTEAU QUI LA COUVRE (12/11/2026, validé par la propriétaire) : elle dépasserait dessous. Vrai seulement si
 * les DEUX longueurs sont connues ; sinon faux, le moteur comme avant.
 */
export function vestePlusLongueQueLeManteau(veste: Pick<Item, "cat" | "longueur">, manteau: Pick<Item, "cat" | "longueur">): boolean {
  if (veste.cat !== "veste" || manteau.cat !== "manteau" || !veste.longueur || !manteau.longueur) return false;
  return RANG_LONGUEUR[veste.longueur] > RANG_LONGUEUR[manteau.longueur];
}

/**
 * LA LONGUEUR LUE DANS LE NOM — pour PROPOSER celle des pièces du catalogue (16/11/2026, choisi par la propriétaire : « un tri
 * automatique d'après le nom des pièces, que tu relis avant que je l'applique », puis l'analyse des images pour le reste). Ce n'est
 * jamais une lecture du moteur : la proposition est relue, puis écrite dans la colonne `longueur` (migration 0064) par un SQL validé.
 *
 * Seuls des mots qui disent la longueur DU VÊTEMENT : « court », « mini », « crop » ; « midi », « mi-long » ; « long », « maxi »,
 * « cheville ». Un mot qui suit « manches », « col » ou « épaules » parle d'autre chose (« chemise manches longues »). « Genou » n'est
 * pas retenu : au-dessus ou au-dessous, il ne tranche pas. Aucun mot, ou deux longueurs contraires : null, la pièce passe à l'image.
 */
const MOTS_LONGUEUR: readonly { valeur: Longueur; mots: readonly string[] }[] = [
  { valeur: "courte", mots: ["court", "courte", "courts", "courtes", "mini", "crop", "cropped", "ras"] },
  { valeur: "midi", mots: ["midi", "mi-long", "mi-longue", "milong", "milongue"] },
  { valeur: "longue", mots: ["long", "longue", "longs", "longues", "maxi", "cheville", "chevilles"] },
];
const PORTEURS = new Set(["manche", "manches", "col", "cols", "epaule", "epaules"]);

export function longueurDepuisLeNom(cat: CategoryKey, ...textes: (string | null | undefined)[]): Longueur | null {
  if (!aUneLongueur(cat)) return null;
  const t = textes
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/mi[\s-]+long(ue)?s?/g, (m) => (m.includes("longue") ? "mi-longue" : "mi-long"));
  const mots = t.split(/[^a-z0-9-]+/).filter(Boolean);
  const trouvees = new Set<Longueur>();
  mots.forEach((m, i) => {
    if (PORTEURS.has(mots[i - 1] ?? "")) return;
    for (const { valeur, mots: liste } of MOTS_LONGUEUR) if (liste.includes(m)) trouvees.add(valeur);
  });
  return trouvees.size === 1 ? [...trouvees][0] : null;
}
