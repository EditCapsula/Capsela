import { accordAPlusieursCouleurs } from "./accordsCouleurs";
import { formalityOf, isNeutralColor, isStatement, matiereOf } from "./attributes";
import { STYLE_ID_TO_CATALOG_LABEL, styleLabel, type Gender, type StyleId } from "./profile";
import type { DateContext, Item, OccasionKey, WorkMode } from "./types";
import { langue, t } from "./langue";

/**
 * LE BLOC ÉDITORIAL D'UNE TENUE RECOMMANDÉE (12/11/2026, brief « Optimiser le bloc éditorial des recommandations de tenues »).
 *
 * Un titre de 2 à 4 mots qui dit le STYLE RÉEL du look (« Casual et structuré »), et une phrase de 8 à 12 mots, 100 caractères au
 * plus, qui dit pourquoi il convient à l'occasion (« Des lignes nettes pour une journée au bureau. »). Tout vient des pièces
 * affichées et du contexte de l'occasion — jamais de la personne : le look a un caractère, pas elle.
 *
 * Remplace, sur les tenues recommandées :
 *   · le titre qui nommait deux pièces (titreDeLaTenue, 17/10/2026) : il répétait le flat lay, juste à côté ;
 *   · le titre fixe par occasion (titreEditorialOccasion) : le même pour toutes les tenues d'une occasion, et accordé au féminin pour
 *     tous (« Féminine et minimaliste » sur un profil homme) ;
 *   · la phrase de la météo (qualificatifLook) : la météo est déjà sur la ligne du jour.
 * Les mots sont accordés au masculin, celui du « look » : la même écriture pour les profils femme et homme.
 *
 * DEUX LECTURES, CHACUNE SUR DES DONNÉES DES PIÈCES (ARBITRAGE ÉDITORIAL du 12/11/2026, des ordres de grandeur) :
 *   · le REGISTRE, par la formalité moyenne des vêtements et des chaussures (formalityOf, 0 à 4) — ou l'occasion quand elle le dit
 *     d'elle-même (sport, maison) ;
 *   · le CARACTÈRE, par la première marque nette du look, dans cet ordre : une pièce forte (isStatement), un accord de plusieurs
 *     couleurs (accordsCouleurs.ts), une structure (blazer, veste structurée, manteau), une matière fluide (robe, jupe, soie, lin,
 *     veste fluide), une allure urbaine (baskets avec un jean ou un sweat), des couleurs toutes neutres ; sinon « intemporel ».
 * Sans pièce, le repli dit l'occasion seule : jamais un caractère inventé.
 */
export interface TexteLook {
  titre: { a: string; b: string };
  phrase: string;
}

type Caractere = "affirme" | "nuance" | "structure" | "fluide" | "urbain" | "minimaliste" | "intemporel";

const CARACTERES: Record<Caractere, { adjectif: string; sujet: string }> = {
  affirme: { adjectif: "affirmé", sujet: "Une pièce forte" },
  nuance: { adjectif: "nuancé", sujet: "Des couleurs accordées" },
  structure: { adjectif: "structuré", sujet: "Des lignes nettes" },
  fluide: { adjectif: "fluide", sujet: "Des matières légères" },
  urbain: { adjectif: "urbain", sujet: "Des coupes actuelles" },
  minimaliste: { adjectif: "minimaliste", sujet: "Une silhouette épurée" },
  intemporel: { adjectif: "intemporel", sujet: "Des pièces intemporelles" },
};

/*
 * L'ANGLAIS (13/11/2026, docs/traduction.md) : les MÊMES lectures des pièces, écrites en anglais idiomatique — pas un mot à mot. Le
 * registre et le caractère gardent leur sens (« Casual and structured », « Clean lines for a day at the office. »).
 */
const CARACTERES_EN: Record<Caractere, { adjectif: string; sujet: string }> = {
  affirme: { adjectif: "bold", sujet: "A statement piece" },
  nuance: { adjectif: "nuanced", sujet: "Coordinated colours" },
  structure: { adjectif: "structured", sujet: "Clean lines" },
  fluide: { adjectif: "fluid", sujet: "Light fabrics" },
  urbain: { adjectif: "urban", sujet: "Modern cuts" },
  minimaliste: { adjectif: "minimal", sujet: "A pared-back silhouette" },
  intemporel: { adjectif: "timeless", sujet: "Timeless pieces" },
};
const REGISTRES_EN: Record<string, string> = { Sportif: "Sporty", Douillet: "Cosy", Décontracté: "Relaxed", Casual: "Casual", Chic: "Chic", Élégant: "Elegant" };

function contexteEn(occasion: OccasionKey, workMode: WorkMode, dateContext: DateContext): string {
  switch (occasion) {
    case "quotidien":
      return "an effortless everyday";
    case "travail_formel":
      return workMode === "Télétravail" ? "a day working from home" : workMode === "Entretien" ? "an important meeting" : "a day at the office";
    case "date":
      return dateContext === "Restaurant / date romantique" ? "a dinner for two" : dateContext === "Soirée festive" ? "a festive evening" : "a date";
    case "soiree":
      return "a night out";
    case "sport":
      return "a workout";
    case "cocooning":
      return "a day at home";
    case "voyage":
      return "a travel day";
    case "evenement_perso":
      return "an occasion that matters";
    default:
      return "a busy day";
  }
}

const VETEMENTS: Item["cat"][] = ["haut", "pull", "pantalon", "jean", "jupe", "short", "robe", "combinaison", "veste", "manteau"];
const MATIERES_FLUIDES = new Set(["Soie", "Lin", "Viscose", "Satin", "Mousseline"]);

function registre(pieces: readonly Item[], occasion: OccasionKey): string {
  if (occasion === "sport") return "Sportif";
  if (occasion === "cocooning") return "Douillet";
  const portees = pieces.filter((p) => VETEMENTS.includes(p.cat) || p.cat === "chaussures");
  if (!portees.length) return "Casual";
  const f = portees.reduce((s, p) => s + formalityOf(p), 0) / portees.length;
  if (f < 1.5) return "Décontracté";
  if (f < 2.5) return "Casual";
  if (f < 3.5) return "Chic";
  return "Élégant";
}

function caractere(pieces: readonly Item[]): Caractere {
  const vetements = pieces.filter((p) => VETEMENTS.includes(p.cat));
  const sansBijou = pieces.filter((p) => p.cat !== "bijou");
  if (pieces.some(isStatement)) return "affirme";
  if (accordAPlusieursCouleurs(sansBijou)) return "nuance";
  const structure = pieces.some(
    (p) => p.cat === "manteau" || (p.cat === "veste" && (p.couche === "structuree" || /blazer|tailleur/i.test(`${p.subtype ?? ""} ${p.name}`)))
  );
  if (structure) return "structure";
  const fluide = pieces.some(
    (p) => p.cat === "robe" || p.cat === "jupe" || (p.cat === "veste" && p.couche === "fluide") || (VETEMENTS.includes(p.cat) && MATIERES_FLUIDES.has(matiereOf(p)))
  );
  if (fluide) return "fluide";
  const baskets = pieces.some((p) => p.cat === "chaussures" && p.shoeType === "Baskets");
  if (baskets && pieces.some((p) => p.cat === "jean" || /sweat|hoodie/i.test(p.name))) return "urbain";
  if (vetements.length && vetements.every((p) => isNeutralColor(p.color))) return "minimaliste";
  return "intemporel";
}

/** Le contexte de l'occasion, à l'article indéfini (« une journée au bureau ») : ce qui rend la tenue pertinente, sans parler de la personne. */
export function contexteDeLOccasion(occasion: OccasionKey, workMode: WorkMode, dateContext: DateContext): string {
  switch (occasion) {
    case "quotidien":
      return "un quotidien sans effort";
    case "travail_formel":
      return workMode === "Télétravail" ? "une journée en télétravail" : workMode === "Entretien" ? "un rendez-vous important" : "une journée au bureau";
    case "date":
      return dateContext === "Restaurant / date romantique" ? "un dîner en tête-à-tête" : dateContext === "Soirée festive" ? "une soirée festive" : "un rendez-vous à deux";
    case "soiree":
      return "une soirée en ville";
    case "sport":
      return "une séance de sport";
    case "cocooning":
      return "une journée à la maison";
    case "voyage":
      return "un jour de voyage";
    case "evenement_perso":
      return "un événement qui compte";
    default:
      return "une journée bien remplie";
  }
}

/**
 * LE STYLE DU PROFIL QUE LE LOOK PORTE VRAIMENT (12/11/2026, « Pourquoi cette tenue ? ») : le premier style déclaré dont l'étiquette
 * catalogue figure sur une pièce du look. Aucun : null — la phrase ne dit alors rien du style, plutôt qu'une promesse fausse.
 */
export function styleDuLook(pieces: readonly Item[], styles: readonly string[], gender: Gender | null): string | null {
  for (const id of styles) {
    const etiquette = STYLE_ID_TO_CATALOG_LABEL[id as StyleId];
    if (etiquette && pieces.some((p) => p.styleTags?.includes(etiquette))) return t(styleLabel(id, gender)).toLowerCase() || null;
  }
  return null;
}

/**
 * `style` : celui que le look porte vraiment (styleDuLook). La phrase le dit alors en fin (« …, dans ton style minimaliste. »), la
 * seule mention de la personne : c'est son style déclaré, pas un trait de caractère. Jamais au-delà de 12 mots : sinon, sans lui.
 */
export function texteEditorialLook(pieces: readonly Item[], occasion: OccasionKey, workMode: WorkMode, dateContext: DateContext, style: string | null = null): TexteLook {
  if (langue() === "en") {
    const contexteEnLigne = contexteEn(occasion, workMode, dateContext);
    if (!pieces.length) return { titre: { a: "Your outfit", b: "of the day" }, phrase: `An outfit designed for ${contexteEnLigne}.` };
    const ce = CARACTERES_EN[caractere(pieces)];
    const baseEn = `${ce.sujet} for ${contexteEnLigne}`;
    const avecStyleEn = style ? `${baseEn}, in your ${style} style.` : null;
    const phraseEn = avecStyleEn && avecStyleEn.split(/\s+/).length <= 12 && avecStyleEn.length <= 100 ? avecStyleEn : `${baseEn}.`;
    const r = registre(pieces, occasion);
    return { titre: { a: REGISTRES_EN[r] ?? r, b: `and ${ce.adjectif}` }, phrase: phraseEn };
  }
  const contexte = contexteDeLOccasion(occasion, workMode, dateContext);
  if (!pieces.length) return { titre: { a: "Ta tenue", b: "du jour" }, phrase: `Une tenue pensée pour ${contexte}.` };
  const c = CARACTERES[caractere(pieces)];
  const r = registre(pieces, occasion);
  const base = `${c.sujet} pour ${contexte}`;
  const avecStyle = style ? `${base}, dans ton style ${style}.` : null;
  const phrase = avecStyle && avecStyle.split(/\s+/).length <= 12 && avecStyle.length <= 100 ? avecStyle : `${base}.`;
  return { titre: { a: r, b: `et ${c.adjectif}` }, phrase };
}

/** Le titre sur une ligne (« Casual et structuré »), pour les cartes qui n'ont pas de second temps en italique. */
export const titreEnLigne = (t: TexteLook["titre"]): string => (t.b ? `${t.a} ${t.b}` : t.a);
