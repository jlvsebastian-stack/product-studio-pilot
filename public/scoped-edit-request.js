// A named section can precede factual feedback before the actual edit command.
export function namedSectionEditRequest(current,input){
  const prefix=/^(?:in|within|for)\s+(?:(?:the|this|that|my|our)\s+)?(?:(?:section|unit|slide|chapter|lesson)\s+(?:(?:named|called)\s+)?)?(?:"([^"]+)"|“([^”]+)”|‘([^’]+)’|'([^']+)'|`([^`]+)`)(?:\s+(?:exercise|section|unit|slide|chapter|lesson))?\s*[,:]\s*([\s\S]+)$/i.exec(String(input).trim());
  if(!prefix)return null;
  const heading=prefix.slice(1,6).find(value=>value!==undefined),body=prefix[6];
  let fence,offset=0;const headings=[];
  for(const chunk of String(current).split(/(?<=\n)/)){
    const line=chunk.replace(/\r?\n$/,'');
    const marker=/^ {0,3}(`{3,}|~{3,})/.exec(line);
    if(marker){if(!fence)fence=marker[1];else if(marker[1][0]===fence[0]&&marker[1].length>=fence.length)fence=undefined;}
    else if(!fence){const match=/^ {0,3}(#{1,2})[ \t]+(.+)$/.exec(line);if(match)headings.push({title:match[2].trim(),level:match[1].length,start:offset});}
    offset+=chunk.length;
  }
  const matches=headings.filter(value=>value.level===2&&value.title===heading);
  if(matches.length!==1)return null;
  const action=/(?:^|[.!]\s+)((?:please\s+)?(?:(?:can|could|would|will)\s+you\s+(?:please\s+)?)?(?:change|replace|rewrite|simplify|shorten|edit|reword|fix)\s+(?:only|just)\s+[\s\S]+)$/i.exec(body);
  if(!action)return null;
  const instruction=action[1],intro=body.slice(0,body.length-instruction.length),unquoted=(intro+' '+instruction).replace(/"[^"]*"|“[^”]*”|‘[^’]*’|'[^']*'|`[^`]*`/g,' ');
  if(/\?|\b(?:if|unless|earlier|previously|historically|hypothetically|(?:I|we) (?:said|asked|wrote|used to)|do not|don't|don’t|not (?:now|yet)|for reference only)\b/i.test(unquoted))return null;
  const target=instruction.replace(/^(?:please\s+)?(?:(?:can|could|would|will)\s+you\s+(?:please\s+)?)?\w+\s+(?:only|just)\s+/i,'').split(/\b(?:with|as|into|using)\b/i,1)[0];
  if(!/\b(?:table|excerpt|paragraph|sentence|passage|line|bullet|wording)\b/i.test(target)||/\b(?:author|metadata|listing copy|product title|whole product|entire product)\b/i.test(target))return null;
  if(/\b(?:first|second|third|fourth|fifth|sixth|last|\d+(?:st|nd|rd|th)?)\s+(?:paragraph|sentence|line|bullet)\b|\b(?:paragraph|sentence|line|bullet)\s+\d+\b/i.test(target)||/^["“‘'`]/.test(target.replace(/^(?:the|this|that)\s+/i,'')))return {heading,instruction};
  const scope=matches[0],end=headings[headings.indexOf(scope)+1]?.start??current.length,text=current.slice(scope.start,end),label=/\bV\d+(?=\s+table\b)|\b(?:Table|Example)\s+(?:[A-Z]|\d+)\b/i.exec(target);
  const unclear=()=>({heading,instruction,error:'Quote the exact table and explanation to change; their current source locations are not unique.'});
  if(!label)return unclear();
  const tables=[...text.matchAll(/^\|[^\r\n]+\r?\n\|[ \t:|-]+\r?\n(?:\|[^\r\n]+(?:\r?\n|$))+/gm)].filter(table=>[...text.slice(0,table.index).matchAll(/\bV\d+\b|\b(?:Table|Example)\s+(?:[A-Z]|\d+)\b/gi)].at(-1)?.[0].toUpperCase()===label[0].toUpperCase());
  if(tables.length!==1)return unclear();
  const table=tables[0],fragments=[table];
  if(/\b(?:explanation|paragraph)\b/i.test(target)){
    if(!/(?:explanation|paragraph)[\s\S]*\b(?:repeat\w*|repetition)\b/i.test(target))return unclear();
    const sentences=[...text.matchAll(/[^\n.!?]+[.!?](?=\s|$)/g)].filter(sentence=>sentence.index>table.index+table[0].length&&/\b(?:avoid\w*\s+repeat\w*|repetition)\b/i.test(sentence[0])&&/\b(?:table|row|example)\b/i.test(sentence[0]));
    if(sentences.length!==1)return unclear();fragments.push(sentences[0]);
  }
  const ranges=fragments.map(match=>({start:scope.start+match.index,end:scope.start+match.index+match[0].trimEnd().length}));
  return {heading,instruction,ranges};
}
