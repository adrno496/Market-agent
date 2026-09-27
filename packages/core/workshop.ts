import { parseSpec, readyForPlan } from './spec.ts';
import type { ProjectSpec } from './spec.ts';
import { selectFramework } from './research.ts';
import { packageProject } from './packaging.ts';
import { unavailable } from './states.ts';
import { invariant } from './errors.ts';
export function workshopExport(spec:ProjectSpec):ReturnType<typeof packageProject>{
  parseSpec(spec);invariant(readyForPlan(spec),'SPEC_INCOMPLETE','Termine le cadrage avant de l’exporter.');
  return packageProject({
    'README.md':'# Cadrage AgentForge — atelier local\n\nCe ZIP est un export de spécification, pas un agent généré par IA ni une livraison commerciale.\nAucun paiement, appel de modèle, test du futur agent, RECURSIVE ou BR360 n’a été exécuté pour cet export.\n',
    'PROJECT_SPEC.json':JSON.stringify(spec,null,2)+'\n',
    'ARCHITECTURE_PREVIEW.json':JSON.stringify({...selectFramework(spec),status:'PROPOSAL_UNVERIFIED',version:null},null,2)+'\n',
    '.env.example':'# À compléter seulement après sélection du framework et du fournisseur.\nAI_PROVIDER=\nAI_MODEL=\n'
  },['sandbox','recursive','br360'].map(tool=>unavailable(tool,'Export de cadrage uniquement.')),{
    origin:'AgentForge local rules engine',code_generated:false,paid:false,external_research_executed:false,generator:'AgentForge/0.1.0'
  });
}
