const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../cookie-preferences.js'),'utf8');
function boot(saved,{gpc=false,blocked=false}={}){
 const stored=new Map(saved?[['cc_cookie_choice',saved]]:[]),created=[],body=[];
 const storage={getItem:k=>{if(blocked)throw Error('blocked');return stored.get(k);},setItem:(k,v)=>{if(blocked)throw Error('blocked');stored.set(k,v);},removeItem:k=>stored.delete(k)};
 const env={Date,localStorage:storage,sessionStorage:storage,navigator:{globalPrivacyControl:gpc},CustomEvent:class{constructor(type,o){this.type=type;this.detail=o.detail;}},document:{activeElement:null,head:{append:()=>{}},body:{append:e=>body.push(e)},querySelectorAll:()=>[],createElement:tag=>{created.push(tag);return{};}},dispatchEvent:()=>{}};env.window=env;vm.runInNewContext(source,env);return{env,created,body,stored};
}
test('new, returning, expired, and blocked-storage visitors never get an automatic cookie panel',()=>{
 for(const saved of [null,JSON.stringify({version:1,at:Date.now(),analytics:false}),JSON.stringify({version:1,at:1,analytics:true})]){const h=boot(saved);assert.equal(h.env.CallerCorePrivacy.analytics,false);assert.equal(h.created.includes('dialog'),false);assert.equal(h.body.length,0);}
 const blocked=boot(null,{blocked:true});assert.equal(blocked.env.CallerCorePrivacy.analytics,false);assert.equal(blocked.body.length,0);
});
test('saved analytics opt-in is respected, while global privacy control overrides it',()=>{
 const saved=JSON.stringify({version:1,at:Date.now(),analytics:true});assert.equal(boot(saved).env.CallerCorePrivacy.analytics,true);assert.equal(boot(saved,{gpc:true}).env.CallerCorePrivacy.analytics,false);
});
