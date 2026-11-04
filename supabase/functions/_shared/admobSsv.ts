// VÉRIFICATION CÔTÉ SERVEUR D'ADMOB (« SSV », 02/11/2026) — module pur, sans Deno ni réseau, testé dans
// src/lib/__tests__/admobSsv.test.ts.
//
// Quand une vidéo récompensée a été vue jusqu'au bout, AdMob appelle `video-recompense` en GET avec, dans l'adresse :
//   ad_network, ad_unit, custom_data?, reward_amount, reward_item, timestamp, transaction_id, user_id, signature, key_id
// La signature est un ECDSA P-256 / SHA-256, encodé DER puis en base64 « web-safe », calculé sur la partie de l'adresse
// qui PRÉCÈDE « &signature= » — telle qu'elle arrive, sans rien décoder ni réordonner. La clé publique se choisit par
// `key_id` dans la liste que Google publie (https://www.gstatic.com/admob/reward/verifier-keys.json).
// Doc : https://developers.google.com/admob/android/ssv

export const URL_CLES_ADMOB = "https://www.gstatic.com/admob/reward/verifier-keys.json";

/** Ce qu'on garde d'un appel d'AdMob une fois découpé. null : l'appel n'a pas la forme d'AdMob. */
export interface AppelAdMob {
  /** Les octets signés : l'adresse jusqu'à « &signature= », exclus. */
  message: string;
  signature: Uint8Array<ArrayBuffer>;
  keyId: string;
  userId: string;
  transactionId: string;
  /** Millisecondes depuis l'époque Unix, comme AdMob l'envoie. */
  timestamp: number;
}

export function decouperAppelAdMob(query: string): AppelAdMob | null {
  const q = query.startsWith("?") ? query.slice(1) : query;
  const i = q.indexOf("&signature=");
  if (i <= 0) return null;
  const message = q.slice(0, i);
  const params = new URLSearchParams(q);
  const sig = params.get("signature");
  const keyId = params.get("key_id");
  // `user_id` peut manquer : l'appel de test qu'AdMob envoie à l'enregistrement de l'adresse n'en porte pas forcément.
  const userId = params.get("user_id") ?? "";
  const transactionId = params.get("transaction_id");
  const timestamp = Number(params.get("timestamp"));
  if (!sig || !keyId || !transactionId || !Number.isFinite(timestamp)) return null;
  const signature = base64WebSafeVersOctets(sig);
  if (!signature) return null;
  return { message, signature, keyId, userId, transactionId, timestamp };
}

/** L'identifiant du compte doit être un UUID Supabase : rien d'autre ne part vers la base. */
export function userIdValide(userId: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
}

/**
 * Un appel trop vieux est refusé : une adresse signée ne se rejoue pas indéfiniment. Une heure laisse toute la marge
 * aux nouvelles tentatives d'AdMob. (Le rejeu dans l'heure ne rapporte rien : un seul bonus par jour, tenu par la base.)
 */
export function appelRecent(timestamp: number, maintenant: number, toleranceMs = 60 * 60 * 1000): boolean {
  return Math.abs(maintenant - timestamp) <= toleranceMs;
}

export function base64WebSafeVersOctets(s: string): Uint8Array<ArrayBuffer> | null {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const complet = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const bin = atob(complet);
    const out = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) out[k] = bin.charCodeAt(k);
    return out;
  } catch {
    return null;
  }
}

/**
 * WebCrypto attend une signature ECDSA « brute » (r ‖ s, 64 octets en P-256) ; Google l'envoie en DER
 * (SEQUENCE { INTEGER r, INTEGER s }). null si le DER est mal formé.
 */
export function derVersBrut(der: Uint8Array, taille = 32): Uint8Array<ArrayBuffer> | null {
  let p = 0;
  if (der[p++] !== 0x30) return null;
  let lg = der[p++];
  if (lg & 0x80) {
    const n = lg & 0x7f;
    lg = 0;
    for (let k = 0; k < n; k++) lg = (lg << 8) | der[p++];
  }
  if (p + lg !== der.length) return null;
  const out = new Uint8Array(taille * 2);
  for (let part = 0; part < 2; part++) {
    if (der[p++] !== 0x02) return null;
    const l = der[p++];
    let entier = der.subarray(p, p + l);
    p += l;
    while (entier.length > taille && entier[0] === 0) entier = entier.subarray(1);
    if (entier.length > taille) return null;
    out.set(entier, part * taille + (taille - entier.length));
  }
  return p === der.length ? out : null;
}

export interface CleAdMob {
  keyId: number | string;
  /** Clé publique SPKI encodée en base64 (champ `base64` de la liste de Google). */
  base64: string;
}

/** Vérifie la signature d'un appel découpé avec la liste des clés de Google. Ne jette jamais. */
export async function signatureAdMobValide(appel: AppelAdMob, cles: CleAdMob[]): Promise<boolean> {
  try {
    const cle = cles.find((c) => String(c.keyId) === appel.keyId);
    if (!cle) return false;
    const spki = base64WebSafeVersOctets(cle.base64);
    const brut = derVersBrut(appel.signature);
    if (!spki || !brut) return false;
    const cleCrypto = await crypto.subtle.importKey("spki", spki, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      cleCrypto,
      brut,
      new TextEncoder().encode(appel.message),
    );
  } catch {
    return false;
  }
}
