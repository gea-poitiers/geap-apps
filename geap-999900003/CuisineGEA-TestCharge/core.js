
/* GEAP — sous-ensemble DAX pour colonnes calculées. Parseur et interpréteur sans eval. */
(function(g,f){if(typeof module!=='undefined'&&module.exports)module.exports=f;else g.GEAPFormulaCore=f;})(typeof window!=='undefined'?window:globalThis,function(C){
'use strict';
const MAX_SOURCE=20000,MAX_NODES=3000,MAX_DEPTH=64,MAX_STEPS=300000;
const specs={IF:[3,3],AND:[2,2],OR:[2,2],NOT:[1,1],TRUE:[0,0],FALSE:[0,0],BLANK:[0,0],ISBLANK:[1,1],COALESCE:[2,30],DIVIDE:[2,3],ABS:[1,1],ROUND:[2,2],CONTAINSSTRING:[2,2],RELATED:[1,1],RELATEDTABLE:[1,1],SUM:[1,1],AVERAGE:[1,1],MIN:[1,2],MAX:[1,2],DISTINCTCOUNT:[1,1],COUNTROWS:[1,1],SUMX:[2,2],AVERAGEX:[2,2],MINX:[2,2],MAXX:[2,2],FILTER:[2,2],CONCATENATEX:[2,3],GEAP_ARRAY:[1,100],GEAP_RELATEDTABLE:[1,1],GEAP_FIRST:[2,2],GEAP_VALUES:[2,2],GEAP_DISTINCTCOUNT:[2,2],GEAP_DISTANCE:[2,2],GEAP_TEXTJOIN:[4,100],GEAP_CAST:[2,2],GEAP_TEST:[3,3]};
const numeric=t=>['decimal','integer','duration','blank'].includes(t),norm=s=>String(s).toLocaleLowerCase('fr'),blank=v=>v===null||v===undefined;
function fail(message,node){const e=new Error(message);if(node?.pos!==undefined)e.position=node.pos;throw e;}
function tokenize(source){if(typeof source!=='string'||source.length>MAX_SOURCE)fail('Formule vide ou trop longue (20 000 caractères maximum).');let i=0,out=[];
 const push=(k,v,pos)=>{out.push({k,v,pos});if(out.length>MAX_NODES)fail('Formule trop longue.');};
 while(i<source.length){const start=i,c=source[i];if(/\s/.test(c)){i++;continue;}if(source.slice(i,i+2)==='//'||source.slice(i,i+2)==='--'){while(i<source.length&&source[i]!=='\n')i++;continue;}if(source.slice(i,i+2)==='/*'){const end=source.indexOf('*/',i+2);if(end<0)fail('Commentaire non terminé.',{pos:i});i=end+2;continue;}
 if(c==='"'||c==="'"||c==='['){const end=c==='['?']':c;let value='',closed=false;i++;while(i<source.length){if(source[i]===end){if(source[i+1]===end){value+=end;i+=2;continue;}i++;closed=true;break;}value+=source[i++];}if(!closed)fail('Texte ou référence non terminé.',{pos:start});push(c==='"'?'literal':c==='['?'column':'identifier',value,start);if(c==="'")out.at(-1).quoted=true;continue;}
 const number=source.slice(i).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);if(number){const v=Number(number[0]);if(!Number.isFinite(v))fail('Nombre non fini.',{pos:start});push('literal',v,start);i+=number[0].length;continue;}
 const id=source.slice(i).match(/^[\p{L}_][\p{L}\p{N}_]*/u);if(id){push('identifier',id[0],start);i+=id[0].length;continue;}
 const op=['&&','||','<>','<=','>=','=='].find(x=>source.startsWith(x,i))||c;if('+-*/^&=<>(),;'.includes(c)){push('operator',op,start);i+=op.length;continue;}fail('Caractère inattendu : '+c,{pos:start});
 }out.push({k:'end',v:'',pos:i});return out;
}
function parse(source){const tokens=tokenize(source);let i=0,depth=0,count=0;const peek=()=>tokens[i],take=()=>tokens[i++],expect=v=>{if(peek().v!==v)fail('« '+v+' » attendu.',peek());take();};
 const precedence={'||':1,'&&':2,'=':3,'==':3,'<>':3,'<':3,'>':3,'<=':3,'>=':3,'&':4,'+':5,'-':5,'*':6,'/':6,'^':7};
 function expr(min=0){if(++depth>MAX_DEPTH)fail('Formule trop imbriquée.',peek());if(++count>MAX_NODES)fail('Formule trop complexe.',peek());const t=take();let n;
 if(t.k==='literal')n={k:'lit',v:t.v,pos:t.pos};else if(t.k==='column')n={k:'col',fieldName:t.v,pos:t.pos};else if(t.v==='('){n=expr();expect(')');}else if(['+','-'].includes(t.v))n={k:'un',op:t.v,a:expr(7),pos:t.pos};else if(t.k==='identifier'){
  const name=t.v.toUpperCase();if(peek().v==='('){take();const args=[];if(peek().v!==')')do{args.push(expr());if(![',',';'].includes(peek().v))break;take();}while(true);expect(')');n={k:'call',name,args,pos:t.pos};}
  else if(peek().k==='column')n={k:'col',tableName:t.v,fieldName:take().v,pos:t.pos};else if(!t.quoted&&['TRUE','FALSE'].includes(name))n={k:'lit',v:name==='TRUE',pos:t.pos};else n={k:'table',tableName:t.v,pos:t.pos};
 }else fail('Une valeur, une colonne ou une fonction est attendue.',t);
 while(peek().k==='operator'&&precedence[peek().v]!==undefined&&precedence[peek().v]>=min){const op=take(),p=precedence[op.v];n={k:'bin',op:op.v,a:n,b:expr(p+(op.v==='^'?0:1)),pos:op.pos};}depth--;return n;}
 if(peek().v==='=')take();const ast=expr();if(peek().k!=='end')fail('Élément inattendu : '+peek().v,peek());return ast;
}
function named(items,name,label,node){const matches=items.filter(x=>norm(x.name)===norm(name));if(matches.length!==1)fail(matches.length?'Nom ambigu : '+name+'.':' '+label+' introuvable : '+name+'.',node);return matches[0];}
function quoteTable(name){return "'"+String(name).replace(/'/g,"''")+"'";}
function quoteColumn(name){return '['+String(name).replace(/]/g,']]')+']';}
function tableFor(p,n){const t=n.tableId?C.table(p,n.tableId):named(p.tables,n.tableName,'Table',n);if(!t)fail('Table supprimée ou introuvable.',n);return t;}
function relationFor(p,from,to,kind,n){let rels=p.relations.filter(r=>C.relationTarget(r,from)===to);if(kind==='one')rels=rels.filter(r=>r.kind!=='match'&&r.childTableId===from);if(kind==='many')rels=rels.filter(r=>r.kind==='match'?r.sourceTableId===from:r.parentTableId===from);if(rels.length!==1)fail(rels.length?'Plusieurs relations possibles vers cette table : vérifiez le modèle à l’étape Relations.':'Relation compatible absente : définissez-la à l’étape Relations.',n);if(n.relationId&&rels[0].id!==n.relationId)fail('Relation supprimée ou devenue incompatible.',n);return rels[0];}
const caches=new WeakMap();
function inspect(p,t,f,chain=new Set()){
 let cache=caches.get(p);if(!cache)caches.set(p,cache=new WeakMap());const found=cache.get(f);if(found&&found.compute===f.compute)return found;
 if(chain.has(f.id))fail('Calcul circulaire : '+t.name+'.'+f.name+'.');chain=new Set(chain);chain.add(f.id);
 const ast=f.compute.ast?C.clone(f.compute.ast):parse(f.compute.source||''),deps=new Map(),relations=new Set();let nodes=0;
 const add=(ti,fi)=>deps.set(ti+'\0'+fi,[ti,fi]);
 const relDeps=r=>{relations.add(r.id);if(r.kind==='match'){add(r.sourceTableId,r.sourceFieldId);add(r.targetTableId,r.targetFieldId);}else{add(r.childTableId,r.childFieldId);add(r.parentTableId,C.pk(C.table(p,r.parentTableId)).id);}};
 function fieldType(tt,ff){if(ff.type==='computed'&&ff.compute?.kind==='formula')return inspect(p,tt,ff,chain).type;return C.resultType?C.resultType(p,tt,ff):ff.type;}
 function ref(n,env,allowOutside=false){const tt=n.tableId?tableFor(p,n):n.tableName?named(p.tables,n.tableName,'Table',n):C.table(p,env.current);const ff=n.fieldId?C.field(tt,n.fieldId):named(C.dataFields(tt),n.fieldName,'Colonne',n);if(!ff)fail('Colonne supprimée ou introuvable.',n);if(ff.type==='relation')fail('Utilisez la relation définie à l’étape 2.',n);n.tableId=tt.id;n.fieldId=ff.id;delete n.tableName;delete n.fieldName;add(tt.id,ff.id);if(!allowOutside&&!env.rows.has(tt.id))fail('La colonne '+tt.name+'.'+ff.name+' nécessite RELATED ou un agrégat.',n);return fieldType(tt,ff);}
 const requireScalar=(type,n)=>{if(typeof type!=='string')fail('Une valeur scalaire est attendue.',n);return type;};
 const num=(type,n)=>{if(!numeric(type))fail('Une valeur numérique est attendue.',n);};
 function walk(n,env,depth=0){if(!n||typeof n!=='object'||++nodes>MAX_NODES||depth>MAX_DEPTH)fail('Structure de formule invalide ou trop complexe.');const w=a=>walk(a,env,depth+1);
 if(n.k==='lit'){if(n.v===null)return 'blank';if(typeof n.v==='number'&&Number.isFinite(n.v))return 'decimal';if(typeof n.v==='string')return 'text';if(typeof n.v==='boolean')return 'boolean';fail('Constante invalide.',n);}
 if(n.k==='col')return ref(n,env);if(n.k==='table'){const tt=tableFor(p,n);n.tableId=tt.id;delete n.tableName;return {tableId:tt.id};}
 if(n.k==='un'){if(!['+','-'].includes(n.op))fail('Opérateur inconnu.',n);num(w(n.a),n);return 'decimal';}
 if(n.k==='bin'){const a=requireScalar(w(n.a),n),b=requireScalar(w(n.b),n);if(['+','-','*','/','^'].includes(n.op)){num(a,n.a);num(b,n.b);return 'decimal';}if(n.op==='&')return 'text';if(['=','==','<>','<','>','<=','>=','&&','||'].includes(n.op))return 'boolean';fail('Opérateur inconnu.',n);}
 if(n.k!=='call'||!Object.hasOwn(specs,n.name)||!Array.isArray(n.args))fail('Fonction inconnue : '+(n.name||'?')+'.',n);
 const name=n.name,args=n.args,[min,max]=specs[name];if(args.length<min||args.length>max)fail(name+' : '+(min===max?min:min+' à '+max)+' argument(s) attendu(s).',n);
 const col=(a,out=false)=>{if(a?.k!=='col')fail(name+' attend une référence de colonne.',a||n);return ref(a,env,out);};
 const literal=(a)=>{if(a?.k!=='lit'||typeof a.v!=='string')fail(name+' attend un nom entre guillemets.',a||n);return a.v;};
 if(name==='RELATED'){const type=col(args[0],true),r=relationFor(p,env.current,args[0].tableId,'one',n);n.relationId=r.id;relDeps(r);return type;}
 if(name==='RELATEDTABLE'){if(args[0].k!=='table')fail('RELATEDTABLE attend une table.',n);const tt=w(args[0]),r=relationFor(p,env.current,tt.tableId,'many',n);n.relationId=r.id;relDeps(r);return tt;}
 if(name.startsWith('GEAP_')&&['GEAP_RELATEDTABLE','GEAP_FIRST','GEAP_VALUES','GEAP_DISTINCTCOUNT'].includes(name)){
  let r=n.relationId?p.relations.find(r=>r.id===n.relationId):named(p.relations,literal(args[0]),'Relation',n);if(!r)fail('Relation supprimée.',n);const dest=C.relationTarget(r,env.current);if(!dest)fail('Relation inaccessible depuis cette ligne.',n);n.relationId=r.id;args[0]={k:'lit',v:r.name};relDeps(r);if(name==='GEAP_RELATEDTABLE')return {tableId:dest};const ft=col(args[1],true);if(args[1].tableId!==dest)fail('La colonne ne correspond pas à la table liée.',n);return name==='GEAP_FIRST'?ft:name==='GEAP_VALUES'?'array':'integer';
 }
 if(['SUM','AVERAGE','DISTINCTCOUNT'].includes(name)||(['MIN','MAX'].includes(name)&&args.length===1)){const type=col(args[0],true);if(name!=='DISTINCTCOUNT')num(type,n);return name==='DISTINCTCOUNT'?'integer':'decimal';}
 if(['SUMX','AVERAGEX','MINX','MAXX','FILTER','CONCATENATEX'].includes(name)){const table=w(args[0]);if(!table?.tableId)fail(name+' attend une table en premier argument.',n);const inner={current:table.tableId,rows:new Set([...env.rows,table.tableId])},type=walk(args[1],inner,depth+1);requireScalar(type,n);if(name==='FILTER'){if(type!=='boolean')fail('FILTER attend une condition booléenne.',n);return table;}if(name==='CONCATENATEX'){if(args[2])requireScalar(w(args[2]),n);return 'text';}num(type,n);return 'decimal';}
 if(name==='COUNTROWS'){if(!w(args[0])?.tableId)fail('COUNTROWS attend une table.',n);return 'integer';}
 if(name==='IF'){if(w(args[0])!=='boolean')fail('IF attend une condition booléenne.',n);const a=requireScalar(w(args[1]),n),b=requireScalar(w(args[2]),n);if(a==='blank')return b;if(b==='blank')return a;if(a===b)return a;if(numeric(a)&&numeric(b))return 'decimal';fail('Les deux résultats de IF doivent avoir des types compatibles.',n);}
 if(name==='GEAP_CAST'){w(args[0]);const type=literal(args[1]);if(!['text','decimal','boolean','date','datetime'].includes(type))fail('Type de conversion inconnu.',n);return type;}
 if(name==='GEAP_TEST'){col(args[0]);if(!C.OPS.includes(literal(args[1])))fail('Condition inconnue.',n);requireScalar(w(args[2]),n);return 'boolean';}
 if(name==='GEAP_DISTANCE'){for(const a of args)if(w(a)!=='location')fail('Deux positions GPS sont requises.',n);return 'decimal';}
 if(name==='GEAP_TEXTJOIN'){for(const a of args)requireScalar(w(a),a);return 'text';}
 if(name==='GEAP_ARRAY'){for(const a of args)requireScalar(w(a),a);return 'array';}
 const types=args.map(a=>requireScalar(w(a),a));if(['TRUE','FALSE','ISBLANK','AND','OR','NOT','CONTAINSSTRING'].includes(name))return 'boolean';if(name==='BLANK')return 'blank';if(name==='COALESCE'){const non=types.filter(x=>x!=='blank');if(non.every(x=>numeric(x)))return 'decimal';if(non.some(x=>x!==non[0]))fail('COALESCE : types incompatibles.',n);return non[0]||'blank';}
 for(let i=0;i<types.length;i++)num(types[i],args[i]);return 'decimal';
 }
 const type=walk(ast,{current:t.id,rows:new Set([t.id])});if(typeof type!=='string'||type==='blank') {if(type!=='blank')fail('Une colonne calculée doit retourner une valeur, pas une table.');}
 const result={ast,type:type==='blank'?'text':type,deps:[...deps.values()],relations:[...relations],compute:f.compute};cache.set(f,result);return result;
}
function compile(p,t,source,fieldId){const compute={kind:'formula',source,ast:parse(source)},f={id:fieldId||'__draft_formula__',type:'computed',name:'Formule',compute};const result=inspect(p,t,f);return {...compute,ast:result.ast};}
function print(ast,p,pretty=false,level=0){const indent=n=>'    '.repeat(n),q=v=>typeof v==='string'?'\"'+v.replace(/\"/g,'\"\"')+'\"':JSON.stringify(v);
 const pr=(n,l=level)=>print(n,p,pretty,l);
 if(ast.k==='lit')return ast.v===null?'BLANK()':typeof ast.v==='boolean'?(ast.v?'TRUE()':'FALSE()'):q(ast.v);
 if(ast.k==='col'){const t=ast.tableId?C.table(p,ast.tableId):null,f=t&&C.field(t,ast.fieldId);return (t?quoteTable(t.name):ast.tableName?quoteTable(ast.tableName):'')+quoteColumn(f?.name||ast.fieldName||'?');}
 if(ast.k==='table')return quoteTable((ast.tableId?C.table(p,ast.tableId)?.name:ast.tableName)||'?');
 if(ast.k==='un')return ast.op+pr(ast.a);if(ast.k==='bin')return '('+pr(ast.a)+' '+ast.op+' '+pr(ast.b)+')';
 const args=ast.args.map((a,i)=>{if(i===0&&ast.relationId&&ast.name.startsWith('GEAP_'))return q(p.relations.find(r=>r.id===ast.relationId)?.name||a.v);return pr(a,level+1);});if(!args.length)return ast.name+'()';if(pretty&&args.length===1&&!args[0].includes('\n'))return ast.name+'('+args[0]+')';return pretty?ast.name+'(\n'+args.map(a=>indent(level+1)+a).join(',\n')+'\n'+indent(level)+')':ast.name+'('+args.join(', ')+')';
}
function evaluate(p,t,f,row){const ast=inspect(p,t,f).ast;let steps=0;const num=v=>blank(v)?0:Number(v),text=v=>blank(v)?'':typeof v==='boolean'?(v?'TRUE':'FALSE'):String(v),truth=v=>!!v;
 function run(n,env){if(++steps>MAX_STEPS)fail('Limite de calcul dépassée : réduisez les itérations.');const ev=a=>run(a,env),colValue=a=>env.rows.get(a.tableId)?.[a.fieldId]??null;
 const rows=arg=>{const v=ev(arg);if(!v?.tableId||!Array.isArray(v.rows))fail('Table attendue.');return v;};
 const numbers=values=>values.filter(v=>!blank(v)).map(Number).filter(Number.isFinite);
 const aggregate=(name,values)=>{const a=numbers(values);if(!a.length)return null;if(name==='SUM'||name==='SUMX')return a.reduce((x,y)=>x+y,0);if(name==='AVERAGE'||name==='AVERAGEX')return a.reduce((x,y)=>x+y,0)/a.length;if(name==='MIN'||name==='MINX')return Math.min(...a);return Math.max(...a);};
 const relationRows=()=>{const r=p.relations.find(r=>r.id===n.relationId);return C.relationRows(p,r,env.current,env.rows.get(env.current));};
 if(n.k==='lit')return n.v;if(n.k==='col')return colValue(n);if(n.k==='table')return {tableId:n.tableId,rows:C.table(p,n.tableId).rows};if(n.k==='un')return n.op==='-'?-num(ev(n.a)):num(ev(n.a));
 if(n.k==='bin'){const a=ev(n.a);if(n.op==='&&')return truth(a)&&truth(ev(n.b));if(n.op==='||')return truth(a)||truth(ev(n.b));const b=ev(n.b);switch(n.op){case '+':return blank(a)&&blank(b)?null:num(a)+num(b);case '-':return blank(a)&&blank(b)?null:num(a)-num(b);case '*':return blank(a)||blank(b)?null:num(a)*num(b);case '/':if(blank(a))return null;if(num(b)===0)fail('Division par zéro : utilisez DIVIDE.');return num(a)/num(b);case '^':return num(a)**num(b);case '&':return text(a)+text(b);case '=':return equal(a,b,false);case '==':return equal(a,b,true);case '<>':return !equal(a,b,false);case '>':return compare(a,b)>0;case '<':return compare(a,b)<0;case '>=':return compare(a,b)>=0;case '<=':return compare(a,b)<=0;}}
 const name=n.name,a=n.args;
 if(name==='IF')return ev(a[0])?ev(a[1]):ev(a[2]);if(name==='COALESCE'){for(const x of a){const v=ev(x);if(!blank(v))return v;}return null;}if(name==='AND')return truth(ev(a[0]))&&truth(ev(a[1]));if(name==='OR')return truth(ev(a[0]))||truth(ev(a[1]));if(name==='NOT')return !truth(ev(a[0]));if(name==='TRUE')return true;if(name==='FALSE')return false;if(name==='BLANK')return null;if(name==='ISBLANK')return blank(ev(a[0]));
 if(name==='DIVIDE'){const b=num(ev(a[1]));return b===0?(a[2]?ev(a[2]):null):num(ev(a[0]))/b;}if(name==='ABS')return Math.abs(num(ev(a[0])));if(name==='ROUND'){const places=num(ev(a[1]));if(!Number.isInteger(places)||Math.abs(places)>12)fail('ROUND : décimales entières entre -12 et 12.');const scale=10**places,v=num(ev(a[0]));return Math.sign(v)*Math.round((Math.abs(v)+Number.EPSILON)*scale)/scale;}
 if(name==='CONTAINSSTRING'){const pattern=text(ev(a[1]));let rx='';for(let i=0;i<pattern.length;i++){let c=pattern[i];if(c==='~'&&i+1<pattern.length)c=pattern[++i];else if(c==='*'){rx+='[\\s\\S]*';continue;}else if(c==='?'){rx+='[\\s\\S]';continue;}rx+=c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}return new RegExp(rx,'iu').test(text(ev(a[0])));}
 if(name==='RELATED'){const matches=relationRows();if(matches.length>1)fail('RELATED requiert une valeur unique.');return matches[0]?.[a[0].fieldId]??null;}
 if(name==='RELATEDTABLE'||name==='GEAP_RELATEDTABLE')return {tableId:C.relationTarget(p.relations.find(r=>r.id===n.relationId),env.current),rows:relationRows()};
 if(['GEAP_FIRST','GEAP_VALUES','GEAP_DISTINCTCOUNT'].includes(name)){const values=relationRows().map(row=>row[a[1].fieldId]).filter(v=>!C.empty(v));if(name==='GEAP_FIRST')return values.length?C.clone(values[0]):null;if(name==='GEAP_VALUES')return C.clone(values);return new Set(values.map(v=>JSON.stringify(v))).size;}
 if(['SUM','AVERAGE','DISTINCTCOUNT'].includes(name)||(['MIN','MAX'].includes(name)&&a.length===1)){const values=C.table(p,a[0].tableId).rows.map(row=>row[a[0].fieldId]);return name==='DISTINCTCOUNT'?(values.length?new Set(values.map(v=>blank(v)?'__blank':JSON.stringify(v))).size:null):aggregate(name,values);}
 if(name==='COUNTROWS'){const table=rows(a[0]);return table.rows.length||null;}
 if(['SUMX','AVERAGEX','MINX','MAXX','FILTER','CONCATENATEX'].includes(name)){const table=rows(a[0]),values=[],selected=[];for(const row of table.rows){const inner={current:table.tableId,rows:new Map(env.rows).set(table.tableId,row)},v=run(a[1],inner);if(name==='FILTER'){if(v)selected.push(row);}else values.push(v);}if(name==='FILTER')return {...table,rows:selected};if(name==='CONCATENATEX')return values.map(text).join(a[2]?text(ev(a[2])):'');return aggregate(name,values);}
 if(name==='MIN'||name==='MAX'){const x=num(ev(a[0])),y=num(ev(a[1]));return name==='MIN'?Math.min(x,y):Math.max(x,y);}
 if(name==='GEAP_ARRAY')return a.map(ev).filter(v=>!C.empty(v)&&String(v).trim()!=='');
 if(name==='GEAP_DISTANCE')return C.distance(ev(a[0]),ev(a[1]));
 if(name==='GEAP_CAST'){const v=ev(a[0]);return C.empty(v)?null:C.cast({type:a[1].v,name:f.name},v);}
 if(name==='GEAP_TEST'){const attr=C.field(C.table(p,a[0].tableId),a[0].fieldId),tt=C.table(p,a[0].tableId);return C.match(p,tt,{[attr.id]:ev(a[0])},{fieldId:attr.id,op:a[1].v,value:ev(a[2])});}
 if(name==='GEAP_TEXTJOIN'){const values=a.slice(3).map(x=>{const v=ev(x);if(C.empty(v))return '';return x.k==='col'?C.display(p,C.table(p,x.tableId),C.field(C.table(p,x.tableId),x.fieldId),v):text(v);}).filter(Boolean);return text(ev(a[1]))+values.join(text(ev(a[0])))+text(ev(a[2]));}
 fail('Fonction non implémentée : '+name);
 }
 const value=run(ast,{current:t.id,rows:new Map([[t.id,row]])});if(typeof value==='number'&&!Number.isFinite(value))fail('Le calcul produit un nombre non fini.');return value;
}
function equal(a,b,strict){if(strict&&(blank(a)||blank(b)))return blank(a)&&blank(b);if(!strict){if(blank(a))a=typeof b==='string'?'':typeof b==='boolean'?false:0;if(blank(b))b=typeof a==='string'?'':typeof a==='boolean'?false:0;}return typeof a==='string'&&typeof b==='string'?norm(a)===norm(b):a===b;}
function compare(a,b){if(blank(a))a=typeof b==='string'?'':0;if(blank(b))b=typeof a==='string'?'':0;if(typeof a==='string'&&typeof b==='string'){a=norm(a);b=norm(b);}return a>b?1:a<b?-1:0;}
function legacy(p,t,f){if(f.compute?.kind==='formula')return print(inspect(p,t,f).ast,p,true);const x=f.compute||{},ref=(id,tid=t.id)=>quoteTable(C.table(p,tid).name)+quoteColumn(C.field(C.table(p,tid),id).name),lit=v=>v===null||v===undefined?'BLANK()':typeof v==='boolean'?(v?'TRUE()':'FALSE()'):typeof v==='string'?'\"'+v.replace(/\"/g,'\"\"')+'\"':JSON.stringify(v),operand=o=>o?.fieldId?ref(o.fieldId):lit(o?.value),rel=p.relations.find(r=>r.id===x.relationId),dest=rel&&C.relationTarget(rel,t.id),canMany=rel&&C.relationSource(rel)===t.id&&p.relations.filter(r=>C.relationSource(r)===t.id&&C.relationTarget(r,t.id)===dest).length===1,canOne=rel&&rel.kind!=='match'&&rel.childTableId===t.id&&p.relations.filter(r=>r.kind!=='match'&&r.childTableId===t.id&&r.parentTableId===dest).length===1,related=rel?(canMany?'RELATEDTABLE('+quoteTable(C.table(p,dest).name)+')':'GEAP_RELATEDTABLE('+lit(rel.name)+')'):'';
 if(f.type==='array')return 'GEAP_ARRAY('+(x.sources||[]).map(id=>ref(id)).join(', ')+')';
 if(x.kind==='math'){const a=operand(x.left),b=operand(x.right),op={add:'+',subtract:'-',multiply:'*',divide:'/'}[x.operation],body=x.operation==='percent'?'('+a+' * '+b+') / 100':x.operation==='divide'?'DIVIDE('+a+', '+b+')':a+' '+op+' '+b;return 'IF(OR(ISBLANK('+a+'), ISBLANK('+b+')), BLANK(), '+body+')';}
 if(x.kind==='lookup'&&x.mode!=='all'&&canOne){const value='RELATED('+ref(x.fieldId,dest)+')';return 'IF('+value+' == \"\", BLANK(), '+value+')';}
 if(x.kind==='lookup')return (x.mode==='all'?'GEAP_VALUES':'GEAP_FIRST')+'('+lit(rel?.name||'?')+', '+ref(x.fieldId,dest)+')';
 if(x.kind==='rollup'){if(x.operation==='count')return 'COALESCE(COUNTROWS('+related+'), 0)';if(x.operation==='unique')return 'GEAP_DISTINCTCOUNT('+lit(rel.name)+', '+ref(x.fieldId,dest)+')';const expr=({sum:'SUMX',avg:'AVERAGEX',min:'MINX',max:'MAXX'})[x.operation]+'('+related+', '+ref(x.fieldId,dest)+')';return x.operation==='sum'?'COALESCE('+expr+', 0)':expr;}
 if(x.kind==='template')return 'GEAP_TEXTJOIN('+[lit(x.separator??' '),lit(x.prefix||''),lit(x.suffix||''),...(x.fields||[]).map(id=>ref(id))].join(', ')+')';
 if(x.kind==='distance')return 'GEAP_DISTANCE('+ref(x.fromFieldId)+', '+ref(x.toFieldId)+')';
 if(x.kind==='if')return 'IF(GEAP_TEST('+ref(x.condition.fieldId)+', '+lit(x.condition.op)+', '+lit(x.condition.value)+'), GEAP_CAST('+operand(x.then)+', '+lit(x.valueType||'text')+'), GEAP_CAST('+operand(x.else)+', '+lit(x.valueType||'text')+'))';
 return '';
}
function format(source,p){return print(parse(source),p||{tables:[],relations:[]},true);}
return {compile,inspect,evaluate,legacy,print,format,tokenize,specs,quoteTable,quoteColumn};
});

/* GEAP — types métier, calculs déclaratifs et sources de collections. */
(function(root,factory){if(typeof module!=='undefined'&&module.exports)module.exports=factory;else root.GEAPAdvancedCore=factory;})(typeof window!=='undefined'?window:globalThis,function(C){
'use strict';
const NUMERIC=['integer','decimal','duration'];
const COLLECTIONS=['list','cards','table','grid','tiles','checklist','calendar','kanban','gallery','carousel','map'];
const ARRAY_TYPES=['array','multiselect','images','files'];
const FILE_TYPES=['application/pdf','text/plain','text/csv','application/json','application/zip','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation','image/png','image/jpeg','image/webp','image/gif'];
const MAX_FILE=2*1024*1024,MAX_MEDIA=10;
const fail=m=>{throw new Error(m);},scalarType=f=>!['array','relation','image','images','files','location','multiselect'].includes(effectiveType(f));
const arrayValue=v=>Array.isArray(v)?v:typeof v==='string'&&v.trim().startsWith('[')?JSON.parse(v):typeof v==='string'?v.split(';'):[];
function location(v){if(C.empty(v))return null;let a=v;if(typeof a==='string'){const s=a.trim();if(!s)return null;if(s[0]==='{')a=JSON.parse(s);else{const parts=s.includes(';')?s.split(';'):s.split(',');if(parts.length!==2)fail('Localisation attendue : latitude, longitude.');a={lat:parts[0],lng:parts[1]};}}if(!a||Array.isArray(a)||typeof a!=='object')fail('Localisation invalide.');const num=x=>typeof x==='number'?x:Number(String(x).trim().replace(',','.'));if(C.empty(a.lat)||C.empty(a.lng))fail('Renseignez latitude et longitude.');const lat=num(a.lat),lng=num(a.lng);if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat< -90||lat>90||lng< -180||lng>180)fail('Latitude entre −90 et 90 ; longitude entre −180 et 180.');return {lat,lng};}
function safeFile(item){if(!item||typeof item!=='object'||typeof item.data!=='string')return null;const m=item.data.match(/^data:([^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/);if(!m||!FILE_TYPES.includes(m[1]))return null;const size=Math.floor(m[2].length*3/4)-(m[2].endsWith('==')?2:m[2].endsWith('=')?1:0);if(size>MAX_FILE||size<0)return null;return {name:String(item.name||'Document').replace(/[\u0000-\u001f]/g,'').slice(0,180),type:m[1],size,data:item.data};}
function imageItems(value){if(C.empty(value))return [];const items=Array.isArray(value)?value:[value];return items.map((item,i)=>typeof item==='string'?{src:item,name:'Photo '+(i+1)}:{src:item?.src,name:String(item?.name||'Photo '+(i+1)).slice(0,180)}).filter(item=>!!C.imageSource(item.src));}
function castAdvanced(f,v){const label='« '+f.name+' »';switch(f.type){
 case 'email':{const s=String(v).trim();if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s))fail(label+' attend une adresse de courriel.');return s;}
 case 'phone':{const s=String(v).trim();if(!/^\+?[\d\s().-]+$/.test(s)||s.replace(/\D/g,'').length<6||s.replace(/\D/g,'').length>20)fail(label+' attend un numéro de téléphone.');return s;}
 case 'richtext':return String(v);
 case 'datetime':{const s=String(v);if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?$/.test(s))fail(label+' attend une date et une heure.');C.cast({type:'date',name:f.name},s.slice(0,10));if(Number(s.slice(11,13))>23||Number(s.slice(14,16))>59||Number(s.slice(17,19)||0)>59)fail('Heure invalide.');const n=Date.parse(s);if(!Number.isFinite(n))fail('Date et heure invalides.');return new Date(n).toISOString();}
 case 'time':{const s=String(v);if(!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(s))fail(label+' attend une heure HH:MM.');return s;}
 case 'duration':{let n;if(/^\d+:[0-5]\d$/.test(String(v)))n=Number(String(v).split(':')[0])*60+Number(String(v).split(':')[1]);else n=Number(String(v).trim().replace(',','.'));if(!Number.isFinite(n)||n<0)fail(label+' attend une durée positive en minutes, ou HH:MM.');if(Number.isFinite(f.min)&&n<f.min||Number.isFinite(f.max)&&n>f.max)fail('Durée hors de la plage autorisée.');return n;}
 case 'location':return location(v);
 case 'multiselect':{const a=arrayValue(v);if(f.required&&!a.length)fail(label+' est obligatoire.');if(a.some(x=>x&&typeof x==='object'))fail('Choix multiples : valeurs simples attendues.');return [...new Set(a.filter(x=>!C.empty(x)).map(x=>String(x).trim()).filter(Boolean))];}
 case 'images':{const a=arrayValue(v);if(f.required&&!a.length)fail(label+' est obligatoire.');if(a.length>MAX_MEDIA)fail('Dix photos maximum par attribut.');const photos=imageItems(a);if(photos.length!==a.length)fail('Une photo est invalide : image intégrée ou URL HTTPS attendue.');for(const x of photos)if(C.safeImage(x.src)&&x.src.length>MAX_FILE*4/3+200)fail('Photo trop volumineuse : 2 Mo maximum.');return photos;}
 case 'files':{const a=arrayValue(v);if(f.required&&!a.length)fail(label+' est obligatoire.');if(a.length>MAX_MEDIA)fail('Dix pièces jointes maximum par attribut.');const files=a.map(safeFile);if(files.some(x=>!x))fail('Pièce jointe invalide : format documentaire autorisé et 2 Mo maximum.');return files;}
 default:fail('Type non pris en charge : '+f.type);
}}
function effectiveType(f){if(!f)return '';if(f.type!=='computed')return f.type;return f.resultType||({math:'decimal',distance:'decimal',rollup:f.compute?.operation==='count'?'integer':'decimal',template:'text',if:f.compute?.valueType||'text',lookup:f.compute?.mode==='all'?'array':'text'})[f.compute?.kind]||'text';}
function resultType(p,t,f,seen=new Set()){if(f.type!=='computed')return f.type;if(seen.has(f.id))return 'text';seen.add(f.id);const x=f.compute||{};if(x.kind==='formula')return C.Formula.inspect(p,t,f).type;if(x.kind!=='lookup')return ({math:'decimal',distance:'decimal',rollup:['count','unique'].includes(x.operation)?'integer':'decimal',template:'text',if:x.valueType||'text'})[x.kind]||'text';if(x.mode==='all')return 'array';const rel=p.relations.find(r=>r.id===x.relationId),dt=C.table(p,C.relationTarget(rel||{},t.id)),df=C.field(dt,x.fieldId);return df?resultType(p,dt,df,seen):'text';}
function resolvedField(p,t,f,seen=new Set()){if(f.type!=='computed')return f;if(seen.has(f.id))return {...f,type:'text'};seen.add(f.id);const x=f.compute||{};if(x.kind==='lookup'&&x.mode!=='all'){const rel=p.relations.find(r=>r.id===x.relationId),dt=C.table(p,C.relationTarget(rel||{},t.id)),df=C.field(dt,x.fieldId);if(df){const base=resolvedField(p,dt,df,seen);return {...base,id:f.id,name:f.name,required:false,primary:false,format:f.format||base.format};}}return {...f,type:resultType(p,t,f),required:false,primary:false};}
function formattedNumber(f,v){const format=f.format;if(!format||!NUMERIC.includes(effectiveType(f)))return undefined;const opts={minimumFractionDigits:format.decimals??(format.kind==='currency'?2:0),maximumFractionDigits:format.decimals??(format.kind==='currency'?2:4)};if(format.kind==='currency'){opts.style='currency';opts.currency=format.currency||'EUR';}if(format.kind==='percent')opts.style='percent';return new Intl.NumberFormat('fr-FR',opts).format(Number(v));}
function displayAdvanced(p,t,f,v){if(f.type==='computed'){const kind=effectiveType(f);if(kind==='array')return (Array.isArray(v)?v:[]).map(x=>typeof x==='object'?x.name||JSON.stringify(x):String(x)).join(' · ');return C.display(p,t,resolvedField(p,t,f),v);}const formatted=formattedNumber(f,v);if(formatted!==undefined)return formatted;
 switch(f.type){case 'email':case 'phone':case 'richtext':case 'time':return String(v);case 'datetime':return new Intl.DateTimeFormat('fr-FR',{dateStyle:'short',timeStyle:'short'}).format(new Date(v));case 'duration':{const h=Math.floor(Number(v)/60),m=Number(v)%60;return (h?h+' h ':'')+(m||!h?new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(m)+' min':'');}case 'location':{try{const q=location(v);return q?q.lat.toFixed(5)+', '+q.lng.toFixed(5):'—';}catch{return 'Coordonnées invalides';}}case 'multiselect':return (Array.isArray(v)?v:[]).join(' · ');case 'images':return imageItems(v).length+' photo(s)';case 'files':return (Array.isArray(v)?v:[]).map(x=>x.name).join(' · ');default:return undefined;}}
function operand(row,o){if(o?.fieldId)return row[o.fieldId];return o?.value??null;}
function relationDependencies(p,t,rel){if(!rel)return [];if(rel.kind==='match')return [[rel.sourceTableId,rel.sourceFieldId],[rel.targetTableId,rel.targetFieldId]];return [[rel.childTableId,rel.childFieldId]];}
function dependencies(p,t,f){const x=f.compute||{};if(x.kind==='formula')return C.Formula.inspect(p,t,f).deps;if(f.type==='array')return (x.sources||[]).map(id=>[t.id,id]);if(f.type==='relation')return relationDependencies(p,t,p.relations.find(r=>r.id===x.relationId));const local=ids=>ids.filter(Boolean).map(id=>[t.id,id]);
 switch(x.kind){case 'math':return local([x.left?.fieldId,x.right?.fieldId]);case 'distance':return local([x.fromFieldId,x.toFieldId]);case 'if':return local([x.condition?.fieldId,x.then?.fieldId,x.else?.fieldId]);case 'template':return local(x.fields||[]);case 'lookup':case 'rollup':{const rel=p.relations.find(r=>r.id===x.relationId),dest=C.relationTarget(rel||{},t.id);return [...relationDependencies(p,t,rel),...(x.fieldId&&dest?[[dest,x.fieldId]]:[])];}default:return [];}}
function calculationOrder(p){const all=new Map();for(const t of p.tables)for(const f of t.fields)if(C.computed(f))all.set(f.id,{t,f});const ordered=[],state=new Map();function visit(item){const mark=state.get(item.f.id);if(mark===2)return;if(mark===1)fail('Calcul circulaire : '+item.t.name+'.'+item.f.name+'.');state.set(item.f.id,1);for(const [tid,fid]of dependencies(p,item.t,item.f)){const sf=C.field(C.table(p,tid),fid);if(!sf)fail('Attribut de calcul introuvable dans '+item.f.name+'.');if(all.has(fid))visit(all.get(fid));}state.set(item.f.id,2);ordered.push(item);}for(const item of all.values())visit(item);return ordered;}
function distance(a,b){a=location(a);b=location(b);if(!a||!b)return null;const rad=n=>n*Math.PI/180,dlat=rad(b.lat-a.lat),dlon=rad(b.lng-a.lng),v=Math.sin(dlat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlon/2)**2;return 6371.0088*2*Math.atan2(Math.sqrt(Math.min(1,v)),Math.sqrt(Math.max(0,1-v)));}
function calculate(p,t,f,row){const x=f.compute||{};if(x.kind==='formula')return C.Formula.evaluate(p,t,f,row);if(f.type==='array')return (x.sources||[]).map(id=>row[id]).filter(v=>!C.empty(v)&&String(v).trim()!=='');if(f.type==='relation'){const rel=p.relations.find(r=>r.id===x.relationId),dt=C.table(p,C.relationTarget(rel||{},t.id));return dt?C.relationRows(p,rel,t.id,row).map(r=>r[C.pk(dt).id]):[];}
 let value=null;switch(x.kind){case 'math':{const a=operand(row,x.left),b=operand(row,x.right);if(C.empty(a)||C.empty(b))return null;const aa=Number(a),bb=Number(b);if(!Number.isFinite(aa)||!Number.isFinite(bb))return null;value=({add:()=>aa+bb,subtract:()=>aa-bb,multiply:()=>aa*bb,divide:()=>bb===0?null:aa/bb,percent:()=>aa*bb/100})[x.operation]?.();if(value===null||!Number.isFinite(value))return null;return value;}
 case 'distance':return distance(row[x.fromFieldId],row[x.toFieldId]);
 case 'template':return String(x.prefix||'')+(x.fields||[]).map(id=>{const sf=C.field(t,id);return C.empty(row[id])?'':C.display(p,t,sf,row[id]);}).filter(Boolean).join(x.separator??' ')+String(x.suffix||'');
 case 'if':{const chosen=C.match(p,t,row,x.condition)?x.then:x.else;value=operand(row,chosen);return C.empty(value)?null:C.cast({type:x.valueType||'text',name:f.name},value);}
 case 'lookup':case 'rollup':{const rel=p.relations.find(r=>r.id===x.relationId),rows=C.relationRows(p,rel,t.id,row),values=rows.map(r=>r[x.fieldId]).filter(v=>!C.empty(v));if(x.kind==='lookup')return x.mode==='all'?C.clone(values):values.length?C.clone(values[0]):null;if(x.operation==='count')return rows.length;if(x.operation==='unique')return new Set(values.map(v=>JSON.stringify(v))).size;const nums=values.map(Number).filter(Number.isFinite);if(x.operation==='sum')return nums.reduce((a,b)=>a+b,0);if(!nums.length)return null;if(x.operation==='avg')return nums.reduce((a,b)=>a+b,0)/nums.length;if(x.operation==='min')return Math.min(...nums);if(x.operation==='max')return Math.max(...nums);return null;}
 default:fail('Calcul inconnu pour '+f.name);}}
function refreshAdvanced(p){for(const {t,f}of calculationOrder(p)){if(f.compute?.kind==='formula'){const v=C.Formula.inspect(p,t,f);if(f.type==='array'&&v.type!=='array')fail('Un tableau calculé doit retourner un tableau GEAP_ARRAY ou GEAP_VALUES.');}if(f.type==='computed')f.resultType=resultType(p,t,f);for(const row of t.rows)row[f.id]=calculate(p,t,f,row);}return p;}
function choiceValues(p,f,cfg={}){const source=cfg.tableId?cfg:f.choiceSource,table=source?C.table(p,source.tableId):null;const from=[...(f.choices||[]),...(table?table.rows.map(r=>r[source.fieldId]):[])];return [...new Set(from.filter(v=>!C.empty(v)).flatMap(v=>Array.isArray(v)?v:[v]).map(String))];}
function formValue(fd,f){if(f.type==='location'&&fd.has(f.id+'__lat')){const lat=fd.get(f.id+'__lat'),lng=fd.get(f.id+'__lng');return !lat&&!lng?'':{lat,lng};}if(f.type==='multiselect'&&fd.has(f.id+'__present'))return fd.getAll(f.id);const all=fd.getAll(f.id);return all.length?all.at(-1):undefined;}
function initialValue(f){return ['array','relation','multiselect','images','files'].includes(f.type)?[]:f.type==='boolean'?false:f.type==='computed'?null:'';}
function localDateTime(v){if(C.empty(v))return '';const d=new Date(v);if(Number.isNaN(d.getTime()))return '';const pad=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes())+(d.getSeconds()||d.getMilliseconds()?':'+pad(d.getSeconds())+(d.getMilliseconds()?'.'+String(d.getMilliseconds()).padStart(3,'0'):''):'');}
function contactURL(type,v){if(C.empty(v))return '';try{v=castAdvanced({type,name:'Contact'},v);}catch{return '';}return type==='email'?'mailto:'+encodeURIComponent(v):type==='phone'?'tel:'+v.replace(/[^+\d]/g,''):'';}
function inlineMarkdown(text){const rx=/(\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|\[([^\]\n]+)\]\(([^\s)]+)\))/g;let out='',last=0,m;while((m=rx.exec(text))){out+=C.esc(text.slice(last,m.index));out+=m[2]?'<strong>'+C.esc(m[2])+'</strong>':m[3]?'<em>'+C.esc(m[3])+'</em>':C.safeURL(m[5])?'<a href="'+C.esc(C.safeURL(m[5]))+'" target="_blank" rel="noopener noreferrer">'+C.esc(m[4])+'</a>':C.esc(m[0]);last=rx.lastIndex;}return out+C.esc(text.slice(last));}
function richHTML(value){let out='',list=false;for(const line of String(value||'').split(/\r?\n/)){const li=line.match(/^[-*] (.*)$/);if(li){if(!list){out+='<ul>';list=true;}out+='<li>'+inlineMarkdown(li[1])+'</li>';continue;}if(list){out+='</ul>';list=false;}const h=line.match(/^(#{1,3}) (.*)$/);out+=h?'<h'+(h[1].length+1)+'>'+inlineMarkdown(h[2])+'</h'+(h[1].length+1)+'>':line?'<p>'+inlineMarkdown(line)+'</p>':'';}return out+(list?'</ul>':'');}
const viewImageMode=c=>c.imageMode||(c.imageFieldId?'field':'auto');
const viewSubtitleMode=c=>c.subtitleMode||(c.subtitleFieldId?'field':'auto');
function collectionImages(t,row,c){const mode=viewImageMode(c);if(mode==='none')return [];if(mode==='fixed')return imageItems(c.imageSrc);const id=mode==='field'?c.imageFieldId:t.fields.find(f=>['image','images'].includes(effectiveType(f)))?.id;return imageItems(row?.[id]);}
function sourceRecords(p,c,s,row){if(c.source==='field'){const t=C.table(p,s.tableId);return {table:t,rows:row?[row]:[],fieldId:c.fieldId};}if(c.relationId&&(c.source!=='table')){const rel=p.relations.find(r=>r.id===c.relationId),t=C.table(p,C.relationTarget(rel||{},s.tableId));let rows=t?C.relationRows(p,rel,s.tableId,row):[];return {table:t,rows:filterRows(p,t,rows,c),relation:rel};}const t=C.table(p,c.tableId||s.tableId);return {table:t,rows:t?filterRows(p,t,t.rows,c):[]};}
function filterRows(p,t,rows,c){if(!t)return [];let out=rows.filter(row=>(c.filters||[]).every(f=>C.match(p,t,row,f)));if(c.sort?.fieldId){const dir=c.sort.direction==='desc'?-1:1;out=[...out].sort((a,b)=>{const aa=a[c.sort.fieldId],bb=b[c.sort.fieldId];return dir*(typeof aa==='number'&&typeof bb==='number'?aa-bb:String(aa??'').localeCompare(String(bb??''),'fr',{numeric:true}));});}if(c.limit)out=out.slice(0,c.limit);return out;}
function validTileURL(value){if(!value)return true;if(typeof value!=='string'||!value.includes('{z}')||!value.includes('{x}')||!value.includes('{y}'))return false;return C.safeURL(value.replace(/\{[zxy]\}/g,'0')).startsWith('https:');}
function viewErrors(p,t,c,label){const es=[],check=(ok,m)=>{if(!ok)es.push(label+' : '+m);},has=(id,types)=>!id||!!C.field(t,id)&&(!types||types.includes(effectiveType(C.field(t,id))));
 check(c.imageMode===undefined||['auto','field','fixed','none'].includes(c.imageMode),'mode photo invalide.');check(c.subtitleMode===undefined||['auto','field','none'].includes(c.subtitleMode),'mode de sous-titre invalide.');if(c.imageMode==='field')check(!!c.imageFieldId,'choisissez un attribut Image ou Photos multiples.');if(c.imageMode==='fixed')check(!!C.imageSource(c.imageSrc),'choisissez une image fixe valide.');if(c.subtitleMode==='field')check(!!c.subtitleFieldId,'choisissez un attribut de sous-titre.');
 for(const key of ['titleFieldId','subtitleFieldId','groupFieldId'])check(has(c[key]),'attribut de présentation absent.');check(has(c.imageFieldId,['image','images']),'attribut photo incompatible.');check(has(c.locationFieldId,['location']),'attribut GPS incompatible.');check(has(c.dateFieldId,['date','datetime']),'attribut de date incompatible.');check(has(c.checkedFieldId,['boolean']),'attribut de checklist incompatible.');check(validTileURL(c.tileUrl),'URL de fond cartographique invalide.');if(c.limit!==undefined)check(Number.isInteger(c.limit)&&c.limit>=1&&c.limit<=10000,'limite de collection invalide.');if(c.fields)check(Array.isArray(c.fields)&&c.fields.every(id=>has(id)),'colonnes de collection invalides.');for(const fl of c.filters||[])check(has(fl.fieldId)&&C.OPS.includes(fl.op),'filtre de collection invalide.');if(c.sort?.fieldId)check(has(c.sort.fieldId)&&['asc','desc'].includes(c.sort.direction),'tri de collection invalide.');return es;}
function validateAdvanced(p){const es=[],check=(ok,m)=>{if(!ok)es.push(m);};for(const t of p.tables||[])for(const f of t.fields||[]){if(f.choiceSource)check(!!C.field(C.table(p,f.choiceSource.tableId),f.choiceSource.fieldId),'Source de choix absente : '+f.name);if(f.choices)check(Array.isArray(f.choices)&&f.choices.every(x=>typeof x==='string'),'Liste de choix invalide.');if(f.format){check(NUMERIC.includes(effectiveType(f))&&['number','currency','percent'].includes(f.format.kind),'Format numérique incompatible : '+f.name);check(f.format.decimals===undefined||Number.isInteger(f.format.decimals)&&f.format.decimals>=0&&f.format.decimals<=6,'Nombre de décimales invalide.');if(f.format.kind==='currency')check(/^[A-Z]{3}$/.test(f.format.currency||'EUR'),'Devise invalide.');}
 if(['computed','array'].includes(f.type)&&f.compute?.kind==='formula'){try{const v=C.Formula.inspect(p,t,f);check(f.type!=='array'||v.type==='array','Type de résultat incompatible : '+f.name);}catch(e){es.push(f.name+' : '+e.message);}continue;}
 if(f.type==='computed'){const x=f.compute||{},local=id=>!!C.field(t,id),operandOK=o=>!!o&&(o.fieldId?local(o.fieldId):['string','number','boolean'].includes(typeof o.value));check(['math','lookup','rollup','if','template','distance'].includes(x.kind),'Calcul inconnu : '+f.name);
 if(x.kind==='math'){check(['add','subtract','multiply','divide','percent'].includes(x.operation)&&operandOK(x.left)&&operandOK(x.right),'Calcul numérique incomplet : '+f.name);for(const o of [x.left,x.right])if(o?.fieldId)check(NUMERIC.includes(effectiveType(C.field(t,o.fieldId))),'Le calcul requiert un nombre : '+f.name);else check(typeof o?.value==='number'&&Number.isFinite(o.value),'Constante numérique invalide.');}
 if(['lookup','rollup'].includes(x.kind)){const rel=p.relations.find(r=>r.id===x.relationId),dt=C.table(p,C.relationTarget(rel||{},t.id)),df=C.field(dt,x.fieldId);check(!!dt,'Relation de calcul absente : '+f.name);if(x.kind==='lookup')check(!!df&&['first','all'].includes(x.mode||'first'),'Lookup incomplet : '+f.name);else{check(['count','sum','avg','min','max','unique'].includes(x.operation),'Agrégation inconnue.');if(x.operation!=='count')check(!!df&&(x.operation==='unique'||NUMERIC.includes(effectiveType(df))),'Attribut d’agrégation incompatible : '+f.name);}}
 if(x.kind==='template')check(Array.isArray(x.fields)&&x.fields.length>0&&x.fields.every(local)&&[x.prefix||'',x.suffix||'',x.separator??' '].every(v=>typeof v==='string'),'Assemblage incomplet : '+f.name);
 if(x.kind==='if')check(local(x.condition?.fieldId)&&C.OPS.includes(x.condition?.op)&&operandOK(x.then)&&operandOK(x.else)&&['text','decimal','boolean','date','datetime'].includes(x.valueType||'text'),'Condition incomplète : '+f.name);
 if(x.kind==='distance')check([x.fromFieldId,x.toFieldId].every(id=>effectiveType(C.field(t,id))==='location'),'La distance requiert deux attributs GPS.');
 }}
 try{calculationOrder(p);}catch(e){es.push(e.message);}
 for(const s of p.screens||[]){const t=C.table(p,s.tableId);if(COLLECTIONS.includes(s.type))es.push(...viewErrors(p,t,s.view||{},s.name));for(const c of s.components||[]){if(c.visibleWhen)check(!!C.field(t,c.visibleWhen.fieldId)&&C.OPS.includes(c.visibleWhen.op),'Condition d’affichage invalide dans '+s.name);
 if(['collection','map','gallery','carousel'].includes(c.type)){const fieldSource=c.source==='field'||(!c.source&&c.fieldId&&c.type!=='collection'),mode=fieldSource?'field':c.relationId&&c.source!=='table'?'relation':'table',cfg={...c,source:mode};let dt=t;if(mode==='field'){const f=C.field(t,c.fieldId);check(!!f&&(c.type==='map'?effectiveType(f)==='location':['image','images'].includes(effectiveType(f))),'Source de composant incompatible dans '+s.name);}else{if(mode==='relation')check(s.type==='detail'&&!!p.relations.find(r=>r.id===c.relationId),'Une collection liée requiert une fiche et une relation.');const src=sourceRecords(p,cfg,s,null);dt=src.table;check(!!dt,'Table de collection absente dans '+s.name);if(c.type==='collection')check(COLLECTIONS.includes(c.layout||'cards'),'Présentation de collection invalide.');if(c.targetScreenId){const target=C.screen(p,c.targetScreenId);check(target?.type==='detail'&&target.tableId===dt?.id,'Destination liée incompatible dans '+s.name);}}es.push(...viewErrors(p,dt,c,s.name));}
 if(c.type==='richtext'&&c.fieldId)check(!!C.field(t,c.fieldId),'Source de texte enrichi absente.');if(c.type==='contact')check(['email','phone'].includes(effectiveType(C.field(t,c.fieldId))),'Source de contact invalide.');
 }}return [...new Set(es)];}
async function readMediaFiles(files,kind){const list=Array.from(files||[]);if(list.length>MAX_MEDIA)fail('Dix fichiers maximum par attribut.');const extensions={pdf:'application/pdf',txt:'text/plain',csv:'text/csv',json:'application/json',zip:'application/zip',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'};const out=[];for(const f of list){if(f.size>MAX_FILE)fail('« '+f.name+' » dépasse 2 Mo.');const mime=f.type||extensions[f.name.split('.').at(-1).toLowerCase()];if(kind==='images'&&!['image/png','image/jpeg','image/webp','image/gif'].includes(mime)||kind==='files'&&!FILE_TYPES.includes(mime))fail('Format de fichier non pris en charge : '+f.name);let data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Lecture impossible : '+f.name));reader.readAsDataURL(f);});data=String(data).replace(/^data:[^;,]*;base64,/,'data:'+mime+';base64,');out.push(kind==='images'?{name:f.name,src:data}:{name:f.name,type:mime,size:f.size,data});}return out;}
return {viewImageMode,viewSubtitleMode,collectionImages,NUMERIC,COLLECTION_TYPES:COLLECTIONS,ARRAY_TYPES,MAX_FILE,MAX_MEDIA,FILE_TYPES,castAdvanced,displayAdvanced,effectiveType,resultType,location,safeFile,imageItems,calculationOrder,dependencies,calculate,refreshAdvanced,validateAdvanced,choiceValues,formValue,initialValue,localDateTime,contactURL,richHTML,sourceRecords,filterRows,validTileURL,readMediaFiles,scalarType,distance,resolvedField};
});

/* GEAP — dispositions déterministes, communes aux anciens et nouveaux projets. */
(function(g,f){if(typeof module!=='undefined'&&module.exports)module.exports=f;else g.GEAPResponsiveCore=f;})(typeof window!=='undefined'?window:globalThis,function(C){
'use strict';
const FORMATS=['phone','tablet','desktop'],LABELS={phone:'Smartphone',tablet:'Tablette',desktop:'Ordinateur'},BREAKPOINTS={tablet:640,desktop:1024};
const KEYS=['columns','fieldColumns','sectionColumns','maxWidth','align','gap','imageSize','navigation','visible'];
function breakpoints(p){return {...BREAKPOINTS,...p.responsive?.breakpoints};}
function format(width,p={}){const b=breakpoints(p);return width<b.tablet?'phone':width<b.desktop?'tablet':'desktop';}
function defaults(kind,device){const i=FORMATS.indexOf(device),gallery=kind==='gallery',tiles=kind==='tiles';return {columns:(gallery?[2,3,5]:tiles?[2,3,4]:kind==='cards'?[1,2,4]:[1,1,1])[i],fieldColumns:[1,2,2][i],sectionColumns:[1,2,2][i],maxWidth:1200,align:'center',gap:[12,16,20][i],imageSize:'medium',navigation:['bottom','top','side'][i],visible:true};}
function overrides(config,device){return config?.mode==='custom'?config.overrides?.[device]||{}:{};}
function resolve(p,screen,component,device,kind){const base=defaults(kind||screen?.type||'home',device),v={...base,...overrides(screen?.responsive,device),...overrides(component?.responsive,device)},nav=C.navigationModel(p).formats[device];v.navigation=nav==='auto'?base.navigation:nav;return v;}
function validateConfig(config,label){const errors=[];if(config===undefined)return errors;if(!config||typeof config!=='object'||Array.isArray(config)||!['auto','custom'].includes(config.mode))return [label+' : disposition responsive invalide.'];if(config.overrides!==undefined&&(!config.overrides||typeof config.overrides!=='object'||Array.isArray(config.overrides)))return [label+' : formats responsive invalides.'];for(const [device,props]of Object.entries(config.overrides||{})){if(!FORMATS.includes(device)||!props||typeof props!=='object'||Array.isArray(props)){errors.push(label+' : format responsive inconnu.');continue;}for(const [key,value]of Object.entries(props)){let ok=KEYS.includes(key);if(['columns','fieldColumns','sectionColumns'].includes(key))ok=Number.isInteger(value)&&value>=1&&value<=(key==='columns'?6:3);if(key==='maxWidth')ok=Number.isInteger(value)&&value>=240&&value<=2400;if(key==='gap')ok=Number.isInteger(value)&&value>=0&&value<=48;if(key==='align')ok=['start','center','end','stretch'].includes(value);if(key==='imageSize')ok=['small','medium','large'].includes(value);if(key==='navigation')ok=['auto','bottom','top','side'].includes(value);if(key==='visible')ok=typeof value==='boolean';if(!ok)errors.push(label+' : propriété responsive invalide ('+key+').');}}return errors;}
function validate(p){const errors=[];if(p.responsive!==undefined&&(!p.responsive||typeof p.responsive!=='object'||Array.isArray(p.responsive)))errors.push('Configuration responsive du projet invalide.');if(p.responsive?.breakpoints!==undefined&&(!p.responsive.breakpoints||typeof p.responsive.breakpoints!=='object'||Array.isArray(p.responsive.breakpoints)))errors.push('Points de rupture responsive invalides.');if(p.responsive!==undefined){const b=breakpoints(p);if(!Number.isInteger(b.tablet)||!Number.isInteger(b.desktop)||b.tablet<480||b.desktop<=b.tablet||b.desktop>2400)errors.push('Points de rupture responsive invalides.');}for(const s of p.screens||[]){errors.push(...validateConfig(s.responsive,s.name));for(const c of s.components||[])errors.push(...validateConfig(c.responsive,s.name+' / composant'));}return errors;}
return {FORMATS,LABELS,BREAKPOINTS,KEYS,breakpoints,format,defaults,overrides,resolve,validateConfig,validate};
});

/* GEAP — modèle logique visible, navigation commune et ordre des composants. */
(function(g,f){if(typeof module!=='undefined'&&module.exports)module.exports=f;else g.GEAPWorkflowCore=f;})(typeof window!=='undefined'?window:globalThis,function(C){
'use strict';
const NAV_FORMATS=['phone','tablet','desktop'],NAV_POSITIONS=['main','secondary','hidden'];
const dataFields=t=>(t?.fields||[]).filter(f=>f.type!=='relation');
function navigationModel(p){
 const explicit=p.navigation!==undefined,stored=Array.isArray(p.navigation?.items)?p.navigation.items:[],home=C.screen(p,p.homeScreenId),formats={};
 for(const format of NAV_FORMATS)formats[format]=p.navigation?.formats?.[format]||(!explicit&&home?.responsive?.mode==='custom'?home.responsive.overrides?.[format]?.navigation:null)||'auto';
 const items=explicit?stored.map(x=>({...x})):p.screens.map(s=>({screenId:s.id,position:C.navPosition(s),label:s.navLabel||s.name,icon:s.navIcon||''}));
 for(const s of p.screens)if(!items.some(x=>x.screenId===s.id))items.push({screenId:s.id,position:'hidden',label:s.name,icon:''});
 return {items:items.map(x=>({...x,label:x.label??C.screen(p,x.screenId)?.name??'',icon:x.icon||''})),formats};
}
function setNavigation(p,model){
 p.navigation=C.clone(model);
 for(const s of p.screens){for(const key of ['menu','navigation','navLabel','navIcon'])delete s[key];for(const props of Object.values(s.responsive?.overrides||{}))delete props.navigation;}
 return p;
}
function navigationScreens(p,position){return navigationModel(p).items.filter(x=>x.position===position).map(x=>{const s=C.screen(p,x.screenId);return s?{...s,navLabel:x.label,navIcon:x.icon}:null;}).filter(Boolean);}
function validateNavigation(p){
 if(p.navigation===undefined)return [];
 const n=p.navigation,errors=[],check=(ok,m)=>{if(!ok)errors.push(m);};
 if(!n||typeof n!=='object'||Array.isArray(n)||!Array.isArray(n.items))return ['Configuration de navigation invalide.'];
 const ids=new Set();for(const x of n.items){if(!x||typeof x!=='object'){errors.push('Destination de navigation invalide.');continue;}check(!!C.screen(p,x.screenId)&&!ids.has(x.screenId),'Destination de navigation absente ou dupliquée.');ids.add(x.screenId);check(NAV_POSITIONS.includes(x.position),'Position de navigation invalide.');check(x.label===undefined||typeof x.label==='string'&&x.label.trim().length>0&&x.label.length<=160,'Libellé de navigation invalide.');check(x.icon===undefined||typeof x.icon==='string'&&x.icon.length<=160,'Icône de navigation invalide.');}
 if(n.formats!==undefined){if(!n.formats||typeof n.formats!=='object'||Array.isArray(n.formats))errors.push('Formats de navigation invalides.');else for(const [format,value]of Object.entries(n.formats))check(NAV_FORMATS.includes(format)&&['auto','bottom','top','side'].includes(value),'Présentation de navigation invalide.');}
 return errors;
}
function moveComponent(p,screenId,fromId,toId,after=false){return C.transact(p,q=>{const s=C.screen(q,screenId),list=s?.components,from=list?.findIndex(c=>c.id===fromId),to=list?.findIndex(c=>c.id===toId);if(from===undefined||from<0||to<0)throw new Error('Composant à déplacer introuvable.');if(from===to)return;const [item]=list.splice(from,1),index=list.findIndex(c=>c.id===toId);list.splice(index+(after?1:0),0,item);});}
function previewSelection(p,state,screenId){
 const s=C.screen(p,screenId);if(!s)throw new Error('Écran introuvable.');
 if(state?.screenId===screenId&&!state.mode)return C.clone(state);
 const t=C.table(p,s.tableId),old=C.screen(p,state?.screenId),rows=t?.rows||[],k=C.pk(t)?.id,current=old?.tableId===s.tableId?rows.find(r=>C.key(r[k])===C.key(state?.key)):null;
 return {screenId,key:s.type==='detail'?(current||rows[0])?.[k]??null:null};
}
return {dataFields,navigationModel,setNavigation,navigationScreens,validateNavigation,moveComponent,previewSelection};
});

/* Préférences locales, filtres de consultation et chaînes d’actions structurées. */
(function(g){'use strict';const factory=function(C){
 const TYPES=['condition','set-values','create-record','delete-record','preference','notify','open','form','back'];
 const fail=m=>{throw new Error(m);},own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const defaults=p=>Object.fromEntries((p.preferences||[]).map(x=>[x.id,x.defaultValue]));
 function preferences(p,values={}){if(!values||typeof values!=='object'||Array.isArray(values))fail('Préférences locales invalides.');const out=defaults(p);for(const d of p.preferences||[])if(own(values,d.id)){if(typeof values[d.id]!=='boolean')fail('Préférence booléenne invalide : '+d.name);out[d.id]=values[d.id];}return out;}
 function filtered(p,values,tableId,rows){const filters=(p.globalFilters||[]).filter(f=>f.tableId===tableId&&values[f.preferenceId]===true).flatMap(f=>f.filters);return filters.length?C.filterRows(p,C.table(p,tableId),rows,{filters}):rows;}
 function validate(p){const errors=[],check=(v,m)=>{if(!v)errors.push(m);},ids=new Set();
  if(p.preferences!==undefined&&!Array.isArray(p.preferences))return ['Liste de préférences invalide.'];if(p.globalFilters!==undefined&&!Array.isArray(p.globalFilters))return ['Liste de filtres globaux invalide.'];
  for(const d of p.preferences||[]){check(d&&/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(d.id)&&!ids.has(d.id),'Identifiant de préférence invalide ou dupliqué.');ids.add(d?.id);check(typeof d?.name==='string'&&d.name.trim().length>0&&d.name.length<=160&&typeof d.defaultValue==='boolean','Préférence locale invalide.');}
  const pref=id=>(p.preferences||[]).some(d=>d.id===id);
  function test(t,c){check(!!c&&C.OPS.includes(c.op)&&!!C.field(t,c.fieldId),'Condition de colonne invalide.');if(C.field(t,c?.fieldId)&&c.op!=='empty')try{C.valueFor(p,t,C.field(t,c.fieldId),c.value);}catch(e){errors.push(e.message);}}
  const fids=new Set();for(const f of p.globalFilters||[]){check(f&&typeof f.id==='string'&&!fids.has(f.id),'Identifiant de filtre global invalide ou dupliqué.');fids.add(f?.id);check(pref(f?.preferenceId)&&!!C.table(p,f?.tableId)&&Array.isArray(f.filters)&&f.filters.length>0,'Filtre global incomplet.');if(Array.isArray(f?.filters))for(const c of f.filters)test(C.table(p,f.tableId),c);}
  function assignments(t,values){check(values&&typeof values==='object'&&!Array.isArray(values)&&Object.keys(values).length>0,'Ajoutez au moins une colonne à modifier.');for(const [id,v]of Object.entries(values||{})){const f=C.field(t,id);check(f&&!f.primary&&!C.computed(f),'Colonne modifiable absente (les clés et calculs sont exclus).');if(f)try{C.valueFor(p,t,f,v);}catch(e){errors.push(e.message);}}}
  let total=0;function steps(list,tid,depth=0,inSubmit=false){check(Array.isArray(list)&&list.length>0,'La chaîne doit contenir au moins une étape.');if(!Array.isArray(list))return;if(depth>5){errors.push('Au plus cinq niveaux de conditions.');return;}for(let i=0;i<list.length;i++){const s=list[i];if(++total>100){errors.push('Au plus 100 étapes par chaîne.');return;}check(s&&TYPES.includes(s.type),'Étape d’action inconnue.');if(!s)continue;const t=C.table(p,tid);if(s.type==='condition'){if(s.source==='preference')check(pref(s.preferenceId)&&typeof s.value==='boolean','Condition de préférence invalide.');else test(t,s);steps(s.then,tid,depth+1,inSubmit);if(s.else?.length)steps(s.else,tid,depth+1,inSubmit);}
    if(s.type==='set-values')assignments(t,s.values);
    if(s.type==='create-record'){const target=C.table(p,s.tableId);check(!!target,'Table de création absente.');assignments(target,s.values);}
    if(s.type==='delete-record')check(!!t&&!inSubmit,'La suppression requiert une ligne et ne peut pas suivre une validation de formulaire.');
    if(s.type==='preference')check(pref(s.preferenceId)&&typeof s.value==='boolean','Valeur de préférence invalide.');
    if(s.type==='notify')check(typeof s.message==='string'&&s.message.trim().length>0&&s.message.length<=500,'Message vide ou trop long.');
    if(s.type==='open'||s.type==='form'){const target=C.screen(p,s.targetScreenId);check(!!target,'Destination de chaîne absente.');if(s.type==='form'){check(!inSubmit&&target?.type==='form'&&!!tid&&target.tableId===tid,'Le formulaire de la chaîne doit modifier la ligne de la même table.');if(s.onSubmit?.length)steps(s.onSubmit,tid,depth+1,true);}else if(['detail','form'].includes(target?.type))check(!!tid&&target.tableId===tid,'La destination exige une ligne de la même table.');}
    if(['open','form','back','delete-record'].includes(s.type))check(i===list.length-1,'La navigation ou suppression termine sa branche : placez-la à la fin.');
  }}
  for(const a of p.actions||[])if(a.type==='workflow'){total=0;check(!a.tableId||!!C.table(p,a.tableId),'Table de contexte de la chaîne absente.');steps(a.steps,a.tableId);}
  for(const s of p.screens||[]){if(s.resetActionId){const a=p.actions.find(a=>a.id===s.resetActionId);check(s.type==='form'&&a?.type==='workflow'&&a.tableId===s.tableId,'La réinitialisation doit utiliser une chaîne de la même table sur un formulaire.');}for(const prop of ['resetLabel','resetHelp'])if(s[prop]!==undefined)check(typeof s[prop]==='string'&&s[prop].length<=(prop==='resetLabel'?160:500),'Texte de réinitialisation invalide.');if(s.editOnly!==undefined)check(s.type==='form'&&typeof s.editOnly==='boolean','Seul un formulaire peut être réservé à la modification.');for(const c of s.components||[])if(c.type==='button'){const a=p.actions.find(a=>a.id===c.actionId);if(a?.type==='workflow'&&a.tableId)check(a.tableId===s.tableId&&['detail','form'].includes(s.type),'Cette chaîne exige une fiche de la table '+(C.table(p,a.tableId)?.name||a.tableId)+'.');}}
  return errors;
 }
 function plan(project,values,list,context={}){const validation=list?.length?validate({...project,actions:[...project.actions,{id:'_execution',name:'Exécution',type:'workflow',tableId:context.tableId,steps:list}]}):[];if(validation.length)fail(validation.join('\n'));let p=C.clone(project),prefs=preferences(p,values),key=context.key;const effects=[];let deletes=false;
  const row=()=>{const t=C.table(p,context.tableId),r=t?.rows.find(r=>C.key(r[C.pk(t).id])===C.key(key));if(!r)fail('Cette chaîne exige un enregistrement sélectionné.');return r;};
  if(context.formValues){const r=row();p=C.writeRow(p,context.tableId,key,{...r,...context.formValues});key=context.formValues[C.pk(C.table(p,context.tableId)).id]??key;}
  let count=0;function run(steps,depth=0){if(depth>6)fail('Chaîne trop profonde.');for(const s of steps||[]){if(++count>100)fail('Chaîne trop longue.');switch(s.type){
   case 'condition':{const yes=s.source==='preference'?prefs[s.preferenceId]===s.value:C.match(p,C.table(p,context.tableId),row(),s);if(run(yes?s.then:s.else,depth+1))return true;break;}
   case 'set-values':p=C.writeRow(p,context.tableId,key,{...row(),...s.values});break;
   case 'create-record':{const t=C.table(p,s.tableId),data=Object.fromEntries(t.fields.filter(f=>!C.computed(f)).map(f=>[f.id,f.primary?C.nextKey(t):C.initialValue(f)]));p=C.writeRow(p,t.id,null,{...data,...s.values});break;}
   case 'delete-record':row();p=C.removeRow(p,context.tableId,key);deletes=true;effects.push({type:'back'});return true;
   case 'preference':prefs[s.preferenceId]=s.value;break;
   case 'notify':effects.push({type:'notify',message:s.message});break;
   case 'form':row();effects.push({...C.clone(s),tableId:context.tableId,key});return true;
   case 'open':effects.push({...C.clone(s),key:C.screen(p,s.targetScreenId)?.tableId===context.tableId?key:null});return true;
   case 'back':effects.push({type:'back'});return true;
   default:fail('Étape inconnue.');
  }}return false;}
  run(list);C.assert(p);return {project:p,preferences:prefs,effects,deletes};
 }
 return {Actions:{TYPES,defaults,preferences,filtered,validate,plan}};
};g.GEAPActionsCore=factory;if(typeof module!=='undefined'&&module.exports)module.exports=factory;})(typeof window!=='undefined'?window:globalThis);

/* GEAP Core 1.7.1 — modèle déclaratif et intégrité, sans dépendance. */
(function(global){
'use strict';
const TYPES=['text','url','integer','decimal','date','boolean','image','reference','array','relation','email','phone','datetime','time','duration','location','multiselect','images','files','richtext','computed'];
const SCREEN_TYPES=['home','list','cards','table','detail','form','grid','tiles','checklist','calendar','kanban','gallery','carousel','map'];
const ACTION_TYPES=['open','detail','add','edit','delete','filter','reset','refresh','back','external','workflow'];
const COMPONENT_TYPES=['text','image','button','metric','related','collection','link','rating','switch','separator','gallery','carousel','map','richtext','contact'];
const OPS=['eq','ne','contains','gt','gte','lt','lte','empty'];
const clone=o=>JSON.parse(JSON.stringify(o));
const uid=(prefix='id')=>prefix+'_'+(global.crypto?.randomUUID?.()||Math.random().toString(36).slice(2)+Date.now().toString(36)).replace(/-/g,'').slice(0,20);
const slug=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'projet';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const table=(p,id)=>p.tables.find(t=>t.id===id);
const field=(t,id)=>t?.fields.find(f=>f.id===id);
const pk=t=>t?.fields.find(f=>f.primary);
const screen=(p,id)=>p.screens.find(s=>s.id===id);
const empty=v=>v===null||v===undefined||v==='';
const key=v=>String(v??'');
const safeImage=v=>typeof v==='string'&&/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/.test(v);
const fail=m=>{throw new Error(m);};
const name=s=>typeof s==='string'&&s.trim().length>0&&s.length<=160;
const ident=s=>typeof s==='string'&&/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(s)&&!['__proto__','prototype','constructor'].includes(s);
function bounded(f,n){if(Number.isFinite(f.min)&&n<f.min)fail('« '+f.name+' » doit être au moins égal à '+f.min+'.');if(Number.isFinite(f.max)&&n>f.max)fail('« '+f.name+' » doit être au plus égal à '+f.max+'.');return n;}
const computed=f=>!!f&&['array','relation','computed'].includes(f.type);
function safeURL(v){try{const u=new URL(String(v).trim());return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}}
const imageSource=v=>safeImage(v)||safeURL(v).startsWith('https:')?String(v):'';
const navPosition=s=>s.navigation|| (s.menu?'main':'hidden');
const FONTS={system:{name:'Système · sans empattements',css:"system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"},humanist:{name:'Verdana · lisible',css:'Verdana,Geneva,sans-serif'},serif:{name:'Georgia · avec empattements',css:'Georgia,Times,serif'},mono:{name:'Monospace · technique',css:'ui-monospace,Consolas,monospace'}};
const THEMES={
 classic:{name:'Nature',primary:'#177b69',background:'#f6f8f7',surface:'#ffffff',text:'#172d32',muted:'#6f8186',border:'#e5eceb',font:'system'},
 ocean:{name:'Océan',primary:'#235db0',background:'#eef4fb',surface:'#ffffff',text:'#17304f',muted:'#62758d',border:'#d9e4f0',font:'humanist'},
 sand:{name:'Sable',primary:'#9c5935',background:'#fcf4eb',surface:'#fffaf4',text:'#493527',muted:'#807062',border:'#eadccc',font:'serif'},
 plum:{name:'Prune',primary:'#71549b',background:'#f6f2fa',surface:'#ffffff',text:'#332645',muted:'#796987',border:'#e5dcec',font:'system'}
};
const color=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
function appearance(theme={}){const base=Object.hasOwn(THEMES,theme.preset)?THEMES[theme.preset]:THEMES.classic,t={...base};for(const k of ['primary','background','surface','text','muted','border'])if(color(theme[k]))t[k]=theme[k];t.font=Object.hasOwn(FONTS,theme.font)?theme.font:base.font;return t;}
function luminance(hex){const c=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
function contrast(a,b){const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
const onColor=hex=>contrast(hex,'#ffffff')>=contrast(hex,'#172d32')?'#ffffff':'#172d32';
function cast(f,v){
 if(f.type==='computed')return v??null;if(computed(f))return Array.isArray(v)?v:[];if(['multiselect','images','files'].includes(f.type)&&empty(v)){if(f.required)fail('« '+f.name+' » est obligatoire.');return [];}
 if(empty(v)){if(f.required||f.primary)fail('« '+f.name+' » est obligatoire.');return f.type==='text'||f.type==='image'?'':null;}
 switch(f.type){
 case 'text':return String(v);
 case 'url':{const url=safeURL(v);if(!url)fail('« '+f.name+' » attend une URL HTTP ou HTTPS complète, sans identifiant.');return url;}
 case 'reference':return v;
 case 'integer':{if(typeof v==='boolean'||!/^[-+]?\d+$/.test(String(v).trim()))fail('« '+f.name+' » attend un entier.');const n=Number(v);if(!Number.isSafeInteger(n))fail('Entier hors limites pour « '+f.name+' ».');return bounded(f,n);}
 case 'decimal':{const s=String(v).trim().replace(',','.');if(typeof v==='boolean'||!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/i.test(s)||!Number.isFinite(Number(s)))fail('« '+f.name+' » attend un nombre décimal.');return bounded(f,Number(s));}
 case 'boolean':{if(v===true||v===1||['true','vrai','oui','1'].includes(String(v).toLowerCase()))return true;if(v===false||v===0||['false','faux','non','0'].includes(String(v).toLowerCase()))return false;fail('« '+f.name+' » attend Oui ou Non.');break;}
 case 'date':{const s=String(v);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||Number.isNaN(Date.parse(s+'T00:00:00Z'))||new Date(s+'T00:00:00Z').toISOString().slice(0,10)!==s)fail('Date invalide pour « '+f.name+' ».');return s;}
 case 'image':if(!imageSource(v))fail('« '+f.name+' » attend une image intégrée ou une URL HTTPS.');return v;
 default:if(api.castAdvanced)return api.castAdvanced(f,v);fail('Type inconnu.');
 }
}
function valueFor(p,t,f,v){
 if(f.type!=='reference')return cast(f,v);
 if(empty(v)){if(f.required)fail('« '+f.name+' » est obligatoire.');return null;}
 const parent=table(p,f.refTableId), k=pk(parent);if(!parent||!k)fail('Table référencée introuvable.');
 return cast({...k,required:true},v);
}
function label(p,t,r){
 if(!r)return 'Enregistrement absent';
 const f=field(t,t.labelFieldId)||t.fields.find(f=>!f.primary&&f.type==='text')||pk(t);
 return String(t.labelPrefix||'')+String(r[f?.id]??'Sans libellé');
}
function display(p,t,f,v){
 if(empty(v))return '—';if(api.displayAdvanced){const advanced=api.displayAdvanced(p,t,f,v);if(advanced!==undefined)return advanced;}
 if(f.type==='array')return (Array.isArray(v)?v:[]).join(' · ');
 if(f.type==='relation')return (Array.isArray(v)?v.length:0)+' enregistrement(s) lié(s)';
 if(f.type==='reference'){const pt=table(p,f.refTableId), r=pt?.rows.find(r=>key(r[pk(pt)?.id])===key(v));return r?label(p,pt,r)+' · '+v:'Référence absente · '+v;}
 if(f.type==='boolean')return v?'Oui':'Non';
 if(f.type==='date')return String(v).split('-').reverse().join('/');
 if(f.type==='decimal')return new Intl.NumberFormat('fr-FR',{maximumFractionDigits:4}).format(v);
 if(f.type==='image')return v?(safeImage(v)?'Image intégrée':'Image distante'):'—';return String(v);
}
function relationSource(r){return r.kind==='match'?r.sourceTableId:r.parentTableId;}
function relationTarget(r,fromTable){if(r.kind==='match')return fromTable===r.sourceTableId?r.targetTableId:null;return fromTable===r.parentTableId?r.childTableId:fromTable===r.childTableId?r.parentTableId:null;}
function relationRows(p,r,fromTable,row){if(!r||!row)return [];const t=table(p,fromTable);if(!t)return [];
 if(r.kind==='match'){if(r.sourceTableId!==fromTable)return [];const dest=table(p,r.targetTableId),v=row[r.sourceFieldId];if(!dest||empty(v)||String(v).trim()==='')return [];const eq=x=>!empty(x)&&String(x).trim()!==''&&String(x).trim()===String(v).trim();const matches=dest.rows.filter(x=>r.operator==='includes'?(Array.isArray(x[r.targetFieldId])&&x[r.targetFieldId].some(eq)):eq(x[r.targetFieldId]));return r.multiple===false?matches.slice(0,1):matches;}
 if(r.parentTableId===fromTable){const dest=table(p,r.childTableId);return dest?.rows.filter(x=>key(x[r.childFieldId])===key(row[pk(t)?.id]))||[];}
 if(r.childTableId===fromTable){const dest=table(p,r.parentTableId);return empty(row[r.childFieldId])?[]:dest?.rows.filter(x=>key(x[pk(dest)?.id])===key(row[r.childFieldId]))||[];}return [];
}
function refreshComputed(p){if(api.refreshAdvanced)return api.refreshAdvanced(p);for(const t of p.tables||[])for(const row of t.rows||[])for(const f of t.fields||[])if(f.type==='array')row[f.id]=(f.compute?.sources||[]).map(id=>row[id]).filter(v=>!empty(v)&&String(v).trim()!=='');
 for(const t of p.tables||[])for(const row of t.rows||[])for(const f of t.fields||[])if(f.type==='relation'){const r=p.relations.find(r=>r.id===f.compute?.relationId),dest=table(p,relationTarget(r||{},t.id));row[f.id]=dest?relationRows(p,r,t.id,row).map(x=>x[pk(dest)?.id]):[];}return p;
}
function addMatchRelation(p,config){return transact(p,q=>{const r={id:config.id||uid('rel'),kind:'match',name:config.name.trim(),sourceTableId:config.sourceTableId,sourceFieldId:config.sourceFieldId,targetTableId:config.targetTableId,targetFieldId:config.targetFieldId,operator:config.operator,multiple:config.multiple!==false};const old=q.relations.find(x=>x.id===r.id);if(old&&old.kind!=='match')fail('Type de relation incompatible.');if(old&&old.sourceTableId!==r.sourceTableId)fail('La table source d’une relation existante ne peut pas changer.');if(old)q.relations=q.relations.map(x=>x.id===r.id?r:x);else q.relations.push(r);});}
function removeMatchRelation(p,id){return transact(p,q=>{const r=q.relations.find(r=>r.id===id);if(!r||r.kind!=='match')fail('Correspondance absente.');const t=table(q,r.sourceTableId),f=t.fields.find(f=>f.compute?.relationId===id);if(q.tables.some(qt=>qt.fields.some(qf=>qf.type==='computed'&&qf.compute?.relationId===id)))fail('Cette relation est utilisée par un calcul.');if(q.screens.some(s=>s.components.some(c=>c.relationId===id)||s.fields.includes(f?.id)))fail('Cette relation est utilisée dans un écran. Retirez cet usage avant suppression.');q.relations=q.relations.filter(r=>r.id!==id);if(f){t.fields=t.fields.filter(x=>x.id!==f.id);t.rows.forEach(row=>delete row[f.id]);}});}
function validate(p){
 const errors=[];const check=(v,m)=>{if(!v)errors.push(m);};
 if(!p||typeof p!=='object'||p.format!=='GEAP'||p.version!==1) return ['Format attendu : projet GEAP version 1.'];
 if(!ident(p.id)||!name(p.name))errors.push('Identifiant ou nom du projet invalide.');
 if(!Array.isArray(p.tables)||!Array.isArray(p.screens)||!Array.isArray(p.actions)||!Array.isArray(p.relations))return [...errors,'Structure du projet incomplète.'];
 const ids=new Set();const checkId=(id,what)=>{check(ident(id)&&!ids.has(id),'Identifiant invalide ou dupliqué : '+what);ids.add(id);};
 const tableNames=new Set();
 for(const t of p.tables){
  if(!t||typeof t!=='object'){errors.push('Table invalide.');continue;}
  checkId(t.id,'table');check(name(t.name)&&!tableNames.has(t.name.toLocaleLowerCase('fr')),'Nom de table vide ou dupliqué.');tableNames.add(String(t.name).toLocaleLowerCase('fr'));
  if(!Array.isArray(t.fields)||!Array.isArray(t.rows)){errors.push('Attributs ou données absents de '+t.name);continue;}
  check(t.fields.filter(f=>f.primary).length===1,'La table « '+t.name+' » doit avoir une clé primaire unique.');
  const fn=new Set();for(const f of t.fields){
   checkId(f.id,'attribut');check(name(f.name)&&!fn.has(f.name.toLocaleLowerCase('fr')),'Nom d’attribut vide ou dupliqué dans '+t.name);fn.add(String(f.name).toLocaleLowerCase('fr'));
   check(TYPES.includes(f.type),'Type invalide pour '+f.name);
   if(computed(f))check(!f.primary&&!f.required,'Une colonne calculée est en lecture seule et ne peut être une clé.');
   if(f.type==='array'&&f.compute?.kind!=='formula')check(f.compute?.kind==='makeArray'&&Array.isArray(f.compute.sources)&&f.compute.sources.length>0&&new Set(f.compute.sources).size===f.compute.sources.length&&f.compute.sources.every(id=>{const sf=field(t,id);return sf&&(api.scalarType?api.scalarType(sf):!['array','relation','image'].includes(sf.type))&&sf.id!==f.id;}),'Tableau calculé invalide pour '+t.name+'.'+f.name);
   if(f.type==='relation')check(f.compute?.kind==='relation'&&p.relations.some(r=>r.kind==='match'&&r.id===f.compute.relationId&&r.sourceTableId===t.id),'Colonne de relation calculée invalide pour '+t.name+'.'+f.name);
   if(f.min!==undefined||f.max!==undefined)check((api.NUMERIC||['integer','decimal']).includes(api.effectiveType?api.effectiveType(f):f.type)&&(f.min===undefined||Number.isFinite(f.min))&&(f.max===undefined||Number.isFinite(f.max))&&(!(Number.isFinite(f.min)&&Number.isFinite(f.max))||f.min<=f.max),'Plage numérique invalide pour '+f.name);
   if(f.primary)check(['text','integer'].includes(f.type),'La clé primaire doit être de type texte ou entier.');
   if(f.type==='reference'){check(!!table(p,f.refTableId),'Table référencée absente pour '+f.name);check(!f.primary,'Une référence ne peut pas être la clé primaire en V1.');}
  }
  if(t.labelFieldId)check(!!field(t,t.labelFieldId),'Attribut de libellé absent dans '+t.name);
  if(t.labelPrefix!==undefined)check(typeof t.labelPrefix==='string'&&t.labelPrefix.length<=160,'Préfixe de libellé invalide.');
  const k=pk(t), keys=new Set();
  for(const r of t.rows){
   if(!r||typeof r!=='object'||Array.isArray(r)){errors.push('Enregistrement invalide dans '+t.name);continue;}
   if(k){const kv=key(r[k.id]);check(!empty(r[k.id])&&!keys.has(kv),'Clé primaire vide ou dupliquée dans '+t.name+' : '+kv);keys.add(kv);}
   for(const f of t.fields){try{const v=valueFor(p,t,f,r[f.id]);if(!empty(v)&&f.type==='reference'){const pt=table(p,f.refTableId), kf=pk(pt);check(!!pt?.rows.some(x=>key(x[kf?.id])===key(v)),'Référence invalide : '+t.name+'.'+f.name+' = '+v);}}catch(e){errors.push(t.name+' : '+e.message);}}
  }
 }
 const relFields=new Set();for(const r of p.relations){
  checkId(r.id,'relation');if(r.kind==='match'){const st=table(p,r.sourceTableId),tt=table(p,r.targetTableId),sf=field(st,r.sourceFieldId),tf=field(tt,r.targetFieldId);check(!!st&&!!tt&&!!sf&&!!tf&&(api.scalarType?api.scalarType(sf):!['array','relation','image'].includes(sf?.type)),'Source ou cible de correspondance invalide : '+r.name);check(['equals','includes'].includes(r.operator)&&(r.operator==='includes'?['array','multiselect'].includes(tf?.type):!!tf&&(api.scalarType?api.scalarType(tf):!['array','relation','image'].includes(tf.type))),'Opérateur de correspondance incompatible : '+r.name);continue;}const ct=table(p,r.childTableId),pt=table(p,r.parentTableId),f=field(ct,r.childFieldId);
  check(!!ct&&!!pt&&f?.type==='reference'&&f.refTableId===pt.id,'Relation incohérente : '+r.name);
  check(!relFields.has(r.childFieldId),'Relation dupliquée.');relFields.add(r.childFieldId);
 }
 for(const t of p.tables)for(const f of t.fields||[])if(f.type==='reference')check(relFields.has(f.id),'Relation absente pour '+t.name+'.'+f.name);
 for(const s of p.screens){
  checkId(s.id,'écran');check(name(s.name)&&SCREEN_TYPES.includes(s.type),'Écran invalide.');const t=table(p,s.tableId);
  check(!!t||s.type==='home','Source de données absente pour '+s.name);
  if(!Array.isArray(s.fields)||!Array.isArray(s.components)||!Array.isArray(s.filters)){errors.push('Configuration incomplète de '+s.name);continue;}
  if(t&&s.type==='form'&&!s.editOnly)for(const f of t.fields.filter(f=>f.required&&!f.primary))check(s.fields.includes(f.id),'Champ obligatoire absent du formulaire '+s.name+' : '+f.name);
  if(t){for(const fid of s.fields)check(!!field(t,fid),'Attribut affiché absent dans '+s.name);check(new Set(s.fields).size===s.fields.length,'Attribut affiché en double.');}
  if(s.navigation)check(['main','secondary','hidden'].includes(s.navigation),'Position de navigation invalide.');
  for(const [fid,config]of Object.entries(s.inputConfig||{})){const f=field(t,fid);check(!!f&&!computed(f)&&['text','textarea','number','url','image','select','switch','rating','email','phone','datetime','time','duration','location','multiselect','images','files','richtext'].includes(config.mode),'Mode de saisie invalide.');if(['select','multiselect'].includes(config.mode)&&config.tableId)check(!!field(table(p,config.tableId),config.fieldId),'Source du choix de valeurs absente.');}
  if(s.itemTarget)check(!!screen(p,s.itemTarget)&&screen(p,s.itemTarget).tableId===s.tableId&&['detail','form'].includes(screen(p,s.itemTarget).type),'Écran de destination incompatible dans '+s.name);
  if(s.sort?.fieldId)check(!!field(t,s.sort.fieldId)&&['asc','desc'].includes(s.sort.direction),'Tri invalide dans '+s.name);
  for(const fl of s.filters){check(!!field(t,fl.fieldId)&&OPS.includes(fl.op),'Filtre invalide dans '+s.name);if(fl.op!=='empty'&&field(t,fl.fieldId))try{valueFor(p,t,field(t,fl.fieldId),fl.value);}catch(e){errors.push('Filtre de '+s.name+' : '+e.message);}}
  for(const c of s.components){
   checkId(c.id,'composant');check(COMPONENT_TYPES.includes(c.type),'Composant inconnu.');
   if(c.type==='related'){const rel=p.relations.find(r=>r.id===c.relationId),target=screen(p,c.targetScreenId);check(!!rel&&!!target,'Relation ou destination absente dans '+s.name);if(rel&&target){const dest=relationTarget(rel,s.tableId);check(dest===target.tableId,'Destination liée incompatible dans '+s.name);check(s.type==='detail','Une collection liée requiert une fiche.');check(rel.kind==='match'||rel.parentTableId===s.tableId?(api.COLLECTION_TYPES||['list','cards','table']).includes(target.type):target.type==='detail','Type de destination liée invalide.');}}
   if(c.type==='button')check(p.actions.some(a=>a.id===c.actionId),'Action absente du bouton dans '+s.name);
   if(c.type==='metric')check(!!table(p,c.tableId),'Source d’indicateur absente.');
   if(c.type==='image'&&c.fieldId)check(field(t,c.fieldId)?.type==='image','Attribut image absent.');
   if(c.type==='image'&&c.src)check(!!imageSource(c.src),'Source image invalide.');
   if(c.type==='text'&&c.fieldId)check(!!field(t,c.fieldId),'Attribut texte absent.');
   if(c.type==='rating'){check(['integer','decimal'].includes(field(t,c.fieldId)?.type)&&s.type==='detail','La notation doit utiliser un attribut numérique sur une fiche.');if(t)check(t.rows.every(row=>empty(row[c.fieldId])||Number.isInteger(Number(row[c.fieldId]))&&Number(row[c.fieldId])>=1&&Number(row[c.fieldId])<=5),'La notation attend des valeurs entières de 1 à 5.');}
   if(c.type==='switch')check(field(t,c.fieldId)?.type==='boolean'&&s.type==='detail','L’interrupteur doit utiliser un booléen sur une fiche.');
   if(c.type==='link')check((c.fieldId?field(t,c.fieldId)?.type==='url':!!safeURL(c.url)),'Source de lien invalide.');
  }
 }
 for(const a of p.actions){
  checkId(a.id,'action');check(name(a.name)&&ACTION_TYPES.includes(a.type),'Action invalide.');
  if(['open','detail','add','filter'].includes(a.type))check(!!screen(p,a.targetScreenId),'Destination absente de '+a.name);
  if(a.type==='external')check(a.fieldId?p.tables.some(t=>field(t,a.fieldId)?.type==='url'):!!safeURL(a.url),'Source de lien externe invalide.');
  const target=screen(p,a.targetScreenId);
  if(a.type==='add')check(target?.type==='form'&&!target.editOnly,'L’action Ajouter doit viser un formulaire.');
  if(a.type==='detail')check(target?.type==='detail','L’action Fiche doit viser une fiche.');
  if(a.type==='filter'){const t=table(p,target?.tableId);check((api.COLLECTION_TYPES||['list','cards','table']).includes(target?.type)&&!!field(t,a.fieldId)&&OPS.includes(a.op),'Filtre d’action invalide.');if(field(t,a.fieldId)&&a.op!=='empty')try{valueFor(p,t,field(t,a.fieldId),a.value);}catch(e){errors.push('Action '+a.name+' : '+e.message);}}
 }
 if(p.screens.length)check(!!screen(p,p.homeScreenId),'Écran d’accueil absent.');
 check(/^#[0-9a-f]{6}$/i.test(p.theme?.primary||''),'Couleur principale invalide.');
 for(const k of ['background','surface','text','muted','border'])if(p.theme?.[k]!==undefined)check(color(p.theme[k]),'Couleur de présentation invalide : '+k);
 if(p.theme?.font!==undefined)check(Object.hasOwn(FONTS,p.theme.font),'Police de caractères non prise en charge.');
 if(p.theme?.preset!==undefined)check(Object.hasOwn(THEMES,p.theme.preset),'Thème de présentation absent.');
 if(p.theme?.iconData)check(safeImage(p.theme.iconData),'Icône invalide.');
 if(api.Actions)errors.push(...api.Actions.validate(p));if(api.validateNavigation)errors.push(...api.validateNavigation(p));if(api.validateAdvanced)errors.push(...api.validateAdvanced(p));if(api.Responsive)errors.push(...api.Responsive.validate(p));return [...new Set(errors)];
}
function assert(p){const es=validate(p);if(es.length)fail(es.slice(0,8).join('\n'));return p;}
function normalise(p){
 p=clone(p);assert(p);
 // Les enregistrements suivent les types déclarés, y compris après import JSON.
 for(const t of p.tables)t.rows=t.rows.map(r=>Object.fromEntries(t.fields.map(f=>[f.id,valueFor(p,t,f,r[f.id])])));
 return refreshComputed(p);
}
function transact(p,fn){const q=clone(p);fn(q);refreshComputed(q);assert(q);return q;}
function nextKey(t){const k=pk(t);if(!k)return null;if(k.type==='integer'){const n=Math.max(0,...t.rows.map(r=>Number(r[k.id])||0))+1;if(!Number.isSafeInteger(n))fail('Plus de clé entière disponible.');return n;}let n=1;while(t.rows.some(r=>key(r[k.id])===String(n)))n++;return String(n);}
function writeRow(p,tid,oldKey,values){return transact(p,q=>{
 const t=table(q,tid),k=pk(t);if(!t)fail('Table introuvable.');
 const row=Object.fromEntries(t.fields.map(f=>[f.id,valueFor(q,t,f,values[f.id])]));
 const idx=oldKey===null||oldKey===undefined?-1:t.rows.findIndex(r=>key(r[k.id])===key(oldKey));
 if(oldKey!==null&&oldKey!==undefined&&idx<0)fail('Enregistrement introuvable.');
 if(idx>=0)t.rows[idx]=row;else t.rows.push(row);
 });}
function removeRow(p,tid,id){return transact(p,q=>{const t=table(q,tid);if(!t)fail('Table introuvable.');t.rows=t.rows.filter(r=>key(r[pk(t).id])!==key(id));});}
function addTable(p,n){return transact(p,q=>{q.tables.push({id:uid('t'),name:n.trim(),fields:[{id:uid('f'),name:'ID',type:'integer',primary:true,required:true}],rows:[]});});}
function addField(p,tid,n,type,refTableId,required=false,options={}){return transact(p,q=>{const t=table(q,tid);if(!t)fail('Table introuvable.');const f={id:uid('f'),name:n.trim(),type,required:!!required,primary:false};if(type==='reference')f.refTableId=refTableId;if(type==='array')f.compute=options.compute||{kind:'makeArray',sources:options.sources||[]};if(type==='computed'){f.compute=options.compute;f.required=false;}for(const k of ['format','choices','choiceSource'])if(options[k]!==undefined)f[k]=options[k];if(Number.isFinite(options.min))f.min=options.min;if(Number.isFinite(options.max))f.max=options.max;t.fields.push(f);if(required)for(const s of q.screens.filter(s=>s.type==='form'&&s.tableId===tid))s.fields.push(f.id);for(const r of t.rows)r[f.id]=api.initialValue?api.initialValue(f):type==='boolean'?false:type==='text'||type==='image'?'':null;if(type==='reference')q.relations.push({id:uid('rel'),name:t.name+' → '+table(q,refTableId)?.name,childTableId:tid,childFieldId:f.id,parentTableId:refTableId});});}
function deleteField(p,tid,fid){return transact(p,q=>{const t=table(q,tid),f=field(t,fid);if(!f||f.primary)fail('La clé primaire ne peut pas être supprimée.');if(f.type==='relation')fail('Supprimez cette relation depuis l’espace Relations.');if(api.dependencies&&q.tables.some(qt=>qt.fields.some(qf=>computed(qf)&&qf.id!==fid&&api.dependencies(q,qt,qf).some(([ti,fi])=>ti===tid&&fi===fid))))fail('Cet attribut est utilisé par un calcul. Retirez ce calcul avant suppression.');if(q.screens.some(s=>s.fields.includes(fid)||s.sort?.fieldId===fid||s.filters.some(x=>x.fieldId===fid)||s.components.some(c=>c.fieldId===fid))||q.actions.some(a=>a.fieldId===fid))fail('Cet attribut est utilisé dans un écran ou une action. Retirez ces usages avant de le supprimer.');const rel=q.relations.find(r=>r.childFieldId===fid);if(rel&&q.screens.some(s=>s.components.some(c=>c.relationId===rel.id)))fail('Cette relation est utilisée par un composant lié.');t.fields=t.fields.filter(x=>x.id!==fid);t.rows.forEach(r=>delete r[fid]);q.relations=q.relations.filter(r=>r.childFieldId!==fid);});}
function removeTable(p,tid){return transact(p,q=>{if(q.relations.some(r=>r.kind==='match'&&(r.sourceTableId===tid||r.targetTableId===tid)))fail('Cette table participe à une correspondance calculée. Supprimez d’abord cette relation.');if(q.relations.some(r=>r.parentTableId===tid&&r.childTableId!==tid))fail('Cette table est référencée. Supprimez d’abord les clés étrangères concernées.');if(q.screens.some(s=>s.tableId===tid||s.components.some(c=>c.tableId===tid)))fail('Cette table est utilisée dans des écrans. Supprimez ou modifiez ces écrans d’abord.');q.tables=q.tables.filter(t=>t.id!==tid);q.relations=q.relations.filter(r=>r.childTableId!==tid);});}
function match(p,t,r,f){const v=r[f.fieldId];let attr=field(t,f.fieldId),w=f.value;if(attr?.type==='computed'&&api.resolvedField)attr=api.resolvedField(p,t,attr);try{if(f.op!=='contains'&&f.op!=='empty')w=valueFor(p,t,attr,w);}catch{return false;}switch(f.op){case 'eq':return key(v)===key(w);case 'ne':return key(v)!==key(w);case 'contains':return String(v??'').toLocaleLowerCase('fr').includes(String(w??'').toLocaleLowerCase('fr'));case 'gt':return v>w;case 'gte':return v>=w;case 'lt':return v<w;case 'lte':return v<=w;case 'empty':return empty(v);default:return true;}}
function records(p,s,context,extraFilters=[]){const t=table(p,s.tableId);if(!t)return [];let rs=t.rows.slice();
 if(context?.relationId){const rel=p.relations.find(r=>r.id===context.relationId);if(!rel)return [];if(rel.kind==='match'){const st=table(p,rel.sourceTableId),source=st?.rows.find(r=>key(r[pk(st)?.id])===key(context.parentKey));rs=relationRows(p,rel,rel.sourceTableId,source);}else if(rel.childTableId===t.id)rs=rs.filter(r=>key(r[rel.childFieldId])===key(context.parentKey));}
 for(const f of [...s.filters,...extraFilters])rs=rs.filter(r=>match(p,t,r,f));
 if(s.sort?.fieldId){const {fieldId,direction}=s.sort;rs.sort((a,b)=>{let x=a[fieldId],y=b[fieldId];return (typeof x==='number'&&typeof y==='number'?x-y:String(x??'').localeCompare(String(y??''),'fr',{numeric:true}))*(direction==='desc'?-1:1);});}return rs;
}
function parseCSV(text){
 text=String(text).replace(/^\uFEFF/,'');let first=text.split(/\r?\n/)[0];const delim=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',';let rows=[],r=[],s='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){s+='"';i++;}else{quoted=false;closed=true;}}else s+=c;}
 else if(c==='"'&&s===''&&!closed)quoted=true;else if(c===delim){r.push(s);s='';closed=false;}else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;r.push(s);if(r.some(x=>x!==''))rows.push(r);r=[];s='';closed=false;}else{if(closed&&c.trim())fail('CSV mal formé après un guillemet.');s+=c;}}
 if(quoted)fail('CSV : guillemet non fermé.');r.push(s);if(r.some(x=>x!==''))rows.push(r);if(rows.length<1)fail('Le CSV est vide.');if(rows.some(r=>r.length!==rows[0].length))fail('CSV : nombre de colonnes incohérent.');return rows;
}
function importCSV(p,tid,text){const data=parseCSV(text),t=table(p,tid),header=data.shift().map(s=>s.trim());if(new Set(header).size!==header.length)fail('CSV : en-têtes dupliqués.');const fs=header.map(h=>t.fields.find(f=>f.name===h||f.id===h));if(fs.some(f=>!f))fail('CSV : utilisez les noms exacts des attributs. Téléchargez un CSV comme modèle.');if(!fs.some(f=>f.primary))fail('Le CSV doit contenir la clé primaire.');return transact(p,q=>{const qt=table(q,tid);for(const cells of data){const vals=Object.fromEntries(fs.map((f,i)=>[f.id,cells[i]]));const row=Object.fromEntries(qt.fields.map(f=>[f.id,valueFor(q,qt,f,vals[f.id])]));qt.rows.push(row);}});}
function exportCSV(p,tid){const t=table(p,tid),cell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';const fields=api.dataFields(t);return '\uFEFF'+[fields.map(f=>cell(f.name)).join(';'),...t.rows.map(r=>fields.map(f=>cell(typeof r[f.id]==='boolean'?r[f.id]?'Oui':'Non':r[f.id]&&typeof r[f.id]==='object'?JSON.stringify(r[f.id]):r[f.id])).join(';'))].join('\r\n');}
function blank(n='Mon application'){return {format:'GEAP',version:1,id:uid('project'),name:n,description:'Une application créée avec GEAP.',theme:{primary:'#177b69'},tables:[],relations:[],screens:[],actions:[],homeScreenId:''};}
const api={THEMES,FONTS,appearance,contrast,onColor,computed,safeURL,imageSource,navPosition,relationSource,relationTarget,relationRows,refreshComputed,addMatchRelation,removeMatchRelation,TYPES,SCREEN_TYPES,ACTION_TYPES,COMPONENT_TYPES,OPS,clone,uid,slug,esc,key,empty,safeImage,table,field,pk,screen,cast,valueFor,label,display,validate,assert,normalise,transact,nextKey,writeRow,removeRow,addTable,addField,deleteField,removeTable,match,records,parseCSV,importCSV,exportCSV,blank};
const advancedFactory=typeof module!=='undefined'&&module.exports?require('./core-advanced.js'):global.GEAPAdvancedCore;if(advancedFactory)Object.assign(api,advancedFactory(api));
const formulaFactory=typeof module!=='undefined'&&module.exports?require('./core-formula.js'):global.GEAPFormulaCore;if(formulaFactory)api.Formula=formulaFactory(api);
const workflowFactory=typeof module!=='undefined'&&module.exports?require('./core-workflow.js'):global.GEAPWorkflowCore;if(workflowFactory)Object.assign(api,workflowFactory(api));
const responsiveFactory=typeof module!=='undefined'&&module.exports?require('./responsive-core.js'):global.GEAPResponsiveCore;if(responsiveFactory)api.Responsive=responsiveFactory(api);
const actionsFactory=typeof module!=='undefined'&&module.exports?require('./core-actions.js'):global.GEAPActionsCore;if(actionsFactory)Object.assign(api,actionsFactory(api));
global.GEAPCore=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);

/* GEAP — adaptateurs physiques locaux. Aucun écran ne dépend d’IndexedDB. */
(function(g,factory){const api=factory(g.GEAPCore||(typeof require==='function'?require('./core.js'):null),g);g.GEAPStorage=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;})(typeof window!=='undefined'?window:globalThis,function(C,env){
'use strict';
class DataError extends Error{
 constructor(kind,code,message,cause){super(message);this.name='GEAPDataError';this.kind=kind;this.code=code;if(cause)this.cause=cause;}
}
const clone=v=>v===undefined?undefined:C.clone(v);
const asError=(e,kind='storage',code='STORAGE_FAILURE')=>e instanceof DataError?e:new DataError(kind,code,e?.name==='QuotaExceededError'?'Espace de stockage insuffisant. Exportez une sauvegarde de vos données.':e?.message||'Stockage local indisponible.',e);
class MemoryAdapter{
 constructor(state){this.kind='memory';this.capabilities={local:true,atomicSnapshot:true,persistent:false};this._state=clone(state);}
 async load(){return clone(this._state);}
 async save(state,{expectedRevision}={}){const revision=Number(this._state?.revision)||0;if(expectedRevision!==undefined&&expectedRevision!==revision)throw new DataError('conflict','STALE_REVISION','Les données ont changé. Rechargez avant de poursuivre.');this._state={...clone(state),revision:revision+1};return clone(this._state);}
 replacePreview(state){this._state=clone(state);}
 subscribeExternal(){return ()=>{};}
 async close(){}
}
class IndexedDBAdapter{
 constructor({projectId,path,databaseName,indexedDB,broadcast=true}={}){this.kind='indexeddb';this.capabilities={local:true,atomicSnapshot:true,persistent:true};this.name=databaseName||'geap-'+projectId+'-'+(path??new URL('.',env.location.href).pathname);this._idb=indexedDB||env.indexedDB;this._listeners=new Set();this._broadcast=broadcast;}
 async open(){
  if(this._db)return this._db;if(this._opening)return this._opening;
  this._opening=new Promise((resolve,reject)=>{if(!this._idb){reject(new DataError('storage','STORAGE_UNAVAILABLE','IndexedDB est indisponible dans ce navigateur.'));return;}let settled=false,req;
   try{req=this._idb.open(this.name,1);}catch(e){reject(asError(e));return;}
   // Identité historique conservée : version 1, magasin state, clé data.
   req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('state'))req.result.createObjectStore('state');};
   req.onsuccess=()=>{if(settled){req.result.close();return;}settled=true;this._db=req.result;this._db.onversionchange=()=>{this._db?.close();this._db=null;this._opening=null;this._notify({type:'external'});};
    if(this._broadcast&&env.document&&env.BroadcastChannel){this._channel=new env.BroadcastChannel(this.name);this._channel.onmessage=()=>this._notify({type:'external'});}resolve(this._db);};
   req.onerror=()=>{if(!settled){settled=true;reject(asError(req.error));}};
   req.onblocked=()=>{if(!settled){settled=true;reject(new DataError('storage','STORAGE_BLOCKED','La base est bloquée par un autre onglet. Fermez cet onglet puis réessayez.'));}};
  });return this._opening;
 }
 async load(){const db=await this.open();return new Promise((resolve,reject)=>{let value,tx;try{tx=db.transaction('state','readonly');const req=tx.objectStore('state').get('data');req.onsuccess=()=>value=req.result;tx.oncomplete=()=>resolve(clone(value));tx.onabort=tx.onerror=()=>reject(asError(tx.error));}catch(e){reject(asError(e));}});}
 async save(state,{expectedRevision}={}){const db=await this.open(),input=clone(state);return new Promise((resolve,reject)=>{let tx,next,error;try{tx=db.transaction('state','readwrite');const store=tx.objectStore('state'),req=store.get('data');req.onsuccess=()=>{const current=req.result,revision=Number(current?.revision)||0;if(expectedRevision!==undefined&&revision!==expectedRevision||current&&current.projectId!==input.projectId){error=new DataError('conflict','STALE_REVISION','Les données ont changé dans un autre onglet. Rechargez avant de modifier.');tx.abort();return;}next={...input,revision:revision+1};store.put(next,'data');};
    tx.oncomplete=()=>{this._channel?.postMessage('changed');resolve(clone(next));};tx.onerror=()=>{error??=asError(tx.error);};tx.onabort=()=>reject(error||asError(tx.error));
   }catch(e){reject(asError(e));}});}
 _notify(event){for(const fn of this._listeners)try{fn(event);}catch{}}
 subscribeExternal(fn){this._listeners.add(fn);return ()=>this._listeners.delete(fn);}
 async close(){this._channel?.close();this._channel=null;this._db?.close();this._db=null;this._opening=null;this._listeners.clear();}
}
return {DataError,asError,MemoryAdapter,IndexedDBAdapter};
});

/* GEAP — services de données, invariants et notifications, indépendants du stockage. */
(function(g,factory){const api=factory(g.GEAPCore||(typeof require==='function'?require('./core.js'):null),g.GEAPStorage||(typeof require==='function'?require('./storage-local.js'):null));g.GEAPData=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;})(typeof window!=='undefined'?window:globalThis,function(C,S){
'use strict';const {DataError,asError}=S;
const signature=p=>JSON.stringify(p.tables.map(t=>({id:t.id,fields:t.fields})));
const schema=p=>({format:'GEAP_SCHEMA',version:1,projectId:p.id,tables:p.tables.map(t=>({id:t.id,name:t.name,fields:C.clone(C.dataFields(t))})),relations:C.clone(p.relations)});
const snapshot=(p,revision=0,localPreferences={})=>({format:'GEAP_DATA',version:1,projectId:p.id,modelSignature:signature(p),tables:p.tables.map(t=>({id:t.id,rows:C.clone(t.rows)})),revision,localPreferences:C.Actions.preferences(p,localPreferences)});
function fromSnapshot(seed,state){
 if(!state||state.format!=='GEAP_DATA'||state.version!==1||state.projectId!==seed.id||state.modelSignature!==signature(seed))throw new DataError('validation','SCHEMA_MISMATCH','Cette sauvegarde ne correspond pas au modèle de cette application.');
 if(!Array.isArray(state.tables)||state.tables.length!==seed.tables.length||new Set(state.tables.map(t=>t?.id)).size!==seed.tables.length||state.tables.some(t=>!C.table(seed,t?.id)||!Array.isArray(t.rows)))throw new DataError('validation','INVALID_BACKUP','Les tables de la sauvegarde sont incomplètes ou dupliquées.');
 try{return C.normalise({...seed,tables:seed.tables.map(t=>({...t,rows:state.tables.find(x=>x.id===t.id).rows}))});}catch(e){throw asError(e,'validation','INVALID_DATA');}
}
class DataEngine{
 constructor(project,{adapter,preview=false}={}){
  try{this._project=C.normalise(project);}catch(e){throw asError(e,'validation','INVALID_MODEL');}this._seed=C.clone(this._project);this._values=C.Actions.defaults(this._project);this.adapter=adapter||new S.MemoryAdapter();this.isPreview=preview;this._revision=0;this._listeners=new Set();this._queue=Promise.resolve();this._external=false;this._state='opening';
  this._unwatch=this.adapter.subscribeExternal?.(()=>{this._external=true;this._emit({type:'external'});});
  if(preview){this.adapter.replacePreview(snapshot(this._project,0,this._values));this._state='ready';this.ready=Promise.resolve(this);}else{this.ready=this._open();this.ready.catch(()=>{});}
 }
 async _open(){try{const stored=await this.adapter.load();if(stored!==undefined&&stored!==null){try{this._project=fromSnapshot(this._seed,stored);this._values=C.Actions.preferences(this._project,stored.localPreferences||{});}catch(e){e.storedState=C.clone(stored);throw e;}this._revision=Number(stored.revision)||0;}this._state='ready';this._emit({type:'load'});return this;}catch(e){this._state='blocked';this.error=asError(e);throw this.error;}}
 get status(){return this._state;}
 project(){return C.clone(this._project);}
 get modelSignature(){return signature(this._project);}
 subscribe(fn){this._listeners.add(fn);return ()=>this._listeners.delete(fn);}
 _emit(event){for(const fn of this._listeners)try{fn({...event,revision:this._revision});}catch{}}
 _table(id){const t=C.table(this._project,id);if(!t)throw new DataError('validation','TABLE_NOT_FOUND','Table introuvable.');return t;}
 // Projection de lecture déjà chargée. Les rendus ne contactent jamais l’adaptateur.
 records(tableId,options={}){const t=this._table(tableId);let rows=C.filterRows(this._project,t,t.rows,{filters:options.filters||[],sort:options.sort});if(options.offset)rows=rows.slice(options.offset);if(options.limit!==undefined)rows=rows.slice(0,options.limit);return rows;}
 record(tableId,id){if(!tableId)return null;const t=this._table(tableId);return t.rows.find(r=>C.key(r[C.pk(t).id])===C.key(id))||null;}
 preferenceValues(){return C.clone(this._values);}
 preference(id){return this._values[id];}
 setPreference(id,value){if(!(this._project.preferences||[]).some(x=>x.id===id)||typeof value!=='boolean')return Promise.reject(new DataError('validation','INVALID_PREFERENCE','Préférence locale invalide.'));return this._enqueue((p,values)=>{values[id]=value;return C.clone(p);},{type:'preference'});}
 viewRecords(tableId,options={}){let rows=C.Actions.filtered(this._project,this._values,tableId,this.records(tableId,{...options,offset:undefined,limit:undefined}));if(options.offset)rows=rows.slice(options.offset);return options.limit===undefined?rows:rows.slice(0,options.limit);}
 screenRecords(screen,context={},extra=[]){return C.Actions.filtered(this._project,this._values,screen.tableId,C.records(this._project,screen,context,extra));}
 sourceRecords(config,screen,row){const src=C.sourceRecords(this._project,{...config,limit:undefined},screen,row);if(src.table&&config.source!=='field')src.rows=C.Actions.filtered(this._project,this._values,src.table.id,src.rows);if(config.limit)src.rows=src.rows.slice(0,config.limit);return src;}
 relatedRecords(relationId,tableId,row){const rel=this._project.relations.find(r=>r.id===relationId);if(!rel)throw new DataError('validation','RELATION_NOT_FOUND','Relation introuvable.');return C.Actions.filtered(this._project,this._values,C.relationTarget(rel,tableId),C.relationRows(this._project,rel,tableId,row));}
 choices(field,config={}){return C.choiceValues(this._project,field,config);}
 async getSchema(){await this.ready;return schema(this._project);}
 async getRecords(tableId,options={}){await this.ready;return C.clone(this.records(tableId,options));}
 async getRecord(tableId,id){await this.ready;return C.clone(this.record(tableId,id));}
 async queryRecords(tableId,filters=[],sort,options={}){return this.getRecords(tableId,{...options,filters,sort});}
 async getRelatedRecords(relationId,tableId,id){await this.ready;const row=this.record(tableId,id);if(!row)throw new DataError('validation','RECORD_NOT_FOUND','Enregistrement introuvable.');return C.clone(this.relatedRecords(relationId,tableId,row));}
 _enqueue(change,{type='commit'}={}){const task=this._queue.then(async()=>{await this.ready;if(this._state==='closed')throw new DataError('connection','ENGINE_CLOSED','Le service de données est fermé.');if(this._external)throw new DataError('conflict','EXTERNAL_CHANGE','Les données ont changé dans un autre onglet. Rechargez la page avant de modifier.');let q;const values=C.clone(this._values);try{q=change(this._project,values);C.assert(q);}catch(e){throw asError(e,'validation','INVALID_DATA');}if(type==='workflow'&&JSON.stringify(q)===JSON.stringify(this._project)&&JSON.stringify(values)===JSON.stringify(this._values))return this.project();const state=await this.adapter.save(snapshot(q,this._revision,values),{expectedRevision:this._revision}).catch(e=>{throw asError(e);});this._project=q;this._values=values;this._revision=Number(state?.revision)||this._revision+1;this._emit({type});return this.project();});this._queue=task.catch(()=>{});return task;}
 async runWorkflow(steps,context={},options={}){let effects;await this._enqueue((p,values)=>{const result=C.Actions.plan(p,values,steps,context);if(result.deletes&&!options.confirmed)throw new DataError('validation','CONFIRM_DELETE','Confirmez la suppression de cet enregistrement.');Object.assign(values,result.preferences);effects=result.effects;return result.project;},{type:'workflow'});return effects;}
 async createRecord(tableId,data){const q=await this._enqueue(p=>C.writeRow(p,tableId,null,data));const t=C.table(q,tableId);return C.clone(t.rows.at(-1));}
 async updateRecord(tableId,id,patch){let newKey;const q=await this._enqueue(p=>{const t=C.table(p,tableId),old=t?.rows.find(r=>C.key(r[C.pk(t).id])===C.key(id));if(!old)throw new DataError('validation','RECORD_NOT_FOUND','Enregistrement introuvable.');const values={...old,...patch};newKey=values[C.pk(t).id];return C.writeRow(p,tableId,id,values);});return C.clone(C.table(q,tableId).rows.find(r=>C.key(r[C.pk(C.table(q,tableId)).id])===C.key(newKey)));}
 async deleteRecord(tableId,id){return this._enqueue(p=>{if(!this.record(tableId,id))throw new DataError('validation','RECORD_NOT_FOUND','Enregistrement introuvable.');return C.removeRow(p,tableId,id);});}
 async replaceData(project){return this._enqueue(current=>{if(project.id!==current.id||signature(project)!==signature(current))throw new DataError('validation','SCHEMA_MISMATCH','Le remplacement des données exige un modèle identique.');return C.normalise({...current,tables:current.tables.map(t=>({...t,rows:C.table(project,t.id)?.rows||[]}))});});}
 async exportData(){await this._queue;await this.ready;return snapshot(this._project,this._revision,this._values);}
 async importData(state){await this.ready;const project=fromSnapshot(this._seed,state);const values=C.Actions.preferences(project,state.localPreferences||{});return this._enqueue((p,current)=>{for(const id of Object.keys(current))delete current[id];Object.assign(current,values);return C.normalise({...p,tables:project.tables});});}
 updatePreview(project){if(!this.isPreview||this.adapter.kind!=='memory')throw new DataError('validation','PREVIEW_ONLY','Le modèle ne peut être changé que dans l’éditeur.');let q;try{q=C.normalise(project);}catch(e){throw asError(e,'validation','INVALID_MODEL');}const sameProject=q.id===this._project.id;this._project=q;this._seed=C.clone(q);this._revision=0;this._values=C.Actions.preferences(q,sameProject?this._values:{});this.adapter.replacePreview(snapshot(q,0,this._values));this._external=false;this._emit({type:'presentation'});}
 async resetAfterBackup({confirmed=false}={}){if(!confirmed||this.error?.code!=='SCHEMA_MISMATCH')throw new DataError('validation','EXPLICIT_RESET_REQUIRED','Exportez d’abord les anciennes données et confirmez la réinitialisation.');const old=this.error.storedState,revision=Number(old?.revision)||0;await this.adapter.save(snapshot(this._seed),{expectedRevision:revision});return true;}
 async close(){await this._queue;this._unwatch?.();this._listeners.clear();await this.adapter.close();this._state='closed';}
}
const createPreview=project=>new DataEngine(project,{preview:true});
const createLocal=(project,options={})=>new DataEngine(project,{adapter:new S.IndexedDBAdapter({projectId:project.id,...options})});
return {DataEngine,DataError,MemoryAdapter:S.MemoryAdapter,IndexedDBAdapter:S.IndexedDBAdapter,createPreview,createLocal,signature,schema,snapshot,fromSnapshot};
});

