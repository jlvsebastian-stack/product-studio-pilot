// Shared structural checks only. Human approval remains explicit project data.
function visibleLines(text){
  const result=[];let fence;
  for(const [index,line]of String(text||'').replace(/\r/g,'').split('\n').entries()){
    const marker=/^ {0,3}(`{3,}|~{3,})/.exec(line);
    if(marker){if(!fence)fence={character:marker[1][0],length:marker[1].length};else if(marker[1][0]===fence.character&&marker[1].length>=fence.length)fence=undefined;continue;}
    if(!fence)result.push({line,index});
  }
  return result;
}
export function expandedOutlineSections(text){
  if(typeof text!=='string')return [];
  const lines=text.replace(/\r/g,'').split('\n'),headings=visibleLines(text).flatMap(({line,index})=>{const match=/^ {0,3}##[ \t]+(\S.*)$/.exec(line);return match?[{heading:match[1].trim(),index}]:[];});
  return headings.map(({heading,index},at)=>({heading,body:lines.slice(index+1,headings[at+1]?.index).join('\n').trim()}));
}
export function expandedOutlineValid(text){
  if(typeof text!=='string'||text.length>60000)return false;
  const sections=expandedOutlineSections(text);if(!sections.length||new Set(sections.map(section=>section.heading)).size!==sections.length)return false;
  return sections.every(section=>{const lines=visibleLines(section.body).map(item=>item.line),detail=lines.filter(line=>!/^\s*#{1,6}\s/.test(line)).join(' ');return lines.some(line=>/^ {0,3}###[ \t]+\S/.test(line))&&(detail.match(/[\p{L}\p{N}]+/gu)||[]).length>=6;});
}
export function outlineApprovalCurrent(project){const outline=project?.brief?.outline;return typeof outline==='string'&&outline.trim().length>0&&outline.length<=12000&&project.approvedOutline===outline;}
export function expandedOutlineApprovalCurrent(project){return outlineApprovalCurrent(project)&&expandedOutlineValid(project.expandedOutline)&&project.expandedOutline===project.approvedExpandedOutline;}
export function manuscriptHeadings(brief={}){
  const draft=brief.productDraft||'',title=brief.title||'',normalized=value=>value.toLocaleLowerCase().replace(/\s+/g,' ').trim(),headings=expandedOutlineSections(draft.replace(/^#[ \t]+/gm,'## ')).map(section=>section.heading);
  if(/^#[ \t]+/.test(draft.trimStart())&&title.trim()&&normalized(headings[0]||'')===normalized(title))headings.shift();return headings;
}
export function expandedOutlineCovered(project){
  if(!expandedOutlineApprovalCurrent(project))return false;
  const planned=expandedOutlineSections(project.approvedExpandedOutline).map(section=>section.heading),drafted=manuscriptHeadings(project.brief);
  return drafted.length===planned.length&&planned.every((heading,index)=>drafted[index]===heading);
}
export function outlineStatus(project){if(!outlineApprovalCurrent(project))return 'basic-pending';if(!project.expandedOutline?.trim())return 'expanded-missing';if(!expandedOutlineValid(project.expandedOutline))return 'expanded-invalid';return expandedOutlineApprovalCurrent(project)?'approved':'expanded-pending';}

// Content progress only: a drafted section is not an approved section or a finished file.
export function creationProgress(project){
  if(!expandedOutlineApprovalCurrent(project))return {total:0,approved:0,drafted:0,next:'',pending:false,sections:[]};
  const headings=expandedOutlineSections(project.approvedExpandedOutline).map(section=>section.heading),draft=project.brief.productDraft||'',approvedDraft=project.approvedDraft||'',drafted=manuscriptHeadings(project.brief),approved=manuscriptHeadings({...project.brief,productDraft:approvedDraft});
  const aligned=drafted.length<=headings.length&&drafted.every((heading,index)=>heading===headings[index])&&approved.length<=drafted.length&&approved.every((heading,index)=>heading===headings[index])&&draft.startsWith(approvedDraft),pending=draft!==approvedDraft;
  return {total:headings.length,approved:aligned?approved.length:0,drafted:aligned?drafted.length:0,pending,next:aligned&&!pending?headings[drafted.length]||'':'',sections:headings.map((heading,index)=>({heading,status:aligned&&index<approved.length?'Approved':aligned&&index<drafted.length?'Review draft':'Planned'}))};
}
