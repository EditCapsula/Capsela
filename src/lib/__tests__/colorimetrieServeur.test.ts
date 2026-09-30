import { describe, expect, it } from "vitest";
import {
  QUALITES_PHOTO,
  SAISONS_COLORIMETRIE,
  SCHEMA_COLORIMETRIE,
  construireRequeteColorimetrie,
  lireVerdictColorimetrie,
  traiterDemandeColorimetrie,
  type DependancesColorimetrie,
  type JournalColorimetrie,
} from "../../../supabase/functions/_shared/colorimetrie.ts";
import { SAISONS_CLES } from "../colorimetrie";

// Fonction Edge « analyser-colorimetrie » : ordre des contrôles, lecture de la réponse (30/09/2026).

/** En-tête JPEG minimal (SOI, APP0, SOF0) aux dimensions voulues — même fixture que avisStyliste.test.ts. */
function jpeg(largeur: number, hauteur: number): Uint8Array {
  const app0 = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00];
  const sof0 = [0xff, 0xc0, 0x00, 0x11, 0x08, hauteur >> 8, hauteur & 255, largeur >> 8, largeur & 255, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
  return new Uint8Array([0xff, 0xd8, ...app0, ...sof0, 0xff, 0xd9]);
}
const IMAGE = `data:image/jpeg;base64,${Buffer.from(jpeg(900, 1200)).toString("base64")}`;

const reponseOpenAI = (contenu: unknown) => ({
  status: "completed",
  output: [{ type: "message", content: [{ type: "output_text", text: typeof contenu === "string" ? contenu : JSON.stringify(contenu) }] }],
  usage: { input_tokens: 300, output_tokens: 20 },
});

function deps(reponse: { ok: boolean; json: unknown } | "reseau" | "attente" = { ok: true, json: reponseOpenAI({ qualite: "ok", saison: "hiver" }) }) {
  const appels: unknown[] = [];
  const journal: JournalColorimetrie[] = [];
  const d: DependancesColorimetrie = {
    authentifier: async (jwt) => (jwt === "jwt-ok" ? { id: "u1" } : null),
    appelerModele: (requete, signal) => {
      appels.push(requete);
      if (reponse === "reseau") return Promise.reject(new Error("réseau"));
      if (reponse === "attente") return new Promise((_, rej) => signal.addEventListener("abort", () => rej(new Error("abort"))));
      return Promise.resolve(reponse);
    },
    journaliser: (l) => journal.push(l),
    maintenant: () => 0,
    modele: "modele-test",
    delaiMs: 20,
  };
  return { d, appels, journal };
}

const OK = { image: IMAGE, consentement: true };

describe("traiterDemandeColorimetrie — rien ne part avant l'authentification, le consentement et le fichier", () => {
  it("sans session valide : 401, aucun appel au modèle", async () => {
    const { d, appels } = deps();
    expect((await traiterDemandeColorimetrie(null, OK, d)).statut).toBe(401);
    expect((await traiterDemandeColorimetrie("Bearer faux", OK, d)).corps).toEqual({ ok: false, code: "non_authentifie" });
    expect(appels).toHaveLength(0);
  });

  it("sans consentement strictement vrai : 400, aucun appel au modèle", async () => {
    const { d, appels } = deps();
    for (const consentement of [undefined, false, "true", 1]) {
      const r = await traiterDemandeColorimetrie("Bearer jwt-ok", { image: IMAGE, consentement }, d);
      expect(r).toEqual({ statut: 400, corps: { ok: false, code: "consentement_manquant" } });
    }
    expect(appels).toHaveLength(0);
  });

  it("fichier qui n'est pas un JPEG valide : 400, aucun appel au modèle", async () => {
    const { d, appels } = deps();
    const r = await traiterDemandeColorimetrie("Bearer jwt-ok", { image: "data:image/png;base64,AAAA", consentement: true }, d);
    expect(r.corps).toEqual({ ok: false, code: "fichier_invalide" });
    expect(appels).toHaveLength(0);
  });

  it("une saison rendue : 200 et la saison seule", async () => {
    const { d, appels, journal } = deps();
    const r = await traiterDemandeColorimetrie("Bearer jwt-ok", OK, d);
    expect(r).toEqual({ statut: 200, corps: { ok: true, saison: "hiver" } });
    expect(appels).toHaveLength(1);
    expect(journal).toEqual([{ evenement: "colorimetrie_photo", statut: "ok", modele: "modele-test", tokens_entree: 300, tokens_sortie: 20, duree_ms: 0 }]);
  });

  it("photo inexploitable : 422 et son motif, sans relance", async () => {
    const { d, appels } = deps({ ok: true, json: reponseOpenAI({ qualite: "lumiere", saison: "indetermine" }) });
    expect(await traiterDemandeColorimetrie("Bearer jwt-ok", OK, d)).toEqual({ statut: 422, corps: { ok: false, code: "photo_inexploitable", motif: "lumiere" } });
    expect(appels).toHaveLength(1);
  });

  it("harmonie illisible : 422 « indetermine », jamais une saison au hasard", async () => {
    const { d } = deps({ ok: true, json: reponseOpenAI({ qualite: "ok", saison: "indetermine" }) });
    expect((await traiterDemandeColorimetrie("Bearer jwt-ok", OK, d)).corps).toEqual({ ok: false, code: "photo_inexploitable", motif: "indetermine" });
  });

  it("réponse hors liste, erreur du modèle, réseau, délai : un code, jamais de détail", async () => {
    const hors = deps({ ok: true, json: reponseOpenAI({ qualite: "ok", saison: "automne_chaud" }) });
    expect((await traiterDemandeColorimetrie("Bearer jwt-ok", OK, hors.d)).corps).toEqual({ ok: false, code: "reponse_invalide" });
    const ko = deps({ ok: false, json: { error: { type: "server_error" } } });
    expect((await traiterDemandeColorimetrie("Bearer jwt-ok", OK, ko.d)).corps).toEqual({ ok: false, code: "erreur_modele" });
    const reseau = deps("reseau");
    expect((await traiterDemandeColorimetrie("Bearer jwt-ok", OK, reseau.d)).statut).toBe(502);
    const lent = deps("attente");
    expect(await traiterDemandeColorimetrie("Bearer jwt-ok", OK, lent.d)).toEqual({ statut: 504, corps: { ok: false, code: "delai_depasse" } });
  });

  it("le journal ne contient jamais la photo ni l'identifiant", async () => {
    const { d, journal } = deps();
    await traiterDemandeColorimetrie("Bearer jwt-ok", OK, d);
    const texte = JSON.stringify(journal);
    expect(texte).not.toContain("base64");
    expect(texte).not.toContain("u1");
    expect(texte).not.toContain("hiver");
  });
});

describe("requête et lecture", () => {
  it("jamais conservée côté OpenAI, sortie stricte à deux champs fermés", () => {
    const q = construireRequeteColorimetrie("m", IMAGE);
    expect(q.store).toBe(false);
    expect(q.text.format.strict).toBe(true);
    expect(Object.keys(SCHEMA_COLORIMETRIE.properties)).toEqual(["qualite", "saison"]);
    expect(SCHEMA_COLORIMETRIE.additionalProperties).toBe(false);
  });

  it("les saisons du serveur sont celles de l'app", () => {
    expect([...SAISONS_COLORIMETRIE]).toEqual(SAISONS_CLES);
    expect(QUALITES_PHOTO[0]).toBe("ok");
  });

  it("lireVerdictColorimetrie : JSON cassé ou champ manquant = invalide", () => {
    expect(lireVerdictColorimetrie(null)).toEqual({ etat: "invalide" });
    expect(lireVerdictColorimetrie("{")).toEqual({ etat: "invalide" });
    expect(lireVerdictColorimetrie(JSON.stringify({ saison: "ete" }))).toEqual({ etat: "invalide" });
    expect(lireVerdictColorimetrie(JSON.stringify({ qualite: "ok", saison: "ete" }))).toEqual({ etat: "saison", saison: "ete" });
    expect(lireVerdictColorimetrie(JSON.stringify({ qualite: "filtre", saison: "ete" }))).toEqual({ etat: "inexploitable", motif: "filtre" });
  });
});
