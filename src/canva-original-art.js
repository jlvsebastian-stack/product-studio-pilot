import {nativeImagePayload,downloadImage,imageDimensions} from './slide-art-assets.js';

export const artworkReviewTool={type:'function',name:'approve_canva_artwork',description:'Verify actual native previews and exact original-media placement before committing the authorized private draft. This production check does not grant human aesthetic approval.',inputSchema:{type:'object',properties:{transaction_id:{type:'string'}},required:['transaction_id'],additionalProperties:false}};
const near=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1;
const frameOf=fill=>({left:fill.containerElement?.position?.left,top:fill.containerElement?.position?.top,width:fill.containerElement?.dimension?.width,height:fill.containerElement?.dimension?.height});
const sameFrame=(a,b)=>['left','top','width','height'].every(key=>near(a?.[key],b?.[key]));
export function createOriginalArtwork({pages,getDesign,fetchFn=fetch,cachePreview,readOnly=false}={}){
  const expected=pages.flatMap((page,index)=>page.artwork?[{page:index+1,mediaId:page.artwork.canvaMediaId,frame:page.imageFrame,title:page.title}]:[]);
  if(expected.some(item=>!/^M[A-Za-z0-9_-]+$/.test(item.mediaId||'')||!item.frame))throw Error('The generated artwork has no verified original Canva media ID or exact image placement.');
  let transactionId='',approvedTransaction='',committed=false,persisted=false,inspectionClosed=false,fills=[],nativePages=[],starts=0;const pagePreviews=new Map();
  const fillsMatch=()=>expected.every(item=>fills.some(fill=>fill.type==='image'&&fill.asset_id===item.mediaId&&fill.page_index===item.page&&sameFrame(frameOf(fill),item.frame)));
  function permits(request){
    const params=request.params||{},args=params._meta?.tool_params||{},message=params.message||'',tool=/canva\.([a-z-]+)/.exec(message)?.[1];
    if(params._meta?.codex_approval_kind!=='mcp_tool_call')return false;
    if(tool==='start-editing-transaction')return !!getDesign()&&args.design_id===getDesign()&&Object.keys(args).every(key=>['design_id','user_intent'].includes(key))&&(starts===0||!readOnly&&committed&&starts===1&&!persisted);
    if(tool==='cancel-editing-transaction')return !!transactionId&&args.transaction_id===transactionId&&Object.keys(args).every(key=>['transaction_id','user_intent'].includes(key));
    if(tool==='commit-editing-transaction')return !readOnly&&!committed&&!!approvedTransaction&&args.transaction_id===approvedTransaction&&transactionId===approvedTransaction&&fillsMatch()&&Object.keys(args).every(key=>['transaction_id','user_intent'].includes(key));
    if(readOnly||tool!=='perform-editing-operations'||committed||args.transaction_id!==transactionId||!Array.isArray(args.operations)||!args.operations.length)return false;
    const item=expected.find(item=>item.page===args.page_index);if(!item)return false;
    return args.operations.every(operation=>{
      if(operation.asset_id!==item.mediaId||operation.asset_type!=='image')return false;
      if(operation.type==='update_fill')return fills.some(fill=>fill.element_id===operation.element_id&&fill.page_index===item.page&&sameFrame(frameOf(fill),item.frame));
      if(operation.type!=='insert_fill'||!sameFrame(operation,item.frame)||operation.page_id!==nativePages.find(page=>page.page_number===item.page)?.page_id)return false;
      // A full-page imported graphic layer is allowed; another unmatched picture is ambiguous.
      return fills.filter(fill=>fill.page_index===item.page).every(fill=>sameFrame(frameOf(fill),{left:0,top:0,width:1280,height:720}));
    });
  }
  function record(item){
    const data=nativeImagePayload(item),args=typeof item.arguments==='string'?JSON.parse(item.arguments):item.arguments||{};
    if(item.tool==='canva.start-editing-transaction'){
      if(args.design_id!==getDesign()||!data?.transaction?.transaction_id)throw Error('Canva did not return a bound editing transaction for this sample.');
      if(starts>0&&(readOnly||!committed||starts!==1))throw Error('An additional editing transaction is outside this draft operation.');starts++;
      transactionId=data.transaction.transaction_id;fills=data.fills||[];nativePages=data.pages||[];
      if(committed||readOnly)persisted=fillsMatch();
    }else if(item.tool==='canva.perform-editing-operations'){
      if(args.transaction_id!==transactionId)throw Error('The artwork edits returned an unrelated transaction.');
      if(!permits({params:{message:'canva.perform-editing-operations',_meta:{codex_approval_kind:'mcp_tool_call',tool_params:args}}}))throw Error('Canva returned an operation outside this exact page’s approved original-artwork placement.');
      const byId=new Map(fills.map(fill=>[fill.element_id,fill]));for(const fill of data.fills||[])byId.set(fill.element_id,fill);fills=[...byId.values()];if(data.pages)nativePages=data.pages;
      if(data.thumbnails?.length===1){
        const preview=downloadImage({url:data.thumbnails[0].url,quality:'preview'},{fetchFn}).then(image=>({...cachePreview(image),...imageDimensions(image.bytes,image.mimeType)}));preview.catch(()=>{});pagePreviews.set(args.page_index,preview);
      }
    }else if(item.tool==='canva.commit-editing-transaction'){
      if(args.transaction_id!==approvedTransaction||!fillsMatch())throw Error('Original artwork was not approved and verified before saving.');committed=true;
    }else if(item.tool==='canva.cancel-editing-transaction'&&args.transaction_id===transactionId){if((committed||readOnly)&&persisted)inspectionClosed=true;transactionId='';}
  }
  async function review(request){
    if(request.params?.tool!=='approve_canva_artwork'||committed)return null;
    let args=request.params.arguments;try{if(typeof args==='string')args=JSON.parse(args);}catch{return null;}
    if(args?.transaction_id!==transactionId||!fillsMatch()||expected.some(item=>!pagePreviews.has(item.page)))return null;
    const previews=[];
    for(const item of expected){
      const preview=await pagePreviews.get(item.page);previews.push({...preview,pageNumber:item.page,label:item.title});
    }
    if(!previews.length)return null;
    return {transactionId,previews,scope:`Verify the real Canva draft with ${expected.length} original generated images before saving this private draft. Human appearance review follows through its Canva link. No sharing or publishing.`};
  }
  function decision(action,{productionAuthorized=false}={}){if(action==='accept')approvedTransaction=transactionId;return {success:true,contentItems:[{type:'inputText',text:JSON.stringify({approved:action==='accept',humanAestheticApproval:false,productionAuthorized:action==='accept'&&productionAuthorized,transaction_id:transactionId,instruction:action==='accept'?'The exact original-media fills and actual page previews passed this production check. The creation request authorizes saving ONLY this private draft transaction. This is not human approval of its appearance. Request the normal one-call commit for this exact transaction; final visual review happens through the Canva editor link.':'This draft cannot be saved. Cancel this transaction; do not commit or create another design.'})}]};}
  return {expected,permits,record,review,decision,get verified(){return !expected.length||(readOnly||committed)&&persisted&&inspectionClosed;},get active(){return expected.length>0;},get prompt(){return !expected.length?'':readOnly?`After exact metadata, audience content and notes are verified, inspect ONLY this design's original artwork fills: ${JSON.stringify(expected)}. Start a read-only editing transaction, read actual fills and verify each original MEDIA on its correct1-based page and frame, then cancel that inspection transaction without changes. Do not perform operations, commit or create anything.`:`After import metadata, audience content and notes identify the actual newly created design, replace its preview images with the ORIGINAL existing Canva MEDIA assets below; do not generate new artwork. Start an editing transaction for ONLY that design. The exact1-based page/frame/media mapping is ${JSON.stringify(expected)}. Use update_fill for the imported independent picture at the exact page/frame; if the only existing fill is a full-page graphics layer and there is no picture, insert_fill at that exact frame using that page's actual page_id. Do not change text, source notes, page structure, graphics, fonts or other images. Apply operations separately per page_index (first page is1). Inspect actual returned fills: each original MEDIA ID must be on its correct page and frame. Then call local approve_canva_artwork with the exact transaction_id. The local app fetches ACTUAL native thumbnails and verifies every expected original-media fill and page preview. This production check is not human aesthetic approval. NEVER call commit before this tool returns approved:true. If declined, cancel and stop. The creation request authorizes ONLY this private draft; call commit_editing_transaction through its normal one-call permission. Finally start ONE read-only editing transaction on the same design to verify persisted original fills, and cancel that inspection transaction without changes. Missing original media, preview, production authorization or persisted fill means PARTIAL; do not claim complete.`;}};
}
