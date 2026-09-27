# Déploiement et validation réelle

**Ne pas ouvrir aux paiements réels avant les gates de cette procédure. Aucun compte externe n’a été configuré depuis cette conversation.**

## 1. Local

Node 22.16+ est nécessaire au lancement TypeScript. `npm run build` crée des fichiers JavaScript exécutables par `npm start`. Aucun `npm install` n’est nécessaire pour le runtime. `npm run typecheck` demande un compilateur et les types Node installés séparément. Les tests ne demandent aucune clé payante.

## 2. Supabase dédié

Créer un **nouveau projet de staging**. Ne pas appliquer cette migration telle quelle sur la base site2 : elle crée des tables génériques `projects`, `profiles`, etc. et ne connaît pas les schémas existants. Sauvegarder la base et faire revoir la migration avant exécution.

Dans l’éditeur SQL du projet dédié, exécuter `supabase/migrations/202609270001_agentforge.sql`. Cette migration est transactionnelle, mais n’a pas été exécutée ici faute de serveur PostgreSQL/Supabase configuré. Tester les fonctions RPC et RLS avec deux utilisateurs distincts avant toute mise en service.

Créer via Storage un bucket nommé `agentforge-artifacts`, **public = false**, sans policy autorisant la lecture ou l’écriture aux utilisateurs anonymes/authentifiés. Le serveur utilise son service role et des URLs signées, après vérification du droit de téléchargement.

Configurer URL, clé publique et service role dans les variables du serveur/worker. Activer Auth email/mot de passe, confirmer les emails, configurer un SMTP de test et les URL de redirection autorisées. Pour le flux local, autoriser l’origine configurée dans APP_URL et sa route `/?auth_callback=1`. Le lien email doit être ouvert sur le même navigateur que le début du flux PKCE. Les flux email réels et les liens de récupération n’ont pas été testés ici.

## 3. Modèles

Configurer un fournisseur et un ID de modèle existant. OpenRouter dispose d’un catalogue interrogé dynamiquement ; pour les fournisseurs qui ne retournent pas leurs prix dans `/models`, renseigner `MODEL_CATALOG_OVERRIDES_JSON` avec des prix **vérifiés en USD par token** et un `updated_at` réel. Un prix inconnu ou vieux de plus de 30 jours bloque la réservation de génération.

`AI_INTERVIEW_MODEL` active l’extraction IA initiale. Ses suggestions restent à confirmer. `AI_CODE_MODEL` ou `AI_DEFAULT_MODEL` sert à générer et réparer. Ne pas présenter les phases ARCHITECT/REVIEW comme actives : elles restent réservées.

Configurer les modèles alternatifs dans `AI_PROVIDER_DEFAULT_MODELS_JSON` pour que la sélection explicite d’un autre fournisseur ait un modèle cohérent. Tester réellement chaque couple retenu ; les fixtures HTTP ne prouvent pas sa compatibilité.

## 4. Moteurs AXDIA

Conserver les moteurs sur le worker, en dehors du dépôt commercial. `RECURSIVE_ROOT` doit contenir `recursive.py`. `BR360_ROOT` doit contenir `runtime/br360_engine.py`. Valider les droits d’usage interne avec le titulaire, ainsi que les éventuelles dépendances. Ne pas confondre preuve d’usage interne et droit de redistribution.

Les commandes prévues dans les conteneurs sont :

```bash
python -B /opt/recursive/recursive.py verify /work --no-cache
python -B /opt/br360/runtime/br360_engine.py audit --project /work
```

Aucun `--allow-host-execution` et aucun `--allow-adapter` n’est ajouté automatiquement. RECURSIVE peut donc déclarer un contrôle indisponible plutôt que forcer une exécution. Le statut natif de BR360 V3 est conservé, puis normalisé par l’adaptateur.

## 5. Hôte Docker et image de dépendances

Le worker doit être séparé du service web. Ne pas supposer que Railway offre Docker-in-Docker. Cette livraison prévoit **Railway pour le web** et un **hôte Docker isolé pour le worker**. Un fournisseur distant de sandbox nécessitera un adaptateur supplémentaire.

Construire une image de confiance avec Node/npm, Python/pip, les bibliothèques nécessaires aux moteurs et les dépendances transitoires approuvées. Les caches doivent être lisibles par UID 65534 : cache npm dans `/opt/npm-cache`, wheels dans `/opt/wheels`. Ne pas inclure de clés, cookies, fichiers `.npmrc` ou identifiants de registre privé dans l’image.

Labels obligatoires :

```text
agentforge.sandbox-contract=1
agentforge.frameworks={"@openai/agents":"<version réellement installée>","langgraph":"<version réellement disponible>"}
```

Les `<...>` sont des indications à remplacer, pas des valeurs utilisables. Utiliser des versions effectivement résolues et testées. Ne pas annoncer une famille supportée seulement parce qu’elle est listée dans le sélecteur.

Référencer l’image par un **digest réellement obtenu** : `registry/image@sha256:...`. Configurer `SANDBOX_PROVIDER=docker`, `SANDBOX_IMAGE`, `ISOLATED_WORKER_ACK=true` et `AXDIA_INTERNAL_USE_ACK=true` après vérification. Si Docker, les caches ou les moteurs manquent, le système bloque. Il ne dispose pas d’un fallback non isolé.

Les dépendances TypeScript générées doivent être exactes et disponibles dans le cache. Le resolver recrée le lock npm dans un conteneur hors ligne. Python utilise `requirements.in`, résolution uniquement depuis les wheels approuvés et hashes calculés sur les fichiers réels. Un package absent bloque ; il faut le faire approuver dans la filière de construction de l’image, pas autoriser Internet au code généré.

**Limite actuelle :** la readiness web vérifie un worker globalement prêt, pas la présence de chaque dépendance du futur manifeste. Un build peut donc être bloqué après paiement par une version absente du cache ; son crédit reste réservé pour un nouvel essai, sans second achat. Ajouter une préqualification spécifique au plan avant d’activer des paiements réels.

## 6. Stripe test

Créer trois produits/Price one-time en mode test. Les prix de lancement demandés dans le cahier des charges sont 19,90 €, 39,90 € et 89,90 € ; ils constituent une configuration commerciale proposée, pas des prix automatiquement créés dans ton compte. Renseigner les trois identifiants `price_...` et les secrets test.

Créer l’endpoint webhook `/api/stripe/webhook`. Écouter `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired` et `charge.refunded`. Checkout est la source d’autorité choisie ; un `payment_intent.succeeded` seul ne crée pas un crédit.

Tester un paiement réussi, un corps/signature invalide, une double livraison du même webhook, deux événements différents pour la même session, un webhook avant le retour navigateur, un refus de paiement, un remboursement arrivé avant/après la création du crédit et le rejet d’un second build pour le même crédit. Le code des scénarios manquants à exécuter en live est documenté dans docs/tool-e2e/framework/SCENARIOS.md.

Les événements échoués/expirés sont journalisés mais le PENDING n’est pas encore réconcilié automatiquement. Prévoir une procédure opérateur : vérifier la session canonique et fermer explicitement un ordre impayé avant de créer un nouveau Checkout. Ne jamais modifier un paiement confirmé pour contourner les validations.

## 7. Déployer le web

Le Dockerfile fourni compile le code et lance Node. Il ne contient pas le socket Docker ni les moteurs AXDIA. Les variables sont définies dans Railway Variables. `APP_URL` doit être l’origine HTTPS publique exacte ; le `Host` reçu doit correspondre. Le hostname spécial `healthcheck.railway.app` est accepté uniquement en GET sur `/health` et `/ready`, jamais sur les API. Le healthcheck de plateforme utilise `/health` pour éviter une boucle de redémarrage lorsque des services de génération sont indisponibles. Superviser `/ready` séparément.

```bash
npm run build
NODE_ENV=production HOST=0.0.0.0 APP_URL=https://votre-domaine.example npm start
```

L’exemple de domaine est un placeholder. L’atelier local est toujours désactivé en production. Prévoir quotas à l’entrée, TLS, sauvegardes restaurées en test, rétention, alertes et suivi des coûts.

### Configuration Railway vérifiée le 27 septembre 2026

La documentation actuelle marque **Config as Code déprécié**, avec maintien des fichiers pour les services legacy jusqu’au **1er décembre 2026**. Le `railway.json` fourni est donc uniquement un fichier de compatibilité legacy ; ne pas supposer qu’il configure un nouveau service. Pour un nouveau service, utiliser les réglages de déploiement du dashboard avec le Dockerfile, la commande Node, le port injecté et `/health`, ou migrer vers l’Infrastructure as Code officielle après validation de son schéma. Aucun déploiement Railway ni fichier IaC moderne n’a été testé ici.

Sources consultées : [Config as Code](https://docs.railway.com/config-as-code/reference) ; [Healthchecks](https://docs.railway.com/deployments/healthchecks). Ce probe mesure seulement la disponibilité du processus ; l’ouverture commerciale exige les autres gates.

## 8. Critères d’ouverture

Passer le parcours réel salon : nouveau compte → email → cadrage IA → plan/sources/devis → Checkout test → webhook → worker → génération → dépendances réelles → tests isolés → RECURSIVE → BR360 → ZIP privé → démarrage de l’agent sur un environnement propre. Tester aussi utilisateur B, refus de permissions, interruption worker, remboursement et URL expirée.

Effectuer un audit sécurité et juridique indépendant. Seulement ensuite envisager `RELEASE_APPROVED=true` et `ALLOW_LIVE_PAYMENTS=true`. Ces flags sont des confirmations administrateur, pas des détecteurs automatiques de conformité.
