# Couverture des 80 exigences

Évaluation de la version candidate 0.1.0. **Il ne s’agit pas d’un taux de complétude ni d’une validation commerciale.** Une présence de code ne vaut pas preuve en production.

`LOCAL_VERIFIED` : comportement ou document vérifié localement dans le périmètre indiqué. `IMPLEMENTED_NOT_LIVE_VALIDATED` : chemin de code présent, service réel non exercé. `PARTIAL` : sous-ensemble seulement. `EXECUTED_WITH_BLOCKERS` : vérification réellement exécutée, défavorable. `NOT_IMPLEMENTED` / `NOT_COMPLETED` : exigence non satisfaite.

| N° / exigence | État | Fichiers principaux | Limite ou preuve |
|---|---|---|---|
| 1. OBJECTIF PRODUIT | PARTIAL | `apps/web, packages/core` | Cadrage local utilisable ; parcours commercial complet non exécuté. |
| 2. OUTILS AXDIA À EXPLOITER | LOCAL_VERIFIED | `docs/audit/EXISTING_TOOLS_AUDIT.md` | Archives inspectées, principes FORMATION réimplémentés sans reprendre son code. |
| 3. UTILISATION DE RECURSIVE | IMPLEMENTED_NOT_LIVE_VALIDATED | `packages/core/sandbox.ts` | Adaptateur réel ; auto-audit exécuté avec résultat BLOCKED, génération isolée non validée. |
| 4. UTILISATION DE BR360 | IMPLEMENTED_NOT_LIVE_VALIDATED | `packages/core/sandbox.ts` | Rapports natifs conservés ; auto-audit FAIL, aucun audit client réel. |
| 5. RECHERCHE GITHUB OBLIGATOIRE | PARTIAL | `docs/research` | Sept projets officiels étudiés ; aucune version téléchargée/installée certifiée ici. |
| 6. GITHUB SKILL RESOLVER | PARTIAL | `packages/core/research.ts` | Découverte réelle de candidats ; sélection et intégration opérationnelle d’un skill non certifiées. |
| 7. SÉCURITÉ DE LA RECHERCHE GITHUB | PARTIAL | `packages/core/research.ts, security.ts` | Sources traitées en données, URLs fixes, pas de clone/exécution dans le serveur ; red team sémantique non réalisée. |
| 8. PROVENANCE ET LICENCES | PARTIAL | `packages/core/research.ts, packaging.ts` | Métadonnées, licence, version et provenance ; licence globale du produit non décidée et pas de revue juridique. |
| 9. EXPÉRIENCE UTILISATEUR PRINCIPALE | LOCAL_VERIFIED | `apps/web/public` | Saisie simple, test DOM et HTTP ; navigation navigateur native limitée ici. |
| 10. INTERVIEW IA | PARTIAL | `packages/core/interview.ts, spec.ts` | Extraction IA initiale optionnelle et questions par règles ; pas d’entretien IA adaptatif multi-tour validé en réel. |
| 11. RÈGLES DU QUESTION ENGINE | LOCAL_VERIFIED | `packages/core/spec.ts` | Une question utile à la fois, inconnus distincts et confirmation explicite des valeurs proposées. |
| 12. PROJECT SPEC | LOCAL_VERIFIED | `schemas/ProjectSpec.schema.json, packages/core/spec.ts` | Schéma et validateur originaux ; les données critiques conservent leur provenance. |
| 13. ÉTATS PROJET | PARTIAL | `packages/core/states.ts, supabase/migrations` | Carte de transitions et gardes SQL ; machine persistée/concurrence non exercées sur PostgreSQL. |
| 14. FRAMEWORK SELECTOR | LOCAL_VERIFIED | `packages/core/research.ts` | Sélecteur heuristique testé ; confiance non calibrée statistiquement. |
| 15. RÈGLES DE SÉLECTION | LOCAL_VERIFIED | `packages/core/research.ts` | Heuristiques explicites, modèle et framework séparés ; pas de garantie de meilleur choix universel. |
| 16. PROVIDER GATEWAY | IMPLEMENTED_NOT_LIVE_VALIDATED | `packages/core/providers.ts` | Cinq adaptateurs HTTP réels ; contrats testés par fixtures, pas d’appel distant. |
| 17. OPENROUTER | LOCAL_VERIFIED | `packages/core/config.ts` | OpenRouter par défaut, fournisseurs alternatifs sélectionnables. |
| 18. CHOIX DU MODÈLE | PARTIAL | `apps/web/public/app.js, packages/core/providers.ts` | Sélection fournisseur/modèle ; rôles ARCHITECT et REVIEW distincts non exécutés. |
| 19. NE PAS CODER LES MODÈLES EN DUR | IMPLEMENTED_NOT_LIVE_VALIDATED | `packages/core/providers.ts` | Catalogues dynamiques, cache et overrides ; catalogues réels non interrogés par l’application ici. |
| 20. .ENV DE LA PLATEFORME | LOCAL_VERIFIED | `.env.example` | Variables effectivement utilisées documentées ; celles réservées sont signalées. |
| 21. RÈGLE ABSOLUE SUR LES SECRETS | PARTIAL | `packages/core/security.ts, apps/web` | Pas de secrets d’exécution livrés ; scanner heuristique testé, pas de certification exhaustive. |
| 22. DEUX TYPES DE .ENV | LOCAL_VERIFIED | `.env.example, packages/core/workshop.ts` | Configuration plateforme distincte des placeholders du projet. |
| 23. .ENV DU PROJET GÉNÉRÉ | LOCAL_VERIFIED | `packages/core/generation.ts, workshop.ts` | Template sans secret ; obligation limitée au fournisseur sélectionné. |
| 24. BUILD PLAN | LOCAL_VERIFIED | `packages/core/research.ts` | BuildPlan immuable et hashé, prix et limites figés ; persistance non testée en réel. |
| 25. GENERATION ENGINE | PARTIAL | `packages/core/generation.ts` | Orchestration écrite ; aucun framework client généré et lancé dans cette session. |
| 26. WORKSPACE ISOLÉ | IMPLEMENTED_NOT_LIVE_VALIDATED | `packages/core/generation.ts, sandbox.ts` | Workspace séparé par job ; isolation Docker non exercée ici. |
| 27. SANDBOX | PARTIAL | `packages/core/sandbox.ts` | Driver Docker local et interface ; aucun fournisseur sandbox distant livré. |
| 28. POLITIQUE SANDBOX | IMPLEMENTED_NOT_LIVE_VALIDATED | `packages/core/sandbox.ts` | Réseau coupé, limites et image épinglée ; Docker absent de l’environnement. |
| 29. REPAIR LOOP | IMPLEMENTED_NOT_LIVE_VALIDATED | `packages/core/generation.ts` | Boucle bornée et budgets ; aucune réparation réelle par modèle. |
| 30. CONTENU DU ZIP | PARTIAL | `packages/core/packaging.ts` | Vrai ZIP, checksums et rapports ; BUILD_REPORT/DEPENDENCIES complets et SBOM non produits. |
| 31. AGENT SKILLS | PARTIAL | `packages/core/packaging.ts` | Structure SKILL.md et validation de base ; conformité complète Agent Skills non certifiée. |
| 32. MCP | PARTIAL | `packages/core/research.ts` | Consultation du registre prévue, candidats non assimilés à des serveurs sûrs ; aucune session MCP métier réelle. |
| 33. PROJET EXEMPLE OBLIGATOIRE | PARTIAL | `fixtures/salon.ts, reports/fixtures` | Salon testé jusqu’au ZIP de cadrage seulement, pas au ZIP d’un agent opérationnel. |
| 34. PAIEMENT | IMPLEMENTED_NOT_LIVE_VALIDATED | `packages/core/payments.ts` | Checkout et signature webhook ; aucun paiement test réellement effectué. |
| 35. PRICING À IMPLÉMENTER | PARTIAL | `packages/core/payments.ts, DEPLOYMENT.md` | Trois niveaux/limites ; prix à créer dans Stripe, pas de faux prix présentés comme actifs. |
| 36. NE PAS CODER LES PRIX EN DUR | IMPLEMENTED_NOT_LIVE_VALIDATED | `packages/core/payments.ts, supabase/migrations` | Price IDs configurables et snapshot ; configuration Stripe réelle absente. |
| 37. APERÇU GRATUIT | LOCAL_VERIFIED | `apps/web/public, packages/core/workshop.ts` | Aperçu sans code complet, export local explicitement limité au cadrage. |
| 38. COMPTE CLIENT | PARTIAL | `apps/web/server.ts, apps/web/public` | Auth/projets/générations/paiements et récupération écrits ; parcours utilisateur connecté non testé. |
| 39. DATABASE | IMPLEMENTED_NOT_LIVE_VALIDATED | `supabase/migrations` | Migration SQL et entités présentes ; aucune migration exécutée sur Supabase. |
| 40. RLS | IMPLEMENTED_NOT_LIVE_VALIDATED | `supabase/migrations` | RLS propriétaire et RPC service-only ; tests réels utilisateur A/B manquants. |
| 41. ARTIFACT STORAGE | IMPLEMENTED_NOT_LIVE_VALIDATED | `packages/core/database.ts` | Bucket privé, URL signée et contrôle du droit ; aucun vrai stockage distant créé. |
| 42. JOB QUEUE | IMPLEMENTED_NOT_LIVE_VALIDATED | `apps/worker/main.ts, supabase/migrations` | File PostgreSQL, baux, événements ; pas de Redis fictif, pas de job connecté exécuté. |
| 43. IDEMPOTENCE | PARTIAL | `packages/core/payments.ts, supabase/migrations` | Contraintes et fonctions idempotentes ; courses concurrentes DB/Stripe non testées. |
| 44. GENERATION EVENTS | IMPLEMENTED_NOT_LIVE_VALIDATED | `packages/core/generation.ts, apps/web/server.ts` | Événements persistés et SSE ; pas de progression commerciale fabriquée. |
| 45. INTERFACE BUILD | PARTIAL | `apps/web/public/app.js` | Vue de progression liée aux événements réels ; pas de génération connectée visualisée. |
| 46. PAGE RÉSULTAT | PARTIAL | `apps/web/public/app.js` | Collections et rapports prévus ; page finale d’un build réel non validée. |
| 47. PREVIEW DU ZIP | PARTIAL | `apps/web/public/app.js` | Manifest/artifacts exposés après autorisation ; explorateur complet avec visualisation par fichier incomplet. |
| 48. UI | LOCAL_VERIFIED | `apps/web/public, reports/browser` | Desktop/mobile vérifiés par DOM et transport local ; pas de navigateur natif de bout en bout. |
| 49. STACK WEB CONSEILLÉE | PARTIAL | `ARCHITECTURE.md, README.md` | Écart : Node HTTP + TypeScript + JS natif, pas Next.js/React/Zod. |
| 50. MONOREPO | LOCAL_VERIFIED | `apps, packages` | Organisation web/worker/cœur, indépendante du site2 existant. |
| 51. ADMIN | PARTIAL | `apps/web/server.ts, apps/web/public` | Admin protégé, derniers jobs/paiements et modèles ; édition complète/catalogues/agrégats revenus manquants. |
| 52. SUIVI DU COÛT IA | IMPLEMENTED_NOT_LIVE_VALIDATED | `packages/core/providers.ts, supabase/migrations` | Réservation/coût estimé et coût retourné ; aucun coût API réel mesuré. |
| 53. BUDGETS INTERNES | PARTIAL | `packages/core/generation.ts, supabase/migrations` | Budget IA réservé et borné ; facturation complète sandbox/infra non intégrée. |
| 54. SÉCURITÉ | PARTIAL | `SECURITY.md, tests` | Contrôles et régressions locales ; audit externe, RLS réelle et red team manquants. |
| 55. NE JAMAIS EXÉCUTER DU CODE TIERS SUR LE HOST | IMPLEMENTED_NOT_LIVE_VALIDATED | `packages/core/sandbox.ts` | Pas de fallback d’exécution générée sur serveur web ; Docker non testé. |
| 56. DOWNLOAD PACKAGE PROVENANCE | LOCAL_VERIFIED | `packages/core/packaging.ts` | Checksums réels vérifiés ; provenance source distingue commit de branche et version package. |
| 57. SBOM | NOT_IMPLEMENTED | `IMPLEMENTATION_REPORT.md` | Aucun SBOM produit ; aucune simulation de CycloneDX. |
| 58. OBSERVABILITY | PARTIAL | `apps/web/server.ts, packages/core/generation.ts` | Logs structurés/événements/coûts ; pas d’intégration Sentry/OpenTelemetry complète. |
| 59. FAILURES | PARTIAL | `apps/web/public, packages/core/generation.ts` | Échecs explicites ; catalogue complet de récupération opérationnelle à finaliser. |
| 60. CRÉDIT EN CAS D’ÉCHEC PLATEFORME | IMPLEMENTED_NOT_LIVE_VALIDATED | `supabase/migrations` | Crédit réservé/réessai sans deuxième paiement ; scénario réel d’échec puis reprise non exécuté. |
| 61. STRIPE WEBHOOKS | PARTIAL | `packages/core/payments.ts` | Signature et déduplication écrites ; commandes échouées/expirées journalisées sans réconciliation automatique complète. |
| 62. STRIPE TAX | NOT_IMPLEMENTED | `DEPLOYMENT.md` | TVA/Stripe Tax à configurer et intégrer avant commercialisation ; aucune logique fiscale improvisée. |
| 63. PAGES LÉGALES | PARTIAL | `apps/web/public/legal.html` | Page explicitement provisoire, pas de CGV/politique de remboursement juridiquement validées. |
| 64. FUTURE AGENT STORE | PARTIAL | `apps/web/server.ts` | Store désactivé ; modèle marketplace public/listed non implémenté. |
| 65. TESTS | PARTIAL | `tests, scripts` | 104 tests locaux ; intégrations réelles, génération sandbox et E2E commercial absents. |
| 66. TESTS STRIPE | PARTIAL | `tests/core.test.ts, provider-contracts.test.ts` | Signatures/contrats testés localement ; vraie suite Stripe test complète non exécutée. |
| 67. TESTS AI | LOCAL_VERIFIED | `tests/provider-contracts.test.ts, scripts/live-check.ts` | FakeProvider seulement dans les tests ; opt-in réel désactivé par défaut. |
| 68. EVAL DU QUESTION ENGINE | PARTIAL | `tests/core.test.ts` | Six scénarios de cadrage de base ; pas d’évaluation extensive/calibrée de qualité d’interview IA. |
| 69. SELF-AUDIT | EXECUTED_WITH_BLOCKERS | `reports/axdia` | Vrais auto-audits : RECURSIVE BLOCKED et BR360 FAIL, sans conversion en PASS. |
| 70. RELEASE GATES | EXECUTED_WITH_BLOCKERS | `reports/RELEASE_GATES.json` | Gates renseignés selon preuves ; ouverture commerciale BLOCKED. |
| 71. DÉPLOIEMENT | PARTIAL | `DEPLOYMENT.md, apps/web/server.ts` | Procédure et probes présents ; déploiement réel et tests de restauration absents. |
| 72. RAILWAY | PARTIAL | `Dockerfile, railway.json, DEPLOYMENT.md` | Dockerfile non construit ici ; railway.json legacy, configuration Railway moderne non déployée. |
| 73. README | LOCAL_VERIFIED | `README.md` | Commandes locales vérifiées, procédure connectée distincte et non vérifiée en réel. |
| 74. IMPLEMENTATION SEQUENCE | PARTIAL | `IMPLEMENTATION_REPORT.md` | Audit, recherche, code et tests exécutés ; phases connectées restantes clairement listées. |
| 75. AUDIT AVANT MODIFICATION | LOCAL_VERIFIED | `docs/audit` | Sources inspectées avant création ; site2 absent, pas écrasé ni modifié. |
| 76. AUCUNE FAUSSE IMPLÉMENTATION | LOCAL_VERIFIED | `tests, reports, packages/core/states.ts` | Atelier local marqué, mocks isolés, contrôles manquants jamais transformés en succès. |
| 77. DEFINITION OF DONE | NOT_COMPLETED | `IMPLEMENTATION_REPORT.md` | La Definition of Done commerciale de 25 étapes n’a pas été satisfaite. |
| 78. LIVRABLES OBLIGATOIRES | PARTIAL | `README.md, IMPLEMENTATION_REPORT.md` | Source et documents livrés ; composants externes, SBOM et validations manquantes identifiés. |
| 79. RAPPORT FINAL | LOCAL_VERIFIED | `IMPLEMENTATION_REPORT.md` | Rapport de livraison créé, résultats bruts et écarts conservés. |
| 80. RÈGLE DE TRAVAIL FINALE | PARTIAL | `README.md, reports` | Code réellement exécutable et testé localement ; produit commercial complet non certifié. |
