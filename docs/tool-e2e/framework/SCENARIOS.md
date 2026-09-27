# Vérifications indépendantes du générateur

## LOCAL_OFFLINE_CORE

`npm test` vérifie provenance, confirmations, statuts, chemins/ZIP, signature brute Stripe, modèles avec fixtures de test, absence de credentials, endpoints locaux et export salon. `npm run fixture` crée uniquement un cadrage explicitement non opérationnel.

## LOCAL_UI

`python scripts/browser-e2e.py` attend un serveur local à E2E_BASE_URL. Le test natif doit naviguer, répondre au salon et télécharger réellement le ZIP. Lors de la construction de cette livraison, Chromium a interdit la navigation localhost. Le rapport de transport local injecté et les captures valident le DOM et les requêtes applicatives, pas le réseau natif ni les cookies/CSP du navigateur.

## CONNECTED_EXTERNAL_INTEGRATION — À EXÉCUTER

Créer utilisateurs A et B. A crée un projet, B essaie d’en lire l’ID, ses specs, plan, événements, paiements et objets privés. Tester aussi un JWT expiré, aucune session et un appel RPC service_role depuis la clé anonyme. Attendre un refus sans donnée de A. Vérifier que l’autorisation fonctionne côté serveur même sans l’interface.

Paiements : Checkout test, signature invalide, événement répété, concurrence, prix/client_reference_id/plan falsifiés, mode live avec clé test, paiement différé, refus, session expirée et remboursement dans différents ordres. Vérifier les lignes DB et contraintes, pas seulement le texte affiché.

Jobs : double clic, deux workers, bail expiré, arrêt au milieu d’un appel possiblement facturé, annulation/remboursement pendant packaging, réservation de coût concurrente. Un seul crédit consommé et un seul artifact par job. Un worker dépassé ne publie rien. Un échec n’ouvre pas un nouveau Checkout automatiquement.

Génération salon : configuration réelle Google Calendar et email sur un environnement client de test, calendrier de test sans vrais clients, permission lecture/écriture minimale et approbation humaine. Tests de chevauchement, durée, fuseau/DST, jours fermés, idempotence réservation, coordonnées manquantes, suppression et confirmation refusée. Aucun envoi à de vrais clients pour faire une démonstration.

Sandbox : code qui essaie de lire les secrets, sortir du répertoire, joindre Internet/métadonnées internes, épuiser CPU/RAM/processus, modifier les moteurs ou accéder au socket. Résultat attendu : refus ou destruction bornée. Vérifier la suppression après timeout et redémarrage.

Sources : dépôt archivé, licence absente, package/commit non concordants, paquet obsolète, serveur MCP non fiable et README à prompt injection. Aucun texte tiers ne change les permissions. Un candidat n’est pas marqué intégré sans test.

Livraison : ZIP réel décompressable, checksums, aucun secret/code propriétaire AXDIA, tests et installation sur machine propre, lien signé expiré, téléchargement refusé après remboursement. Les rapports doivent correspondre au contenu final après la dernière réparation, pas à une version antérieure.

## PUBLIC_DEPLOYED_UI — À EXÉCUTER

Domaine HTTPS exact, bon service/bon port, health et ready distincts, CSP/cookies réels, mobile/desktop, erreurs compréhensibles, flux email/Checkout, progression SSE après reconnexion, sauvegarde restaurée, confidentialité/rétention et supervision.
