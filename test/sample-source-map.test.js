import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as art from '../public/slide-art.js';
import {readConceptSections,fullSourceFingerprint,renderConceptSlides,renderCanvaTransfer} from '../public/design-concepts.js';
import {SLIDE_POLICY_VERSION} from '../public/slide-policy.js';
const sections=[{id:'s1',audience:'Opening'},{id:'s2',audience:'Second'},{id:'s3',audience:'Comparison',blocks:[{kind:'table'}]},{id:'s4',audience:'Later'}];
test('samples cover up to three representative sources and permit three purposeful pages from two sources',()=>{
  assert.deepEqual(art.representativeSourceIds(sections),['s1','s2','s3']);
  assert.equal(typeof art.validateSlideSourceMap,'function');
  const plans=[{id:'a',sourceId:'s1'},{id:'b',sourceId:'s1'},{id:'c',sourceId:'s2'}];
  assert.doesNotThrow(()=>art.validateSlideSourceMap(plans,sections.slice(0,2),{sample:true}));
  assert.throws(()=>art.validateSlideSourceMap([plans[0],plans[2],plans[1]],sections.slice(0,2),{sample:true}),/order/);
  assert.throws(()=>art.validateSlideSourceMap(plans.slice(0,2),sections.slice(0,2),{sample:true}),/three|3/);
  assert.throws(()=>art.validateSlideSourceMap(plans.map(p=>({...p,sourceId:'s1'})),sections.slice(0,2),{sample:true}),/cover/);
  assert.throws(()=>art.validateSlideSourceMap(plans.map(p=>({...p,id:'same'})),sections.slice(0,2),{sample:true}),/unique/);
});
test('full decks retain every approved sample page while covering the canonical source in order',()=>{
  const plans=[{id:'a',sourceId:'s1'},{id:'b',sourceId:'s1'},{id:'c',sourceId:'s2'}];
  assert.doesNotThrow(()=>art.validateSlideSourceMap(plans,sections.slice(0,2),{sample:false}));
  assert.throws(()=>art.validateSlideSourceMap(plans,sections,{sample:false}),/cover/);
  assert.doesNotThrow(()=>art.validateSlideSourceMap(plans,sections,{sample:false,remainingSourceIds:['s3','s4']}));
});
test('the selected template renders exactly three distinct source-bound sample pages with all notes',()=>{
  const brief={format:'Webinar presentation',title:'A Source-Based Lesson',productDraft:'## First Decision\n\nChoose a clear visitor action before building the website.\n\n### Presenter notes\n\nExplain the first decision and its limits.\n\n## Compare Journeys\n\nCompare contact, form submission and payment confirmation.\n\n### Presenter notes\n\nExplain that these are independent alternatives.'};
  const source=readConceptSections(brief),plans=[source[0],source[0],source[1]].map((s,i)=>({id:'editorial-page-'+i,sourceId:s.id,purpose:['Choose an action.','Determine essential features.','Compare the journeys.'][i],headline:['Choose One Action','Build What Matters','Compare Visitor Journeys'][i],onSlideText:['Contact'],sourceAudience:s.audience,originalNotes:s.notes,notes:s.notes,visualAnchors:[{source:s.audience.slice(0,25),depiction:'A specific visitor action is illustrated.'},{source:s.notes,depiction:'A deliberate source-specific distinction.'}],visualMode:'Source-specific illustration',artworkPrompt:'A separate original illustration that explains this exact source decision.',composition:{layout:'image-top',headline:{x:80,y:75,width:1100,fontSize:64},copy:{x:80,y:590,width:1100,fontSize:25},image:{x:320,y:180,width:640,height:360}},artwork:{id:'actual-'+i,url:'/slide-assets/actual-'+i,mimeType:'image/png',width:1600,height:900}}));
  const production={id:'sample-job',policyVersion:SLIDE_POLICY_VERSION,mode:'concepts',conceptId:'editorial',status:'ready',sourceFingerprint:fullSourceFingerprint(brief,''),concepts:[{conceptId:'editorial',slides:plans}],complete:true,remainingSourceIds:[]};
  const pages=renderConceptSlides(brief,'editorial',{production});assert.equal(pages.length,3);assert.equal(new Set(pages.map(p=>p.planId)).size,3);
  for(let i=0;i<3;i++){assert.ok(pages[i].notes.includes(plans[i].purpose));assert.ok(pages[i].notes.includes(plans[i].sourceAudience));assert.ok(pages[i].notes.includes(plans[i].originalNotes));assert.ok(pages[i].emptyRatio>=.4);}
  const images=Object.fromEntries(plans.map(p=>[p.artwork.id,'data:image/png;base64,aGVsbG8=']));assert.equal(renderCanvaTransfer({brief,conceptId:'editorial',production,assetData:{images}}).pages.length,3);
});
