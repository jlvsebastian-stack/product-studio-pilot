import {cleanQualityReview} from '../public/quality-review.js';
import {readFormatQuality} from './format-skills.js';
export const qualityReviewJsonSchema={type:'object',additionalProperties:false,required:['summary','fixes','improvements'],properties:{summary:{type:'string',maxLength:1200},fixes:{type:'array',maxItems:6,items:{type:'string',maxLength:500}},improvements:{type:'array',maxItems:3,items:{type:'object',additionalProperties:false,required:['title','why','basis'],properties:{title:{type:'string',maxLength:180},why:{type:'string',maxLength:600},basis:{type:'string',maxLength:600}}}}}};
export function parseQualityReview(raw){
 try{if(typeof raw==='string')raw=JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));return cleanQualityReview(raw?.qualityReview??raw);}catch{return null;}
}
export function groundedQualityReview(raw,brief,evidence=[]){
 const review=parseQualityReview(raw);if(!review)return null;
 const normalized=value=>String(value).normalize('NFKC').replace(/\s+/g,' ').trim().replace(/^["“”'‘’`]+|["“”'‘’`]+$/g,'').toLocaleLowerCase('en-US');
 const strings=value=>typeof value==='string'?[value]:value&&typeof value==='object'?Object.entries(value).filter(([key])=>key!=='_meta').flatMap(([,v])=>strings(v)):[];
 const known=strings([brief,evidence]).map(normalized);
 review.improvements=review.improvements.filter(i=>{const quote=normalized(i.basis);return quote.length>=8&&known.some(value=>value.includes(quote));});
 return review;
}
export function qualityReviewInstructions(format){return `FINAL QUALITY REVIEW — finish inside this SAME turn/request; no extra AI call, interview, approval gate or whole-product rewrite.
Use the chosen format skill and try the buyer's promised task on the output available in this turn. Correct obvious in-scope formatting/usability issues BEFORE returning it, within existing authority. Preserve approved words, facts, formulas, original artwork, notes, scope and human approvals. Read-only recovery NEVER edits. A source review cannot claim native layout, image, speaker-note or calculation verification; actual-file review requires captured native readback. Never invent a test, correction, sale, buyer result or research.
Report only corrections actually made. Look for the THREE most useful remaining improvements: first-use ease, findability, practical value, reuse, difficult cases and differentiation. Functional success or approval does not mean the product cannot improve. Each suggestion needs a concrete buyer benefit (why) and a short EXACT consecutive quote from the product/brief or actual native readback (basis); copy that quote alone, without a source prefix or paraphrase. Rank by usefulness. Return fewer only when further worthwhile improvements genuinely lack support; do not invent flaws to pad the list. Optional additions remain suggestions, never generated extras. Keep recommendations separate from the buyer-facing manuscript.
Return a concise qualityReview object with summary, fixes (short strings), improvements ([{title,why,basis}]). Native production returns ONLY JSON {"qualityReview":{...}} as its final message after the existing actual-file checks. For interview generation include qualityReview in the existing JSON response. If an issue cannot safely be fixed, explain it as an improvement, not a claimed correction.
Use everyday language for a first-time creator. Keep the summary to two short sentences about what was checked and any real limitation; omit URLs, file IDs, tool names, technical element counts and implementation jargon. Keep each why to one or two short sentences about the buyer's benefit.
${readFormatQuality(format)}`;}
