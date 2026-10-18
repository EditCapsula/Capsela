# Capsela — Applications iOS et Android (Capacitor)

17/10/2026. Plan d'ensemble et fiches des stores : Notion, « Capsela · Delivery » → « Plan de publication sur l'App Store et Google Play ».

## Principe

Capacitor emballe le site statique déjà construit (`out/`, `output: "export"`) dans une app iOS (`ios/`) et une app Android (`android/`). Même code, même Supabase, mêmes comptes. **Le site web n'est pas touché** : `npm run build` et le déploiement Vercel restent les mêmes ; seul `npm run mobile:sync` copie `out/` dans les projets natifs.

- Configuration : `capacitor.config.ts` — identifiant `app.capsela` (définitif une fois publié, à valider), nom « Capsela », fond crème `#F3EEE5`.
- Versions : `@capacitor/*` 8.5.2, épinglées.
- iOS : Swift Package Manager (pas de CocoaPods), iPhone seulement, portrait. Android : `minSdk` 24, `targetSdk` 36, portrait.

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

**Nouveau logo (18/10/2026)** : `public/brand/capsela-logo.png` (« CAPSELA » en didone, le A terracotta, tel que fourni). `node scripts/generer-marque.mjs` en dérive la version claire (fonds sombres) et le monogramme « CA » ; `node scripts/generer-icones-mobiles.mjs` pose ce monogramme sur le crème de l'app pour iOS (icône 1024 px opaque, écrans de démarrage), Android (icônes classiques, rondes, adaptatives, écrans de démarrage) ; le favicon du site reste le cintre-cœur (`src/app/icon.svg`, décidé le 18/10/2026). **À valider** : dans le logo, la jambe droite du A passe sous le P ; le monogramme la prolonge jusqu'à la ligne de base en suivant ses bords. Le fichier fourni fait 775 px de large : une version vectorielle (ou au moins 3 000 px) donnerait une icône plus nette.

## Construction automatique de l'app Android (17/10/2026)

Sans Android Studio : deux workflows GitHub (onglet Actions).
- **« Android — créer la clé d'envoi »** (`android-cle.yml`), une seule fois : crée la clé qui signe les versions envoyées à Google Play. Avant : secret `ANDROID_KEYSTORE_PASSWORD`. Après : copier le contenu de l'artefact `cle-envoi.base64.txt` dans le secret `ANDROID_KEYSTORE_BASE64`, puis supprimer l'artefact. Google Play re-signe l'app (Play App Signing) : une clé d'envoi perdue se remplace auprès du support.
- **« Android — construire l'app pour Google Play »** (`android-construire.yml`), à chaque version : « Run workflow » avec le nom de version ; le fichier `.aab` signé est en artefact (30 jours), à déposer dans la Play Console. Le numéro de version (`versionCode`) est le numéro d'exécution, toujours croissant. Secret de la clé publique Supabase : `NEXT_PUBLIC_SUPABASE_ANON_KEY`, sinon `SUPABASE_PUBLISHABLE_KEY`.
- **Sur une pull request** qui touche `android/`, `capacitor.config.ts` ou le workflow : la même construction, non signée, pour vérifier que le projet compile.
- Gradle lit la clé et la version dans l'environnement (`android/app/build.gradle`) : rien de secret dans le dépôt.

## Ce qui reste à faire avant la première soumission

1. **Sign in with Apple** : exigé sur iOS tant que la connexion Google y est proposée (règle 4.8 de l'App Store) — à faire quand le compte Apple existe (identifiant de service, clé, fournisseur « Apple » dans Supabase).
2. **Pages légales** : déjà publiques sur le site (`/legal/confidentialite`, `/legal/cgu`… générées par `scripts/generer-legal.mjs`) ; ce sont ces adresses qu'il faut donner aux stores.
3. **Paiement** : aucun. Sur les stores, un abonnement numérique passe obligatoirement par l'achat intégré d'Apple ou de Google ; l'écran Premium actuel (« on te préviendra ») ne vend rien et peut rester tel quel.

## Ce qui n'a pas été vérifié

Ni Xcode ni le SDK Android ne sont disponibles dans l'environnement où les projets ont été générés : **aucune compilation native n'a été faite**. La première ouverture dans Xcode et Android Studio est l'étape de vérification.
