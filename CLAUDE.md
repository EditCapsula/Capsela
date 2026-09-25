# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commandes

- `npm run verify` — typecheck → lint → test → build, l'ordre exact de `.github/workflows/ci.yml`. C'est la seule vérification qui compte avant un commit (cf. AGENTS.md).
- `npm run dev` — serveur de développement ; `npm run build` produit le site statique dans `out/`.
- Un seul fichier de tests : `npx vitest run src/lib/__tests__/etatDePort.test.ts` ; un seul test : ajouter `-t "nom du test"`.
- Audits catalogue (interrogent Supabase, hors de `npm test`) : `npx vitest run --config vitest.audit.config.mts scripts/<nom>.audit.ts`.

Les tests ne couvrent que des fonctions pures de `src/lib` (environnement node, sans jsdom ni testing-library). Un changement d'écran se vérifie en rendu réel, pas par les tests.

## Architecture

**Site entièrement statique.** `next.config.ts` fixe `output: "export"` (condition de l'empaquetage Capacitor) : aucune Route Handler, Server Action, `cookies()`/`headers()` ni `next/image` avec le loader par défaut — images en `<img>`. Ce qui demande un serveur passe par les fonctions Edge Supabase (`supabase/functions/` : `weather`, `analyze-dressing-photo`, `generate-catalog-image`, `delete-account`, `video-recompense`…).

**Une seule page, navigation par état.** `src/app/page.tsx` → `AppLoader` (import dynamique, `ssr: false`) → `App.tsx`, qui monte `AuthProvider` puis `CapselaProvider` et affiche l'écran désigné par `state.screen` (union `Screen` dans `src/lib/types.ts`). Il n'y a pas de routage par URL : on change d'écran par les actions du store (`goHome`, `goPlanifier`, `openItem`…). Un fichier par écran dans `src/components/screens/`. La barre du bas est masquée pour `NO_TABBAR_SCREENS` et `FLOW_SCREENS` (`App.tsx`) ; un écran de parcours peut la rendre lui-même sur sa vue d'accueil (cf. le hub de `PlanifierScreen`).

**Le store** (`src/lib/store.tsx`) porte `AppState` et toutes les actions. Les pools à connaître :
- `vestiairePool` — le catalogue `vestiaire_universel` (repli : `catalog.ts`) ;
- `defaultCapsule` — la capsule calculée depuis le catalogue et le profil (`computeDefaultCapsule`, `capsule.ts`) ;
- `wardrobePool` — `composeWardrobePool` : catégorie par catégorie, les pièces réelles du dressing remplacent les suggestions de la capsule.

Pour résoudre des pièces déjà enregistrées (historique, looks, tenues planifiées), utiliser `[...state.items, ...vestiairePool]` et non `wardrobePool`, qui change avec le dressing et le style.

**Un seul moteur de tenues** : `generateOutfitWithFallback` (`logic.ts`), appelé par la tenue du jour (`regen` dans le store), Planifier et les idées du Dressing vide. Ne pas en écrire un second. Les dérivés d'affichage (Journal, états de port, complétude du profil) sont des fonctions pures dans `selectors.ts` et `profile.ts`, testées.

**Données et Supabase.** Les accès passent par des modules dédiés (`dressing.ts`, `planifier.ts`, `premium.ts`, `generations.ts`, `auth.tsx`…). Sans les variables `NEXT_PUBLIC_SUPABASE_*`, l'app tourne en mode démo (`isSupabaseConfigured`). Les lectures échouent en douceur (`[]`, `null`, `"inconnu"`) et les paywalls échouent en ouvrant : un état inconnu n'applique aucune limite.

**Migrations SQL.** `supabase/migrations/` est exécuté À LA MAIN par la propriétaire du projet dans l'éditeur SQL : ne jamais supposer qu'une migration est appliquée. Montrer le SQL avant, collé dans la conversation. Une fonctionnalité qui dépend d'une nouvelle colonne doit fonctionner avant la migration : l'écriture de cette colonne reste isolée (jamais dans `itemToRow`, qui casserait toutes les sauvegardes) et son échec est signalé à l'écran.

## Conventions du projet

- Interface, commentaires et messages de commit en français. Les commentaires expliquent le POURQUOI et datent les arbitrages : les lire avant de modifier une règle.
- Aucune donnée inventée à l'écran : une section sans donnée ne s'affiche pas. Une phrase qui affirme qu'une donnée « sert à » quelque chose doit être vraie dans le code.
- Jamais de message morphologique négatif. Interdits : cacher, dissimuler, camoufler, corriger, défaut, grossir, amincir, peu flatteur. Aucune logique fondée sur la couleur de peau, la morphologie, l'âge ou le genre apparents.
- Design system : tokens de `src/app/globals.css` (crème, terracotta, encre), Fraunces pour les titres (27 px pour un titre d'écran, second temps en italique terracotta), Manrope pour le reste. Pas d'emoji dans l'interface.

## Rendu local dans l'environnement cloud

Le conteneur définit `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`, mais le réseau vers Supabase y est bloqué : les requêtes échouent et l'app s'affiche vide. Pour un rendu en mode démo : `env -u NEXT_PUBLIC_SUPABASE_URL -u NEXT_PUBLIC_SUPABASE_ANON_KEY npx next dev -p 3000`.
