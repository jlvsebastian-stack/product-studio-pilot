import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MAX_SLIDE_WORDS,SLIDE_POLICY_VERSION,slideWordCount,titleCase,isTitleCase} from '../public/slide-policy.js';
test('titles and labels share a strict fourteen-word budget using actual Unicode words',()=>{
  assert.equal(MAX_SLIDE_WORDS,14);assert.equal(SLIDE_POLICY_VERSION,3);
  assert.equal(slideWordCount('Choose Your Website’s Job — Awareness → Lead Capture → Direct Sales'),9);
  assert.equal(slideWordCount('one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen'),15);
});
test('title case capitalizes each word without corrupting acronyms, brands or possessives',()=>{
  assert.equal(titleCase('choose your website’s job'),'Choose Your Website’s Job');
  assert.equal(titleCase('AI for chatgpt and API setup'),'AI For ChatGPT And API Setup');
  assert.equal(titleCase('follow-up with paymongo'),'Follow-Up With PayMongo');
  assert.equal(isTitleCase('Choose Your Website’s Job'),true);assert.equal(isTitleCase('Choose your website’s job'),false);
});

test('Title Case preserves meaningful mixed-case names, digit acronyms and their possessives',()=>{
  assert.equal(titleCase('use OpenAI and TikTok for B2B'),'Use OpenAI And TikTok For B2B');
  assert.equal(titleCase('learn WebFlowX with GPT4 and CAPI'),'Learn WebFlowX With GPT4 And CAPI');
  assert.equal(titleCase('use ChatGPT’s answers and OpenAI’s tools'),'Use ChatGPT’s Answers And OpenAI’s Tools');
});
