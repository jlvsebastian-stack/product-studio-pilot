const text=(value,max=1200)=>typeof value==='string'?value.trim().slice(0,max):'';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const qualityReviewKey=brief=>JSON.stringify([brief.title,brief.format,brief.productDraft,brief.tone,brief.design,brief.designPlan,brief.buyer,brief.outcome,brief.method,brief.offer,brief.author]);
export function cleanQualityReview(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const summary=text(value.summary),fixes=Array.isArray(value.fixes)?value.fixes.filter(v=>typeof v==='string').map(v=>text(v,500)).filter(Boolean).slice(0,6):[];
 const improvements=Array.isArray(value.improvements)?value.improvements.filter(v=>v&&typeof v==='object').map(v=>({title:text(v.title,180),why:text(v.why,600),basis:text(v.basis,600)})).filter(v=>v.title&&v.why&&v.basis).slice(0,3):[];
 return summary||fixes.length||improvements.length?{summary,fixes,improvements}:null;
}
export function renderQualityReview(value,label='Draft'){
 const review=cleanQualityReview(value);if(!review)return '';
 return `<section class="final-quality-review" aria-label="Final quality review"><h2>Final quality review</h2><p class="fine">${escape(label)} · improvements are optional</p>${review.improvements.length?`<ol>${review.improvements.map(i=>`<li><strong>${escape(i.title)}</strong><p>Why: ${escape(i.why)}</p></li>`).join('')}</ol>`:''}${review.fixes.length?`<details><summary>Corrections made</summary><ul>${review.fixes.map(f=>`<li>${escape(f)}</li>`).join('')}</ul></details>`:''}${review.summary?`<details><summary>What was checked</summary><p>${escape(review.summary)}</p></details>`:''}${review.improvements.length?`<details><summary>What these suggestions are based on</summary><ul>${review.improvements.map(i=>`<li>${escape(i.title)}: ${escape(i.basis)}</li>`).join('')}</ul></details>`:''}</section>`;
}
