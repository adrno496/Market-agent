# Architecture réalisée

## Frontières

`apps/web` sert les assets locaux et l’API de contrôle. Aucune commande Docker ni aucun code généré n’est exécuté dans ce processus. `apps/worker` réclame un job payé dans PostgreSQL, appelle le modèle sélectionné et les contrôles. Le worker doit être installé sur une machine d’isolation appropriée, distincte du serveur web et des secrets de production principaux.

```text
Navigateur
  → API Node TypeScript
    → Supabase Auth / PostgreSQL / RLS
    → recherche GitHub + métadonnées MCP
    → catalogue IA + Stripe Checkout
Stripe webhook signé
  → paiement / crédit unique
    → file PostgreSQL persistée
Worker avec bail et jeton de verrouillage
  → appel IA réel / budget réservé
  → résolution des dépendances dans Docker hors ligne
  → validation statique / tests isolés
  → RECURSIVE / BR360 dans conteneurs séparés
  → boucle bornée ou blocage
  → ZIP + rapports + provenance + checksums
  → Supabase Storage privé
  → URL signée 60 secondes après autorisation serveur
```

## Principales unités

`spec.ts` : provenance, validations, réponses explicites, questions prioritaires. `interview.ts` : extraction IA optionnelle, sans pouvoir confirmer une donnée ni changer les permissions. `research.ts` : propositions de framework, métadonnées actuelles, filtre de licences, sources candidates. `providers.ts` : cinq API de modèles réelles et estimation de coût. `payments.ts` : Checkout, canonicalisation du paiement, signature et retransmission idempotente. `dependencies.ts` : politique de manifeste. `sandbox.ts` : Docker sans réseau, résolution de locks et normalisation d’audit. `generation.ts` : orchestration, réparations et livraison. `packaging.ts` : ZIP déterministe sans lecture de chemins arbitraires.

## Persistance et autorisations

Toutes les écritures métier passent par le serveur. L’utilisateur authentifié lit ses données avec son JWT et la clé publique Supabase ; la RLS reste active. Le `service_role` n’est pas présent dans le navigateur. Les RPC d’écriture sont `SECURITY DEFINER`, avec `search_path` fixé, et leur exécution est retirée de `public`, `anon` et `authenticated`. **Cette définition SQL reste à tester sur un vrai PostgreSQL/Supabase, notamment avec deux utilisateurs et des requêtes concurrentes.**

Chaque paiement est lié à un plan, un tarif et un mode Stripe. Les crédits sont uniques par paiement et les jobs uniques par crédit. Un webhook répété ne doit pas créer un second achat. Le worker dispose d’un jeton de verrouillage renouvelé par un bail ; un ancien worker ne doit plus pouvoir publier une livraison après perte du verrou. Les coûts sont réservés avant appel et ne sont pas libérés silencieusement si la facturation est incertaine.

## Limitations structurelles

La reprise conserve les événements, le crédit et les coûts, mais ne reprend pas chaque étape intermédiaire de génération depuis un checkpoint de fichiers : après interruption, un nouvel essai peut régénérer le code, dans le budget restant. Les produits Stripe restent configurés par variables d’environnement ; leur remplacement nécessite une mise à jour de configuration/restart. Les tables de catalogues et de provenance sont préparées mais ne constituent pas encore une administration éditoriale complète.

Le JSON de chaque champ critique stocke une chaîne ou `null`. Les listes et workflows ne sont pas encore des graphes typés riches. Le moteur de sélection n’est pas une certification de compatibilité de toutes les combinaisons framework/fournisseur. Les cinq frameworks sont des familles recherchables, pas cinq générateurs validés en production.

Le checksum du ZIP est enregistré hors ZIP dans l’artifact. Le fichier `reports/CHECKSUMS.sha256` contient les hashes des autres fichiers, pas son propre hash, pour éviter une référence circulaire.
