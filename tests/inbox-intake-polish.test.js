const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');
test('inbox keeps contact, chatbot and unpaid checkout leads distinct, excluding completed checkouts',()=>{
  const context=vm.createContext({adminWebsiteData:{prospects:[{id:'contact',source:'contact',message:'Question'},{id:'chat',source:'chatbot',message:'Chat question'},{id:'unpaid',source:'get_started',stage:'checkout_started',plan:'Growth'},{id:'paid',source:'get_started',stage:'converted'}]}});
  vm.runInContext(source.slice(source.indexOf('function websiteInboxItems()'),source.indexOf('function gmailInboxItems()')),context);
  const items=context.websiteInboxItems();assert.deepEqual(Array.from(items,x=>[x.id,x.category]),[['contact','website'],['chat','chatbot'],['unpaid','checkout']]);
  assert.match(items[2].preview,/Growth.*Payment has not been confirmed/);assert.doesNotMatch(items[2].subject,/failed|abandoned/i);
});
test('business logo encoding retains square and portrait image proportions instead of adding wide blank borders',async()=>{
  for(const [width,height] of [[200,200],[180,360],[800,200]]){
    let canvas,draw;
    const context=vm.createContext({FileReader:class{readAsDataURL(){this.result='data:image/png;base64,test';this.onload()}},Image:class{constructor(){this.width=width;this.height=height}set src(v){this.onload()}},document:{createElement(){canvas={getContext:()=>({clearRect(){},drawImage(...args){draw=args}}),toDataURL:()=> 'encoded'};return canvas;}}});
    vm.runInContext(source.slice(source.indexOf('async function resizeBusinessLogo('),source.indexOf('function resetBusinessLogoProcessing(')),context);
    await context.resizeBusinessLogo({type:'image/png',size:100});assert.ok(canvas.width<=420&&canvas.height<=420);assert.ok(Math.abs(canvas.width/canvas.height-width/height)<.01);assert.deepEqual(draw.slice(1),[0,0,canvas.width,canvas.height]);
  }
});
test('inbox refresh updates website intake before Gmail even when Gmail is disconnected',async()=>{
  const order=[],context=vm.createContext({adminInboxData:{gmailStatus:{connected:false}},document:{getElementById:()=>null},loadWebsiteAnalytics:async()=>order.push('website'),fetch:async()=>{order.push('gmail');return {ok:true,json:async()=>({connected:false})}},renderAdminInbox(){},currentInboxItem:null,adminSearchInboxRequest:0,renderInboxThread(){}});
  vm.runInContext(source.slice(source.indexOf('async function loadAdminInbox('),source.indexOf('async function refreshAdminInboxLive(')),context);await context.loadAdminInbox();assert.deepEqual(order,['website','gmail']);
});
test('contact receipt hides and clears submitted information and explicitly resets the form for another message',async()=>{
  const html=fs.readFileSync('contact.html','utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1],handlers={},button={disabled:false,textContent:'Send message'},field={focused:false,focus(){this.focused=true}},heading={focused:false,focus(){this.focused=true}},note={},status={},success={hidden:true,querySelector:s=>s==='p'?note:heading};let resets=0;
  const form={hidden:false,addEventListener:(_event,fn)=>handlers.submit=fn,reportValidity:()=>true,reset(){resets++},querySelector:s=>s.includes('button')?button:field};
  const nodes={contactForm:form,contactSuccess:success,contactStatus:status,contactNewMessage:{addEventListener:(_event,fn)=>handlers.new=fn}};
  const context=vm.createContext({document:{getElementById:id=>nodes[id]},window:{},FormData:class{entries(){return [['name','Visitor'],['email','visitor@example.test'],['message','Private inquiry']]}get(){return null}},fetch:async()=>({ok:true,json:async()=>({ok:true,prospectId:'saved'})})});vm.runInContext(script,context);
  await handlers.submit({preventDefault(){},currentTarget:form});assert.equal(form.hidden,true);assert.equal(success.hidden,false);assert.equal(resets,1);assert.equal(heading.focused,true);
  handlers.new();assert.equal(form.hidden,false);assert.equal(success.hidden,true);assert.equal(button.disabled,false);assert.equal(field.focused,true);assert.equal(status.textContent,'');
});
