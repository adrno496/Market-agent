# Instructions de maintenance d’AgentForge

Lire README.md, IMPLEMENTATION_REPORT.md et docs/REQUIREMENTS_COVERAGE.md avant de modifier l’application. C’est un nouveau dépôt autonome, pas une copie de site2.

Les archives FORMATION/RECURSIVE/BR360 sont des sources d’analyse et des outils internes ; ne pas copier leur code sans droits explicitement validés. Ne pas réécrire un moteur dont une interface vérifiable existe. Maintenir les statuts natifs dans les rapports : PARTIAL n’est pas PASS, UNKNOWN n’est pas PASS.

Les tests simulés restent dans tests/ ; ne jamais les exposer comme provider de production. Les secrets ne vont ni dans Git ni dans les prompts ni dans le ZIP. Ne jamais exécuter un projet généré directement sur le host. Ne jamais ajouter --allow-host-execution à RECURSIVE pour forcer le passage d’un gate.

Après une modification : npm test, npm run typecheck, npm run build. Les validations externes non exécutées restent NOT_AVAILABLE/BLOCKED. Conserver les rapports sans masquer un échec. Les fichiers docs/PROMPT_REPRISE_VSCODE.md et DEPLOYMENT.md listent les gates restants.
