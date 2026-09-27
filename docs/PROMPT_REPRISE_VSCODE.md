# Reprise d’implémentation dans VS Code / Codex

Tu reprends le dépôt AgentForge joint, pas site2. Lis README.md, IMPLEMENTATION_REPORT.md, SECURITY.md, docs/REQUIREMENTS_COVERAGE.md et les rapports. N’efface pas le travail existant et ne remplace pas les statuts manquants par PASS.

Commence par exécuter npm test, npm run typecheck et npm run build. Vérifie ensuite les API actuelles dans leurs documentations officielles. Toute version de modèle/framework doit être résolue au moment de l’intervention, puis enregistrée et épinglée ; un hash de dépôt courant n’est pas nécessairement le commit de publication du package.

Priorités : appliquer la migration sur un Supabase de test dédié ; prouver la RLS avec utilisateurs A/B ; exécuter le flux email PKCE et la récupération ; compléter les tests de concurrence paiements/webhooks/crédits ; réconcilier les Checkout expirés ; exiger une capacité sandbox compatible avec le plan avant paiement ; préparer une image hors ligne effectivement qualifiée ; exécuter une génération réelle avec clés de test et budget limité ; conserver tous les statuts RECURSIVE/BR360 et vérifier le ZIP sur une machine propre.

La stack actuelle est Node HTTP/TypeScript/JS natif. Le cahier des charges conseillait Next.js/React/Zod. Si tu rétablis cette stack, motive et réalise une migration incrémentale avec tests de non-régression des chemins API, auth, webhook et règles de sécurité. Ne produis pas simplement une surcouche vide.

Compléter les lacunes déclarées : sélection réellement multi-critère, catalogues administrables, evals sémantiques indépendantes du code généré, snapshots de reprise durables, intégrations client qualifiées, coût de sandbox, observabilité/alertes, opérations de suppression/rétention et textes juridiques validés. Les champs inconnus restent inconnus. Ne présente pas l’export de cadrage local comme un agent livré.

N’accède pas aux archives AXDIA par un chemin deviné. Localise les sources réellement fournies et vérifie leurs droits d’usage interne. Ne redistribue pas leurs moteurs. Ne mets pas le socket Docker dans le web. Ne donne jamais d’autorisation d’exécution sur le host au code généré pour faire passer un test.

À la fin, mets à jour la matrice des exigences, les commandes effectivement exécutées, leurs sorties et les gates. N’annonce pas Production Ready tant que le parcours complet connecté et les contrôles externes ne sont pas prouvés.
