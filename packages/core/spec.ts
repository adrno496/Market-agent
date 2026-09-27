import { randomUUID } from 'node:crypto';
import { invariant, object, text } from './errors.ts';
import { rejectSecrets } from './security.ts';
export const STATUSES = ['FACT', 'USER_CONFIRMED', 'INFERRED', 'UNKNOWN', 'NEEDS_CONFIRMATION'] as const;
export type FactStatus = typeof STATUSES[number];
export interface Fact { value: string | null; status: FactStatus; confidence: number; source: string; confirmed: boolean; updated_at: string }
export const FIELDS = ['objective','description','domain','target_users','workflows','triggers','inputs','outputs','channels',
'integrations','tools','skills','memory','database','authentication','permissions','autonomy','approvals','privacy','sensitive_data',
'expected_scale','language','runtime_language','framework_preference','provider_preference','model_preference','deployment_target',
'observability','success_criteria','tests','constraints','calendar_provider','working_hours','services_durations','timezone'] as const;
export type FieldName = typeof FIELDS[number];
export interface ProjectSpec { schema_version: '1.0.0'; id: string; project_name: string; revision: number; fields: Record<FieldName, Fact> }
export function fact(value: string | null, status: FactStatus = 'UNKNOWN', source = 'missing', confidence = 0): Fact {
  return {value, status, confidence, source, confirmed: status === 'USER_CONFIRMED', updated_at: new Date().toISOString()};
}
export function newSpec(idea: string): ProjectSpec {
  idea = text(idea, 'objective', 8000); rejectSecrets(idea);
  const fields = Object.fromEntries(FIELDS.map(k => [k, fact(null)])) as Record<FieldName, Fact>;
  fields.objective = fact(idea, 'USER_CONFIRMED', 'user:initial_request', 1);
  fields.domain = fact(/salon|coiff|rendez-vous|booking/i.test(idea) ? 'booking' : 'general', 'INFERRED', 'local-rule:domain', .7);
  return { schema_version: '1.0.0', id: randomUUID(), project_name: 'Mon agent', revision: 1, fields };
}
export function parseSpec(value: unknown): ProjectSpec {
  const spec = object(value);
  invariant(Object.keys(spec).length===5,'INVALID_SPEC','Propriétés de spécification inconnues.');
  invariant(spec.schema_version === '1.0.0' && typeof spec.id === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(spec.id), 'INVALID_SPEC', 'Version ou ID de spécification invalide.');
  invariant(Number.isInteger(spec.revision) && Number(spec.revision) >= 1, 'INVALID_SPEC', 'Révision invalide.');
  text(spec.project_name, 'project_name', 100); const fields = object(spec.fields);
  invariant(Object.keys(fields).length === FIELDS.length, 'INVALID_SPEC', 'Champs inconnus ou absents.');
  for (const k of FIELDS) {
    const f = object(fields[k]);
    invariant(Object.keys(f).length===6,'INVALID_SPEC','Propriétés de provenance inconnues.');
    invariant(f.value === null || typeof f.value === 'string' && f.value.length <= 8000, 'INVALID_SPEC', 'Valeur invalide.');
    invariant(STATUSES.includes(f.status as FactStatus) && typeof f.confidence === 'number' && f.confidence >= 0 && f.confidence <= 1,
      'INVALID_SPEC', 'Provenance invalide.');
    invariant(typeof f.source === 'string' && f.source.length <= 250 && typeof f.updated_at === 'string' && Number.isFinite(Date.parse(f.updated_at)), 'INVALID_SPEC', 'Source invalide.');
    invariant(f.confirmed === (f.status === 'USER_CONFIRMED'), 'INVALID_SPEC', 'Confirmation incohérente.');
    invariant(f.status !== 'UNKNOWN' || f.value === null, 'INVALID_SPEC', 'Valeur inconnue incohérente.');
    if (f.value) rejectSecrets(String(f.value));
  }
  return spec as unknown as ProjectSpec;
}
export interface Question { field: FieldName; label: string; options: string[]; critical: boolean; default_value?: string }
const booking: Question[] = [
  {field:'calendar_provider',label:'Où sont gérés les rendez-vous ?',options:['Google Calendar','Calendly','Agenda interne','Je ne sais pas'],critical:true,default_value:'Agenda interne'},
  {field:'approvals',label:'L’agent peut-il confirmer un rendez-vous seul ?',options:['Validation humaine avant confirmation','Confirmation automatique'],critical:true},
  {field:'channels',label:'Comment prévenir le client ?',options:['Email','SMS','WhatsApp','Aucune confirmation','Je ne sais pas'],critical:true,default_value:'Aucune confirmation'},
  {field:'working_hours',label:'Quels sont les jours et horaires d’ouverture ?',options:[],critical:true},
  {field:'services_durations',label:'Quelles prestations proposer, et combien de minutes durent-elles ?',options:[],critical:true},
  {field:'timezone',label:'Quel fuseau horaire utiliser ?',options:['Europe/Paris','Autre'],critical:true},
  {field:'database',label:'Où conserver les rendez-vous et les coordonnées clients ?',options:['Base PostgreSQL privée','Base existante à connecter','Je ne sais pas'],critical:true,default_value:'Base PostgreSQL privée'}
];
const general: Question[] = [
  {field:'workflows',label:'Quelles actions doit effectuer l’agent, dans quel ordre ?',options:[],critical:true},
  {field:'integrations',label:'Quels outils ou services doit-il utiliser ?',options:['Aucun service externe','Je ne sais pas'],critical:true,default_value:'Aucun service externe'},
  {field:'approvals',label:'Quelles actions doivent être validées par une personne ?',options:['Toutes les actions externes','L’agent reste en lecture seule'],critical:true},
  {field:'success_criteria',label:'Quel résultat concret permettra de dire que l’agent fonctionne ?',options:[],critical:true}
];
const common: Question[] = [
  {field:'sensitive_data',label:'L’agent traitera-t-il des données personnelles ou sensibles ?',options:['Coordonnées clients seulement','Aucune donnée personnelle','Données sensibles à préciser'],critical:true},
  {field:'expected_scale',label:'Combien de demandes devra-t-il traiter environ par jour ?',options:['Moins de 100','100 à 1 000','Plus de 1 000','Je ne sais pas'],critical:false,default_value:'Moins de 100'},
  {field:'provider_preference',label:'Quel fournisseur IA souhaites-tu utiliser ?',options:['Auto','OpenRouter','OpenAI','Anthropic','Mistral','Google'],critical:false}
];
export function questionsFor(spec: ProjectSpec): Question[] {
 const base=[...(spec.fields.domain.value === 'booking' ? booking : general), ...common];
 for(const k of ['integrations','permissions','runtime_language','framework_preference','model_preference','deployment_target','privacy'] as FieldName[]){
  const f=spec.fields[k];if(f.value!==null&&!f.confirmed&&!base.some(q=>q.field===k))base.push({field:k,label:`Confirme ou corrige ce choix proposé pour « ${k} » : ${f.value}`,options:[f.value],critical:true});
 }
 return base;
}
export function nextQuestion(spec: ProjectSpec): Question | null {
  return questionsFor(spec).find(q => !spec.fields[q.field].confirmed) ?? null;
}
export function answer(spec: ProjectSpec, field: FieldName, value: string, confirmDefault = false): ProjectSpec {
  invariant(FIELDS.includes(field), 'INVALID_FIELD', 'Champ inconnu.'); value = text(value, field); rejectSecrets(value);
  const result = structuredClone(spec); const q = questionsFor(spec).find(q => q.field === field);
  const unknown = /^(je ne sais pas|unknown)$/i.test(value);
  if (unknown) {
    invariant(q?.default_value, 'NEEDS_CONFIRMATION', 'Cette information doit être précisée avant de continuer.');
    result.fields[field] = fact(q.default_value, 'NEEDS_CONFIRMATION', 'default:requires_user_confirmation', .5);
  } else {
    if (confirmDefault) invariant(spec.fields[field].status === 'NEEDS_CONFIRMATION' && spec.fields[field].value === value, 'INVALID_CONFIRMATION', 'Valeur proposée modifiée.');
    result.fields[field] = fact(value, 'USER_CONFIRMED', 'user:answer', 1);
  }
  result.revision++; return result;
}
export function applyModelSuggestions(spec: ProjectSpec, suggestions: unknown): ProjectSpec {
  const values = object(suggestions); const result = structuredClone(spec);
  for (const [k, v] of Object.entries(values)) {
    if (!FIELDS.includes(k as FieldName) || result.fields[k as FieldName].confirmed || v === null) continue;
    const value = text(v, k, 8000); rejectSecrets(value);
    result.fields[k as FieldName] = fact(value, 'INFERRED', 'model:suggestion_unconfirmed', .65);
  }
  result.revision++; return result;
}
export function readyForPlan(spec: ProjectSpec): boolean { return nextQuestion(spec) === null; }
