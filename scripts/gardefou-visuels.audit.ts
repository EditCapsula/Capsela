import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { CATEGORY_CANON, CATEGORY_FOLDER } from "../supabase/functions/_shared/imagePrompt.ts";

// GARDE-FOU : LE CHEMIN DU VISUEL DOIT DIRE CE QU'EST LA PIÈCE — LECTURE SEULE.
//
// POURQUOI IL EXISTE. Le 15/09/2026, une utilisatrice signale un « Pull col V »
// affiché avec la photo d'un T-shirt gris. L'audit `visuels-partages` remonte
// 53 pièces dans ce cas : 20 servies depuis le dossier d'une autre catégorie,
// 36 depuis celui d'un autre genre (recoupements compris).
//
// La cause racine n'est pas la génération : c'est que `url_image` n'a JAMAIS
// été rafraîchi quand la `category` ou le `genre` d'une ligne a changé. Le
// chemin Storage, lui, est écrit une fois pour toutes au moment de la
// génération (`generate-catalog-image/index.ts`, ligne 495) et n'est jamais
// retouché. Il reste donc le seul témoin fiable de ce qui a été dessiné —
// `image_prompt`, lui, a été rafraîchi depuis, et la comparaison prompt contre
// prompt du 15/09 ne voyait plus rien (0 sur 617), alors que 53 visuels
// étaient bel et bien faux.
//
// Sans ce garde-fou, la dérive recommence en silence à la prochaine
// recatégorisation, et il faudra repayer une campagne de régénération.
//
// CE QU'IL VÉRIFIE, et rien d'autre : que pour chaque ligne servie depuis le
// bucket `catalog-images`, les deux segments du chemin `{genre}/{dossier}/`
// correspondent aux champs `genre` et `category` de la fiche. Il ne dit rien
// de la QUALITÉ du visuel (un pull correctement rangé mais mal dessiné passe
// ici) — seulement de sa cohérence avec la fiche.
//
// L'EXEMPTION, et pourquoi elle est nécessaire. Pour `bijou` et `accessoire`,
// le partage d'un visuel entre genres est DÉLIBÉRÉ : `generate-catalog-image`
// réutilise un asset existant sans considérer le genre (step 4, correctif du
// 20/08/2026), parce qu'un bonnet ou une ceinture n'a pas de rendu genré. Sans
// cette exemption, le garde-fou crierait sur un comportement voulu.
//
// Les SACS en sont explicitement exclus : ils avaient été retirés du repli
// sans genre le 21/08/2026 (un cabas homme héritait de la version femme, rendu
// trop féminin). Un sac est donc bien tenu au genre, ici comme dans la
// fonction.
//
// Le contrôle de dérive ci-dessous relit la constante dans le source de la
// fonction : si quelqu'un ajoute ou retire une catégorie agnostique là-bas, ce
// garde-fou échoue plutôt que d'exempter silencieusement la mauvaise chose.
//
// Aucune écriture, aucun ALTER, aucune régénération déclenchée.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Miroir de `GENRE_AGNOSTIC_CATEGORIES` (generate-catalog-image/index.ts).
 * Dupliqué et non importé : `index.ts` est du Deno et tire des imports par URL
 * que Vitest ne sait pas résoudre. La duplication est tenue honnête par
 * `verifieNonDerive` ci-dessous.
 */
const GENRE_AGNOSTIC_CATEGORIES = new Set(["bijou", "accessoire"]);
const SOURCE_FONCTION = "supabase/functions/generate-catalog-image/index.ts";

/** Relit la constante côté fonction et échoue si elle ne dit plus la même chose. */
function verifieNonDerive(): void {
  const source = readFileSync(SOURCE_FONCTION, "utf8");
  const m = /GENRE_AGNOSTIC_CATEGORIES\s*=\s*new Set\(\[([^\]]*)\]\)/.exec(source);
  if (!m) throw new Error(`${SOURCE_FONCTION} ne déclare plus GENRE_AGNOSTIC_CATEGORIES sous une forme reconnaissable — exemption non vérifiable, garde-fou arrêté.`);
  const laBas = new Set(m[1].split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean));
  const ici = [...GENRE_AGNOSTIC_CATEGORIES].sort().join(",");
  const source2 = [...laBas].sort().join(",");
  if (ici !== source2) {
    throw new Error(
      `Exemption de genre désynchronisée.\n` +
        `  ici          : {${ici}}\n` +
        `  ${SOURCE_FONCTION} : {${source2}}\n` +
        `  Aligner ce garde-fou sur la fonction avant de conclure quoi que ce soit.`
    );
  }
}

interface Ligne {
  id: number;
  name: string | null;
  category: string | null;
  genre: string | null;
  couleur_dominante: string | null;
  url_image: string | null;
}

interface Violation {
  ligne: Ligne;
  axe: "catégorie" | "genre" | "catégorie inconnue";
  attendu: string;
  trouve: string;
}

const court = (s: string | null, n: number) => (s ?? "—").slice(0, n).padEnd(n);

/** Les deux segments que porte un chemin `catalog-images/{genre}/{dossier}/…`. */
function segments(url: string): { genre: string; dossier: string } | null {
  const m = /catalog-images\/([^/]+)\/([^/]+)\//.exec(url);
  return m ? { genre: m[1], dossier: m[2] } : null;
}

/**
 * Le détecteur, isolé du transport : il ne lit rien, il juge une liste de
 * lignes. C'est ce qui permet de le mettre à l'épreuve sur des cas fabriqués
 * (voir la contre-épreuve ci-dessous) au lieu de le croire sur parole.
 */
function analyser(lignes: Ligne[]): { violations: Violation[]; examinees: number } {
  const violations: Violation[] = [];
  let examinees = 0;

  for (const l of lignes) {
    // Seules les lignes servies par le bucket sont concernées : une image
    // affiliée ou une photo utilisateur ne porte pas ce chemin et ne dit
    // donc rien de la catégorie.
    const seg = l.url_image ? segments(l.url_image) : null;
    if (!seg) continue;
    examinees++;

    const canon = CATEGORY_CANON[(l.category || "").trim().toLowerCase()];
    if (!canon) {
      // Même refus que la fonction (index.ts:333) : jamais de repli silencieux
      // sur "accessoire", qui ferait collisionner des pièces sans rapport.
      violations.push({ ligne: l, axe: "catégorie inconnue", attendu: "une entrée de CATEGORY_CANON", trouve: l.category ?? "—" });
      continue;
    }

    const dossierAttendu = CATEGORY_FOLDER[canon] || canon;
    if (seg.dossier !== dossierAttendu) {
      violations.push({ ligne: l, axe: "catégorie", attendu: dossierAttendu, trouve: seg.dossier });
    }

    // `unisexe` est une valeur légitime du catalogue, comparée telle quelle :
    // ce n'est pas un joker. L'exemption ne porte que sur les catégories
    // dont le rendu n'est pas genré.
    if (!GENRE_AGNOSTIC_CATEGORIES.has(canon)) {
      const genreAttendu = (l.genre || "").trim().toLowerCase();
      if (seg.genre !== genreAttendu) {
        violations.push({ ligne: l, axe: "genre", attendu: genreAttendu || "—", trouve: seg.genre });
      }
    }
  }

  return { violations, examinees };
}

const URL_BASE = "https://tkrbzrazejrxavtfspll.supabase.co/storage/v1/object/public/catalog-images";
const cas = (id: number, name: string, category: string, genre: string, chemin: string): Ligne => ({
  id,
  name,
  category,
  genre,
  couleur_dominante: null,
  url_image: `${URL_BASE}/${chemin}/${id}.webp`,
});

describe("garde-fou : chemin du visuel contre fiche", () => {
  // CONTRE-ÉPREUVE, et elle n'est pas décorative.
  //
  // Le catalogue est propre depuis la campagne du 15/09. Un garde-fou qui rend
  // vert sur un catalogue propre n'a RIEN démontré : il rendrait exactement le
  // même vert s'il ne détectait rien du tout. La règle d'audit interdit de
  // présenter cette absence comme une preuve.
  //
  // On lui soumet donc, hors réseau, les quatre cas qui comptent — dont celui
  // qui ne doit PAS le déclencher, sans quoi l'exemption ne serait pas testée
  // non plus.
  it("détecte bien les deux axes, et se tait sur l'exemption", () => {
    const { violations, examinees } = analyser([
      cas(1, "Pull col V femme, bien rangé", "pulls_gilets", "femme", "femme/pulls-gilets"),
      cas(2, "Pull servi depuis hauts", "pulls_gilets", "femme", "femme/hauts"),
      cas(3, "Pull homme servi depuis femme", "pulls_gilets", "homme", "femme/pulls-gilets"),
      cas(4, "Bonnet femme servi depuis homme", "accessoires", "femme", "homme/accessoires"),
      cas(5, "Sac homme servi depuis femme", "sacs", "homme", "femme/sacs"),
      { id: 6, name: "Photo affiliée, hors bucket", category: "hauts", genre: "femme", couleur_dominante: null, url_image: "https://exemple.test/photo.jpg" },
    ]);

    expect(examinees, "la ligne hors bucket ne doit pas être examinée").toBe(5);
    expect(violations.map((v) => `${v.ligne.id}:${v.axe}`)).toEqual([
      "2:catégorie", // le cas signalé le 15/09 — un pull illustré par un haut
      "3:genre", // une pièce homme illustrée par un visuel femme
      "5:genre", // les sacs restent tenus au genre (retirés de l'exemption le 21/08)
    ]);
    // La ligne 4 est absente de la liste : c'est l'exemption, et c'est voulu.
  });

  it("aucune pièce n'est servie depuis le dossier d'une autre catégorie ni d'un autre genre", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    verifieNonDerive();

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data, error } = await supabase
      .from("vestiaire_universel")
      .select("id, name, category, genre, couleur_dominante, url_image")
      .order("id", { ascending: true })
      .returns<Ligne[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);

    const { violations, examinees } = analyser(data);

    const exemptees = data.filter((l) => {
      const canon = CATEGORY_CANON[(l.category || "").trim().toLowerCase()];
      const seg = l.url_image ? segments(l.url_image) : null;
      return seg && canon && GENRE_AGNOSTIC_CATEGORIES.has(canon) && seg.genre !== (l.genre || "").trim().toLowerCase();
    });

    console.log(`Catalogue : ${data.length} lignes, ${examinees} servies depuis catalog-images.`);
    console.log(`Exemption de genre (${[...GENRE_AGNOSTIC_CATEGORIES].join(", ")}) : ${exemptees.length} pièce(s) partagent un visuel inter-genre — voulu, cf. index.ts:51.`);
    for (const l of exemptees.slice(0, 20)) {
      console.log(`     id ${String(l.id).padStart(5)}  ${court(l.category, 14)}${court(l.genre, 9)}${court(l.couleur_dominante, 14)}${l.name ?? ""}`);
    }
    if (exemptees.length > 20) console.log(`     … et ${exemptees.length - 20} de plus.`);

    if (violations.length) {
      console.log(`\n════════ ${violations.length} VIOLATION(S) ════════`);
      console.log(`  ${"id".padStart(6)}  ${court("axe", 20)}${court("attendu", 24)}${court("trouvé", 24)}nom`);
      for (const v of violations) {
        console.log(`  ${String(v.ligne.id).padStart(6)}  ${court(v.axe, 20)}${court(v.attendu, 24)}${court(v.trouve, 24)}${v.ligne.name ?? ""}`);
        console.log(`          ${v.ligne.url_image}`);
      }
      const ids = [...new Set(violations.map((v) => v.ligne.id))].sort((a, b) => a - b);
      console.log(`\n  À REPRENDRE : ${ids.length} pièce(s)`);
      console.log(`  IDS=${ids.join(",")}`);
      console.log(`  (workflow « Régénérer les visuels au sujet faux », mode=regen — ~0,02 $ la pièce.)`);
    }

    console.log(`\n  LECTURE SEULE. Aucune écriture, aucune génération de visuel déclenchée.`);

    expect(
      violations.map((v) => `#${v.ligne.id} ${v.ligne.name ?? ""} — ${v.axe} : attendu ${v.attendu}, trouvé ${v.trouve}`),
      "Des visuels ne correspondent plus à leur fiche — voir la liste IDS= ci-dessus."
    ).toEqual([]);
  });
});
