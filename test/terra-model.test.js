import test from 'node:test';
import assert from 'node:assert/strict';
import {modelCatalog,modelOptions} from '../src/models.js';

test('Terra supports exact Medium to Extra High without replacing the selected Sol model',()=>{
  assert.equal(modelCatalog.chatgpt.find(model=>model.id==='gpt-6.1-terra')?.label,'GPT-6.1 Terra');
  for(const reasoningEffort of ['medium','high','xhigh'])assert.deepEqual(modelOptions('chatgpt',{model:'gpt-6.1-terra',reasoningEffort}),{model:'gpt-6.1-terra',reasoningEffort});
  assert.deepEqual(modelOptions('chatgpt',{model:'gpt-6.1-sol',reasoningEffort:'medium'}),{model:'gpt-6.1-sol',reasoningEffort:'medium'});
  assert.throws(()=>modelOptions('claude',{model:'gpt-6.1-terra'}));
});
