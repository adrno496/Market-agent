import { spawnSync } from 'node:child_process';
const args=['--project','tsconfig.json'];if(process.env.NODE_TYPES_DIR)args.push('--typeRoots',process.env.NODE_TYPES_DIR);
const r=spawnSync(process.env.TSC_BIN||'tsc',args,{stdio:'inherit'});if(r.error){console.error('TypeScript compiler unavailable. Install a stable TypeScript compiler and @types/node, or configure TSC_BIN and NODE_TYPES_DIR.');process.exit(2);}process.exit(r.status??2);
