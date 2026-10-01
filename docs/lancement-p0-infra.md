# Lancement P0 via navigateur — section C : Supabase et Vercel

État au 01/10/2026. Cette fiche dit quoi vérifier, comment, et ce que le dépôt
permet de contrôler lui-même. **Rien ici n'a pu être vérifié sur ton projet
Supabase ni sur Vercel** : je n'y ai pas accès. Chaque point « à vérifier » se
fait de ton côté, avec la commande ou le réglage indiqué.

## 8. Migrations

`supabase/migrations/` (0001 à 0042) est exécuté À LA MAIN dans l'éditeur SQL.

1. **Vérifier ce qui est passé.** Colle `supabase/verification/verifier_migrations.sql`
   dans l'éditeur SQL et exécute-le : lecture seule, un seul résultat. Il rend
   une ligne par migration (« complète » ou « INCOMPLÈTE : … manque … »), les
   tables sans RLS (attendu : aucune), les buckets (attendu : `dressing-photos`
   et `avis-styliste-photos` privés), et le catalogue (dont le nombre de liens
   d'affiliation et de pièces avec manches). Envoie-moi le résultat : je lis
   les écarts.
   - Contrôlé sur un PostgreSQL 16 neuf, 0001 à 0042 rejouées dans l'ordre :
     42 migrations « complètes ». Il détecte bien une migration manquante.
2. **0033 échouait, et c'est corrigé dans le dépôt.** `consommer_generation`
   gagnait une colonne (`bonus`) par `create or replace`, ce que PostgreSQL
   refuse (« cannot change return type of existing function »). Passée dans
   l'éditeur SQL, la migration était annulée en entier : ni `generation_quota.bonus`
   ni `accorder_bonus_generation`. Le fichier a maintenant un `drop function if exists`.
   Si ta vérification dit que 0033 est incomplète, **recolle 0033 corrigée**.
   Effet visible tant qu'elle manque : aucun (le bonus vidéo n'est pas actif),
   mais la limite quotidienne de tenues peut mal se lire — à contrôler.
3. **0041 (bucket privé)** : le code qui signe les URL des photos est en
   production depuis la PR 77. Ordre respecté si 0041 est passée après.
4. **0002 (table `pieces`)** : schéma obsolète, jamais branché au code (cf. 0021) ;
   son absence en base est sans effet, le script ne la teste plus.
5. **0042 (manches)** : à exécuter ; le champ « Manches » fonctionne sans, mais
   l'enregistrement d'une longueur échoue à l'écran tant qu'elle manque.

## 9. Fonctions Edge

Sept fonctions dans `supabase/functions/`. Chacune se déploie en collant son
fichier dans le tableau de bord (Edge Functions → Deploy a new function), ou
`supabase functions deploy <nom>`. Les trois qui importent `_shared/` demandent
la CLI ou un fichier unique.

| Fonction | Rôle | Secrets | JWT vérifié ? | Lancement P0 |
| --- | --- | --- | --- | --- |
| `weather` | météo, prévisions (`mode=forecast`), villes (`mode=geo`) | `OPENWEATHER_API_KEY` | non (par conception) | **requise** ; redéployer la dernière version (le client détecte l'ancienne par la forme de sa réponse) |
| `analyze-dressing-photo` | préremplit la fiche d'une pièce depuis sa photo | `OPENAI_API_KEY`, `PHOTO_ANALYSIS_MODEL` (option) | **non** | requise pour le préremplissage |
| `generate-catalog-image` | visuels du catalogue | `OPENAI_API_KEY`, `IMAGE_GENERATION_MODEL`/`_QUALITY`, `MAX_IMAGE_GENERATIONS_PER_DAY` (options), clé admin | **non** | requise si des visuels manquent |
| `delete-account` | suppression du compte (RGPD) | `SUPABASE_SERVICE_ROLE_KEY` ou `SB_SECRET_KEY` | oui (id lu dans le JWT) | **requise** : sans elle, la suppression et le refus sous 15 ans échouent |
| `stylist-advice` | avis de styliste | `OPENAI_API_KEY`, `STYLIST_ADVICE_MODEL`, `STYLIST_ADVICE_TIMEOUT_MS` (options), clé admin | oui | requise si l'avis est ouvert |
| `video-recompense` | bonus après vidéo | — | — | **inutile** : aucun fournisseur, l'app n'affiche jamais la carte vidéo |
| `recompress-legacy-images` | maintenance du stock PNG | `RECOMPRESS_ADMIN_KEY` | clé dédiée | à supprimer une fois le stock épuisé |

**Risque de coût à traiter.** `analyze-dressing-photo` et `generate-catalog-image`
ne vérifient aucun JWT : la clé `anon`, publique dans le navigateur, suffit à les
appeler en boucle et à consommer des crédits OpenAI. `generate-catalog-image` a
un plafond quotidien (`MAX_IMAGE_GENERATIONS_PER_DAY`, **à fixer**) ;
`analyze-dressing-photo` n'en a aucun. À faire : exiger un JWT d'utilisatrice
connectée, et plafonner par compte et par jour. Je peux l'écrire.

Test d'une fonction déployée (remplace `<ref>` et `<anon>`) :

```
curl -s -X POST 'https://<ref>.supabase.co/functions/v1/weather' \
  -H 'Authorization: Bearer <anon>' -H 'Content-Type: application/json' \
  -d '{"city":"Paris"}'
```

## 10. Secrets (Settings → Edge Functions → Secrets)

`OPENAI_API_KEY`, `OPENWEATHER_API_KEY`, `SB_SECRET_KEY` (clé `sb_secret_…`, si
les clés JWT historiques sont désactivées), `VIDEO_SSV_SECRET` (inutile tant que
la vidéo n'existe pas), `RECOMPRESS_ADMIN_KEY` (si tu relances la maintenance),
et les options de modèle. **Fixer `MAX_IMAGE_GENERATIONS_PER_DAY`.** Aucun
secret ne porte le préfixe `NEXT_PUBLIC_`.

## 11. Vercel

- **Variables** (Production **et** Preview) : `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` (sans elles, l'app part en mode démo),
  `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_GA_ID`. Elles sont figées au build :
  **redéployer** après toute modification.
- **Sentry** : `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` pour les cartes
  de source (facultatif) ; et désactiver le stockage des IP dans Sentry.
- **Site statique** : `output: "export"`, dossier `out/`. Aucun en-tête n'est
  posé par le code : pour la production, un `vercel.json` peut en ajouter
  (Content-Security-Policy, Referrer-Policy, X-Content-Type-Options). À décider.
- **Formule Vercel** : le plan gratuit (Hobby) est réservé à un usage personnel
  non commercial d'après les conditions de Vercel — **à vérifier avant de
  vendre Premium**.

## 12. Authentification (Supabase → Authentication)

- **URL Configuration** : *Site URL* = le domaine public ; *Redirect URLs* doit
  contenir `https://<domaine>/` et `https://<domaine>/?recuperation=1` (le code
  s'en sert pour Google et la réinitialisation du mot de passe), et chaque
  domaine de préproduction utilisé.
- **E-mail** : confirmation d'e-mail activée (l'app affiche « Vérifie ta boîte
  mail »), gabarits en français, expéditeur propre (SMTP dédié : l'envoi
  Supabase par défaut est limité et peu fiable en production).
- **Google** : fournisseur activé, client OAuth avec l'URL de retour Supabase
  déclarée côté Google, écran de consentement publié.
- **Tests de bout en bout à rejouer** : inscription e-mail, confirmation,
  connexion, mot de passe oublié, Google, suppression du compte.

## 13. Domaine et hébergement

- **Domaine propre** à brancher sur Vercel (aujourd'hui `*.vercel.app`) ; le
  mettre ensuite dans les mentions légales, les URL de redirection Supabase et
  `NEXT_PUBLIC_*` si besoin.
- **Quotas Supabase** : un relevé du 26/08 notait un *Cached Egress* à 196 % du
  quota gratuit (5 Go), avec une période de grâce jusqu'au 22/09 après laquelle
  les requêtes renvoient 402. **Vérifie l'état du projet** (Settings → Usage) :
  si le quota est dépassé, l'app ne marche plus. Les photos privées servies par
  URL signée ne sont pas mises en cache, ce qui pèse sur l'egress.
- **Formule Supabase** : le plan gratuit met le projet en pause après une
  semaine d'inactivité et n'a pas de sauvegarde quotidienne. Pour un lancement,
  prévoir le plan payant et activer les sauvegardes.
