
/* GEAP Core 1.0 — modèle déclaratif et intégrité, sans dépendance. */
(function(global){
'use strict';
const TYPES=['text','url','integer','decimal','date','boolean','image','reference','array','relation'];
const SCREEN_TYPES=['home','list','cards','table','detail','form'];
const ACTION_TYPES=['open','detail','add','edit','delete','filter','reset','refresh','back','external'];
const COMPONENT_TYPES=['text','image','button','metric','related','collection','link','rating','switch','separator'];
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
const computed=f=>['array','relation'].includes(f.type);
function safeURL(v){try{const u=new URL(String(v).trim());return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}}
const imageSource=v=>safeImage(v)||safeURL(v).startsWith('https:')?String(v):'';
const navPosition=s=>s.navigation|| (s.menu?'main':'hidden');
function cast(f,v){
 if(computed(f))return Array.isArray(v)?v:[];
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
 default:fail('Type inconnu.');
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
 if(empty(v))return '—';
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
function refreshComputed(p){for(const t of p.tables||[])for(const row of t.rows||[])for(const f of t.fields||[])if(f.type==='array')row[f.id]=(f.compute?.sources||[]).map(id=>row[id]).filter(v=>!empty(v)&&String(v).trim()!=='');
 for(const t of p.tables||[])for(const row of t.rows||[])for(const f of t.fields||[])if(f.type==='relation'){const r=p.relations.find(r=>r.id===f.compute?.relationId),dest=table(p,relationTarget(r||{},t.id));row[f.id]=dest?relationRows(p,r,t.id,row).map(x=>x[pk(dest)?.id]):[];}return p;
}
function addMatchRelation(p,config){return transact(p,q=>{const r={id:config.id||uid('rel'),kind:'match',name:config.name.trim(),sourceTableId:config.sourceTableId,sourceFieldId:config.sourceFieldId,targetTableId:config.targetTableId,targetFieldId:config.targetFieldId,operator:config.operator,multiple:config.multiple!==false};const old=q.relations.find(x=>x.id===r.id);if(old&&old.kind!=='match')fail('Type de relation incompatible.');if(old&&old.sourceTableId!==r.sourceTableId)fail('La table source d’une relation existante ne peut pas changer.');if(old)q.relations=q.relations.map(x=>x.id===r.id?r:x);else q.relations.push(r);const t=table(q,r.sourceTableId);let f=t.fields.find(f=>f.type==='relation'&&f.compute?.relationId===r.id);if(!f){f={id:uid('f'),name:r.name,type:'relation',required:false,primary:false,compute:{kind:'relation',relationId:r.id}};t.fields.push(f);}else f.name=r.name;});}
function removeMatchRelation(p,id){return transact(p,q=>{const r=q.relations.find(r=>r.id===id);if(!r||r.kind!=='match')fail('Relation calculée absente.');const t=table(q,r.sourceTableId),f=t.fields.find(f=>f.compute?.relationId===id);if(q.screens.some(s=>s.components.some(c=>c.relationId===id)||s.fields.includes(f?.id)))fail('Cette relation ou sa colonne est utilisée dans un écran. Retirez cet usage avant suppression.');q.relations=q.relations.filter(r=>r.id!==id);t.fields=t.fields.filter(x=>x.id!==f?.id);t.rows.forEach(row=>delete row[f?.id]);});}
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
   if(f.type==='array')check(f.compute?.kind==='makeArray'&&Array.isArray(f.compute.sources)&&f.compute.sources.length>0&&new Set(f.compute.sources).size===f.compute.sources.length&&f.compute.sources.every(id=>{const sf=field(t,id);return sf&&!['array','relation','image'].includes(sf.type)&&sf.id!==f.id;}),'Make Array invalide pour '+t.name+'.'+f.name);
   if(f.type==='relation')check(f.compute?.kind==='relation'&&p.relations.some(r=>r.kind==='match'&&r.id===f.compute.relationId&&r.sourceTableId===t.id),'Colonne de relation calculée invalide pour '+t.name+'.'+f.name);
   if(f.min!==undefined||f.max!==undefined)check(['integer','decimal'].includes(f.type)&&(f.min===undefined||Number.isFinite(f.min))&&(f.max===undefined||Number.isFinite(f.max))&&(!(Number.isFinite(f.min)&&Number.isFinite(f.max))||f.min<=f.max),'Plage numérique invalide pour '+f.name);
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
  checkId(r.id,'relation');if(r.kind==='match'){const st=table(p,r.sourceTableId),tt=table(p,r.targetTableId),sf=field(st,r.sourceFieldId),tf=field(tt,r.targetFieldId);check(!!st&&!!tt&&!!sf&&!!tf&&!['array','relation','image'].includes(sf?.type),'Source ou cible de correspondance invalide : '+r.name);check(['equals','includes'].includes(r.operator)&&(r.operator==='includes'?tf?.type==='array':!!tf&&!['array','relation','image'].includes(tf.type)),'Opérateur de correspondance incompatible : '+r.name);check(st?.fields.some(f=>f.type==='relation'&&f.compute?.relationId===r.id),'Colonne calculée de relation absente : '+r.name);continue;}const ct=table(p,r.childTableId),pt=table(p,r.parentTableId),f=field(ct,r.childFieldId);
  check(!!ct&&!!pt&&f?.type==='reference'&&f.refTableId===pt.id,'Relation incohérente : '+r.name);
  check(!relFields.has(r.childFieldId),'Relation dupliquée.');relFields.add(r.childFieldId);
 }
 for(const t of p.tables)for(const f of t.fields||[])if(f.type==='reference')check(relFields.has(f.id),'Relation absente pour '+t.name+'.'+f.name);
 for(const s of p.screens){
  checkId(s.id,'écran');check(name(s.name)&&SCREEN_TYPES.includes(s.type),'Écran invalide.');const t=table(p,s.tableId);
  check(!!t||s.type==='home','Source de données absente pour '+s.name);
  if(!Array.isArray(s.fields)||!Array.isArray(s.components)||!Array.isArray(s.filters)){errors.push('Configuration incomplète de '+s.name);continue;}
  if(t&&s.type==='form')for(const f of t.fields.filter(f=>f.required&&!f.primary))check(s.fields.includes(f.id),'Champ obligatoire absent du formulaire '+s.name+' : '+f.name);
  if(t){for(const fid of s.fields)check(!!field(t,fid),'Attribut affiché absent dans '+s.name);check(new Set(s.fields).size===s.fields.length,'Attribut affiché en double.');}
  if(s.navigation)check(['main','secondary','hidden'].includes(s.navigation),'Position de navigation invalide.');
  for(const [fid,config]of Object.entries(s.inputConfig||{})){const f=field(t,fid);check(!!f&&!computed(f)&&['text','textarea','number','url','image','select','switch','rating'].includes(config.mode),'Mode de saisie invalide.');if(config.mode==='select')check(!!field(table(p,config.tableId),config.fieldId),'Source du choix de valeurs absente.');}
  if(s.itemTarget)check(!!screen(p,s.itemTarget)&&screen(p,s.itemTarget).tableId===s.tableId&&['detail','form'].includes(screen(p,s.itemTarget).type),'Écran de destination incompatible dans '+s.name);
  if(s.sort?.fieldId)check(!!field(t,s.sort.fieldId)&&['asc','desc'].includes(s.sort.direction),'Tri invalide dans '+s.name);
  for(const fl of s.filters){check(!!field(t,fl.fieldId)&&OPS.includes(fl.op),'Filtre invalide dans '+s.name);if(fl.op!=='empty'&&field(t,fl.fieldId))try{valueFor(p,t,field(t,fl.fieldId),fl.value);}catch(e){errors.push('Filtre de '+s.name+' : '+e.message);}}
  for(const c of s.components){
   checkId(c.id,'composant');check(COMPONENT_TYPES.includes(c.type),'Composant inconnu.');
   if(['related','collection'].includes(c.type)){const rel=p.relations.find(r=>r.id===c.relationId),target=screen(p,c.targetScreenId);check(!!rel&&!!target,'Relation ou destination absente dans '+s.name);if(rel&&target){const dest=relationTarget(rel,s.tableId),dt=table(p,dest);check(dest===target.tableId,'Destination liée incompatible dans '+s.name);check(s.type==='detail','Une collection liée requiert une fiche.');check(c.type==='collection'?target.type==='detail':rel.kind==='match'||rel.parentTableId===s.tableId?['list','cards','table'].includes(target.type):target.type==='detail','Type de destination liée invalide.');if(c.type==='collection'){check(['list','cards'].includes(c.layout),'Présentation de collection invalide.');if(c.titleFieldId)check(!!field(dt,c.titleFieldId),'Titre de collection absent.');if(c.imageFieldId)check(field(dt,c.imageFieldId)?.type==='image','Image de collection absente.');}}}
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
  if(a.type==='add')check(target?.type==='form','L’action Ajouter doit viser un formulaire.');
  if(a.type==='detail')check(target?.type==='detail','L’action Fiche doit viser une fiche.');
  if(a.type==='filter'){const t=table(p,target?.tableId);check(['list','cards','table'].includes(target?.type)&&!!field(t,a.fieldId)&&OPS.includes(a.op),'Filtre d’action invalide.');if(field(t,a.fieldId)&&a.op!=='empty')try{valueFor(p,t,field(t,a.fieldId),a.value);}catch(e){errors.push('Action '+a.name+' : '+e.message);}}
 }
 if(p.screens.length)check(!!screen(p,p.homeScreenId),'Écran d’accueil absent.');
 check(/^#[0-9a-f]{6}$/i.test(p.theme?.primary||''),'Couleur principale invalide.');
 if(p.theme?.iconData)check(safeImage(p.theme.iconData),'Icône invalide.');
 return [...new Set(errors)];
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
function addField(p,tid,n,type,refTableId,required=false,options={}){return transact(p,q=>{const t=table(q,tid);if(!t)fail('Table introuvable.');const f={id:uid('f'),name:n.trim(),type,required:!!required,primary:false};if(type==='reference')f.refTableId=refTableId;if(type==='array')f.compute={kind:'makeArray',sources:options.sources||[]};if(Number.isFinite(options.min))f.min=options.min;if(Number.isFinite(options.max))f.max=options.max;t.fields.push(f);if(required)for(const s of q.screens.filter(s=>s.type==='form'&&s.tableId===tid))s.fields.push(f.id);for(const r of t.rows)r[f.id]=type==='boolean'?false:type==='text'||type==='image'?'':null;if(type==='reference')q.relations.push({id:uid('rel'),name:t.name+' → '+table(q,refTableId)?.name,childTableId:tid,childFieldId:f.id,parentTableId:refTableId});});}
function deleteField(p,tid,fid){return transact(p,q=>{const t=table(q,tid),f=field(t,fid);if(!f||f.primary)fail('La clé primaire ne peut pas être supprimée.');if(f.type==='relation')fail('Supprimez cette relation depuis l’espace Relations.');if(q.screens.some(s=>s.fields.includes(fid)||s.sort?.fieldId===fid||s.filters.some(x=>x.fieldId===fid)||s.components.some(c=>c.fieldId===fid))||q.actions.some(a=>a.fieldId===fid))fail('Cet attribut est utilisé dans un écran ou une action. Retirez ces usages avant de le supprimer.');const rel=q.relations.find(r=>r.childFieldId===fid);if(rel&&q.screens.some(s=>s.components.some(c=>c.relationId===rel.id)))fail('Cette relation est utilisée par un composant lié.');t.fields=t.fields.filter(x=>x.id!==fid);t.rows.forEach(r=>delete r[fid]);q.relations=q.relations.filter(r=>r.childFieldId!==fid);});}
function removeTable(p,tid){return transact(p,q=>{if(q.relations.some(r=>r.kind==='match'&&(r.sourceTableId===tid||r.targetTableId===tid)))fail('Cette table participe à une correspondance calculée. Supprimez d’abord cette relation.');if(q.relations.some(r=>r.parentTableId===tid&&r.childTableId!==tid))fail('Cette table est référencée. Supprimez d’abord les clés étrangères concernées.');if(q.screens.some(s=>s.tableId===tid||s.components.some(c=>c.tableId===tid)))fail('Cette table est utilisée dans des écrans. Supprimez ou modifiez ces écrans d’abord.');q.tables=q.tables.filter(t=>t.id!==tid);q.relations=q.relations.filter(r=>r.childTableId!==tid);});}
function match(p,t,r,f){const v=r[f.fieldId],attr=field(t,f.fieldId);let w=f.value;try{if(f.op!=='contains'&&f.op!=='empty')w=valueFor(p,t,attr,w);}catch{return false;}switch(f.op){case 'eq':return key(v)===key(w);case 'ne':return key(v)!==key(w);case 'contains':return String(v??'').toLocaleLowerCase('fr').includes(String(w??'').toLocaleLowerCase('fr'));case 'gt':return v>w;case 'gte':return v>=w;case 'lt':return v<w;case 'lte':return v<=w;case 'empty':return empty(v);default:return true;}}
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
function exportCSV(p,tid){const t=table(p,tid),cell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';return '\uFEFF'+[t.fields.map(f=>cell(f.name)).join(';'),...t.rows.map(r=>t.fields.map(f=>cell(typeof r[f.id]==='boolean'?r[f.id]?'Oui':'Non':Array.isArray(r[f.id])?JSON.stringify(r[f.id]):r[f.id])).join(';'))].join('\r\n');}
function blank(n='Mon application'){return {format:'GEAP',version:1,id:uid('project'),name:n,description:'Une application créée avec GEAP.',theme:{primary:'#177b69'},tables:[],relations:[],screens:[],actions:[],homeScreenId:''};}
const api={computed,safeURL,imageSource,navPosition,relationSource,relationTarget,relationRows,refreshComputed,addMatchRelation,removeMatchRelation,TYPES,SCREEN_TYPES,ACTION_TYPES,COMPONENT_TYPES,OPS,clone,uid,slug,esc,key,empty,safeImage,table,field,pk,screen,cast,valueFor,label,display,validate,assert,normalise,transact,nextKey,writeRow,removeRow,addTable,addField,deleteField,removeTable,match,records,parseCSV,importCSV,exportCSV,blank};
global.GEAPCore=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);

