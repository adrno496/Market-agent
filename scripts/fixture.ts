import { mkdir, writeFile } from 'node:fs/promises';
import { salonSpec } from '../fixtures/salon.ts';
import { workshopExport } from '../packages/core/workshop.ts';
const spec=salonSpec();const pack=workshopExport(spec);await mkdir('reports/fixtures',{recursive:true});await writeFile('reports/fixtures/SALON_PROJECT_SPEC.json',JSON.stringify(spec,null,2));await writeFile('reports/fixtures/SALON_CADRAGE_LOCAL.zip',pack.buffer);
console.log(JSON.stringify({scope:'LOCAL_OFFLINE_CORE',export:'reports/fixtures/SALON_CADRAGE_LOCAL.zip',sha256:pack.sha256,agent_code_generated:false,payment:'NOT_EXECUTED',sandbox:'NOT_AVAILABLE',recursive:'NOT_EXECUTED_FOR_FIXTURE',br360:'NOT_EXECUTED_FOR_FIXTURE'}));
