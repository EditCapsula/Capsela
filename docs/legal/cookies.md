# Cookies et traceurs

*Dernière mise à jour : [À COMPLÉTER — date de publication]*

Un traceur est une information enregistrée sur ton appareil par
l'application (cookie, stockage local du navigateur). Capsela en utilise
peu, et un seul type demande ton accord : la mesure d'audience.

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
| `capsela.authIntent` (stockage de session) | Revenir au bon écran après l'inscription | Jusqu'à la fermeture de l'onglet |

## Mesure d'audience (avec ton consentement)

Si tu l'acceptes, Google Analytics mesure la fréquentation de l'application
(pages vues, usage général) pour nous aider à l'améliorer. Il n'est chargé
qu'après ton accord ; sans lui, rien n'est déposé.

| Nom | Émetteur | Rôle | Durée |
| --- | --- | --- | --- |
| `_ga`, `_ga_…` | Google | Distinguer les visites de façon statistique | 13 mois au plus [À VÉRIFIER — réglage du compte Analytics] |

Refuser est aussi simple qu'accepter, et ton choix se modifie à tout moment
dans « Mon compte ».

## Ce que nous n'utilisons pas

- aucun cookie publicitaire, aucun traceur de réseau social ;
- les rapports d'erreur (Sentry) ne déposent aucun cookie ;
- les polices de caractères sont servies par Capsela elle-même, sans appel à
  un service tiers.

## En savoir plus

cnil.fr, rubrique « Cookies et autres traceurs ».
