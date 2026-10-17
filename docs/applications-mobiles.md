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

## Ce qui reste à faire avant la première soumission

1. **Connexion Google** : `signInWithOAuth` redirige vers `window.location.origin`, qui vaut `capacitor://localhost` (iOS) ou `https://localhost` (Android) dans l'app, et Google refuse sa page de connexion dans une vue web intégrée. Il faut ouvrir la connexion dans le navigateur du système et revenir par un lien profond (`app.capsela://…`), déclaré dans Supabase. Même chose pour le lien « nouveau mot de passe » (`auth.tsx`, `PARAM_RECUPERATION`).
2. **Sign in with Apple** : exigé sur iOS tant que la connexion Google y est proposée (règle 4.8 de l'App Store).
3. **Icône et écran de démarrage** : les projets portent les icônes par défaut de Capacitor. Produire une icône 1024 × 1024 px sans transparence, puis la décliner (outil `@capacitor/assets`, à ajouter le moment venu).
4. **Pages légales** : déjà publiques sur le site (`/legal/confidentialite`, `/legal/cgu`… générées par `scripts/generer-legal.mjs`) ; ce sont ces adresses qu'il faut donner aux stores.
5. **Paiement** : aucun. Sur les stores, un abonnement numérique passe obligatoirement par l'achat intégré d'Apple ou de Google ; l'écran Premium actuel (« on te préviendra ») ne vend rien et peut rester tel quel.

## Ce qui n'a pas été vérifié

Ni Xcode ni le SDK Android ne sont disponibles dans l'environnement où les projets ont été générés : **aucune compilation native n'a été faite**. La première ouverture dans Xcode et Android Studio est l'étape de vérification.
