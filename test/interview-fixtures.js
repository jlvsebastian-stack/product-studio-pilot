import {expandedOutlineSections} from '../public/outline-plan.js';

// Existing safeguard tests explicitly start after human plan approval. The
// separate outline-plan suite tests absent/stale approvals and unknown units.
export function fixtureHeadings(brief){const headings=expandedOutlineSections((brief.productDraft||'').replace(/^#[ \t]+/gm,'## ')).map(section=>section.heading);if(/^#[ \t]+/.test((brief.productDraft||'').trimStart())&&brief.title&&headings[0]?.toLowerCase()===brief.title.toLowerCase())headings.shift();return headings;}
export function withApprovedOutline(input,extraHeadings=[]){
  if(input.interviewStage<9)return input;
  const basic=(input.brief.outline||'').split('\n').map(line=>line.replace(/^\s*(?:#+|[-*]|\d+[.)])\s*/,'').trim()).filter(Boolean),headings=[...new Set([...fixtureHeadings(input.brief),...extraHeadings,...basic])];
  if(!headings.length)headings.push('The planned reader action');
  const outline=input.brief.outline||headings.join('\n'),expandedOutline=headings.map(heading=>'## '+heading+'\n\n### Purpose\n\nExplain this planned reader action with its concrete example and usable result.\n\n### Key points and practice\n\nDemonstrate the action, let the reader apply it, then check the result.').join('\n\n');
  return {...input,brief:{...input.brief,outline},approvedOutline:outline,expandedOutline,approvedExpandedOutline:expandedOutline};
}
