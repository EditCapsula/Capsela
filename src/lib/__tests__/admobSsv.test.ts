import { describe, expect, it } from "vitest";
import {
  appelRecent,
  base64WebSafeVersOctets,
  decouperAppelAdMob,
  derVersBrut,
  signatureAdMobValide,
  userIdValide,
} from "../../../supabase/functions/_shared/admobSsv";
import { BLOC_RECOMPENSE_TEST, blocRecompense } from "../publicite";

// Une vraie paire de clés P-256 : la signature est produite comme Google la produit (ECDSA SHA-256, encodée DER, puis
// base64 web-safe), et vérifiée par le module de la fonction Edge.

function enDer(brut: Uint8Array): Uint8Array {
  const entier = (o: Uint8Array) => {
    let i = 0;
    while (i < o.length - 1 && o[i] === 0) i++;
    let v = o.subarray(i);
    if (v[0] & 0x80) v = Uint8Array.from([0, ...v]);
    return Uint8Array.from([0x02, v.length, ...v]);
  };
  const r = entier(brut.subarray(0, 32));
  const s = entier(brut.subarray(32));
  return Uint8Array.from([0x30, r.length + s.length, ...r, ...s]);
}

const enB64WebSafe = (o: Uint8Array) =>
  Buffer.from(o).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function preparer() {
  const paire = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", paire.publicKey));
  const cles = [{ keyId: 3335741209, base64: Buffer.from(spki).toString("base64") }];
  const signer = async (message: string) => {
    const brut = new Uint8Array(
      await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, paire.privateKey, new TextEncoder().encode(message)),
    );
    return enB64WebSafe(enDer(brut));
  };
  return { cles, signer };
}

const UID = "0b6f3c1e-8a2d-4f5b-9c7e-1d2e3f4a5b6c";
const message = (uid = UID, ts = 1730550000000) =>
  `ad_network=5450213213286189855&ad_unit=1234567890&reward_amount=1&reward_item=Tenue&timestamp=${ts}&transaction_id=123456789&user_id=${uid}`;

describe("vérification côté serveur d'AdMob", () => {
  it("accepte un appel signé par la clé annoncée", async () => {
    const { cles, signer } = await preparer();
    const m = message();
    const appel = decouperAppelAdMob(`?${m}&signature=${await signer(m)}&key_id=3335741209`);
    expect(appel).not.toBeNull();
    expect(appel!.userId).toBe(UID);
    expect(appel!.message).toBe(m);
    expect(await signatureAdMobValide(appel!, cles)).toBe(true);
  });

  it("refuse une adresse modifiée après signature (autre compte)", async () => {
    const { cles, signer } = await preparer();
    const sig = await signer(message());
    const autre = message("11111111-2222-3333-4444-555555555555");
    const appel = decouperAppelAdMob(`${autre}&signature=${sig}&key_id=3335741209`);
    expect(await signatureAdMobValide(appel!, cles)).toBe(false);
  });

  it("refuse une clé inconnue et une signature d'une autre clé", async () => {
    const a = await preparer();
    const b = await preparer();
    const m = message();
    const sig = await a.signer(m);
    expect(await signatureAdMobValide(decouperAppelAdMob(`${m}&signature=${sig}&key_id=999`)!, a.cles)).toBe(false);
    expect(await signatureAdMobValide(decouperAppelAdMob(`${m}&signature=${sig}&key_id=3335741209`)!, b.cles)).toBe(false);
  });

  it("refuse ce qui n'a pas la forme d'un appel AdMob", () => {
    expect(decouperAppelAdMob("")).toBeNull();
    expect(decouperAppelAdMob(`?${message()}`)).toBeNull();
    expect(decouperAppelAdMob(`?${message()}&signature=abc`)).toBeNull();
    expect(decouperAppelAdMob(`?signature=abc&key_id=1`)).toBeNull();
  });

  it("accepte l'appel de test sans compte, que la fonction ne crédite pas", async () => {
    const { cles, signer } = await preparer();
    const m = "ad_network=1&ad_unit=2&reward_amount=1&reward_item=x&timestamp=1730550000000&transaction_id=9";
    const appel = decouperAppelAdMob(`?${m}&signature=${await signer(m)}&key_id=3335741209`);
    expect(await signatureAdMobValide(appel!, cles)).toBe(true);
    expect(userIdValide(appel!.userId)).toBe(false);
  });

  it("un appel de plus d'une heure est trop vieux", () => {
    const t = 1730550000000;
    expect(appelRecent(t, t + 59 * 60 * 1000)).toBe(true);
    expect(appelRecent(t, t + 61 * 60 * 1000)).toBe(false);
  });

  it("DER → brut : gère les entiers préfixés par un zéro et rejette un DER tronqué", () => {
    const r = new Uint8Array(32).fill(0x80);
    const s = new Uint8Array(32).fill(0x01);
    const brut = derVersBrut(enDer(Uint8Array.from([...r, ...s])));
    expect(brut).toEqual(Uint8Array.from([...r, ...s]));
    expect(derVersBrut(enDer(Uint8Array.from([...r, ...s])).subarray(0, 20))).toBeNull();
    expect(base64WebSafeVersOctets("!!")).toBeNull();
  });
});

describe("bloc d'annonces de la vidéo récompensée", () => {
  it("sans identifiant valable, le bloc de test de Google", () => {
    expect(blocRecompense(undefined)).toEqual({ id: BLOC_RECOMPENSE_TEST, test: true });
    expect(blocRecompense("")).toEqual({ id: BLOC_RECOMPENSE_TEST, test: true });
    expect(blocRecompense("n'importe quoi")).toEqual({ id: BLOC_RECOMPENSE_TEST, test: true });
    expect(blocRecompense(BLOC_RECOMPENSE_TEST)).toEqual({ id: BLOC_RECOMPENSE_TEST, test: true });
  });
  it("le vrai bloc, une fois renseigné", () => {
    expect(blocRecompense(" ca-app-pub-1234567890123456/1234567890 ")).toEqual({
      id: "ca-app-pub-1234567890123456/1234567890",
      test: false,
    });
  });
});
