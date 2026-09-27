# AgentForge — AI Agent Framework Factory

**Version candidate 0.1.0. Non certifiée pour une ouverture commerciale.**

Application web TypeScript autonome : cadrage d’un agent, proposition d’architecture, modèles et sources, paiements Stripe, file de génération, sandbox, audits et livraison privée. Le code des services connectés est présent ; leurs tests réels restent à exécuter avec une infrastructure et des identifiants configurés.

## Lancer l’atelier local maintenant

Prérequis : Node.js **22.16 ou supérieur**. La version 22.16.0 a servi aux tests de cette distribution ; ce n’est pas une affirmation qu’elle est la plus récente. Aucune dépendance npm d’exécution à installer.

```bash
cd agentforge
npm test
npm run build
PORT=3002 APP_URL=http://localhost:3002 npm run dev
```

Ouvrir `http://localhost:3002` dans ton navigateur. Le port 3002 évite de remplacer un éventuel site AXDIA/site2 déjà lancé sur 3000. Le code n’a pas été installé dans ce projet préexistant et n’a pas été déployé sur ton compte Railway.

Sans configuration, l’application fonctionne en **atelier local par règles, sans appel IA**. Le parcours salon pose les questions utiles et produit un **ZIP de cadrage**. Ce ZIP n’est pas un agent généré et ne contient aucune fausse preuve d’audit. Fermer ou recharger la page perd le cadrage non exporté.

```bash
npm run fixture    # Spécification salon + ZIP de cadrage explicite
npm run doctor     # Diagnostic de configuration sans afficher les secrets
```

## Mode connecté

Copier `.env.example` en `.env` uniquement sur ton environnement, compléter les variables puis consulter [DEPLOYMENT.md](DEPLOYMENT.md). Les secrets restent côté serveur.

Le mode connecté utilise un projet **Supabase dédié**, des prix **Stripe test**, un fournisseur IA réellement configuré, un worker séparé avec Docker, une image de dépendances approuvée et les moteurs AXDIA montés en lecture seule. Les sources des moteurs ne font pas partie de cette distribution.

```bash
npm run dev       # Terminal 1 : serveur web
npm run worker    # Terminal 2 : worker sur un hôte d’isolation approprié
```

Le contrôle `/health` mesure la disponibilité du processus. `/ready` vérifie des prérequis opérationnels ; **aucun de ces endpoints ne vaut certification de production**. Un service manquant bloque les paiements/générations au lieu de simuler un succès.

## Ce qui est écrit

Le serveur expose l’authentification Supabase, les projets avec contrôle de propriétaire, la recherche de métadonnées GitHub et MCP, les plans immuables, Stripe Checkout et les webhooks signés. La migration SQL contient RLS, idempotence, crédits, jobs avec baux et jetons de verrouillage, coûts réservés, événements et téléchargements privés. Le worker appelle les fournisseurs, résout les dépendances hors ligne dans Docker, vérifie, tente des corrections bornées, puis peut publier un ZIP si tous les contrôles requis sont réellement favorables.

Le cadrage connecté peut appeler `AI_INTERVIEW_MODEL` pour extraire des propositions. Elles restent `INFERRED` jusqu’à confirmation. Sans ce modèle, ou si son appel échoue, l’interface conserve un cadrage par règles et signale le repli. Le choix d’architecture reste heuristique ; les phases IA architecte et revue distinctes ne sont pas exécutées dans cette version.

## Choix et écarts importants

Cette réalisation utilise **Node HTTP + TypeScript + interface JavaScript native**, et non Next.js/React/Zod. C’est un écart explicite par rapport à la stack conseillée du cahier des charges : l’environnement de construction ne permettait pas d’installer ces paquets depuis npm, et le cœur a été rendu exécutable sans dépendances plutôt que livré comme un squelette impossible à tester ici. Un contrôle TypeScript séparé est disponible.

La file utilise **PostgreSQL/Supabase**, pas Redis ; le stockage utilise **Supabase Storage privé**, pas S3. Ce sont des choix d’implémentation, pas des adaptateurs fictifs. Les dépendances de génération sont résolues dans une image hors ligne prévalidée. Il n’existe pas de provisionnement automatique de sandbox cloud distante.

## Vérification et limites

Voir [IMPLEMENTATION_REPORT.md](IMPLEMENTATION_REPORT.md) pour les résultats réellement exécutés, les rapports AXDIA et les limites. Les tests d’adaptateurs HTTP utilisent des fixtures uniquement dans `tests/`. Ils ne prouvent pas qu’un vrai paiement ou une vraie génération distante a réussi.

```bash
npm test
npm run typecheck  # Compiler TypeScript et @types/node à installer séparément si absents
npm run build
npm start
RUN_LIVE_CHECKS=true npm run test:live  # Connectivité réelle uniquement, Stripe test obligatoire
```

Pour le contrôle de types, installer une version stable vérifiée de TypeScript et `@types/node` dans ton environnement de développement, ou indiquer `TSC_BIN` et `NODE_TYPES_DIR`. Le test de cette livraison a utilisé les outils déjà installés, sans les redistribuer. Le build retire les annotations TypeScript : **il ne remplace pas le contrôle de types**.

Les tests navigateur natifs se lancent avec `python scripts/browser-e2e.py` après installation de Playwright et Chromium et démarrage du serveur local. Ici, la navigation Chromium vers localhost a été bloquée par la politique du navigateur. Les contrôles DOM et captures ont donc un périmètre séparé : transport HTTP local explicite, sans test des cookies ni de la CSP native.

## Documents

[Architecture](ARCHITECTURE.md) · [Sécurité](SECURITY.md) · [Déploiement](DEPLOYMENT.md) · [Recherche](docs/research/AGENT_FRAMEWORK_RESEARCH.md) · [Audit des archives](docs/audit/EXISTING_TOOLS_AUDIT.md) · [Matrice des exigences](docs/REQUIREMENTS_COVERAGE.md) · [Reprise VS Code](docs/PROMPT_REPRISE_VSCODE.md)
