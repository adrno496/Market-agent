import { deflateRawSync } from 'node:zlib';
import { invariant } from './errors.ts';
import { safePath, sha256, rejectSecrets, canonical } from './security.ts';
import type { EvidenceReport } from './states.ts';
export type ProjectFiles = Record<string, string>;
const crcTable = new Uint32Array(256).map((_, i) => { let c = i; for(let j=0;j<8;j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
export function crc32(data: Uint8Array): number { let c = 0xffffffff; for(const b of data) c = crcTable[(c ^ b)&255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
export function validateFiles(files: ProjectFiles, knownSecrets: string[] = []): void {
  const entries = Object.entries(files); invariant(entries.length > 0 && entries.length <= 250, 'FILE_LIMIT', 'Nombre de fichiers invalide.');
  const seen = new Set<string>(); let total=0;
  for (const [path, content] of entries) {
    safePath(path); invariant(!seen.has(path.toLowerCase()), 'DUPLICATE_PATH', 'Collision de noms de fichiers.'); seen.add(path.toLowerCase());
    invariant(typeof content === 'string' && !content.includes('\0'), 'INVALID_CONTENT', 'Contenu texte invalide.');
    const size = Buffer.byteLength(content); invariant(size <= 1_000_000, 'FILE_LIMIT', 'Fichier trop grand.'); total += size; rejectSecrets(content, knownSecrets);
  }
  invariant(total <= 12_000_000, 'FILE_LIMIT', 'Projet trop grand.');
  for (const path of seen) for (const other of seen) invariant(!other.startsWith(path + '/'), 'PATH_COLLISION', 'Un fichier masque un répertoire.');
}
/** Deterministic ZIP, Unix regular files only. Never reads arbitrary filesystem paths. */
export function zipFiles(files: ProjectFiles): Buffer {
  validateFiles(files); const locals: Buffer[]=[]; const central:Buffer[]=[]; let offset=0;
  for(const [path,content] of Object.entries(files).sort(([a],[b])=>a.localeCompare(b,'en'))) {
    const name=Buffer.from(path); const raw=Buffer.from(content); const data=deflateRawSync(raw); const crc=crc32(raw);
    const local=Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20,4); local.writeUInt16LE(0x800,6);
    local.writeUInt16LE(8,8); local.writeUInt16LE(0x21,12); local.writeUInt32LE(crc,14); local.writeUInt32LE(data.length,18);
    local.writeUInt32LE(raw.length,22); local.writeUInt16LE(name.length,26);
    const dir=Buffer.alloc(46); dir.writeUInt32LE(0x02014b50); dir.writeUInt16LE(0x314,4); dir.writeUInt16LE(20,6); dir.writeUInt16LE(0x800,8);
    dir.writeUInt16LE(8,10); dir.writeUInt16LE(0x21,14); dir.writeUInt32LE(crc,16); dir.writeUInt32LE(data.length,20); dir.writeUInt32LE(raw.length,24);
    dir.writeUInt16LE(name.length,28); dir.writeUInt32LE((0o100644 * 65536)>>>0,38); dir.writeUInt32LE(offset,42);
    locals.push(local,name,data); central.push(dir,name); offset += local.length+name.length+data.length;
  }
  const end=Buffer.alloc(22); const count=Object.keys(files).length; end.writeUInt32LE(0x06054b50); end.writeUInt16LE(count,8); end.writeUInt16LE(count,10);
  end.writeUInt32LE(central.reduce((s,b)=>s+b.length,0),12); end.writeUInt32LE(offset,16);
  return Buffer.concat([...locals,...central,end]);
}
export function packageProject(files: ProjectFiles, reports: EvidenceReport[], provenance: unknown, knownSecrets: string[] = []): {buffer:Buffer;sha256:string;files:ProjectFiles} {
  validateFiles(files,knownSecrets);
  invariant(!Object.keys(files).some(p=>p.startsWith('reports/')), 'RESERVED_PATH', 'Le dossier reports est réservé au système de vérification.');
  const result={...files};
  for(const r of reports) result[`reports/${r.tool.toUpperCase()}_REPORT.json`]=JSON.stringify(r,null,2)+'\n';
  result['reports/PROVENANCE.json']=JSON.stringify(provenance,null,2)+'\n';
  result['reports/CHECKSUMS.sha256']=Object.entries(result).sort(([a],[b])=>a.localeCompare(b,'en')).map(([p,c])=>`${sha256(c)}  ${p}`).join('\n')+'\n';
  validateFiles(result,knownSecrets); const buffer=zipFiles(result); return {buffer,sha256:sha256(buffer),files:result};
}
export function staticValidate(files: ProjectFiles, language: string): EvidenceReport {
  const findings:string[]=[]; validateFiles(files);
  for(const required of ['README.md','ARCHITECTURE.md','AGENTS.md','SECURITY.md','.env.example','.gitignore']) if(!files[required]) findings.push(`MISSING:${required}`);
  if(!Object.keys(files).some(p=>p.startsWith('src/'))) findings.push('MISSING:src');
  if(!Object.keys(files).some(p=>p.startsWith('tests/'))) findings.push('MISSING:tests');
  if(language==='typescript') {
    try { const p=JSON.parse(files['package.json']??''); if(!p.scripts?.test||!p.scripts?.build) findings.push('MISSING:test_or_build_script');
      for(const version of Object.values({...p.dependencies,...p.devDependencies})) if(typeof version!=='string'||!/^\d+\.\d+\.\d+$/.test(version))findings.push('UNPINNED_DEPENDENCY');
      if(p.scripts?.preinstall||p.scripts?.postinstall||p.scripts?.prepare) findings.push('INSTALL_LIFECYCLE_SCRIPT');
    } catch {findings.push('INVALID:package.json');}
    if(!files['package-lock.json']) findings.push('MISSING:package-lock.json');
  } else if(!files['pyproject.toml'] || !files['requirements.lock']) findings.push('MISSING:python_dependency_lock');
  for(const [p,s]of Object.entries(files)) {
    if(p.startsWith('.github/')&&/pull_request_target|secrets: inherit/.test(s))findings.push(`UNSAFE_CI:${p}`);
    if(p.endsWith('SKILL.md')) {
      const name=s.match(/^---\r?\nname: ([a-z0-9]+(?:-[a-z0-9]+)*)\r?\n/); const description=s.match(/^description:\s*(.+)$/m);
      if(!name || !description || description[1].length>1024 || name[1].length>64 || p.split('/').at(-2)!==name[1])findings.push(`INVALID_SKILL:${p}`);
    }
  }
  return {tool:'static',status:findings.length?'BLOCK':'PASS',summary:findings.length?'Validation statique bloquante.':'Contrôles statiques structurels exécutés. Ne prouve pas le fonctionnement.',findings,
    evidence:[{type:'files_digest',sha256:sha256(canonical(files)),checks:'structure,paths,secret-patterns,manifest-policy'}],executed_at:new Date().toISOString(),scope:'structural_only'};
}
