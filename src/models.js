// Selection is explicit; this catalog does not prove an account can use a model.
export const modelCatalog={
  chatgpt:[{id:'gpt-6.1-sol',label:'GPT-6.1 Sol',recommended:false},{id:'gpt-6-astra',label:'GPT-6 Astra',recommended:true}],
  claude:[{id:'claude-sonnet-5-5',label:'Claude Sonnet 5.5',recommended:true},{id:'claude-opus-5-5',label:'Claude Opus 5.5',recommended:false}]
};
export function modelOptions(provider,{model,reasoningEffort='medium'}={}){
  const available=modelCatalog[provider];
  if(!available)throw new Error('Choose ChatGPT or Claude.');
  const selected=model===undefined?available.find(item=>item.recommended).id:model;
  if(!available.some(item=>item.id===selected))throw new Error('Choose a model offered for the selected AI provider.');
  if(!['medium','high','xhigh'].includes(reasoningEffort))throw new Error('Choose Medium, High, or Extra high quality.');
  return {model:selected,reasoningEffort};
}
