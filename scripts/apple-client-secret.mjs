// Le « client secret » de la connexion Apple pour Supabase (06/11/2026, docs/connexion-apple.md).
//
// Apple n'accepte pas la clé .p8 elle-même : il faut un jeton (JWT, ES256) signé avec elle, valable 6 mois au plus. Ce script le
// fabrique à partir des variables d'environnement, SANS dépendance, et l'écrit sur la sortie standard. Il n'est lancé que par le
// workflow « Apple — renouveler la clé de connexion dans Supabase », qui le passe directement à Supabase : le jeton n'est jamais
// affiché ni enregistré dans le dépôt.
//
//   APPLE_SIGNIN_P8      contenu du fichier AuthKey_XXXXXXXXXX.p8 (secret GitHub)
//   APPLE_SIGNIN_KEY_ID  les 10 caractères de la clé (secret GitHub)
//   APPLE_TEAM_ID        identifiant d'équipe Apple
//   APPLE_SERVICES_ID    identifiant du Services ID (app.capsela.connexion)

import { createPrivateKey, sign } from "node:crypto";

/** Durée de validité : 180 jours, sous le plafond d'Apple (15 777 000 s, environ 6 mois). */
export const DUREE_S = 180 * 24 * 3600;

const base64url = (b) => Buffer.from(b).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

export function secretApple({ p8, keyId, teamId, servicesId, maintenant = Math.floor(Date.now() / 1000) }) {
  if (!p8 || !keyId || !teamId || !servicesId) throw new Error("Variables manquantes (clé, Key ID, Team ID ou Services ID).");
  const entete = { alg: "ES256", kid: keyId, typ: "JWT" };
  const charge = { iss: teamId, iat: maintenant, exp: maintenant + DUREE_S, aud: "https://appleid.apple.com", sub: servicesId };
  const signe = `${base64url(JSON.stringify(entete))}.${base64url(JSON.stringify(charge))}`;
  // La clé collée dans un secret peut avoir perdu ses retours à la ligne : on la remet en forme PEM.
  const corps = p8.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const pem = `-----BEGIN PRIVATE KEY-----\n${corps.match(/.{1,64}/g).join("\n")}\n-----END PRIVATE KEY-----\n`;
  const signature = sign("sha256", Buffer.from(signe), { key: createPrivateKey(pem), dsaEncoding: "ieee-p1363" });
  return `${signe}.${base64url(signature)}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(
    secretApple({
      p8: process.env.APPLE_SIGNIN_P8,
      keyId: process.env.APPLE_SIGNIN_KEY_ID,
      teamId: process.env.APPLE_TEAM_ID,
      servicesId: process.env.APPLE_SERVICES_ID,
    })
  );
}
