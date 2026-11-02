import {namedSectionEditRequest} from '../public/scoped-edit-request.js';
// Provider edits are applied to the retained source, never to a model's copy.
export const EDIT_BEFORE_LIMIT=4000,EDIT_AFTER_LIMIT=6000,EDIT_TOTAL_LIMIT=12000,APPEND_LIMIT=12000;
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
export const manuscriptEditJsonSchema={...object({replacements:{type:'array',maxItems:3,items:object({before:{type:'string',minLength:1,maxLength:EDIT_BEFORE_LIMIT},after:{type:'string',maxLength:EDIT_AFTER_LIMIT}})},append:{type:['string','null'],maxLength:APPEND_LIMIT}}),type:['object','null']};

function boundaries(text){
  const starts=[];let offset=0,fence;
  for(const line of text.split(/(?<=\n)/)){const value=line.replace(/\r?\n$/,'');const marker=/^ {0,3}(`{3,}|~{3,})/.exec(value);if(marker){if(!fence)fence={char:marker[1][0],length:marker[1].length};else if(marker[1][0]===fence.char&&marker[1].length>=fence.length)fence=undefined;}else if(!fence&&/^ {0,3}#{1,2}[ \t]+\S/.test(value))starts.push(offset);offset+=line.length;}
  return starts;
}
const sectionAt=(starts,offset)=>starts.findLastIndex(start=>start<=offset);
function requestedRange(current,input,title=''){
  if(!input?.trim())return null;
  if(/^(?:earlier|previously|historically|for reference|i (?:said|asked|wrote|used to))\b/i.test(input.trim()))return {error:'Historical context is not a current source-edit request.'};
  const starts=boundaries(current),sections=starts.map((start,index)=>({start,end:starts[index+1]??current.length,title:current.slice(start).split(/\r?\n/,1)[0].replace(/^\s*#{1,2}\s+/,''),level:/^\s*##\s/.test(current.slice(start))?2:1}));
  const selectable=sections.filter((section,index)=>!(index===0&&section.level===1&&section.title.toLocaleLowerCase()===title.trim().toLocaleLowerCase()));
  const namedRequest=namedSectionEditRequest(current,input),reviewed=input.trim().replace(/^(?:I|We)\s+(?:reviewed|checked|read)\s+(?:(?:the|this|your|our)\s+)?(?:PDF|sample|draft|preview|presentation|slides|product)[.!]\s+/i,''),prefix=!namedRequest&&/^(?:in|within|for)\s+([^\r\n,:]{1,240})\s*[,:]\s*(.+)$/i.exec(reviewed);let instruction=namedRequest?.instruction||reviewed,prefixScope=namedRequest?selectable.find(section=>section.level===2&&section.title===namedRequest.heading):undefined;
  if(namedRequest?.error)return {error:namedRequest.error};
  if(namedRequest?.ranges)return {...prefixScope,ranges:namedRequest.ranges};
  if(prefix){
    const locator=prefix[1].replace(/^(?:the|this|that|my|our)\s+/i,'').trim(),quoted=/^(?:"([^"]+)"|“([^”]+)”|‘([^’]+)’|'([^']+)'|`([^`]+)`)(?:\s+(?:exercise|section|unit|slide|chapter|lesson))?$/i.exec(locator),names=quoted?[quoted.slice(1).find(value=>value!==undefined)]:[locator,locator.replace(/\s+(?:exercise|section|unit|slide|chapter|lesson)$/i,'')],matches=selectable.filter(section=>names.some(name=>name.toLocaleLowerCase()===section.title.trim().toLocaleLowerCase()));
    if(matches.length!==1)return {error:'Identify one existing named source section for this edit.'};prefixScope=matches[0];instruction=prefix[2].trim();
  }
  const action=/^(?:please\s+)?(?:(?:can|could|would|will)\s+you\s+(?:please\s+)?)?(?:change|replace|rewrite|simplify|shorten|edit|reword|fix)\b\s*/i.exec(instruction);
  if(!action)return prefix||reviewed!==input.trim()?{error:'The named section needs a current explicit source-edit instruction.'}:null;let target=instruction.slice(action[0].length).replace(/^(?:(?:only|just)\s+)+/i,'');const quote=/"([^"]+)"|“([^”]+)”|‘([^’]+)’|(?<![\p{L}\p{N}])'([^']+)'|`([^`]+)`/u.exec(target);
  const unquoted=target.replace(/"[^"]*"|“[^”]*”|'[^']*'|‘[^’]*’|`[^`]*`/g,' '),polite=/^(?:please\s+)?(?:can|could|would|will)\s+you\b/i.test(instruction);
  // Explaining an if-scenario is content; making the edit depend on later permission is not.
  const conditionalPermission=[...unquoted.matchAll(/\b(?:if|unless)\b/gi)].some(match=>!/\b(?:to|and)\s+(?:explain|show|describe|teach|cover|demonstrate|include|add|mention)\b[^.!?\n]*$/i.test(unquoted.slice(0,match.index))||/^(?:if|unless)\s+(?:(?:we|I|you)\s+(?:(?:have|had|get|obtain|receive)\s+(?:(?:more|new|enough|sufficient|the|my|our|your|explicit)\s+)*(?:approval|permission|evidence|confirmation)\b|(?:(?:can|could|will|would)\s+)?(?:approve|agree|confirm|consent|authorize)\b)|(?:(?:the|my|our|your)\s+)?(?:approval|permission|evidence|confirmation)\b)/i.test(unquoted.slice(match.index)));
  if((polite?unquoted.replace(/\?\s*$/,''):unquoted).includes('?')||conditionalPermission||/\b(?:not (?:now|yet)|for reference only|hypothetically)\b/i.test(unquoted))return {error:'A question, conditional or historical example is not current permission to revise source.'};
  if(/^(?:(?:only|just|the|my|our|creator)\s+)*(?:author(?:\s+(?:field|name))?|listing\s+copy|product\s+title|metadata)\b/i.test(target))return {error:'The requested metadata target does not authorize manuscript changes.'};
  if(quote&&!/\b(?:to|with|as|into|using)\s*$/i.test(target.slice(0,quote.index))){const value=quote.slice(1).find(part=>part!==undefined);if(/^\s*(?:and|or|,|&|\/)\s*["“‘'`]/i.test(target.slice(quote.index+quote[0].length)))return {error:'Choose one requested source section for this edit.'};const headings=!prefixScope?selectable.filter(section=>section.level===2&&section.title===value):[];if(headings.length>1)return {error:'The requested quoted heading is ambiguous; identify one source section.'};if(headings.length===1)return headings[0];const region=prefixScope||{start:0,end:current.length},text=current.slice(region.start,region.end),local=text.indexOf(value);if(local<0)return {error:'The requested quoted target was not found in the selected source; identify the current passage exactly.'};if(text.indexOf(value,local+1)>=0)return {error:'The requested quoted target is ambiguous; include its unique surrounding text.'};const at=region.start+local,heading=!prefixScope&&selectable.find(section=>section.title===value);return heading||{start:at,end:at+value.length,...(prefixScope?{anchorRegion:prefixScope}:{})};}
  for(const separator of target.matchAll(/\b(?:to|with|as|into|using)\b/gi)){if(!selectable.some(section=>{const at=target.toLocaleLowerCase().indexOf(section.title.toLocaleLowerCase());return at>=0&&at<=separator.index&&at+section.title.length>separator.index;})){target=target.slice(0,separator.index);break;}}
  const ordinal=value=>{const words={first:0,second:1,third:2,fourth:3,fifth:4,sixth:5,last:-1};return value.toLowerCase() in words?words[value.toLowerCase()]:parseInt(value,10)-1;};
  const choose=(items,value)=>{const index=ordinal(value);return items[index<0?items.length-1:index]||{error:'The requested target position does not exist in this source.'};};
  const unit=/(?:\b(first|second|third|fourth|fifth|sixth|last|\d+(?:st|nd|rd|th)?)\s+(?:section|slide|unit)\b|\b(?:section|slide|unit)\s+(\d+)\b)/i.exec(target);
  let scope=prefixScope||(unit?choose(selectable,unit[1]||unit[2]):null);if(scope?.error)return scope;
  if(!scope){const lower=target.toLocaleLowerCase(),named=selectable.filter(section=>lower.includes(section.title.toLocaleLowerCase())).sort((a,b)=>b.title.length-a.title.length);if(named.length){if(named.some(section=>!named[0].title.toLocaleLowerCase().includes(section.title.toLocaleLowerCase())))return {error:'Choose one requested source section for this edit.'};scope=named[0];}}
  const region=scope||{start:0,end:current.length},text=current.slice(region.start,region.end);
  if(/\b(?:(?:presenter|speaker)\s+)?notes\b/i.test(target)){const matches=[...text.matchAll(/^###\s+(?:presenter|speaker) notes[^\r\n]*\r?\n/gim)];if(matches.length!==1)return {error:'Identify the source slide whose presenter notes should change.'};const start=region.start+matches[0].index,next=starts.find(at=>at>start);return {start,end:Math.min(region.end,next??current.length)};}
  const part=/\b(first|second|third|fourth|fifth|sixth|last|\d+(?:st|nd|rd|th)?)\s+(paragraph|sentence|line|bullet)\b|\b(paragraph|sentence|line|bullet)\s+(\d+)\b/i.exec(target);
  if(!part)return scope||(/\b(?:paragraph|sentence|section|slide|unit|line|bullet|passage|question)\b/i.test(target)?{error:'Identify the requested target with its exact quote, named section or passage number.'}:null);
  const kind=(part[2]||part[3]).toLowerCase(),value=part[1]||part[4],paragraphs=[];let block;
  for(const match of text.matchAll(/[^\n]*(?:\n|$)/g)){const line=match[0].replace(/\r?\n$/,'');if(!line.trim()||/^\s*#{1,6}\s|^\s*(?:```|~~~)/.test(line)){if(block){paragraphs.push(block);block=undefined;}continue;}if(!block)block={start:region.start+match.index,end:region.start+match.index+line.length};else block.end=region.start+match.index+line.length;if(kind==='line'||kind==='bullet'){if(kind==='line'||/^\s*(?:[-*+]|\d+[.)])\s/.test(line))paragraphs.push({...block});block=undefined;}}
  if(block)paragraphs.push(block);
  if(kind!=='sentence')return choose(paragraphs,value);
  const sentences=paragraphs.flatMap(paragraph=>[...current.slice(paragraph.start,paragraph.end).matchAll(/[^.!?]+[.!?]*(?:\s+|$)/g)].filter(match=>match[0].trim()).map(match=>({start:paragraph.start+match.index,end:paragraph.start+match.index+match[0].length})));return choose(sentences,value);
}
export function applyManuscriptEdit(current,edit,{revisionIntent=false,currentInput='',title='',appendHeading='',sampleSection=false}={}){
  if(edit===null||edit===undefined)return {draft:current};
  const hold=error=>({draft:current,error:'The manuscript is unchanged. '+error});
  if(!edit||typeof edit!=='object'||Array.isArray(edit)||Object.keys(edit).some(key=>!['replacements','append'].includes(key))||!Array.isArray(edit.replacements)||edit.replacements.length>3||!(edit.append===null||typeof edit.append==='string'))return hold('Use one bounded exact-text edit or append.');
  const replacements=edit.replacements,append=edit.append||'';
  if(append.length>APPEND_LIMIT||append&&replacements.length)return hold('Keep replacement and append operations separate and bounded.');
  if(append){const added=boundaries(append),cover=sampleSection&&!current.trim()&&added.length===2&&append.slice(added[0],added[1]).trim()==='# '+title.trim(),unit=cover?1:0;if(!appendHeading||added.length!==unit+1||append.slice(0,added[0]).trim()||append.slice(added[unit]).split(/\r?\n/,1)[0].replace(/^\s*#{1,2}\s+/,'').trim()!==appendHeading)return hold('Append requires the authorized initial sample or next undrafted unit in order; review the approved expanded outline and use the drafting action.');const draft=current+append;return draft.length<=90000?{draft,kind:'append'}:hold('The proposed append exceeds the manuscript field limit.');}
  if(!replacements.length)return {draft:current};
  if(!revisionIntent)return hold('An explicit targeted revision is required; approved text and unapproved passages are retained.');
  const selection=requestedRange(current,currentInput,title);if(selection?.error)return hold(selection.error);
  const starts=boundaries(current),ranges=[];let total=0,section;
  for(const replacement of replacements){
    if(!replacement||typeof replacement!=='object'||Object.keys(replacement).some(key=>!['before','after'].includes(key))||typeof replacement.before!=='string'||!replacement.before.length||replacement.before.length>EDIT_BEFORE_LIMIT||typeof replacement.after!=='string'||replacement.after.length>EDIT_AFTER_LIMIT)return hold('Each replacement needs a short exact before anchor and bounded after text.');
    const {before,after}=replacement;total+=before.length+after.length;if(total>EDIT_TOTAL_LIMIT)return hold('This change is too broad for a focused edit.');
    const region=selection?.anchorRegion||{start:0,end:current.length},text=current.slice(region.start,region.end),local=text.indexOf(before);if(local<0)return hold('The exact before anchor was not found in the requested source. Retry with the existing passage verbatim.');const start=region.start+local;
    if(text.indexOf(before,local+1)>=0)return hold('The before anchor is ambiguous. Include nearby unchanged text to identify one passage.');
    const end=start+before.length,target=sectionAt(starts,start);if(starts.some(at=>at>start&&at<end)||section!==undefined&&section!==target)return hold('A focused edit cannot cross manuscript sections or change another section.');
    if(selection?.ranges){let left=0,right=0;while(left<before.length&&left<after.length&&before[left]===after[left])left++;while(right<before.length-left&&right<after.length-left&&before[before.length-1-right]===after[after.length-1-right])right++;if(!selection.ranges.some(range=>start+left>=range.start&&end-right<=range.end))return hold('The patch changes text outside the requested table or explanation. Keep other source text unchanged.');}
    const wholeSample=sampleSection&&current.includes('\n')&&starts.length===1&&selection?.level===2&&selection.start===0&&selection.end===current.length&&boundaries(after).length===1&&after.startsWith(current.slice(0,current.indexOf('\n')+1));
    if(before===current&&starts.length&&!wholeSample||boundaries(after).length>boundaries(before).length)return hold('A focused edit cannot replace the whole product or add source sections. Use the explicit drafting action instead.');
    if(ranges.some(range=>start<range.end&&end>range.start))return hold('Replacement anchors overlap; retry one independent passage.');
    section=target;ranges.push({start,end,after});
  }
  let draft=current;for(const range of ranges.sort((a,b)=>b.start-a.start))draft=draft.slice(0,range.start)+range.after+draft.slice(range.end);
  if(selection&&(draft.length<selection.start+current.length-selection.end||!draft.startsWith(current.slice(0,selection.start))||!draft.endsWith(current.slice(selection.end))))return hold('The patch falls outside the requested target selection. Retry only that passage or section.');
  return draft.length<=90000?{draft,kind:'replace'}:hold('The proposed edit exceeds the manuscript field limit.');
}

// Compatibility for existing string fixtures: infer one bounded contiguous diff
// and send it through the same anchor/section/authority checks as the new wire.
export function legacyManuscriptEdit(current,proposed,{revisionIntent=false}={}){
  if(proposed===current)return null;
  if(proposed.startsWith(current)){const tail=proposed.slice(current.length);if(revisionIntent&&current.trim()&&!boundaries(tail).length){const start=current.lastIndexOf('\n',current.trimEnd().length-1)+1;return {replacements:[{before:current.slice(start),after:current.slice(start)+tail}],append:null};}return {replacements:[],append:tail};}
  let prefix=0;while(prefix<current.length&&prefix<proposed.length&&current[prefix]===proposed[prefix])prefix++;
  let suffix=0;while(suffix<current.length-prefix&&suffix<proposed.length-prefix&&current[current.length-1-suffix]===proposed[proposed.length-1-suffix])suffix++;
  const start=prefix===0?0:current.lastIndexOf('\n',prefix-1)+1,diffEnd=current.length-suffix,nextLine=current.indexOf('\n',diffEnd),end=nextLine<0?current.length:nextLine;
  return {replacements:[{before:current.slice(start,end),after:proposed.slice(start,proposed.length-(current.length-end))}],append:null};
}
