# Sécurité — candidat à vérifier, pas certification

## Modèle de menace

Le texte utilisateur, les réponses IA, les README GitHub, métadonnées MCP, noms de fichiers et rapports externes sont non fiables. Ils ne peuvent accorder ni autorisation, ni paiement, ni validation. Les identifiants de ressource sont vérifiés côté serveur ; les fichiers et ZIP ont des limites, des chemins normalisés, des contrôles de collision et une détection de motifs de secrets.

Les URL distantes de fournisseurs, GitHub, npm, PyPI et du registre MCP sont des endpoints fixes. Une URL de dépôt utilisateur n’est pas exécutée ni téléchargée arbitrairement. Les redirections HTTP sont refusées, les réponses sont bornées et des délais sont appliqués. L’URL Supabase et l’image de sandbox sont des configurations d’administrateur, pas des valeurs fournies par un client.

## Secrets

Ne jamais placer une vraie clé dans le dépôt, le navigateur, un prompt, les logs ou un ZIP. Les clés de plateforme sont des variables d’environnement côté serveur. Aucun coffre de clés BYOK utilisateur n’est implémenté. Aucun chiffrement de secrets en DB n’est donc simulé. Les ZIP clients contiennent seulement des `.env.example` avec valeurs vides ; les clés du futur agent seront configurées par le client sur son propre environnement.

La détection par motifs n’est pas un détecteur universel de secrets. Un scan spécialisé supplémentaire est un gate de sortie recommandé. Les prompts sensibles ne sont pas journalisés intégralement ; les événements affichent surtout phases, statuts et identifiants.

## Code généré et dépendances

Les manifestes sont validés avant résolution. Le modèle ne fournit pas une vérité de lockfile : Docker résout les versions exactes depuis un cache npm ou des wheels prévalidés, sans réseau, avec `--ignore-scripts` côté npm et hashes réels côté Python. En l’absence de dépendance en cache, la résolution bloque. Aucun `npm install` de projet généré ne se fait sur le serveur web ni directement sur le worker.

Les conteneurs sont éphémères, non root, sans réseau ni secrets, avec racine en lecture seule, capacités supprimées et limites de ressources. Le socket Docker n’est jamais monté dans le conteneur du client. **Docker seul n’est pas une garantie d’isolation forte pour une offre multi-tenant hostile** : faire valider l’hôte, l’isolation réseau et l’image ; envisager microVM ou un fournisseur de sandbox dédié avant ouverture au public. Le driver distant n’est pas implémenté.

Les audits lisent des sources non fiables. Les versions des moteurs doivent être revues par l’exploitant. Les monter en lecture seule ne prouve pas leur innocuité. L’accusé `AXDIA_INTERNAL_USE_ACK` ne crée aucun droit juridique.

## Authentification et paiements

Cookies HttpOnly, SameSite=Lax et Secure en production ; contrôle de l’Origin pour les mutations ; CSP restrictive et hôte attendu. Le webhook Stripe n’utilise pas un cookie/Origin : il vérifie la signature du corps brut, le temps et les valeurs de la session relue via l’API. Le retour de Checkout n’accorde aucun droit.

Un remboursement révoque l’accès futur au téléchargement, y compris un remboursement partiel par politique conservatrice. Il ne peut révoquer un ZIP déjà téléchargé ni une URL encore valide pendant sa courte durée. Un remboursement se fait via Stripe : cette application n’offre pas encore d’interface de remboursement financier.

## Limites à fermer avant lancement

Les tests live Supabase/RLS, le parcours email PKCE, la rotation des tokens, les webhooks asynchrones concurrents, les downloads multi-utilisateurs, le durcissement de l’hôte Docker et l’audit de supply chain restent à exécuter. Les tentatives d’un webhook de checkout expiré/échoué nécessitent une procédure de réconciliation ; un paiement PENDING peut rester bloqué sans cette procédure. La limitation IP en mémoire est défensive mais partagée derrière un proxy et non distribuée. Ajouter un contrôle au niveau de l’entrée réseau et tester le routage des adresses IP de confiance.

Le budget comptabilisé est principalement le coût IA. CPU/RAM/durée de sandbox sont bornés, mais une comptabilité monétaire complète d’infrastructure n’est pas incluse. La politique de rétention/suppression doit être opérée et vérifiée ; l’expiration d’accès de 30 jours ne supprime pas physiquement les objets.

## Signalement et exploitation

Avant production, renseigner un canal de signalement, les responsables d’incident, la politique de rotation des clés et le plan de restauration de sauvegarde. Ne pas activer `ALLOW_LIVE_PAYMENTS` ou `RELEASE_APPROVED` sur la seule base des tests unitaires de ce dépôt.
