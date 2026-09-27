# Recherche technique — 27 septembre 2026

## Périmètre et méthode

Lecture des dépôts officiels et de documentations primaires au moyen de la recherche web. Cette lecture est distincte d’une installation, d’une qualification de release ou d’un benchmark : **aucun des cinq frameworks n’a été installé ou exécuté dans cette distribution**. Les numéros de dernière version, commits de release et métriques d’activité non établis restent `null` dans SOURCE_MATRIX.json. Aucun nombre de stars n’a servi de critère de choix.

Le conteneur de construction ne pouvait pas résoudre les registres npm à l’installation. Le runtime de cette livraison ne dépend donc pas d’un téléchargement de paquets tiers. En service connecté, `research.ts` demande les métadonnées GitHub et le registre npm/PyPI, vérifie dépôt/maintenance/licence déclarée et enregistre une version avec intégrité disponible. Cela ne dispense pas des tests de l’image et des dépendances transitives.

## Familles comparées

| Dépôt officiel | Utilité documentée / décision proposée | Réserves de qualification |
|---|---|---|
| [openai/openai-agents-js](https://github.com/openai/openai-agents-js) | SDK TypeScript/JavaScript avec outils, orchestration, handoffs et mécanismes de contrôle. Proposition initiale pour un agent simple utilisant des outils. | La compatibilité du fournisseur et de ses fonctions doit être testée. Le choix d’un modèle OpenAI ne doit pas imposer ce framework. |
| [openai/openai-agents-python](https://github.com/openai/openai-agents-python) | Famille Python équivalente à considérer lorsque Python est explicitement requis. | Pas de benchmark local ni de validation des dépendances de génération. |
| [langchain-ai/langgraph](https://github.com/langchain-ai/langgraph) | Graphes, état et workflows durables ; proposé pour un besoin explicitement long ou avec reprise. | Le simple mot « workflow » ne justifie pas une architecture plus complexe. La persistance doit être configurée et testée. |
| [google/adk-python](https://github.com/google/adk-python) | Toolkit Python d’agents et de workflows, adapté à l’écosystème Google/ADK explicitement demandé. | Ne pas confondre intégration de modèle et accès autorisé à Google Calendar. |
| [microsoft/agent-framework](https://github.com/microsoft/agent-framework) | Framework d’agents/workflows dont les implémentations documentées comprennent Python et .NET. | Cette version d’AgentForge prépare uniquement une sortie Python ; pas de génération .NET qualifiée. Le statut de release n’est pas certifié ici. |
| [agentskills/agentskills](https://github.com/agentskills/agentskills) | Format interopérable de compétences, instructions et ressources. | Un skill est du contenu potentiellement non fiable, pas une permission d’exécuter son script. Le dépôt distingue licence du code et de la documentation. |
| [modelcontextprotocol/registry](https://github.com/modelcontextprotocol/registry) | Découverte de métadonnées de serveurs MCP. | Une inscription ne prouve ni confiance, ni sécurité, ni disponibilité du service. Les candidats restent en revue. |

La sélection actuelle est une **heuristique explicable**, pas un classement de qualité général ni un « meilleur framework » mesuré. Les valeurs de confiance produites sont heuristiques, non des probabilités calibrées sur un benchmark.

## Formats et API examinés

La [spécification Agent Skills](https://agentskills.io/specification) décrit le dossier nommé et le frontmatter de SKILL.md. Le validateur de cette livraison couvre le nom, la description et leur cohérence ; ce n’est pas un validateur complet de toutes les extensions futures.

La [documentation OpenAI Agents JS sur les modèles](https://openai.github.io/openai-agents-js/guides/models/) décrit l’abstraction de modèle ; la [documentation des extensions AI SDK](https://openai.github.io/openai-agents-js/extensions/ai-sdk/) montre une autre voie d’intégration. Cela motive la séparation fournisseur/framework, sans promettre toute combinaison.

Le [catalogue OpenRouter](https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties) motive la récupération des IDs et prix. Pour les API directes, le catalogue peut ne pas contenir les prix : ceux-ci doivent être fournis par un administrateur après vérification. Les adaptateurs ont des tests de contrat avec fixtures ; leurs appels live restent non vérifiés.

La [RLS Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security) et le [flux PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow) servent de référence pour les frontières d’authentification. Une lecture de documentation n’équivaut pas à un test de session, de RLS ou de concurrence sur la base.

La [documentation Stripe Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment) est la référence de la source de paiement. La page consultée renvoyait aussi vers des variantes de documentation ; le parcours complet Stripe de ce dépôt reste à valider sur un compte test.

La [documentation TypeScript de Node 22](https://nodejs.org/docs/latest-v22.x/api/typescript.html) distingue type stripping et vérification de types. La distribution effectue un build et un contrôle TypeScript séparés. [Next.js installation](https://nextjs.org/docs/app/getting-started/installation) a été consulté ; cette stack conseillée n’a pas été implémentée ici.

La [référence Mistral chat](https://docs.mistral.ai/api/endpoint/chat) a été consultée. Certaines tentatives de chargement de la référence Anthropic ont échoué ou dépassé la taille de réponse ; le contrat de l’adaptateur Anthropic doit donc être revérifié sur sa documentation officielle avant qualification live. Aucune validation non réalisée n’est annoncée.

## Provenance : distinction essentielle

Le commit GitHub récupéré à la tête du dépôt est un **snapshot du dépôt**. Il n’est pas automatiquement le commit ayant produit la version de package npm/PyPI. Le rapport doit conserver cette distinction ; une liaison vérifiable release/package/commit et les attestations supply-chain constituent un travail de qualification supplémentaire.

Les licences des sources et des dépendances transitives doivent être validées sur les versions réellement utilisées. Aucune copie des moteurs AXDIA ou de code de framework n’est vendue avec l’export local. Les locks, manifests et rapports ne remplacent pas une analyse juridique des obligations de distribution.

## Vérification Railway en fin de construction

Le 27 septembre 2026, la référence officielle indique la dépréciation de Config as Code et la compatibilité legacy jusqu’au 1er décembre 2026. `railway.json` reste livré à ce seul titre ; le déploiement d’un nouveau service doit passer par une configuration actuelle vérifiée. Le probe Railway utilise le hostname `healthcheck.railway.app`, autorisé dans le code uniquement pour GET /health et GET /ready. Sources : https://docs.railway.com/config-as-code/reference et https://docs.railway.com/deployments/healthchecks. Aucune validation sur un compte Railway n’a été exécutée.
