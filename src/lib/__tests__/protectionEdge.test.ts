import { describe, expect, it } from "vitest";
import {
  authentifier,
  consommerQuota,
  estAppelantAdmin,
  jetonDepuisEntete,
  limiteDepuisEnv,
  urlPhotoAutorisee,
  type ClientAdmin,
} from "../../../supabase/functions/_shared/protection";

// Protection des fonctions Edge qui coûtent (01/10/2026) : une utilisatrice
// connectée, jamais la clé `anon` seule ; un quota par compte et par jour ; la
// photo analysée est la sienne.

describe("jetonDepuisEntete", () => {
  it("lit un Bearer, ignore la casse et les espaces", () => {
    expect(jetonDepuisEntete("Bearer abc")).toBe("abc");
    expect(jetonDepuisEntete("bearer   abc  ")).toBe("abc");
  });
  it("rien, vide ou sans jeton : null", () => {
    for (const v of [null, undefined, "", "Bearer", "Bearer   "]) expect(jetonDepuisEntete(v as string | null), String(v)).toBeNull();
  });
});

describe("estAppelantAdmin", () => {
  const CLE = "sb_secret_exemple";
  it("la clé privilégiée, en Authorization ou en apikey", () => {
    expect(estAppelantAdmin(`Bearer ${CLE}`, null, CLE)).toBe(true);
    expect(estAppelantAdmin(null, CLE, CLE)).toBe(true);
  });
  it("jamais la clé anon, ni un JWT d'utilisatrice, ni sans clé configurée", () => {
    expect(estAppelantAdmin("Bearer eyJanon", "eyJanon", CLE)).toBe(false);
    expect(estAppelantAdmin(`Bearer ${CLE}`, null, undefined)).toBe(false);
    expect(estAppelantAdmin(`Bearer ${CLE}`, null, "")).toBe(false);
    expect(estAppelantAdmin(null, null, CLE)).toBe(false);
  });
});

describe("limiteDepuisEnv", () => {
  it("un entier positif est repris", () => {
    expect(limiteDepuisEnv("25", 40)).toBe(25);
  });
  it("absent, vide, nul, négatif, décimal ou illisible : la valeur par défaut — jamais de plafond retiré", () => {
    for (const v of [undefined, null, "", "0", "-5", "3.5", "beaucoup", "NaN"]) expect(limiteDepuisEnv(v, 40), String(v)).toBe(40);
  });
});

describe("urlPhotoAutorisee", () => {
  const PROJET = "https://abc.supabase.co";
  const UID = "11111111-1111-1111-1111-111111111111";
  const signee = `${PROJET}/storage/v1/object/sign/dressing-photos/${UID}/p.jpg?token=xyz`;

  it("une photo signée de son dossier, ou l'ancienne URL publique", () => {
    expect(urlPhotoAutorisee(signee, PROJET, UID)).toBe(true);
    expect(urlPhotoAutorisee(`${PROJET}/storage/v1/object/public/dressing-photos/${UID}/p.jpg`, PROJET, UID)).toBe(true);
  });
  it("jamais la photo de quelqu'un d'autre", () => {
    expect(urlPhotoAutorisee(signee, PROJET, "22222222-2222-2222-2222-222222222222")).toBe(false);
  });
  it("jamais une autre adresse : un autre site, un autre bucket, un autre projet", () => {
    expect(urlPhotoAutorisee(`https://exemple.fr/${UID}/p.jpg`, PROJET, UID)).toBe(false);
    expect(urlPhotoAutorisee(`${PROJET}/storage/v1/object/sign/avis-styliste-photos/${UID}/p.jpg`, PROJET, UID)).toBe(false);
    expect(urlPhotoAutorisee(signee.replace("abc.", "autre."), PROJET, UID)).toBe(false);
  });
  it("jamais un détournement par le chemin ou par l'hôte", () => {
    expect(urlPhotoAutorisee(`${PROJET}/storage/v1/object/sign/dressing-photos/${UID}/../autre/p.jpg`, PROJET, UID)).toBe(false);
    expect(urlPhotoAutorisee(`https://abc.supabase.co.evil.fr/storage/v1/object/sign/dressing-photos/${UID}/p.jpg`, PROJET, UID)).toBe(false);
    expect(urlPhotoAutorisee("n'importe quoi", PROJET, UID)).toBe(false);
    expect(urlPhotoAutorisee(signee, PROJET, "")).toBe(false);
    expect(urlPhotoAutorisee(signee, PROJET, "../x")).toBe(false);
  });
});

function faux(opts: { user?: { id: string } | null; erreurAuth?: boolean; rpc?: { data: unknown; error: unknown } | "jette" }): ClientAdmin {
  return {
    auth: {
      getUser: async () => ({ data: { user: opts.user ?? null }, error: opts.erreurAuth ? new Error("jeton invalide") : null }),
    },
    rpc: async () => {
      if (opts.rpc === "jette") throw new Error("réseau");
      return (opts.rpc ?? { data: [{ consomme: true, utilisees: 1 }], error: null }) as never;
    },
  };
}

describe("authentifier", () => {
  it("l'utilisatrice derrière un JWT valide", async () => {
    expect(await authentifier(faux({ user: { id: "u1" } }), "jwt")).toEqual({ id: "u1" });
  });
  it("sans jeton, avec un jeton refusé, ou sans utilisatrice (clé anon) : null", async () => {
    expect(await authentifier(faux({ user: { id: "u1" } }), null)).toBeNull();
    expect(await authentifier(faux({ erreurAuth: true }), "jwt")).toBeNull();
    expect(await authentifier(faux({ user: null }), "clé-anon")).toBeNull();
  });
  it("une exception du service d'authentification : null, jamais un laissez-passer", async () => {
    const client = { ...faux({}), auth: { getUser: async () => { throw new Error("réseau"); } } } as ClientAdmin;
    expect(await authentifier(client, "jwt")).toBeNull();
  });
});

describe("consommerQuota", () => {
  it("consommé : ok", async () => {
    expect(await consommerQuota(faux({}), "u1", "f", 5)).toBe("ok");
  });
  it("plafond atteint : limite", async () => {
    expect(await consommerQuota(faux({ rpc: { data: [{ consomme: false, utilisees: 5 }], error: null } }), "u1", "f", 5)).toBe("limite");
  });
  it("migration absente, erreur, réponse inattendue ou exception : indisponible — la fonction refusera", async () => {
    expect(await consommerQuota(faux({ rpc: { data: null, error: { code: "42883" } } }), "u1", "f", 5)).toBe("indisponible");
    expect(await consommerQuota(faux({ rpc: { data: [], error: null } }), "u1", "f", 5)).toBe("indisponible");
    expect(await consommerQuota(faux({ rpc: { data: [{ consomme: "oui" }], error: null } }), "u1", "f", 5)).toBe("indisponible");
    expect(await consommerQuota(faux({ rpc: "jette" }), "u1", "f", 5)).toBe("indisponible");
  });
  it("accepte une ligne seule, sans tableau", async () => {
    expect(await consommerQuota(faux({ rpc: { data: { consomme: true, utilisees: 2 }, error: null } }), "u1", "f", 5)).toBe("ok");
  });
});
