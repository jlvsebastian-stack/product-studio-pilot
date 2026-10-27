import { z } from 'zod';
export const stages=['Discover your expertise','Choose a useful problem','Find your audience','Make the niche specific','Check the market','Shape a better offer','Choose the format','Refine the outline','Set the voice and design','Create one section at a time','Review and improve','Package and download'];
export const briefKeys=['title','topic','buyer','outcome','method','example','limits','author','tone','theme','niche','marketEvidence','offer','format','outline','design','designPlan','listingCopy','productDraft'];
export const briefSchema=z.object(Object.fromEntries(briefKeys.map(key=>[key,z.string().max(key==='productDraft'?90000:12000).default('')]))).strict();
export const projectSchema=z.object({stage:z.number().int().min(1).max(12),stageReady:z.boolean(),summary:z.string().max(12000),brief:briefSchema}).strict();
export const freshProject=()=>projectSchema.parse({stage:1,stageReady:false,summary:'',brief:{}});
