import { describe, expect, it } from "vitest";
import {
  APPELS_MAX,
  choisirPiecesDressing,
  construireRequeteOpenAI,
  dimensionsJpeg,
  extraireTexteReponse,
  formulerContexte,
  INSTRUCTIONS,
  MOTS_INTERDITS,
  nettoyerContexte,
  traiterDemandeAvis,
  validerImage,
  validerReponse,
  violationCharte,
  type BesoinDressing,
  type DependancesAvis,
  type JournalUsage,
  type PieceDressing,
} from "../../../supabase/functions/_shared/avisStyliste.ts";
import type { LecteurPremium } from "../../../supabase/functions/_shared/premium.ts";

/* ───────── Fixtures ───────── */

/** En-tête JPEG minimal (SOI, APP0, SOF0) aux dimensions voulues. */
function jpeg(largeur: number, hauteur: number, remplissage = 0): Uint8Array {
  const app0 = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00];
  const sof0 = [0xff, 0xc0, 0x00, 0x11, 0x08, hauteur >> 8, hauteur & 255, largeur >> 8, largeur & 255, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
  return new Uint8Array([0xff, 0xd8, ...app0, ...sof0, ...new Array(remplissage).fill(0), 0xff, 0xd9]);
}
const dataUrl = (o: Uint8Array, type = "image/jpeg") => `data:${type};base64,${Buffer.from(o).toString("base64")}`;
const IMAGE = dataUrl(jpeg(1200, 900));

const AVIS = {
  isAnalyzable: true,
  unanalyzableReason: null,
  overallAssessment: "Ta tenue est harmonieuse : les tons neutres créent une allure douce et cohérente.",
  strengths: ["Le camel et le crème se répondent très bien.", "La coupe droite du pantalon donne une ligne nette."],
  mainAdvice: "Pour donner davantage de relief, tu pourrais marquer la taille avec une ceinture structurée.",
  suggestions: ["Tu pourrais essayer des mocassins.", "Une autre option serait d'ajouter un bijou doré discret."],
  dressingNeeds: [] as unknown[],
};
const reponseOpenAI = (contenu: unknown, extra: Record<string, unknown> = {}) => ({
  status: "completed",
  output: [{ type: "message", content: [{ type: "output_text", text: typeof contenu === "string" ? contenu : JSON.stringify(contenu) }] }],
  usage: { input_tokens: 1000, output_tokens: 200 },
  ...extra,
});

function lecteur(reponse: { data: unknown; error: unknown }): LecteurPremium {
  return { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve(reponse) }) }) }) };
}
const PREMIUM = lecteur({ data: { actif: true, expire_le: null }, error: null });

/** Dépendances factices : les réponses du modèle sont jouées dans l'ordre ; les appels sont comptés. */
function deps(opts: {
  premium?: LecteurPremium;
  reponses?: Array<{ ok: boolean; json: unknown } | "reseau" | "attente">;
  delaiMs?: number;
  dressing?: PieceDressing[];
} = {}) {
  const appels: unknown[] = [];
  const lecturesDressing: string[] = [];
  const journal: JournalUsage[] = [];
  const file = [...(opts.reponses ?? [{ ok: true, json: reponseOpenAI(AVIS) }])];
  const d: DependancesAvis = {
    authentifier: async (jwt) => (jwt === "jwt-ok" ? { id: "u1" } : null),
    lecteurPremium: opts.premium ?? PREMIUM,
    appelerModele: (requete, signal) => {
      appels.push(requete);
      const r = file.shift() ?? { ok: true, json: reponseOpenAI(AVIS) };
      if (r === "reseau") return Promise.reject(new Error("réseau"));
      if (r === "attente") return new Promise((_, rej) => signal.addEventListener("abort", () => rej(new Error("abort"))));
      return Promise.resolve(r);
    },
    journaliser: (l) => journal.push(l),
    lireDressing: async (userId) => {
      lecturesDressing.push(userId);
      return opts.dressing ?? [];
    },
    maintenant: () => 0,
    nouvelId: () => "analyse-1",
    modele: "modele-test",
    delaiMs: opts.delaiMs ?? 1000,
  };
  return { d, appels, journal, lecturesDressing };
}
const AUTH = "Bearer jwt-ok";

/* ───────── Orchestration : les refus n'appellent jamais le modèle ───────── */

describe("traiterDemandeAvis — ordre des contrôles (TEST 06 à 09)", () => {
  it("non authentifié : 401, aucun appel au modèle", async () => {
    const { d, appels } = deps();
    expect(await traiterDemandeAvis(null, { image: IMAGE }, d)).toEqual({ statut: 401, corps: { ok: false, code: "non_authentifie" } });
    expect((await traiterDemandeAvis("Bearer jeton-faux", { image: IMAGE }, d)).statut).toBe(401);
    expect(appels).toHaveLength(0);
  });

  it("TEST 08 — compte gratuit qui appelle l'endpoint directement : 403, aucun appel", async () => {
    const { d, appels } = deps({ premium: lecteur({ data: null, error: null }) });
    expect(await traiterDemandeAvis(AUTH, { image: IMAGE }, d)).toEqual({ statut: 403, corps: { ok: false, code: "non_premium" } });
    expect(appels).toHaveLength(0);
  });

  it("abonnement expiré : 403, aucun appel", async () => {
    const { d, appels } = deps({ premium: lecteur({ data: { actif: true, expire_le: "2020-01-01T00:00:00Z" }, error: null }) });
    expect((await traiterDemandeAvis(AUTH, { image: IMAGE }, d)).statut).toBe(403);
    expect(appels).toHaveLength(0);
  });

  it("TEST 06/07 — statut Premium illisible (erreur Supabase) : 503 fail-closed, aucun appel", async () => {
    const { d, appels } = deps({ premium: lecteur({ data: null, error: { message: "relation does not exist" } }) });
    expect(await traiterDemandeAvis(AUTH, { image: IMAGE }, d)).toEqual({ statut: 503, corps: { ok: false, code: "statut_indisponible" } });
    expect(appels).toHaveLength(0);
  });

  it("fichier invalide : 400, aucun appel", async () => {
    const { d, appels } = deps();
    for (const image of [undefined, "pas une image", dataUrl(jpeg(1200, 900), "image/png"), dataUrl(new Uint8Array([1, 2, 3, 4, 5]))]) {
      expect((await traiterDemandeAvis(AUTH, { image }, d)).corps).toEqual({ ok: false, code: "fichier_invalide" });
    }
    expect(appels).toHaveLength(0);
  });

  it("TEST 09 — Premium, photo valide : 200, un seul appel, avis renvoyé", async () => {
    const { d, appels } = deps();
    const r = await traiterDemandeAvis(AUTH, { image: IMAGE }, d);
    expect(r.statut).toBe(200);
    expect(r.corps).toEqual({
      ok: true,
      analyseId: "analyse-1",
      avis: { overallAssessment: AVIS.overallAssessment, strengths: AVIS.strengths, mainAdvice: AVIS.mainAdvice, suggestions: AVIS.suggestions },
      dressing: [],
    });
    expect(appels).toHaveLength(1);
  });

  it("réponse invalide puis valide : une relance, 200", async () => {
    const { d, appels } = deps({ reponses: [{ ok: true, json: reponseOpenAI("{pas du json") }, { ok: true, json: reponseOpenAI(AVIS) }] });
    expect((await traiterDemandeAvis(AUTH, { image: IMAGE }, d)).statut).toBe(200);
    expect(appels).toHaveLength(2);
  });

  it("réponse invalide deux fois : 502, jamais plus de deux appels, jamais d'affichage partiel", async () => {
    const incomplet = { ...AVIS, suggestions: [] };
    const { d, appels } = deps({ reponses: [{ ok: true, json: reponseOpenAI(incomplet) }, { ok: true, json: reponseOpenAI(incomplet) }, { ok: true, json: reponseOpenAI(AVIS) }] });
    expect(await traiterDemandeAvis(AUTH, { image: IMAGE }, d)).toEqual({ statut: 502, corps: { ok: false, code: "reponse_invalide" } });
    expect(appels).toHaveLength(APPELS_MAX);
  });

  it("délai dépassé : 504, pas de relance", async () => {
    const { d, appels } = deps({ reponses: ["attente"], delaiMs: 5 });
    expect(await traiterDemandeAvis(AUTH, { image: IMAGE }, d)).toEqual({ statut: 504, corps: { ok: false, code: "delai_depasse" } });
    expect(appels).toHaveLength(1);
  });

  it("erreur de l'API (réseau ou statut HTTP) : 502, pas de relance", async () => {
    const a = deps({ reponses: ["reseau"] });
    expect((await traiterDemandeAvis(AUTH, { image: IMAGE }, a.d)).corps).toEqual({ ok: false, code: "erreur_modele" });
    const b = deps({ reponses: [{ ok: false, json: { error: { type: "server_error" } } }] });
    expect((await traiterDemandeAvis(AUTH, { image: IMAGE }, b.d)).corps).toEqual({ ok: false, code: "erreur_modele" });
    expect(a.appels.length + b.appels.length).toBe(2);
  });

  it("photo inexploitable : 422 avec la raison", async () => {
    const { d } = deps({ reponses: [{ ok: true, json: reponseOpenAI({ ...AVIS, isAnalyzable: false, unanalyzableReason: "blurry", overallAssessment: "", strengths: [], mainAdvice: "", suggestions: [] }) }] });
    expect(await traiterDemandeAvis(AUTH, { image: IMAGE }, d)).toEqual({ statut: 422, corps: { ok: false, code: "photo_inexploitable", raison: "blurry" } });
  });

  it("le journal de coût ne contient ni photo, ni conseil, ni identité", async () => {
    const { d, journal } = deps();
    await traiterDemandeAvis(AUTH, { image: IMAGE, contexte: { style: ["Romantique"] } }, d);
    expect(journal).toEqual([
      { evenement: "stylist_advice", analyse_id: "analyse-1", statut: "ok", modele: "modele-test", appels: 1, tokens_entree: 1000, tokens_sortie: 200, duree_ms: 0, pieces_dressing: 0 },
    ]);
    const brut = JSON.stringify(journal);
    expect(brut).not.toContain("base64");
    expect(brut).not.toContain("camel");
    expect(brut).not.toContain("u1");
  });
});

/* ───────── Validation et charte ───────── */

describe("validerReponse", () => {
  it("accepte la structure décidée", () => {
    expect(validerReponse(JSON.stringify(AVIS)).etat).toBe("valide");
  });

  it("rejette un champ manquant, un seul point, quatre points, un texte trop long", () => {
    const sansConseil: Partial<typeof AVIS> = { ...AVIS };
    delete sansConseil.mainAdvice;
    expect(validerReponse(JSON.stringify(sansConseil)).etat).toBe("invalide");
    expect(validerReponse(JSON.stringify({ ...AVIS, strengths: ["Un seul."] })).etat).toBe("invalide");
    expect(validerReponse(JSON.stringify({ ...AVIS, suggestions: ["a", "b", "c", "d"] })).etat).toBe("invalide");
    expect(validerReponse(JSON.stringify({ ...AVIS, overallAssessment: "x".repeat(300) })).etat).toBe("invalide");
  });

  it("rejette une réponse qui enfreint la charte", () => {
    expect(validerReponse(JSON.stringify({ ...AVIS, overallAssessment: "Je te donne 7/10 pour cette tenue." }))).toEqual({ etat: "invalide", motif: "charte:note" });
  });
});

describe("violationCharte — interdits de la section 7 et du projet", () => {
  it.each([
    ["Une note de 8/10.", "note"],
    ["Je dirais 7 sur 10.", "note"],
    ["Selon mon analyse IA, c'est réussi.", "ia"],
    ["Cette veste permet de cacher les hanches.", "cacher"],
    ["Un col qui corrige la silhouette.", "corriger"],
    ["Ça pourrait amincir la taille.", "amincir"],
    ["Une coupe peu flatteuse.", "peu flatteur"],
    ["Le seul défaut, c'est la couleur.", "défaut"],
  ])("%s → %s", (t, motif) => {
    expect(violationCharte([t])).toBe(motif);
  });

  it("les vêtements et expressions anodines ne sont pas des fautes", () => {
    expect(violationCharte(["Ton cache-cœur crème est très réussi.", "Le blanc, c'est la teinte par défaut de l'été."])).toBeNull();
  });

  it("les instructions au modèle listent les mots interdits et bannissent les notes", () => {
    for (const mot of MOTS_INTERDITS) expect(INSTRUCTIONS).toContain(mot);
    expect(INSTRUCTIONS).toContain("X/10");
  });
});

/* ───────── Fichier, requête, réponse ───────── */

describe("validerImage / dimensionsJpeg", () => {
  it("lit les dimensions dans l'en-tête JPEG", () => {
    expect(dimensionsJpeg(jpeg(1200, 900))).toEqual({ largeur: 1200, hauteur: 900 });
  });

  it("vrai type vérifié par la signature, pas par le préfixe déclaré", () => {
    expect(validerImage(dataUrl(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0])))).toBeNull();
  });

  it("dimensions hors bornes refusées", () => {
    expect(validerImage(dataUrl(jpeg(40, 40)))).toBeNull();
    expect(validerImage(dataUrl(jpeg(5000, 3000)))).toBeNull();
    expect(validerImage(IMAGE)).toBe(IMAGE);
  });
});

describe("construireRequeteOpenAI", () => {
  const r = construireRequeteOpenAI("modele-test", IMAGE, { style: ["Romantique"] });
  it("Responses API, sans journal côté OpenAI, sortie JSON stricte", () => {
    expect(r.store).toBe(false);
    expect(r.text.format).toMatchObject({ type: "json_schema", strict: true });
    expect(r.input[0].content[1]).toMatchObject({ type: "input_image", image_url: IMAGE });
  });
});

describe("extraireTexteReponse", () => {
  it("lit le texte d'un message complet", () => {
    expect(extraireTexteReponse(reponseOpenAI("{}"))).toBe("{}");
  });
  it("une réponse coupée (incomplete) n'est jamais lue", () => {
    expect(extraireTexteReponse(reponseOpenAI("{}", { status: "incomplete" }))).toBeNull();
  });
  it("un refus n'a pas de texte", () => {
    expect(extraireTexteReponse({ status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: "non" }] }] })).toBeNull();
  });
});

describe("contexte de personnalisation", () => {
  it("ne garde que les champs attendus, bornés — jamais d'identité", () => {
    const c = nettoyerContexte({ style: ["Romantique"], email: "a@b.fr", nom: "Angela", morphologie: "Taille bien marquée", palette: ["Camel"] });
    expect(c).toEqual({ style: ["Romantique"], morphologie: "Taille bien marquée", palette: ["Camel"] });
  });

  it("la morphologie déclarée est encadrée : vêtements seulement, jamais le corps", () => {
    const t = formulerContexte({ morphologie: "Hanches plus marquées que les épaules" });
    expect(t).toContain("elle-même déclarée");
    expect(t).toContain("ne commente jamais le corps");
  });

  it("sans contexte, rien n'est inventé", () => {
    expect(formulerContexte({})).toBe("Aucun contexte de profil n'est renseigné.");
  });
});

/* ───────── « Avec ton dressing » (option A) ───────── */

const piece = (id: number, cat: string, name: string, over: Partial<PieceDressing> = {}): PieceDressing => ({
  id, cat, name, color: null, matiere: null, subtype: null, shoe_type: null, sac_type: null, bijou_type: null, accessoire_type: null, ...over,
});
const besoin = (over: Partial<BesoinDressing>): BesoinDressing => ({ categorie: "accessoire", motsCles: [], couleurs: [], matieres: [], lien: "mainAdvice", ...over });

describe("choisirPiecesDressing — seulement des pièces réelles et pertinentes", () => {
  const dressing = [
    piece(1, "accessoire", "Foulard soie", { accessoire_type: "Foulard", color: "Bordeaux" }),
    piece(2, "accessoire", "Ceinture cuir chocolat", { accessoire_type: "Ceinture", color: "Chocolat", matiere: "Cuir" }),
    piece(3, "chaussures", "Mocassins marron", { shoe_type: "Mocassins", color: "Marron" }),
    piece(4, "veste", "Blazer camel", { color: "Camel" }),
    piece(5, "accessoire", "Ceinture tressée noire", { accessoire_type: "Ceinture", color: "Noir" }),
  ];

  it("exemple de la spec : ceinture, blazer, mocassins — une pièce par besoin, le conseil principal d'abord", () => {
    const besoins = [
      besoin({ categorie: "chaussures", motsCles: ["mocassins"], lien: "suggestion:1" }),
      besoin({ categorie: "accessoire", motsCles: ["ceinture"], couleurs: ["chocolat"], matieres: ["cuir"] }),
      besoin({ categorie: "veste", motsCles: ["blazer"], lien: "suggestion:2" }),
    ];
    expect(choisirPiecesDressing(besoins, dressing)).toEqual([
      { id: 2, lien: "mainAdvice" },
      { id: 3, lien: "suggestion:1" },
      { id: 4, lien: "suggestion:2" },
    ]);
  });

  it("aucune pièce forcée : même catégorie mais autre type → rien", () => {
    expect(choisirPiecesDressing([besoin({ motsCles: ["chapeau"] })], dressing)).toEqual([]);
  });

  it("3 pièces au plus, jamais deux fois la même", () => {
    const besoins = [1, 2, 3, 4].map((n) => besoin({ motsCles: ["ceinture"], lien: `suggestion:${n}` }));
    const r = choisirPiecesDressing(besoins, dressing);
    expect(r.map((p) => p.id)).toEqual([2, 5]);
    expect(choisirPiecesDressing([besoin({ categorie: "veste", motsCles: ["blazer"] }), ...besoins], dressing)).toHaveLength(3);
  });

  it("une pièce mise de côté pour vendre n'est pas proposée", () => {
    const d = [piece(2, "accessoire", "Ceinture cuir", { accessoire_type: "Ceinture", revente: "de_cote" })];
    expect(choisirPiecesDressing([besoin({ motsCles: ["ceinture"] })], d)).toEqual([]);
  });

  it("dressing vide : rien (section masquée)", () => {
    expect(choisirPiecesDressing([besoin({ motsCles: ["ceinture"] })], [])).toEqual([]);
  });
});

describe("traiterDemandeAvis — « Avec ton dressing » côté serveur", () => {
  const avecBesoins = { ...AVIS, dressingNeeds: [{ categorie: "accessoire", motsCles: ["ceinture"], couleurs: [], matieres: [], lien: "mainAdvice", numeroSuggestion: null }] };

  it("le dressing lu est celui de l'utilisateur du JWT, et seules ses pièces sortent", async () => {
    const { d, lecturesDressing, journal } = deps({
      reponses: [{ ok: true, json: reponseOpenAI(avecBesoins) }],
      dressing: [piece(42, "accessoire", "Ceinture cuir", { accessoire_type: "Ceinture" })],
    });
    const r = await traiterDemandeAvis(AUTH, { image: IMAGE }, d);
    expect(r.corps).toMatchObject({ ok: true, dressing: [{ id: 42, lien: "mainAdvice" }] });
    expect(lecturesDressing).toEqual(["u1"]);
    expect(journal[0].pieces_dressing).toBe(1);
  });

  it("sans besoin exprimé, le dressing n'est même pas lu", async () => {
    const { d, lecturesDressing } = deps();
    await traiterDemandeAvis(AUTH, { image: IMAGE }, d);
    expect(lecturesDressing).toEqual([]);
  });

  it("un besoin mal formé (catégorie inconnue, suggestion inexistante) est ignoré, pas la réponse", async () => {
    const r = await traiterDemandeAvis(AUTH, { image: IMAGE }, deps({
      reponses: [{ ok: true, json: reponseOpenAI({ ...AVIS, dressingNeeds: [{ categorie: "ovni", motsCles: [], couleurs: [], matieres: [], lien: "mainAdvice", numeroSuggestion: null }, { categorie: "sac", motsCles: ["cabas"], couleurs: [], matieres: [], lien: "suggestion", numeroSuggestion: 9 }] }) }],
    }).d);
    expect(r.corps).toMatchObject({ ok: true, dressing: [] });
  });
});
