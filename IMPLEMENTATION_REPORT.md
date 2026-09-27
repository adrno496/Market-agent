# Rapport de livraison — AgentForge 0.1.0

**Statut : VERSION CANDIDATE EXÉCUTABLE. OUVERTURE COMMERCIALE BLOQUÉE.**

La livraison contient du code exécuté et testé, pas seulement un prompt ou une architecture. Elle ne satisfait cependant pas encore la Definition of Done commerciale du cahier des charges. Aucun paiement réel, compte externe, génération client connectée ni déploiement n’est présenté comme effectué.

## 1. Résultat accessible immédiatement

L’atelier local affiche une interface française desktop/mobile, recueille l’idée, pose les questions, conserve les réponses confirmées séparément des inférences et propose une architecture. Le scénario salon a été parcouru jusqu’à dix réponses et à un **vrai ZIP de cadrage**, décompressé et vérifié.

Ce ZIP de cadrage **n’est pas un agent généré** : il n’a pas de code métier `src/`, pas de paiement consommé, et les audits sont marqués NOT_AVAILABLE. Il permet d’examiner le besoin et le format des livrables, sans inventer un produit déjà livré.

L’authentification, les paiements, le worker et le générateur sont des chemins de code distincts nécessitant les services décrits dans DEPLOYMENT.md. Leur présence ne constitue pas une validation de leur fonctionnement connecté.

## 2. Architecture construite

`apps/web` contient le serveur HTTP TypeScript et l’interface native ; `apps/worker` le service de génération séparé ; `packages/core` le cadrage, les schémas, les fournisseurs, le catalogue, la recherche de sources, les plans, paiements, stockage, contrôles, sandbox et packaging. `supabase/migrations` contient la migration et les contrôles de propriétaire/RLS. `tests` contient les tests locaux, `reports` les résultats bruts.

La réalisation utilise **Node HTTP + TypeScript + JavaScript natif**, pas Next.js/React/Zod. C’est un écart explicite à la stack conseillée. L’accès npm étant indisponible dans l’environnement de construction, un runtime sans dépendance npm a été privilégié pour livrer et tester du code réellement lançable. Cela ne démontre pas que cette stack est supérieure à celle demandée.

La file est persistée dans PostgreSQL/Supabase, pas Redis. Le stockage est Supabase Storage privé, pas une fausse abstraction S3. Le worker exige un hôte Docker isolé et une image hors ligne approuvée ; aucun adaptateur de sandbox cloud distante n’est livré.

## 3. Composants écrits et périmètre exact

**Cadrage.** ProjectSpec versionné, faits avec provenance/confiance/confirmation, validation des entrées, questions par règles, défauts non silencieux, fixture salon et autres cas de cadrage. L’extraction IA initiale connectée est écrite ; elle ne remplace jamais une réponse confirmée. L’entretien IA multi-tour approfondi n’est pas implémenté.

**IA et sources.** Adaptateurs HTTP pour OpenRouter, OpenAI, Anthropic, Mistral et Google, catalogue dynamique et cache, budgets réservés, aucune clé dans le navigateur. Les contrats sont testés avec fixtures. Le sélecteur considère OpenAI Agents JS/Python, LangGraph, Google ADK et Microsoft Agent Framework. Les sept dépôts officiels demandés, Agent Skills et MCP compris, ont été étudiés dans la recherche documentaire. Les versions exactes sont résolues au moment du plan ; aucune « dernière version » numérique n’a été inventée ou installée ici. Un commit de branche n’est pas présenté comme le commit du package publié.

**Paiement et données.** Stripe Checkout, vérification de signature sur corps brut, relecture canonique de session, crédits/jobs idempotents, remboursement révoquant les droits, URLs de téléchargement après autorisation. La migration contient des contrôles RLS et des fonctions de réservation/claim/heartbeat/finish. **La migration et ses transactions n’ont pas été testées sur un serveur PostgreSQL.** L’auth Supabase et ses cookies/PKCE demandent une validation réelle sur deux utilisateurs.

**Génération.** Plans immuables, appels structurés, validations de fichiers/manifeste, résolution de lockfiles uniquement dans le sandbox hors ligne, limites réseau/processus/mémoire/temps, audits, réparation bornée, empaquetage et dépôt privé. Les quatre preuves static/sandbox/RECURSIVE/BR360 doivent chacune être présentes une seule fois, favorables et accompagnées d’éléments de preuve. Aucun de ces chemins connectés ne s’est exécuté de bout en bout ici.

**UI.** Écrans de cadrage, architecture, connexion, projets, générations, paiements, téléchargements et administration de base. Les pages connectées restent vides/non disponibles sans authentification ; aucune donnée de production fictive. Les revenus agrégés, l’éditeur complet de catalogues, le marketplace et l’explorateur de ZIP avancé sont incomplets.

## 4. Tests effectivement exécutés

| Vérification | Résultat | Périmètre / preuve |
|---|---|---|
| Tests Node | **104 / 104 PASS**, zéro ignoré | `reports/UNIT_TESTS.tap` ; unités, contrats sur fixtures et vrai HTTP local |
| TypeScript strict | **PASS** | `reports/TYPECHECK_LOG.txt` ; compilateur 5.8.3 disponible localement |
| Build TS → JS | **PASS** | `reports/BUILD_LOG.txt` ; 22 modules compilés, pas une construction Docker |
| Fixture salon | **PASS — cadrage seulement** | Spécification et archive réellement écrites dans `reports/fixtures` |
| Interface desktop/mobile et DOM | **6 contrôles PASS, périmètre limité** | `reports/browser/RENDER_INTEGRATION_REPORT.json` |
| Navigateur natif E2E | **BLOCKED** | `reports/browser/NATIVE_BROWSER_REPORT.json` : politique Chromium bloquant localhost |
| Vérifications externes opt-in | **NOT_AVAILABLE** | `reports/LIVE_CHECKS_LOG.txt` ; aucun appel externe autorisé/exécuté |
| SQL/RLS et concurrence réelle | **NOT_AVAILABLE** | Aucun PostgreSQL/Supabase configuré |
| Docker et runtime de l’agent généré | **NOT_AVAILABLE** | Docker absent ; aucune exécution substituée sur l’hôte |
| Déploiement Railway | **NOT_AVAILABLE** | Aucun service déployé |

Le test DOM a utilisé un **pont HTTP local explicite** vers le vrai serveur pour contourner seulement l’impossibilité technique de navigation du navigateur de test, sans modifier sa politique. Il ne valide ni les cookies natifs, ni la CSP appliquée par une navigation réelle, ni Checkout, ni le téléchargement natif. Les captures servent à examiner le rendu, pas à prétendre avoir terminé le parcours commercial.

Le runtime testé est Node 22.16.0. Le retrait d’annotations TypeScript lors du build ne contrôle pas les types : la commande `typecheck` a été exécutée séparément. Les moteurs/outils déjà présents dans l’environnement, notamment le compilateur, ne sont pas redistribués.

## 5. Auto-audits AXDIA réels

Les trois archives moteurs ont été inspectées avant l’implémentation. FORMATION a servi pour ses principes, sans copie. RECURSIVE et BR360 ont réellement été appelés sur un snapshot du code dans l’environnement isolé de construction, avec un environnement filtré et sans autorisation d’exécution non isolée du projet.

- **RECURSIVE audit** : inspection effectuée ; une sortie de processus réussie ne signifie pas réussite de vérification.
- **RECURSIVE verify : BLOCKED.** Les contrôles d’exécution requis n’ont pas été autorisés faute de sandbox adaptée. Son environnement restreint ne résout pas certaines commandes Node/npm ; cela ne signifie pas qu’elles manquaient dans l’environnement des tests locaux indépendants.
- **BR360 : FAIL.** Le code de sortie du processus est 0, mais le rapport métier dit FAIL. Le rapport brut conserve ses scores et le détail des preuves manquantes ; le code de sortie n’a pas été transformé en PASS.

Les résultats détaillés de la dernière exécution et leurs horodatages figurent dans `reports/axdia/SELF_AUDIT_EXECUTIONS.json`, les trois `*_RAW.json` et les sorties standard/erreur. Aucun score d’audit favorable n’a été fabriqué. Les sujets remontés comprennent la licence explicite du produit, la preuve des frontières de responsabilité et les validations réelles manquantes. Une licence n’a pas été inventée pour satisfaire le scanner.

**Les sources RECURSIVE, BR360 et FORMATION ne sont pas incorporées au ZIP livré.** Les documents de droits fournis ne permettaient pas de présumer un droit de redistribution. Les adapters prévoient leur utilisation interne après validation des droits, et les livraisons clientes ne contiennent que les rapports.

## 6. Écarts et blocages restant à traiter

Le scénario demandé « nouveau client → paiement Stripe test → génération IA → dépendances réelles → sandbox → audits → ZIP d’agent lançable » **n’a pas été validé**. Ce n’est pas simplement une question d’ajouter une clé : il faut également corriger les écarts et éprouver l’ensemble connecté.

Priorités : exécuter et revoir la migration dans un Supabase de staging dédié ; prouver l’isolement A/B ; tester Checkout, les événements en double/désordre et les remboursements ; construire l’image de sandbox approuvée ; vérifier ses commandes/caches ; générer puis démarrer l’agent salon ; traiter les résultats des deux moteurs sans contourner leurs contrôles.

Limites de code identifiées : pas de réconciliation automatique complète des Checkout échoués/expirés ; readiness du worker non spécifique à toutes les dépendances du plan ; absence de reprise au niveau de chaque fichier généré ; phases ARCHITECT/REVIEW séparées réservées mais non actives ; résolution de skills surtout documentaire ; pas de SBOM ni de rapports BUILD_REPORT/DEPENDENCIES complets ; coût sandbox/infra non comptabilisé intégralement ; pas de métriques Sentry/OpenTelemetry opérationnelles ; rétention/nettoyage, Stripe Tax et textes juridiques à terminer.

Le cadrage local est éphémère et par règles lorsqu’aucune IA n’est configurée. Les scores de confiance heuristiques ne sont pas calibrés. Les tests de sécurité locaux ne remplacent pas un audit indépendant, des tests de charge et une validation des droits d’usage/distribution.

## 7. Déploiement et configuration

Suivre `README.md` pour le local et `DEPLOYMENT.md` pour le staging. Le Dockerfile n’a pas été construit ici ; son image de base doit être épinglée sur un digest vérifié avant production. `railway.json` est une configuration **legacy**, la documentation actuelle ayant annoncé la dépréciation de Config as Code ; les sources officielles et la date limite publiée sont indiquées dans le guide. Aucun compte Railway, Supabase ou Stripe de l’utilisateur n’a été modifié.

Le ZIP est un projet autonome. Il n’a **pas** été installé dans `site2`, dans VS Code sur ton ordinateur, ni sous `http://127.0.0.1:3000/app/dashboard`. Le lancement local proposé utilise 3002 pour éviter de remplacer un projet déjà ouvert.

## 8. Fichiers de reprise et décision finale

`docs/REQUIREMENTS_COVERAGE.md` et `.json` évaluent chaque section du prompt original. `docs/PROMPT_REPRISE_VSCODE.md` décrit la reprise à partir du code existant, pas une réécriture à zéro. `docs/tool-e2e/framework/SCENARIOS.md` conserve les tests connectés à réaliser. `reports/RELEASE_GATES.json` présente les gates, avec un état de release **BLOCKED**.

**Conclusion : code candidate réellement livré et tests locaux réussis ; SaaS commercial complet non validé.**
