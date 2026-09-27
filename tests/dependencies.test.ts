import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDependencyManifest } from '../packages/core/dependencies.ts';
import type { BuildPlan } from '../packages/core/research.ts';
// Reduced plan fixtures: only the fields read by the manifest boundary are relevant.
const tsPlan={decision:{language:'typescript'},source:{package:'@openai/agents',version:'1.2.3'}} as BuildPlan;
const pyPlan={decision:{language:'python'},source:{package:'langgraph',version:'1.2.3'}} as BuildPlan;
const ts=(patch:Record<string,unknown>={})=>({'package.json':JSON.stringify({dependencies:{'@openai/agents':'1.2.3'},...patch})});
test('dependency manifests: exact framework version accepted',()=>assert.doesNotThrow(()=>validateDependencyManifest(ts(),tsPlan)));
test('dependency manifests: framework mismatch rejected',()=>assert.throws(()=>validateDependencyManifest(ts({dependencies:{'@openai/agents':'1.2.4'}}),tsPlan)));
for(const version of ['^1.2.3','https://evil.example/code.tgz','file:../../host','git+https://github.com/example/repo.git'])test('dependency manifests: reject unsafe dependency '+version,()=>assert.throws(()=>validateDependencyManifest(ts({devDependencies:{something:version}}),tsPlan)));
test('dependency manifests: install hook rejected',()=>assert.throws(()=>validateDependencyManifest(ts({scripts:{postinstall:'node steal.js'}}),tsPlan)));
test('dependency manifests: workspace replacement rejected',()=>assert.throws(()=>validateDependencyManifest(ts({workspaces:['other']}),tsPlan)));
test('dependency manifests: Python exact versions accepted',()=>assert.doesNotThrow(()=>validateDependencyManifest({'requirements.in':'langgraph==1.2.3\npytest==1.2.3\n'},pyPlan)));
test('dependency manifests: Python URL or index option rejected',()=>assert.throws(()=>validateDependencyManifest({'requirements.in':'langgraph==1.2.3\n--extra-index-url https://evil.example\n'},pyPlan)));
test('dependency manifests: Python framework mismatch rejected',()=>assert.throws(()=>validateDependencyManifest({'requirements.in':'langgraph==1.2.4\n'},pyPlan)));
