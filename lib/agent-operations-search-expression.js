'use strict';
// Static syntax-tree validation, NEVER evaluation. OS isolation remains required
// for tests. This additionally prevents model expressions reaching the reporter.
const parser=require('./vendor/acorn-8.19.0.cjs');
const VERSION='pure-search-expression-v1';
const roots={calls:['q','hay','x'],'follow-ups':['q','x'],'local-conversations':['q','x'],contacts:['q','c','kind'],'paged-conversations':['item','options','messages']};
const fields=new Set(['caller','phone','category','reason','agent','address','name','last','status','messages','services']);
function deny(){throw Object.assign(Error('PHONE_SEARCH_EXPRESSION'),{validationIssue:{mismatch:'unsafe-expression'}});}
function regex(n){
 if(!n?.regex)return false;const {pattern,flags}=n.regex;
 if(['\\D','[^0-9]','[^\\d]'].includes(pattern))return flags==='g';
 if(!['','u'].includes(flags)||!pattern.startsWith('^[')||!/(?:\]\+\$|\]\*\$|\]\$)$/.test(pattern))return false;
 const end=pattern.lastIndexOf(']'),inside=pattern.slice(2,end);if(!inside)return false;
 for(let i=0;i<inside.length;i++){if(inside[i]==='\\'){if(!['d','s','-','(',')','.','+',' '].includes(inside[++i]))return false;}else if(!'0123456789+(). -'.includes(inside[i]))return false;}return true;
}
function validate(text,siteId){
 if(typeof text!=='string'||Buffer.byteLength(text)>2048||!Object.hasOwn(roots,siteId))deny();
 let tree;const comments=[];try{tree=parser.parse('('+text+'\n)',{ecmaVersion:2022,sourceType:'script',onComment:comments});}catch{deny();}if(comments.length)deny();
 if(tree.body.length!==1||tree.body[0].type!=='ExpressionStatement')deny();let nodes=0;
 const initial=new Set(roots[siteId]);
 function visit(n,locals=new Set(),depth=0){
  if(!n||++nodes>500||depth>80)deny();const walk=x=>visit(x,locals,depth+1);
  switch(n.type){
   case'Literal':if(n.regex){if(!regex(n))deny();}else if(n.value!==null&&!['string','number','boolean'].includes(typeof n.value)||typeof n.value==='number'&&!Number.isFinite(n.value))deny();return;
   case'Identifier':if(!initial.has(n.name)&&!locals.has(n.name))deny();return;
   case'LogicalExpression':if(!['||','&&','??'].includes(n.operator))deny();walk(n.left);walk(n.right);return;
   case'BinaryExpression':if(!['+','===','!==','==','!=','>','>=','<','<='].includes(n.operator))deny();walk(n.left);walk(n.right);return;
   case'UnaryExpression':if(!['!','+','-','typeof'].includes(n.operator))deny();walk(n.argument);return;
   case'ConditionalExpression':walk(n.test);walk(n.consequent);walk(n.alternate);return;
   case'ChainExpression':walk(n.expression);return;
   case'ArrayExpression':for(const element of n.elements){if(!element)deny();if(element.type==='SpreadElement')walk(element.argument);else walk(element);}return;
   case'MemberExpression':{
    if(n.computed||n.property.type!=='Identifier')deny();const key=n.property.name,base=n.object;
    if(base.type==='Identifier'&&['x','c','item'].includes(base.name)){if(!initial.has(base.name)||!fields.has(key))deny();return;}
    if(base.type==='Identifier'&&base.name==='options'){if(!initial.has('options')||key!=='q')deny();return;}
    if(base.type==='Identifier'&&locals.has(base.name)){if(key!=='text')deny();return;}
    if(key!=='length')deny();walk(base);return;
   }
   case'CallExpression':{
    if(n.optional||n.arguments.some(x=>x.type==='SpreadElement'))deny();const callee=n.callee;
    if(callee.type==='Identifier'){
     if(callee.name==='String'&&n.arguments.length===1){walk(n.arguments[0]);return;}
     if(['callDispositionLabel','teamStatusLabel'].includes(callee.name)&&initial.has('x')&&n.arguments.length===1&&n.arguments[0].type==='Identifier'&&n.arguments[0].name==='x')return;
     deny();
    }
    if(callee.type!=='MemberExpression'||callee.computed||callee.property.type!=='Identifier')deny();const method=callee.property.name,base=callee.object,args=n.arguments;
    if(base.type==='Identifier'&&base.name==='Array'&&method==='isArray'&&args.length===1){walk(args[0]);return;}
    if(method==='test'){if(base.type!=='Literal'||!regex(base)||args.length!==1)deny();walk(base);walk(args[0]);return;}
    walk(base);
    if(['toLowerCase','trim'].includes(method)&&args.length===0)return;
    if(method==='includes'&&args.length===1){walk(args[0]);return;}
    if(method==='join'&&args.length===1&&args[0].type==='Literal'&&['',' '].includes(args[0].value))return;
    if(['replace','replaceAll'].includes(method)&&args.length===2&&args[0].type==='Literal'&&args[0].regex&&regex(args[0])&&args[1].type==='Literal'&&args[1].value==='')return;
    if(method==='map'&&args.length===1){const fn=args[0];if(fn.type!=='ArrowFunctionExpression'||fn.async||!fn.expression||fn.params.length!==1||fn.params[0].type!=='Identifier'||!/^[a-z][a-zA-Z0-9_]{0,24}$/.test(fn.params[0].name)||initial.has(fn.params[0].name))deny();visit(fn.body,new Set([...locals,fn.params[0].name]),depth+1);return;}
    deny();
   }
   default:deny();
  }
 }
 visit(tree.body[0].expression);return{version:VERSION,nodeCount:nodes,executionAuthorized:false};
}
module.exports={VERSION,validate};
