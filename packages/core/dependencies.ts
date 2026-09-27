import { invariant } from './errors.ts';
import type { ProjectFiles } from './packaging.ts';
import type { BuildPlan } from './research.ts';
/** Manifests are data. Resolve lockfiles only inside the isolated, network-free sandbox. */
export function validateDependencyManifest(files:ProjectFiles,plan:BuildPlan):void{
 if(plan.decision.language==='typescript'){
  const p=JSON.parse(files['package.json']||'{}');const dependencies={...p.dependencies,...p.devDependencies};
  invariant(dependencies[plan.source.package!]===plan.source.version,'FRAMEWORK_VERSION_MISMATCH','Le manifeste doit utiliser la version immuable du framework.');
  invariant(Object.keys(dependencies).length<=100,'DEPENDENCY_LIMIT','Trop de dépendances.');
  for(const [name,version]of Object.entries(dependencies))invariant(/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/.test(name)&&typeof version==='string'&&/^\d+\.\d+\.\d+$/.test(version),'UNSAFE_DEPENDENCY','Seules les dépendances de registre à version exacte sont autorisées.');
  invariant(!p.workspaces&&!p.overrides&&!p.resolutions&&!p.bundleDependencies&&!p.bundledDependencies,'UNSAFE_DEPENDENCY','Les remplacements de résolution ne sont pas autorisés.');
  for(const hook of ['preinstall','install','postinstall','prepare','prepublish'])invariant(!p.scripts?.[hook],'UNSAFE_DEPENDENCY','Scripts de cycle d’installation interdits.');
 }else{
  const content=files['requirements.in'];invariant(typeof content==='string','DEPENDENCY_MANIFEST_MISSING','requirements.in doit déclarer les dépendances exactes.');
  const lines=content.split('\n').map(s=>s.trim()).filter(s=>s&&!s.startsWith('#'));
  invariant(lines.length>0&&lines.length<=100&&lines.every(s=>/^[a-zA-Z0-9][a-zA-Z0-9_.-]*(?:\[[a-zA-Z0-9_,.-]+\])?==\d+\.\d+\.\d+$/.test(s)),'UNSAFE_DEPENDENCY','requirements.in ne peut contenir que des versions exactes, sans URL ni option.');
  invariant(lines.some(s=>s.split('==')[0].split('[')[0].toLowerCase().replaceAll('_','-')===plan.source.package&&s.split('==')[1]===plan.source.version),'FRAMEWORK_VERSION_MISMATCH','Version du framework incorrecte.');
 }
}
