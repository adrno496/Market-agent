import { invariant } from './errors.ts';
export const transitions: Record<string, readonly string[]> = {
  DRAFT:['DISCOVERY','CANCELLED'],DISCOVERY:['CLARIFYING','CANCELLED'],CLARIFYING:['WAITING_USER','SPEC_READY','CANCELLED'],
  WAITING_USER:['CLARIFYING','CANCELLED'],SPEC_READY:['ARCHITECTURE_READY','CLARIFYING','CANCELLED'],
  ARCHITECTURE_READY:['QUOTE_READY','CLARIFYING','CANCELLED'],QUOTE_READY:['PAYMENT_REQUIRED','CLARIFYING','CANCELLED'],
  PAYMENT_REQUIRED:['PAID','CANCELLED','REFUNDED'],PAID:['QUEUED','REFUNDED'],QUEUED:['RESEARCHING','BLOCKED','CANCELLED','REFUNDED'],
  RESEARCHING:['GENERATING','BLOCKED','FAILED','CANCELLED','REFUNDED'],GENERATING:['VERIFYING','BLOCKED','FAILED','CANCELLED','REFUNDED'],
  VERIFYING:['REPAIRING','PACKAGING','BLOCKED','FAILED','REFUNDED'],REPAIRING:['VERIFYING','BLOCKED','FAILED','REFUNDED'],
  PACKAGING:['COMPLETED','COMPLETE_WITH_WARNINGS','BLOCKED','FAILED','REFUNDED'],COMPLETED:['REFUNDED'],COMPLETE_WITH_WARNINGS:['REFUNDED'],
  BLOCKED:['QUEUED','CANCELLED','REFUNDED'],BUDGET_BLOCKED:['QUEUED','CANCELLED','REFUNDED'],FAILED:['QUEUED','CANCELLED','REFUNDED'],CANCELLED:[],REFUNDED:[]
};
export function transition(from: string, to: string): string {
  invariant(transitions[from]?.includes(to), 'INVALID_TRANSITION', `Transition interdite : ${from} → ${to}.`, 409); return to;
}
export type EvidenceStatus = 'PASS'|'WARN'|'BLOCK'|'UNKNOWN'|'NOT_AVAILABLE'|'UNTESTED'|'FAIL';
export interface EvidenceReport { tool: string; status: EvidenceStatus; summary: string; findings: string[]; evidence: unknown[]; raw?: unknown; executed_at: string | null; scope: string }
export function unavailable(tool: string, reason: string): EvidenceReport {
  return {tool,status:'NOT_AVAILABLE',summary:reason,findings:[],evidence:[],executed_at:null,scope:'not_executed'};
}
export function releaseAllowed(reports: EvidenceReport[]): boolean {
  return ['static','sandbox','recursive','br360'].every(tool => { const matches=reports.filter(r=>r.tool===tool); return matches.length===1 && matches[0].status==='PASS' && typeof matches[0].executed_at==='string' && Number.isFinite(Date.parse(matches[0].executed_at)) && matches[0].evidence.length>0; });
}
