# Connexion avec Apple

Ajoutée le 05/11/2026 (« peut-on intégrer iOS dans les boutons de connexion ou de création de compte ? », puis le cahier des charges
« Zone de Connexion Sociale »). Le bouton « Continuer avec Apple » est sur Se connecter et Créer un compte (`ConnexionSociale.tsx`), au-dessus
de Google sur un appareil Apple, en dessous ailleurs. Il passe par Supabase, exactement comme Google (`signInOAuth`, `auth.tsx`) : page
d'Apple dans le navigateur, retour par `onAuthStateChange` sur le web, par le lien profond `app.capsela://auth/callback` dans l'app.

**Le bouton reste masqué** tant que `NEXT_PUBLIC_CONNEXION_APPLE` ne vaut pas `1` : avant les réglages ci-dessous, il mènerait à une page
d'erreur. En mode démo (sans Supabase), il s'affiche pour le rendu.

## Réglages à faire (propriétaire du projet)

1. **Compte Apple Developer** (payant, nécessaire de toute façon pour l'App Store).
2. **Chez Apple** (Certificates, Identifiers & Profiles) :
   - un **App ID** avec la capacité « Sign in with Apple » ;
   - un **Services ID** (l'identifiant utilisé par le web et Android), avec « Sign in with Apple » activé, le domaine `tkrbzrazejrxavtfspll.supabase.co`
     et l'adresse de retour `https://tkrbzrazejrxavtfspll.supabase.co/auth/v1/callback` ;
   - une **clé** « Sign in with Apple » (fichier .p8), son Key ID et le Team ID.
3. **Dans Supabase** → Authentication → Providers → Apple : activer, renseigner le Services ID, le Team ID, le Key ID et la clé (Supabase
   en tire le secret client, à renouveler tous les 6 mois). Vérifier que `app.capsela://auth/callback` est dans les Redirect URLs (déjà le
   cas pour Google).
4. **E-mails masqués** : avec « Masquer mon e-mail », Apple fournit une adresse relais. Pour que les e-mails de Capsela arrivent (lien de
   nouveau mot de passe…), déclarer l'adresse d'envoi dans « Sign in with Apple for Email Communication » chez Apple.
5. **Activer le bouton** : `NEXT_PUBLIC_CONNEXION_APPLE=1` dans les variables d'environnement Vercel, et la variable de dépôt GitHub
   `CONNEXION_APPLE=1` pour les exports Android (`.github/workflows/android-construire.yml`).

## Sur iOS (app native)

L'App Store exige « Sign in with Apple » dès qu'une connexion Google est proposée (règle 4.8). Le chemin actuel (navigateur du système) est
accepté ; la feuille native d'Apple, plus fluide, demandera un plugin Capacitor quand l'app iOS sera préparée.

## Le « client secret » et son renouvellement (06/11/2026)

Supabase demande un jeton (JWT ES256) signé avec la clé .p8, pas la clé elle-même (« Secret key should be a JWT »), et Apple le limite
à 6 mois. Le workflow **« Apple — renouveler la clé de connexion dans Supabase »** (`.github/workflows/apple-cle-connexion.yml`) le
fabrique (`scripts/apple-client-secret.mjs`, Team ID N6YKXJGW25, Services ID `app.capsela.connexion`, 180 jours) et l'écrit dans la
configuration Auth du projet par l'API de gestion Supabase (`external_apple_secret`, jeton `SUPABASE_ACCESS_TOKEN`). Il se relance seul
le 1er janvier, mai et septembre ; le jeton n'apparaît jamais dans les journaux.

Secrets du dépôt à créer une fois : `APPLE_SIGNIN_P8` (contenu du fichier `AuthKey_XXXXXXXXXX.p8`) et `APPLE_SIGNIN_KEY_ID` (son Key ID).
Dans Supabase, les Client IDs restent `app.capsela.connexion,app.capsela`.
