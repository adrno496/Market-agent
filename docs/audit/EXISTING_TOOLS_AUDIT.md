# Audit des archives fournies

Les archives ont été inventoriées et leurs points d’entrée, manifestes, règles de provenance, CLI et documents de droits ont été lus. Les répertoires `node_modules`, `.git`, caches et environnements Python n’ont pas été repris dans l’application.

## FORMATION / AXDIA Prompt OS

Le package fourni s’identifie comme `plug-code-training`, version 12.0.0. Les fichiers `app/prompt-builder/intelligence/question-engine.js` et `app/prompt-builder/ir/mission-ir.js` ont servi à étudier le questionnement, la séparation des faits et des interprétations, le contexte non fiable et les critères d’acceptation.

Réemploi réalisé : **principes**, pas copie de code. Le fichier LICENSE décrit des restrictions de redistribution/reconditionnement sans autorisation écrite. AgentForge possède donc un moteur original de cadrage. Il ne prétend pas importer le moteur FORMATION ni reproduire toutes ses capacités.

## RECURSIVE

Points examinés : `recursive.py`, `runtime/orchestrator.py`, interfaces de vérification, mécanismes de politique et documents de distribution. Commandes reconnues : `doctor`, `audit`, `verify TARGET --no-cache`. L’option `--allow-host-execution` existe, mais n’est pas activée par l’adaptateur.

Le document `COMMERCIAL_DISTRIBUTION_STATUS.md` fourni déclare un état bloqué en attente de compléments de droits. Cela ne constitue pas une analyse juridique indépendante ; c’est l’état signalé par l’archive. Les sources RECURSIVE ne sont pas incorporées au ZIP livré.

## Business Readiness 360

Racine examinée : `02_AXDIA_BUSINESS_READINESS_360/REPO_READY_axdia-business-readiness-360`. CLI : `python runtime/br360_engine.py audit --project DIR --out FILE`. Sans opt-in `--allow-adapter`, l’audit n’autorise pas les commandes du projet.

Le moteur V3 utilise les statuts natifs `PASS`, `PARTIAL`, `FAIL`. L’adaptateur préserve le rapport brut et normalise `PARTIAL` en `WARN`, jamais en `PASS`. Les champs scores, confiance, force des preuves, findings et blockers restent dans le rapport brut.

Le document LICENSING.md ne fournissait pas de licence globale réutilisable. AgentForge ne suppose donc pas qu’un nom de dépôt ou l’accès au ZIP autorise la redistribution. Les moteurs restent internes ; les livraisons clientes contiennent des rapports uniquement.

## Pack AXDIA GO LIVE / prompts E2E

Ce ZIP contient un ensemble de 32 documents Markdown de vérification et prompts. Ce n’est pas le code complet d’un SaaS AgentForge ou site2. Les chemins pointant vers un autre ordinateur ne sont pas des fichiers accessibles dans cet environnement.

Le découpage LOCAL_OFFLINE_CORE / LOCAL_UI / PUBLIC_DEPLOYED_UI / CONNECTED_EXTERNAL_INTEGRATION a été conservé dans les rapports. Un test hors ligne avec fixture ne prouve ni le déploiement public ni la connexion d’un compte externe.

## Preuves et droits

`ARCHIVE_MANIFEST.json` conserve les SHA-256 réellement calculés sur les ZIP accessibles. Les audits exécutés sur AgentForge se trouvent dans `reports/`. Les sorties de vérification ne confèrent pas de droits de distribution et ne doivent pas être interprétées comme une autorisation de vendre les moteurs eux-mêmes.
