import { newSpec, answer, nextQuestion } from '../packages/core/spec.ts';
import type { ProjectSpec, FieldName } from '../packages/core/spec.ts';
export const salonIdea='Je veux un agent IA capable de répondre aux clients de mon salon de coiffure, consulter les disponibilités, proposer un créneau, enregistrer un rendez-vous et envoyer une confirmation.';
export const salonAnswers:Record<string,string>={calendar_provider:'Google Calendar',approvals:'Validation humaine avant confirmation',channels:'Email',working_hours:'Lundi au vendredi, 09:00 à 18:00',services_durations:'Coupe : 30 minutes ; coloration : 90 minutes',timezone:'Europe/Paris',database:'Base PostgreSQL privée',sensitive_data:'Coordonnées clients seulement',expected_scale:'Moins de 100',provider_preference:'Auto'};
export function salonSpec():ProjectSpec{let s=newSpec(salonIdea);let q=nextQuestion(s);while(q){s=answer(s,q.field,salonAnswers[q.field]);q=nextQuestion(s);}return s;}
