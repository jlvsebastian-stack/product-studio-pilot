import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createGoogleProducer} from '../src/google-producer.js';
import {freshProject} from '../src/product.js';

const brief={...freshProject().brief,title:'Readback Diagnostic Fixture',format:'Spreadsheet',productDraft:'## Calculator\n\nKeep the approved input and formula cells.'};
const body={brief,approvedSource:brief.productDraft,destination:'sheets',provider:'chatgpt',model:'gpt-6.1-sol',reasoningEffort:'medium'};
const emit=(config,tool,args,data)=>{config.onTool({tool:'google_drive.'+tool,arguments:args,lifecycle:'item/started'});config.onTool({tool:'google_drive.'+tool,arguments:args,lifecycle:'item/completed',result:{structuredContent:data}});};
async function finished(manager,id){for(let i=0;i<200;i++){const value=manager.status(id);if(value.status!=='running')return value;await new Promise(resolve=>setTimeout(resolve,5));}throw Error('Controlled readback did not finish');}

test('held Sheet readback records bounded shape/mask/count diagnostics without source/cell contents or relaxing verification',async t=>{
  const directory=await mkdtemp(join(fileURLToPath(new URL('../',import.meta.url)),'.tmp-sheet-diagnostic-'));t.after(()=>rm(directory,{recursive:true,force:true}));let attempt=0;
  const cells={sheets:[{properties:{title:'Inputs'},data:[{rowData:[{values:[{userEnteredValue:{stringValue:'PRIVATE_CELL_SENTINEL'}},{userEnteredValue:{formulaValue:'=1+1'},effectiveValue:{numberValue:2},formattedValue:'2'}]}]}]}]};
  const manager=createGoogleProducer({directory,providers:{status:async()=>({ready:true}),checkModel:async()=>({available:true})},createSession:config=>({run:async()=>{
    attempt++;if(attempt===1){emit(config,'create_file',{title:brief.title,mime_type:'application/vnd.google-apps.spreadsheet'},{fileId:'sheet123'});throw Error('Controlled original read interrupted');}
    emit(config,'get_file_metadata',{fileId:'sheet123'},{id:'sheet123',name:brief.title,mimeType:'application/vnd.google-apps.spreadsheet',shared:false});
    emit(config,'get_spreadsheet_metadata',{spreadsheet_id:'sheet123'},{spreadsheetId:'sheet123',properties:{title:brief.title},sheets:[{properties:{title:'Inputs',sheetId:0}}]});
    emit(config,'get_spreadsheet_cells',{spreadsheet_id:'sheet123',ranges:["'Inputs'!A1:B2"],cell_fields:attempt===3?'formattedValue':'userEnteredValue,effectiveValue,formattedValue'},attempt===2?{spreadsheet:cells}:cells);
  },respond(){},close:async()=>{}})});
  const held=await finished(manager,(await manager.start(body)).id);
  const unknown=await finished(manager,(await manager.recheck({...body,id:held.id})).id);assert.equal(unknown.status,'unavailable');assert.equal(unknown.verification.formulas,0);
  const receipt=JSON.parse(await readFile(join(directory,held.id+'.json'),'utf8')),diagnostic=receipt.readbackDiagnostics?.at(-1);
  assert.ok(diagnostic,'the actual completion shape must be diagnosable');assert.equal(diagnostic.requiredValueFields,true);assert.equal(diagnostic.requestedRanges,1);assert.equal(diagnostic.requestedCells,4);assert.equal(diagnostic.directSheets,0);assert.equal(diagnostic.nestedSheetCollections,1);assert.ok(diagnostic.dataShape.some(path=>path.startsWith('spreadsheet.sheets:array')));assert.ok(diagnostic.resultShape.length<=32);assert.ok(diagnostic.dataShape.length<=32);assert.ok(receipt.readbackDiagnostics.length<=8);assert.ok(!JSON.stringify(receipt).includes('PRIVATE_CELL_SENTINEL'));assert.ok(!JSON.stringify(diagnostic).includes('=1+1'));
  const missing=await finished(manager,(await manager.recheck({...body,id:held.id})).id);assert.equal(missing.status,'unavailable');const second=JSON.parse(await readFile(join(directory,held.id+'.json'),'utf8')).readbackDiagnostics.at(-1);assert.equal(second.requiredValueFields,false);assert.equal(second.directSheets,1);assert.equal(second.returnedCells,2);assert.equal(second.formulaCells,1);
});

test('oversized native Sheet reads are denied before approval, with bounded read-only recovery on the same file',async t=>{
  const directory=await mkdtemp(join(fileURLToPath(new URL('../',import.meta.url)),'.tmp-sheet-budget-'));t.after(()=>rm(directory,{recursive:true,force:true}));let attempt=0,creates=0,creationPrompt='';
  const cells={sheets:[{properties:{title:'Inputs'},data:[{rowData:[{values:[{userEnteredValue:{formulaValue:'=1+1'},effectiveValue:{numberValue:2},formattedValue:'2'}]}]}]}]};
  const manager=createGoogleProducer({directory,providers:{status:async()=>({ready:true}),checkModel:async()=>({available:true})},createSession:config=>({run:async prompt=>{
    if(++attempt===1){creates++;creationPrompt=prompt;emit(config,'create_file',{title:brief.title,mime_type:'application/vnd.google-apps.spreadsheet'},{fileId:'sheet123'});throw Error('Controlled creation read interrupted');}
    if(attempt===2){for(const ranges of [["'Inputs'!A1:Z2000"],["'Inputs'!A1:J30","'Inputs'!K1:T21"],["'Inputs'!A:Z"]])assert.equal(config.onApproval({id:50,params:{message:'google_drive.get_spreadsheet_cells requires confirmation',_meta:{codex_approval_kind:'mcp_tool_call',tool_params:{spreadsheet_id:'sheet123',ranges,cell_fields:'userEnteredValue,effectiveValue,formattedValue'}}}}),false,'oversized or open-ended ranges must never be approved');throw Error('Read rejected before dispatch');}
    assert.match(prompt,/500 cells/);assert.match(prompt,/first and last prepared formula row/i);assert.doesNotMatch(prompt,/EVERY actual populated tab.s complete used range/);
    emit(config,'get_file_metadata',{fileId:'sheet123'},{id:'sheet123',name:brief.title,mimeType:'application/vnd.google-apps.spreadsheet',shared:false});
    emit(config,'get_spreadsheet_metadata',{spreadsheet_id:'sheet123'},{spreadsheetId:'sheet123',properties:{title:brief.title},sheets:[{properties:{title:'Inputs',sheetId:0}}]});
    emit(config,'get_spreadsheet_cells',{spreadsheet_id:'sheet123',ranges:["'Inputs'!A1:T25"],cell_fields:'userEnteredValue,effectiveValue,formattedValue'},cells);
  },respond(){},close:async()=>{}})});
  const original=await finished(manager,(await manager.start(body)).id),recheck={...body,id:original.id};
  assert.equal(original.file?.id,'sheet123');const rejected=await finished(manager,(await manager.recheck(recheck)).id);assert.equal(rejected.status,'unavailable');assert.match(rejected.message,/500 cells/);assert.match(rejected.message,/same|existing/i);
  const recovered=await finished(manager,(await manager.recheck(recheck)).id);assert.equal(recovered.status,'ready',recovered.message);assert.equal(recovered.file.id,'sheet123');assert.equal(recovered.verification.formulas,1);assert.equal(creates,1,'rechecks must not create another spreadsheet');assert.match(creationPrompt,/500 cells/);
});
