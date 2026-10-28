'use strict';
// Static syntax-tree validation, NEVER evaluation. OS isolation remains required
// for tests. This additionally prevents model expressions reaching the reporter.
const parser=require('./vendor/acorn-8.19.0.cjs');
const VERSION='pure-search-expression-v1';
const roots={calls:['q','hay','x'],'follow-ups':['q','x'],'local-conversations':['q','x'],contacts:['q','c','kind'],'paged-conversations':['item','options','messages']};
const fields=new Set(['caller','phone','category','reason','agent','address','name','last','status','messages','services']);
const REASONS=Object.freeze(['input-bound','syntax','comment','tree-shape','complexity','regex-shape','literal-type','unknown-identifier','operator','record-field','computed-property','member-access','call-shape','call-target','method','callback-shape','node-kind']);
const STRIP_PATTERNS=Object.freeze(['\\D','[^0-9]','[^\\d]']),PRESENCE_PATTERNS=Object.freeze(['\\d','[0-9]']);
function deny(reason='node-kind'){throw Object.assign(Error('PHONE_SEARCH_EXPRESSION'),{validationIssue:{mismatch:'unsafe-expression',expressionReason:REASONS.includes(reason)?reason:'node-kind'}});}
function contract(){return{version:VERSION,formatVersion:'machine-readable-syntax-v2',inputsBySite:structuredClone(roots),recordFields:[...fields],operators:['||','&&','??','+','===','!==','==','!=','>','>=','<','<=','!','-','typeof','conditional'],functions:['String(value)','Array.isArray(value)','callDispositionLabel(x)','teamStatusLabel(x)'],methods:{toLowerCase:0,trim:0,includes:1,test:'approved literal regex and one query argument; digit-presence forms are test-only',join:'literal space or empty string only',replace:'approved literal regex plus empty replacement only',replaceAll:'approved literal regex plus empty replacement only',map:'one expression-only arrow callback; local field text only'},exactRegexForms:[...STRIP_PATTERNS.map(pattern=>({pattern,flags:'g',purpose:'digit-stripping'})),...PRESENCE_PATTERNS.map(pattern=>({pattern,flags:'',purpose:'digit-presence-test-only'}))],phoneCharacterClass:{anchored:true,quantifiers:['','+','*'],flags:['','u'],characters:'digits whitespace + ( ) . -'},forbidden:['comments','statements','assignments','computed properties','constructors','eval','IIFEs','function access','side effects'],executionAuthorized:false};}
function regex(n){
 if(!n?.regex)return false;const {pattern,flags}=n.regex;
 if(STRIP_PATTERNS.includes(pattern))return flags==='g';
 if(!['','u'].includes(flags)||!pattern.startsWith('^[')||!/(?:\]\+\$|\]\*\$|\]\$)$/.test(pattern))return false;
 const end=pattern.lastIndexOf(']'),inside=pattern.slice(2,end);if(!inside)return false;
 for(let i=0;i<inside.length;i++){if(inside[i]==='\\'){if(!['d','s','-','(',')','.','+',' '].includes(inside[++i]))return false;}else if(!'0123456789+(). -'.includes(inside[i]))return false;}return true;
}
function validate(text,siteId,{allowDigitPresence=false}={}){
 if(typeof text!=='string'||Buffer.byteLength(text)>2048||!Object.hasOwn(roots,siteId))deny('input-bound');
 let tree;const comments=[];try{tree=parser.parse('('+text+'\n)',{ecmaVersion:2022,sourceType:'script',onComment:comments});}catch{deny('syntax');}if(comments.length)deny('comment');
 if(tree.body.length!==1||tree.body[0].type!=='ExpressionStatement')deny('tree-shape');let nodes=0;
 const initial=new Set(roots[siteId]);
 function visit(n,locals=new Set(),depth=0){
  if(!n||++nodes>500||depth>80)deny('complexity');const walk=x=>visit(x,locals,depth+1);
  switch(n.type){
   case'Literal':if(n.regex){if(!regex(n))deny('regex-shape');}else if(n.value!==null&&!['string','number','boolean'].includes(typeof n.value)||typeof n.value==='number'&&!Number.isFinite(n.value))deny('literal-type');return;
   case'Identifier':if(!initial.has(n.name)&&!locals.has(n.name))deny('unknown-identifier');return;
   case'LogicalExpression':if(!['||','&&','??'].includes(n.operator))deny('operator');walk(n.left);walk(n.right);return;
   case'BinaryExpression':if(!['+','===','!==','==','!=','>','>=','<','<='].includes(n.operator))deny('operator');walk(n.left);walk(n.right);return;
   case'UnaryExpression':if(!['!','+','-','typeof'].includes(n.operator))deny('operator');walk(n.argument);return;
   case'ConditionalExpression':walk(n.test);walk(n.consequent);walk(n.alternate);return;
   case'ChainExpression':walk(n.expression);return;
   case'ArrayExpression':for(const element of n.elements){if(!element)deny('node-kind');if(element.type==='SpreadElement')walk(element.argument);else walk(element);}return;
   case'MemberExpression':{
    if(n.computed||n.property.type!=='Identifier')deny('computed-property');const key=n.property.name,base=n.object;
    if(base.type==='Identifier'&&['x','c','item'].includes(base.name)){if(!initial.has(base.name)||!fields.has(key))deny('record-field');return;}
    if(base.type==='Identifier'&&base.name==='options'){if(!initial.has('options')||key!=='q')deny('record-field');return;}
    if(base.type==='Identifier'&&locals.has(base.name)){if(key!=='text')deny('record-field');return;}
    if(key!=='length')deny('member-access');walk(base);return;
   }
   case'CallExpression':{
    if(n.optional||n.arguments.some(x=>x.type==='SpreadElement'))deny('call-shape');const callee=n.callee;
    if(callee.type==='Identifier'){
     if(callee.name==='String'&&n.arguments.length===1){walk(n.arguments[0]);return;}
     if(['callDispositionLabel','teamStatusLabel'].includes(callee.name)&&initial.has('x')&&n.arguments.length===1&&n.arguments[0].type==='Identifier'&&n.arguments[0].name==='x')return;
     deny('call-target');
    }
    if(callee.type!=='MemberExpression'||callee.computed||callee.property.type!=='Identifier')deny('call-target');const method=callee.property.name,base=callee.object,args=n.arguments;
    if(base.type==='Identifier'&&base.name==='Array'&&method==='isArray'&&args.length===1){walk(args[0]);return;}
    if(method==='test'){const presence=allowDigitPresence===true&&base.type==='Literal'&&base.regex&&PRESENCE_PATTERNS.includes(base.regex.pattern)&&base.regex.flags==='';if(base.type!=='Literal'||(!regex(base)&&!presence)||args.length!==1)deny('regex-shape');if(!presence)walk(base);walk(args[0]);return;}
    walk(base);
    if(['toLowerCase','trim'].includes(method)&&args.length===0)return;
    if(method==='includes'&&args.length===1){walk(args[0]);return;}
    if(method==='join'&&args.length===1&&args[0].type==='Literal'&&['',' '].includes(args[0].value))return;
    if(['replace','replaceAll'].includes(method)&&args.length===2&&args[0].type==='Literal'&&args[0].regex&&regex(args[0])&&args[1].type==='Literal'&&args[1].value==='')return;
    if(method==='map'&&args.length===1){const fn=args[0];if(fn.type!=='ArrowFunctionExpression'||fn.async||!fn.expression||fn.params.length!==1||fn.params[0].type!=='Identifier'||!/^[a-z][a-zA-Z0-9_]{0,24}$/.test(fn.params[0].name)||initial.has(fn.params[0].name))deny('callback-shape');visit(fn.body,new Set([...locals,fn.params[0].name]),depth+1);return;}
    deny('method');
   }
   default:deny();
  }
 }
 visit(tree.body[0].expression);return{version:VERSION,nodeCount:nodes,executionAuthorized:false};
}
module.exports={VERSION,REASONS,contract,validate};
