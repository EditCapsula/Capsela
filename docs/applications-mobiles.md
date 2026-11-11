# Capsela — Applications iOS et Android (Capacitor)

17/10/2026. Plan d'ensemble et fiches des stores : Notion, « Capsela · Delivery » → « Plan de publication sur l'App Store et Google Play ».

## Principe

Capacitor emballe le site statique déjà construit (`out/`, `output: "export"`) dans une app iOS (`ios/`) et une app Android (`android/`). Même code, même Supabase, mêmes comptes. **Le site web n'est pas touché** : `npm run build` et le déploiement Vercel restent les mêmes ; seul `npm run mobile:sync` copie `out/` dans les projets natifs.

- Configuration : `capacitor.config.ts` — identifiant `app.capsela` (définitif une fois publié ; validé le 27/10/2026, capsela.app appartient à la propriétaire), nom « Capsela », fond crème `#F3EEE5`.
- Versions : `@capacitor/*` 8.5.2, épinglées.
- iOS : Swift Package Manager (pas de CocoaPods), iPhone seulement, portrait. Android : `minSdk` 24, `targetSdk` 36, sans verrou d'orientation depuis le 11/11/2026 (alerte de la Play Console : Android 16 l'ignore sur grand écran).

## Commandes

- `npm run mobile:sync` — construit le site puis le copie dans `ios/` et `android/` (`cap sync`). À relancer après chaque changement du site.
- `npx cap open ios` — ouvre le projet dans Xcode (Mac obligatoire) ; `npx cap open android` — ouvre Android Studio.
- La copie de `out/` dans les projets natifs (`ios/App/App/public`, `android/app/src/main/assets/public`) est ignorée par git : elle se régénère.

## Autorisations déclarées

| Autorisation | iOS (`Info.plist`) | Android (`AndroidManifest.xml`) | Sert à |
| --- | --- | --- | --- |
| Appareil photo | `NSCameraUsageDescription` | `CAMERA` (facultatif côté matériel) | Ajouter une pièce, importer une tenue, avis de styliste |
| Photothèque | `NSPhotoLibraryUsageDescription` | — (sélecteur du système) | Mêmes parcours, depuis une photo existante |
| Position | `NSLocationWhenInUseUsageDescription` | `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION` | Météo de la ville (`weather.ts`) |

`ITSAppUsesNonExemptEncryption` vaut `false` : seul le chiffrement standard (HTTPS) est utilisé.

## Connexion dans l'app (17/10/2026)

- **Google** : `signInWithOAuth` avec `skipBrowserRedirect`, puis la page Google dans le navigateur du système (`@capacitor/browser` 8.0.5) ; retour par le lien profond `app.capsela://auth/callback` (`@capacitor/app` 8.1.2, `appUrlOpen` et `getLaunchUrl`), échange du code PKCE contre une session (`exchangeCodeForSession`). Code : `authNatif.ts` (lecture du lien, testée), `auth.tsx`.
- **Nouveau mot de passe** : le lien de l'e-mail revient par le même lien profond (`?reinitialisation=1`) quand la demande vient de l'app.
- **Session** : dans l'app, le client Supabase garde la session dans le stockage local (`supabase.ts`) — la vue web d'iOS ne garde pas les cookies de la page. Le web garde son client d'avant.
- **Lien profond déclaré** : `CFBundleURLTypes` (iOS), `intent-filter` `app.capsela://auth` (Android).
- **À faire par la propriétaire** : ajouter `app.capsela://auth/callback` aux « Redirect URLs » de Supabase (Authentication → URL Configuration). Sans cela, Supabase renvoie vers le site au lieu de l'app.

## Icône et écran de démarrage (17/10/2026)

**Logos définitifs (19/10/2026)**, fournis par la propriétaire, rangés tels quels (rognés) dans `public/brand/` :
- `capsela-logo.png` (« capsela. » noir) et `capsela-logo-claire.png` (blanc, fonds sombres) : le logo de l'app (`LogoCapsela`) ;
- `capsela-c.png` (« c. » terracotta), `capsela-c-noir.png`, `capsela-c-blanc.png` : le monogramme.

`node scripts/generer-icones-mobiles.mjs` pose le « c. » terracotta sur le crème pour les icônes iOS (1024 px opaque) et Android (classiques, rondes, adaptatives), et le logo « capsela. » pour les écrans de démarrage. `node scripts/generer-favicon.mjs` produit le favicon du site (`src/app/icon.png`, `apple-icon.png`, `favicon.ico`) depuis le « c. ». L'indicateur de chargement (`LoadingSpinner`) affiche aussi le « c. ».

## Construction automatique de l'app Android (17/10/2026)

Sans Android Studio : deux workflows GitHub (onglet Actions).
- **« Android — créer la clé d'envoi »** (`android-cle.yml`), une seule fois : crée la clé qui signe les versions envoyées à Google Play. Avant : secret `ANDROID_KEYSTORE_PASSWORD`. Après : copier le contenu de l'artefact `cle-envoi.base64.txt` dans le secret `ANDROID_KEYSTORE_BASE64`, puis supprimer l'artefact. Google Play re-signe l'app (Play App Signing) : une clé d'envoi perdue se remplace auprès du support.
- **« Android — construire l'app pour Google Play »** (`android-construire.yml`), à chaque version : « Run workflow » avec le nom de version ; le fichier `.aab` signé est en artefact (30 jours), à déposer dans la Play Console. Le numéro de version (`versionCode`) est le numéro d'exécution, toujours croissant. Secret de la clé publique Supabase : `NEXT_PUBLIC_SUPABASE_ANON_KEY`, sinon `SUPABASE_PUBLISHABLE_KEY`.
- **Sur une pull request** qui touche `android/`, `capacitor.config.ts` ou le workflow : la même construction, non signée, pour vérifier que le projet compile.
- Gradle lit la clé et la version dans l'environnement (`android/app/build.gradle`) : rien de secret dans le dépôt.

## Construction automatique de l'app iOS (05/11/2026)

Sans Mac : le workflow **« iOS — construire l'app pour l'App Store »** (`ios-construire.yml`) tourne sur une machine macOS de GitHub (Xcode 26, exigé par App Store Connect depuis avril 2026).
- **« Run workflow »** avec le nom de version : l'app est archivée, signée, envoyée à App Store Connect (case « Envoyer », cochée par défaut), et le `.ipa` reste en artefact 30 jours. Le numéro de build (`CFBundleVersion`) est le numéro d'exécution, toujours croissant.
- **Signature gérée par Apple** : Xcode crée le certificat de distribution et le profil avec la clé d'API d'App Store Connect (`-allowProvisioningUpdates`) ; rien à exporter d'un Mac.
- **Sur une pull request** qui touche `ios/`, `capacitor.config.ts` ou le workflow : la même construction, non signée, pour vérifier que le projet compile.
- Coût : sur un dépôt privé, une minute macOS compte pour dix minutes du quota GitHub Actions.

Ce que la propriétaire prépare, une fois :
1. **Compte Apple Developer** (99 $/an) ; noter l'**identifiant d'équipe** (developer.apple.com → Membership details) → secret `APPLE_TEAM_ID`.
2. **Fiche de l'app dans App Store Connect** (Apps → « + » → Nouvelle app) : plateforme iOS, nom « Capsela », langue principale français, identifiant de lot `app.capsela` (s'il n'est pas proposé : developer.apple.com → Identifiers → « + » → App IDs, `app.capsela`, cocher « Sign in with Apple »), SKU libre (ex. `capsela-ios`). Sans cette fiche, l'envoi est refusé.
3. **Clé d'API** : App Store Connect → Utilisateurs et accès → Intégrations → App Store Connect API → « + », rôle **Admin** (nécessaire pour que la signature soit gérée par Apple). Télécharger le fichier `AuthKey_XXXX.p8` (une seule fois possible) → secrets `APP_STORE_CONNECT_KEY` (contenu du fichier), `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`.
4. Lancer le workflow ; le build apparaît dans App Store Connect → TestFlight après le traitement d'Apple (de quelques minutes à une heure).

Sur iOS, la vidéo récompensée n'est pas proposée (`src/lib/publicite.ts` : Android seulement), et le SDK AdMob n'est pas embarqué (`capacitor.config.ts`, `ios.includePlugins`, 05/11/2026 : ses bibliothèques faisaient refuser l'envoi à App Store Connect).

**Publicité sur iOS : décidée, APRÈS la première version** (05/11/2026, propriétaire). À faire alors :
- propriétaire : une app iOS et un bloc « avec récompense » dans AdMob (deux identifiants) ; la confidentialité d'App Store Connect (identifiant de l'appareil, données d'utilisation, suivi) et la question « Publicité » à Oui ;
- code : AdMob remis dans `ios.includePlugins` avec une archive signée en distribution (l'archive non signée laisse les bibliothèques de Google mal signées) ; la demande de suivi (App Tracking Transparency, `NSUserTrackingUsageDescription`) ; le vrai `GADApplicationIdentifier` et les `SKAdNetworkItems` dans `Info.plist` ; le formulaire de consentement de Google ; `publiciteDisponibleIci` ouvert à iOS.

## Ce qui reste à faire avant la première soumission

1. **Sign in with Apple** : exigé sur iOS tant que la connexion Google y est proposée (règle 4.8 de l'App Store) — à faire quand le compte Apple existe (identifiant de service, clé, fournisseur « Apple » dans Supabase).
2. **Pages légales** : déjà publiques sur le site (`/legal/confidentialite`, `/legal/cgu`… générées par `scripts/generer-legal.mjs`) ; ce sont ces adresses qu'il faut donner aux stores.
3. **Paiement** : aucun. Sur les stores, un abonnement numérique passe obligatoirement par l'achat intégré d'Apple ou de Google ; l'écran Premium actuel (« on te préviendra ») ne vend rien et peut rester tel quel.

## Ce qui n'a pas été vérifié

Ni Xcode ni le SDK Android ne sont disponibles dans l'environnement où les projets ont été générés. Android compile dans son workflow depuis le 17/10/2026 ; iOS compile pour la première fois dans `ios-construire.yml` (05/11/2026). Aucun des deux n'a été ouvert dans Xcode ou Android Studio.

## iOS : le haut de l'écran (06/11/2026)

Signalé sur l'enregistrement TestFlight de la 1.9 : « le haut des écrans est caché, il n'y a pas suffisamment de marges dans le header ».
La vue web d'iOS passe sous la barre d'état et l'encoche ; sans `viewport-fit=cover`, WebKit donne 0 à `env(safe-area-inset-*)`, donc
rien ne laissait cette place. Correctif : sur iOS natif seulement, `viewport-fit=cover` est ajouté au chargement (App.tsx), et la coque de
l'app reçoit `pt-safe-top` (globals.css). Android (page déjà entre les barres système) et le web ne changent pas. Le bas, qui utilisait
déjà `env(safe-area-inset-bottom)`, laisse désormais aussi la place de la barre d'accueil de l'iPhone. À vérifier sur iPhone à chaque build.

## La position dans l'app (11/11/2026)

Signalé dans la vidéo de démonstration pour Apple : « localhost aimerait utiliser votre position actuelle ». Cause : l'app sert son site
embarqué depuis `capacitor://localhost` (iOS) ; l'API web de position (`navigator.geolocation`) y ouvrait la fenêtre d'autorisation de la
vue web, au nom de ce « site ». Ce n'était pas une URL de développement : aucune `server.url`, et les mentions de « localhost » du bundle
viennent de bibliothèques (valeurs par défaut jamais appelées).

Depuis : dans l'app iOS et Android, `getBrowserPosition` (`src/lib/weather.ts`) passe par le plugin natif `@capacitor/geolocation`
(8.2.4, ajouté à `ios.includePlugins`) : la fenêtre est celle du système, au nom de Capsela, avec le texte de
`NSLocationWhenInUseUsageDescription` (Info.plist) ; Android garde ses permissions `ACCESS_COARSE_LOCATION` et `ACCESS_FINE_LOCATION`. Le site
web garde l'API du navigateur. Un refus ou un délai rend `null`, comme avant : la ville du profil prend le relais. NON vérifié sur un
appareil : à contrôler sur le prochain build TestFlight et Android.
