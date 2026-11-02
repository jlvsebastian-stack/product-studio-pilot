import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createGoogleProducer} from '../src/google-producer.js';
import {freshProject} from '../src/product.js';
const brief={...freshProject().brief,title:'Useful Handoff Kit',format:'Template kit',productDraft:'## Handoff\n\nUse the exact approved file.\n\n| Task | Done |\n| --- | --- |\n| Find file | Check version |'};
const payload=()=>({brief:{...brief},approvedSource:brief.productDraft,destination:'docs',provider:'chatgpt',model:'gpt-6.1-sol',reasoningEffort:'medium'});
const providers={status:async()=>({ready:true}),checkModel:async()=>({available:true})};
const nativeDoc=(text='\n')=>({documentId:'doc123',title:brief.title,revisionId:'blank-revision',body:null,tabs:[{tabId:'t.0',title:'Tab 1',body:{content:[{sectionBreak:{}},{paragraph:{paragraphStyle:{namedStyleType:'NORMAL_TEXT'},elements:[{textRun:{content:text}}]}}]},namedStyles:{styles:[{namedStyleType:'HEADING_1'},{namedStyleType:'HEADING_2'}]}}]});
const fullDoc=()=>{const doc=nativeDoc('Handoff\n');doc.tabs[0].body.content[1].paragraph.paragraphStyle.namedStyleType='HEADING_1';doc.tabs[0].body.content.push({table:{rows:2,columns:2}});return doc;};
const metadata=()=>({id:'doc123',name:brief.title,mimeType:'application/vnd.google-apps.document',shared:false});
const nativeText=()=>({documentId:'doc123',paragraphs:[{text:'Handoff\n'},{text:'Use the exact approved file.\n'},{text:'Task\n'},{text:'Done\n'},{text:'Find file\n'},{text:'Check version\n'}]});
async function finish(manager,id){for(let i=0;i<200;i++){const result=manager.status(id);if(result.status!=='running')return result;await new Promise(resolve=>setTimeout(resolve,5));}throw Error('Recovery did not finish');}
function emit(config,tool,args,data){config.onTool({tool:'google_drive.'+tool,arguments:args,lifecycle:'item/started'});config.onTool({tool:'google_drive.'+tool,arguments:args,lifecycle:'item/completed',result:{content:[{type:'text',text:'Native read completed.'}],structuredContent:data}});}
const failCreate=config=>({run:async()=>{config.onTool({tool:'google_drive.create_file',arguments:{title:brief.title,mime_type:'application/vnd.google-apps.document',parent_folder_id:null},lifecycle:'item/started'});throw Error('Connection ended after create started');},respond(){},close:async()=>{}});
const request=(id,tool,args)=>({id,params:{message:'google_drive.'+tool+' requires confirmation',_meta:{codex_approval_kind:'mcp_tool_call',tool_params:args}}});

test('held Sheet rechecks the same file read-only and reopens its persisted receipt without recreating it',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'studio-sheet-recheck-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const data={...payload(),destination:'sheets',brief:{...brief,format:'Spreadsheet'}};let attempt=0;
  const manager=createGoogleProducer({providers,directory,createSession:config=>({run:async prompt=>{
    if(++attempt===1){emit(config,'create_file',{title:brief.title,mime_type:'application/vnd.google-apps.spreadsheet'},{fileId:'sheet123'});throw Error('Readback interrupted');}
    assert.match(prompt,/READ-ONLY/);assert.doesNotMatch(prompt,/Create exactly ONE/);
    for(const tool of ['create_file','batch_update_spreadsheet'])assert.equal(config.onApproval(request(1,tool,tool==='create_file'?{title:brief.title,mime_type:'application/vnd.google-apps.spreadsheet'}:{spreadsheet_id:'sheet123',requests:[{updateCells:{}}]})),false);
    assert.equal(config.onApproval(request(2,'get_spreadsheet_metadata',{spreadsheet_id:'other123'})),false);
    emit(config,'get_file_metadata',{fileId:'sheet123'},{id:'sheet123',name:brief.title,mimeType:'application/vnd.google-apps.spreadsheet',shared:false});
    emit(config,'get_spreadsheet_metadata',{spreadsheet_id:'sheet123'},{spreadsheetId:'sheet123',properties:{title:brief.title},sheets:[{properties:{title:'Quote',sheetId:0}}]});
    emit(config,'get_spreadsheet_cells',{spreadsheet_id:'sheet123',ranges:["'Quote'!A1:B2"],cell_fields:'userEnteredValue,effectiveValue,formattedValue'},{sheets:[{properties:{title:'Quote'},data:[{rowData:[{values:[{userEnteredValue:{formulaValue:'=1+1'},effectiveValue:{numberValue:2},formattedValue:'2'},{userEnteredValue:{formulaValue:'=IF(A2="","",A2)'}}]}]}]}]});
  },respond(){},close:async()=>{}})});
  const held=await finish(manager,(await manager.start(data)).id),body={...data,id:held.id};
  await assert.rejects(manager.recheck({...body,approvedSource:'stale'}),/approved source/);
  await assert.rejects(manager.recheck({...body,model:'gpt-6-astra'}),/model and quality/);
  const result=await finish(manager,(await manager.recheck(body)).id);assert.equal(result.status,'ready',result.message);assert.equal(result.file.id,'sheet123');assert.equal(result.verification.formulas,2);
  const reopened=createGoogleProducer({providers,directory,createSession:()=>{throw Error('Reopen must not call AI');}});await reopened.ready;assert.equal(reopened.status(held.id).verified,true);assert.equal((await reopened.start(data)).file.id,'sheet123');assert.equal(attempt,2);
});
test('held creation resumes the same explicit blank native Doc after restart, without a synthetic create receipt or another create call',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'studio-google-recovery-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const first=createGoogleProducer({providers,createSession:failCreate,directory}),held=await finish(first,(await first.start(payload())).id);assert.equal(held.creationAttempted,true);assert.equal(held.file,undefined);
  let writes=0;const calls=[],approvals=[],createSession=config=>({run:async prompt=>{
    assert.match(prompt,/NEVER call create_file/);assert.equal(config.model,'gpt-6.1-sol');assert.equal(config.reasoningEffort,'medium');
    const write={document_url:'doc123',document_id:null,requests:[{insertText:{location:{index:1},text:brief.productDraft}}],write_control:{requiredRevisionId:'blank-revision',targetRevisionId:null}};
    assert.equal(config.onApproval(request(1,'create_file',{title:brief.title,mime_type:'application/vnd.google-apps.document'})),false);
    assert.equal(config.onApproval(request(2,'batch_update_document',write)),false,'a URL is not blank verification');
    calls.push('get_file_metadata');emit(config,'get_file_metadata',{fileId:'doc123',fields:'id,name,mimeType,shared'},metadata());
    calls.push('get_document');emit(config,'get_document',{document_url:'doc123',document_id:null,fields:null},nativeDoc());
    emit(config,'get_document_text',{document_id:'doc123'},{documentId:'doc123',paragraphs:[{text:'\n'}]});
    assert.equal(config.onApproval(request(3,'batch_update_document',{...write,write_control:{requiredRevisionId:'wrong-revision'}})),false);
    assert.equal(config.onApproval(request(4,'batch_update_document',write)),true);
    config.onTool({tool:'google_drive.batch_update_document',arguments:write,lifecycle:'item/started'});
    config.onTool({tool:'google_drive.batch_update_document',arguments:write,lifecycle:'item/completed',result:{isError:true,content:[{type:'text',text:'HTTPError: 400: Invalid JSON payload'}]}});
    assert.equal(config.onApproval(request(5,'batch_update_document',{...write,write_control:null})),false,'a rejected first write does not remove the revision requirement');
    assert.equal(config.onApproval(request(6,'batch_update_document',{...write,write_control:{requiredRevisionId:'changed'}})),false);
    assert.equal(config.onApproval(request(7,'batch_update_document',write)),true);
    emit(config,'batch_update_document',write,{documentId:'doc123',replies:[]});writes++;calls.push('write');
    emit(config,'get_document',{document_id:'doc123'},fullDoc());emit(config,'get_document_text',{document_url:'doc123',document_id:null,tab_id:null},{text:'Handoff Use the exact approved file. Task Done Find file Check version'});
  },respond:id=>approvals.push(id),close:async()=>{}});
  const manager=createGoogleProducer({providers,createSession,directory});await manager.ready;
  const requestData={...payload(),id:held.id,url:'https://docs.google.com/document/d/doc123/edit'};
  await assert.rejects(manager.resume({...requestData,approvedSource:'stale'}),/approved source/);await assert.rejects(manager.resume({...requestData,url:'https://docs.google.com.evil.test/document/d/doc123/edit'}),/exact existing/);await assert.rejects(manager.resume({...requestData,model:'gpt-6-astra'}),/model and quality/);
  const started=await manager.resume(requestData);assert.equal(started.id,held.id);const ready=await finish(manager,held.id);assert.equal(ready.status,'ready',ready.message);assert.equal(ready.file.url,requestData.url);assert.equal(writes,1);assert.deepEqual(calls,['get_file_metadata','get_document','write']);assert.deepEqual(approvals,[4,7]);
  const saved=JSON.parse(await readFile(join(directory,held.id+'.json'),'utf8'));assert.equal(saved.recoveryId,'doc123');assert.equal(saved.recoveryWriteStarted,true);assert.equal(saved.records,undefined,'no invented create receipt is persisted');assert.equal((await manager.start(payload())).id,held.id,'ordinary creation stays deduplicated');
});

test('a definitive atomic Doc 400 can be corrected within the same session; unknown writes and exhausted corrections stop',async t=>{
  for(const kind of ['corrected','uncertain','exhausted','unfinished'])await t.test(kind,async()=>{
    let creates=0,writes=0;
    const manager=createGoogleProducer({providers,createSession:config=>({run:async prompt=>{
      creates++;emit(config,'create_file',{title:brief.title,mime_type:'application/vnd.google-apps.document'},{id:'doc123'});
      const args={document_id:'doc123',requests:[{updateDocumentStyle:{documentStyle:{documentSize:{}},fields:'documentSize'}}]};
      const failed=message=>{config.onTool({tool:'google_drive.batch_update_document',arguments:args,lifecycle:'item/started'});config.onTool({tool:'google_drive.batch_update_document',arguments:args,lifecycle:'item/completed',result:{isError:true,content:[{type:'text',text:message}]}});};
      failed(kind==='uncertain'?'HTTPError: 500: outcome unknown':'HTTPError: 400: Invalid JSON payload');
      if(kind==='exhausted'){failed('HTTPError: 400: Invalid JSON payload');failed('HTTPError: 400: Invalid JSON payload');}
      if(kind==='corrected'){emit(config,'batch_update_document',{document_id:'doc123',requests:[{updateParagraphStyle:{range:{startIndex:1,endIndex:8},paragraphStyle:{namedStyleType:'HEADING_1'},fields:'namedStyleType'}}]},{documentId:'doc123'});writes++;}
      emit(config,'get_document',{document_id:'doc123'},fullDoc());emit(config,'get_document_text',{document_id:'doc123'},nativeText());
    },respond(){},close:async()=>{}})});
    const result=await finish(manager,(await manager.start(payload())).id);
    assert.equal(result.status,kind==='corrected'?'ready':'unavailable',result.message);assert.equal(creates,1);assert.equal(writes,kind==='corrected'?1:0);
  });
});
async function completeButUnstyled(scenario,directory){
  let sessionNumber=0;const native=fullDoc();native.tabs[0].body.content[1].paragraph.paragraphStyle.namedStyleType='NORMAL_TEXT';
  const manager=createGoogleProducer({providers,directory,createSession:config=>({run:async prompt=>{
    sessionNumber++;if(sessionNumber===1){await failCreate(config).run();return;}
    if(sessionNumber===2){emit(config,'get_file_metadata',{fileId:'doc123'},metadata());emit(config,'get_document',{document_id:'doc123'},nativeDoc());emit(config,'get_document_text',{document_id:'doc123'},{paragraphs:[{text:'\n'}]});emit(config,'batch_update_document',{document_id:'doc123',requests:[{insertText:{location:{index:1},text:brief.productDraft}}],write_control:{requiredRevisionId:'blank-revision'}},{documentId:'doc123'});throw Error('Formatting was interrupted after complete copy was written.');}
    await scenario(config,native,prompt);
  },respond(){},close:async()=>{}})});
  const held=await finish(manager,(await manager.start(payload())).id);await finish(manager,(await manager.resume({...payload(),id:held.id,url:'https://docs.google.com/document/d/doc123/edit'})).id);
  return {manager,id:held.id};
}
test('complete existing copy continues as revision-bound format-only work, accepting real style batches while denying all content mutations',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'studio-doc-styles-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  let writes=0;const setup=await completeButUnstyled(async(config,native,prompt)=>{
    assert.match(prompt,/FORMAT-ONLY/);
    emit(config,'get_file_metadata',{fileId:'doc123'},metadata());emit(config,'get_document',{document_id:'doc123'},native);emit(config,'get_document_text',{document_id:'doc123'},nativeText());
    const args=requests=>({document_id:'doc123',requests,write_control:{requiredRevisionId:'blank-revision'}});
    for(const [index,operation]of [{insertText:{location:{index:1},text:'Another copy'}},{insertTable:{rows:1,columns:1,location:{index:1}}},{deleteContentRange:{range:{startIndex:1,endIndex:8}}},{replaceAllText:{containsText:{text:'file'},replaceText:'other'}}].entries())assert.equal(config.onApproval(request(index+10,'batch_update_document',args([operation]))),false);
    const styles=[{updateParagraphStyle:{range:{startIndex:1,endIndex:8,tabId:'t.0'},paragraphStyle:{namedStyleType:'HEADING_1'},fields:'namedStyleType'}},{createParagraphBullets:{range:{startIndex:9,endIndex:20,tabId:'t.0'},bulletPreset:'BULLET_DISC_CIRCLE_SQUARE'}},{updateNamedStyle:{namedStyle:{namedStyleType:'NORMAL_TEXT',textStyle:{weightedFontFamily:{fontFamily:'Lato'}}},fields:'namedStyleType,textStyle.weightedFontFamily',tabId:'t.0'}},{updateTableRowStyle:{tableStartLocation:{index:10,tabId:'t.0'},rowIndices:[0],tableRowStyle:{minRowHeight:{magnitude:20,unit:'PT'}},fields:'minRowHeight'}}];
    assert.equal(config.onApproval(request(20,'batch_update_document',args(styles))),true);
    const many=args(Array.from({length:501},()=>styles[0]));assert.equal(config.onApproval(request(21,'batch_update_document',many)),true);
    assert.equal(config.onApproval(request(23,'batch_update_document',{...many,write_control:{requiredRevisionId:'another-revision'}})),false);
    assert.equal(config.onApproval(request(22,'batch_update_document',args(Array.from({length:1001},()=>styles[0])))),false);
    emit(config,'batch_update_document',many,{documentId:'doc123'});writes++;native.tabs[0].body.content[1].paragraph.paragraphStyle.namedStyleType='HEADING_1';emit(config,'get_document',{document_id:'doc123'},native);emit(config,'get_document_text',{document_id:'doc123'},nativeText());
  },directory);
  const result=await finish(setup.manager,(await setup.manager.resume({...payload(),id:setup.id,url:'https://docs.google.com/document/d/doc123/edit'})).id);assert.equal(result.status,'ready',result.message);assert.equal(writes,1);assert.equal(result.file.id,'doc123');
  const saved=JSON.parse(await readFile(join(directory,setup.id+'.json'),'utf8'));assert.equal(saved.resumeMode,'format');assert.equal(saved.lastRejection.rejectionReason,'request_limit');assert.equal(saved.lastRejection.requestCount,1001);assert.equal(saved.lastRejection.requestTypes.updateParagraphStyle,1001);assert.doesNotMatch(JSON.stringify(saved.lastRejection),/Another copy|Useful Handoff|blank-revision/);
});
test('format-only completion holds a changed canonical text or changed table structure even when approved word coverage still passes',async t=>{
  for(const kind of ['extra text','extra table'])await t.test(kind,async()=>{
    let wrote=false;const setup=await completeButUnstyled(async(config,native)=>{
      emit(config,'get_file_metadata',{fileId:'doc123'},metadata());emit(config,'get_document',{document_id:'doc123'},native);emit(config,'get_document_text',{document_id:'doc123'},nativeText());
      emit(config,'batch_update_document',{document_id:'doc123',requests:[{updateParagraphStyle:{range:{startIndex:1,endIndex:8},paragraphStyle:{namedStyleType:'HEADING_1'},fields:'namedStyleType'}}],write_control:{requiredRevisionId:'blank-revision'}},{documentId:'doc123'});wrote=true;
      native.tabs[0].body.content[1].paragraph.paragraphStyle.namedStyleType='HEADING_1';const text=nativeText();if(kind==='extra text')text.paragraphs.push({text:'Unexpected extra content.'});else native.tabs[0].body.content.push({table:{rows:1,columns:1}});
      emit(config,'get_document',{document_id:'doc123'},native);emit(config,'get_document_text',{document_id:'doc123'},text);
    });
    const result=await finish(setup.manager,(await setup.manager.resume({...payload(),id:setup.id,url:'https://docs.google.com/document/d/doc123/edit'})).id);assert.equal(wrote,true);assert.equal(result.status,'unavailable');assert.match(result.message,/changed existing text or table structure/);
  });
});
test('recovery holds nonblank, mismatched, nonnative or shared existing files without granting a write',async t=>{
  const cases=[['existing words',()=>nativeDoc('Existing content must remain.'),metadata],['existing table',()=>{const d=nativeDoc();d.tabs[0].body.content.push({table:{rows:1,columns:1}});return d;},metadata],['wrong title',()=>({...nativeDoc(),title:'Another title'}),metadata],['wrong MIME',nativeDoc,()=>({...metadata(),mimeType:'application/pdf'})],['shared file',nativeDoc,()=>({...metadata(),shared:true})],['unknown privacy',nativeDoc,()=>({...metadata(),shared:undefined})]];
  for(const [name,doc,file]of cases)await t.test(name,async()=>{
    let phase=0,writes=0;const manager=createGoogleProducer({providers,createSession:config=>++phase===1?failCreate(config):({run:async()=>{emit(config,'get_file_metadata',{fileId:'doc123'},file());emit(config,'get_document',{document_id:'doc123'},doc());if(config.onApproval(request(1,'batch_update_document',{document_id:'doc123',requests:[{insertText:{location:{index:1},text:'Replacement'}}],write_control:{requiredRevisionId:'blank-revision'}})))writes++;},respond(){},close:async()=>{}})});
    const held=await finish(manager,(await manager.start(payload())).id);const result=await finish(manager,(await manager.resume({...payload(),id:held.id,url:'https://docs.google.com/document/d/doc123/edit'})).id);assert.equal(result.status,'unavailable');assert.equal(result.verified,false);assert.equal(writes,0);assert.equal(result.creationAttempted,true);
  });
});
test('an unknown completed create receipt stays held with key-only diagnostics and cannot create another copy',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'studio-google-shape-'));t.after(()=>rm(directory,{recursive:true,force:true}));let creates=0;
  const createSession=config=>({run:async()=>{creates++;emit(config,'create_file',{title:brief.title,mime_type:'application/vnd.google-apps.document'},{outcome:{opaque_receipt:'Never store this raw value'}});config.onTool({tool:'google_drive.get_document',arguments:{document_url:'doc123',document_id:null},lifecycle:'item/started'});},respond(){},close:async()=>{}});
  const manager=createGoogleProducer({providers,createSession,directory}),held=await finish(manager,(await manager.start(payload())).id);assert.equal(held.status,'unavailable');assert.equal(held.creationAttempted,true);assert.equal(held.file,undefined);
  const saved=JSON.parse(await readFile(join(directory,held.id+'.json'),'utf8'));assert.equal(saved.diagnostic.tool,'get_document');assert.equal(saved.diagnostic.targetMatches,false);assert.ok(saved.creationReceiptShape.some(field=>field.includes('opaque_receipt:string')));assert.doesNotMatch(JSON.stringify([saved.creationReceiptShape,saved.diagnostic]),/Never store|Useful Handoff/);
  assert.equal((await manager.start(payload())).id,held.id);assert.equal(creates,1);
});
