# Cookies et traceurs

*Dernière mise à jour : [À COMPLÉTER — date de publication]*

Un traceur est une information enregistrée sur ton appareil par
l'application (cookie, stockage local du navigateur). Capsela en utilise
peu, et deux types seulement demandent ton accord : la mesure d'audience et,
dans l'application Android, la personnalisation de la publicité.

## Nécessaires au fonctionnement (sans consentement)

Ils sont indispensables au service que tu demandes : ils ne peuvent pas être
refusés, mais ne servent à rien d'autre.

| Nom | Rôle | Durée |
| --- | --- | --- |
| `sb-…-auth-token` (cookie, parfois découpé en plusieurs) | Garder ta session ouverte | Jusqu'à 400 jours, ou jusqu'à ta déconnexion |
| `sb-…-auth-token-code-verifier` (cookie) | Sécuriser la connexion avec Google et la réinitialisation du mot de passe | Le temps de l'opération |
| `capsela.analyticsConsent` (stockage local) | Retenir ton choix sur la mesure d'audience | Six mois, puis la question est reposée |
| `capsela.lastKnownCity` (stockage local) | Afficher la météo de ta dernière ville plus vite | Jusqu'à la prochaine mise à jour |
| `capsela.valises.…` (stockage local) | Garder tes valises disponibles sur l'appareil | Jusqu'à leur suppression |
| `capsela.villesRecentes` (stockage local) | Te reproposer les six dernières villes choisies | Jusqu'à la suppression du compte |
| `capsela.recommandees.…` (stockage local) | Éviter de te reproposer la tenue des jours précédents | Une quinzaine de jours glissants |
| `capsela.accords.…` (stockage local) | Ne plus te proposer une association de couleurs écartée | Jusqu'à ce que tu changes d'avis, ou la suppression du compte |
| `capsela.authIntent` (stockage de session) | Revenir au bon écran après l'inscription | Jusqu'à la fermeture de l'onglet |
| `capsela.dernierEcran` (stockage de session) | Rouvrir l'écran où tu étais après un rechargement | Jusqu'à la fermeture de l'onglet |

Ceux qui sont liés à ton compte sont effacés de l'appareil quand tu le
supprimes.

## Mesure d'audience (avec ton consentement)

Si tu l'acceptes, Google Analytics mesure la fréquentation de l'application
(pages vues, usage général) pour nous aider à l'améliorer. Il n'est chargé
qu'après ton accord ; sans lui, rien n'est déposé.

| Nom | Émetteur | Rôle | Durée |
| --- | --- | --- | --- |
| `_ga`, `_ga_…` | Google | Distinguer les visites de façon statistique | 13 mois au plus [À VÉRIFIER — réglage du compte Analytics] |

Refuser est aussi simple qu'accepter, et ton choix se modifie à tout moment
dans « Gérer mon compte ».

## Publicité (application Android, avec ton consentement)

Dans l'application Android, une vidéo publicitaire peut t'être proposée quand
tu as utilisé tes tenues gratuites du jour : c'est toi qui choisis de la
regarder, pour obtenir une tenue de plus. Elle est fournie par Google AdMob.

Avant toute publicité, Google te présente un formulaire pour accepter ou
refuser sa personnalisation. Refuser est aussi simple qu'accepter ; sans ton
accord, la publicité n'est pas personnalisée. Ton choix est gardé sur ton
appareil et se modifie à tout moment dans « Gérer mon compte → Choix
publicitaires ».

| Traceur | Émetteur | Rôle | Durée |
| --- | --- | --- | --- |
| Identifiant publicitaire de l'appareil (Android) | Google | Mesurer et, si tu l'acceptes, personnaliser la publicité | Tant que tu ne le réinitialises pas dans les réglages Android |
| Choix de consentement (stockage de l'application) | Google | Retenir ton choix sur la personnalisation | Jusqu'à ce que tu le changes ou désinstalles l'application |

## Ce que nous n'utilisons pas

- aucun cookie publicitaire sur le site web, aucun traceur de réseau social ;
- les rapports d'erreur (Sentry) ne déposent aucun cookie ;
- les polices de caractères sont servies par Capsela elle-même, sans appel à
  un service tiers.

## En savoir plus

cnil.fr, rubrique « Cookies et autres traceurs ».
