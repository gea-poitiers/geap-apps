
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
function resultType(p,t,f,seen=new Set()){if(f.type!=='computed')return f.type;if(seen.has(f.id))return 'text';seen.add(f.id);const x=f.compute||{};if(x.kind!=='lookup')return ({math:'decimal',distance:'decimal',rollup:['count','unique'].includes(x.operation)?'integer':'decimal',template:'text',if:x.valueType||'text'})[x.kind]||'text';if(x.mode==='all')return 'array';const rel=p.relations.find(r=>r.id===x.relationId),dt=C.table(p,C.relationTarget(rel||{},t.id)),df=C.field(dt,x.fieldId);return df?resultType(p,dt,df,seen):'text';}
function resolvedField(p,t,f,seen=new Set()){if(f.type!=='computed')return f;if(seen.has(f.id))return {...f,type:'text'};seen.add(f.id);const x=f.compute||{};if(x.kind==='lookup'&&x.mode!=='all'){const rel=p.relations.find(r=>r.id===x.relationId),dt=C.table(p,C.relationTarget(rel||{},t.id)),df=C.field(dt,x.fieldId);if(df){const base=resolvedField(p,dt,df,seen);return {...base,id:f.id,name:f.name,required:false,primary:false,format:f.format||base.format};}}return {...f,type:resultType(p,t,f),required:false,primary:false};}
function formattedNumber(f,v){const format=f.format;if(!format||!NUMERIC.includes(effectiveType(f)))return undefined;const opts={minimumFractionDigits:format.decimals??(format.kind==='currency'?2:0),maximumFractionDigits:format.decimals??(format.kind==='currency'?2:4)};if(format.kind==='currency'){opts.style='currency';opts.currency=format.currency||'EUR';}if(format.kind==='percent')opts.style='percent';return new Intl.NumberFormat('fr-FR',opts).format(Number(v));}
function displayAdvanced(p,t,f,v){if(f.type==='computed'){const kind=effectiveType(f);if(kind==='array')return (Array.isArray(v)?v:[]).map(x=>typeof x==='object'?x.name||JSON.stringify(x):String(x)).join(' · ');return C.display(p,t,resolvedField(p,t,f),v);}const formatted=formattedNumber(f,v);if(formatted!==undefined)return formatted;
 switch(f.type){case 'email':case 'phone':case 'richtext':case 'time':return String(v);case 'datetime':return new Intl.DateTimeFormat('fr-FR',{dateStyle:'short',timeStyle:'short'}).format(new Date(v));case 'duration':{const h=Math.floor(Number(v)/60),m=Number(v)%60;return (h?h+' h ':'')+(m||!h?new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(m)+' min':'');}case 'location':{try{const q=location(v);return q?q.lat.toFixed(5)+', '+q.lng.toFixed(5):'—';}catch{return 'Coordonnées invalides';}}case 'multiselect':return (Array.isArray(v)?v:[]).join(' · ');case 'images':return imageItems(v).length+' photo(s)';case 'files':return (Array.isArray(v)?v:[]).map(x=>x.name).join(' · ');default:return undefined;}}
function operand(row,o){if(o?.fieldId)return row[o.fieldId];return o?.value??null;}
function relationDependencies(p,t,rel){if(!rel)return [];if(rel.kind==='match')return [[rel.sourceTableId,rel.sourceFieldId],[rel.targetTableId,rel.targetFieldId]];return [[rel.childTableId,rel.childFieldId]];}
function dependencies(p,t,f){const x=f.compute||{};if(f.type==='array')return (x.sources||[]).map(id=>[t.id,id]);if(f.type==='relation')return relationDependencies(p,t,p.relations.find(r=>r.id===x.relationId));const local=ids=>ids.filter(Boolean).map(id=>[t.id,id]);
 switch(x.kind){case 'math':return local([x.left?.fieldId,x.right?.fieldId]);case 'distance':return local([x.fromFieldId,x.toFieldId]);case 'if':return local([x.condition?.fieldId,x.then?.fieldId,x.else?.fieldId]);case 'template':return local(x.fields||[]);case 'lookup':case 'rollup':{const rel=p.relations.find(r=>r.id===x.relationId),dest=C.relationTarget(rel||{},t.id);return [...relationDependencies(p,t,rel),...(x.fieldId&&dest?[[dest,x.fieldId]]:[])];}default:return [];}}
function calculationOrder(p){const all=new Map();for(const t of p.tables)for(const f of t.fields)if(C.computed(f))all.set(f.id,{t,f});const ordered=[],state=new Map();function visit(item){const mark=state.get(item.f.id);if(mark===2)return;if(mark===1)fail('Calcul circulaire : '+item.t.name+'.'+item.f.name+'.');state.set(item.f.id,1);for(const [tid,fid]of dependencies(p,item.t,item.f)){const sf=C.field(C.table(p,tid),fid);if(!sf)fail('Attribut de calcul introuvable dans '+item.f.name+'.');if(all.has(fid))visit(all.get(fid));}state.set(item.f.id,2);ordered.push(item);}for(const item of all.values())visit(item);return ordered;}
function distance(a,b){a=location(a);b=location(b);if(!a||!b)return null;const rad=n=>n*Math.PI/180,dlat=rad(b.lat-a.lat),dlon=rad(b.lng-a.lng),v=Math.sin(dlat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlon/2)**2;return 6371.0088*2*Math.atan2(Math.sqrt(Math.min(1,v)),Math.sqrt(Math.max(0,1-v)));}
function calculate(p,t,f,row){const x=f.compute||{};if(f.type==='array')return (x.sources||[]).map(id=>row[id]).filter(v=>!C.empty(v)&&String(v).trim()!=='');if(f.type==='relation'){const rel=p.relations.find(r=>r.id===x.relationId),dt=C.table(p,C.relationTarget(rel||{},t.id));return dt?C.relationRows(p,rel,t.id,row).map(r=>r[C.pk(dt).id]):[];}
 let value=null;switch(x.kind){case 'math':{const a=operand(row,x.left),b=operand(row,x.right);if(C.empty(a)||C.empty(b))return null;const aa=Number(a),bb=Number(b);if(!Number.isFinite(aa)||!Number.isFinite(bb))return null;value=({add:()=>aa+bb,subtract:()=>aa-bb,multiply:()=>aa*bb,divide:()=>bb===0?null:aa/bb,percent:()=>aa*bb/100})[x.operation]?.();if(value===null||!Number.isFinite(value))return null;return value;}
 case 'distance':return distance(row[x.fromFieldId],row[x.toFieldId]);
 case 'template':return String(x.prefix||'')+(x.fields||[]).map(id=>{const sf=C.field(t,id);return C.empty(row[id])?'':C.display(p,t,sf,row[id]);}).filter(Boolean).join(x.separator??' ')+String(x.suffix||'');
 case 'if':{const chosen=C.match(p,t,row,x.condition)?x.then:x.else;value=operand(row,chosen);return C.empty(value)?null:C.cast({type:x.valueType||'text',name:f.name},value);}
 case 'lookup':case 'rollup':{const rel=p.relations.find(r=>r.id===x.relationId),rows=C.relationRows(p,rel,t.id,row),values=rows.map(r=>r[x.fieldId]).filter(v=>!C.empty(v));if(x.kind==='lookup')return x.mode==='all'?C.clone(values):values.length?C.clone(values[0]):null;if(x.operation==='count')return rows.length;if(x.operation==='unique')return new Set(values.map(v=>JSON.stringify(v))).size;const nums=values.map(Number).filter(Number.isFinite);if(x.operation==='sum')return nums.reduce((a,b)=>a+b,0);if(!nums.length)return null;if(x.operation==='avg')return nums.reduce((a,b)=>a+b,0)/nums.length;if(x.operation==='min')return Math.min(...nums);if(x.operation==='max')return Math.max(...nums);return null;}
 default:fail('Calcul inconnu pour '+f.name);}}
function refreshAdvanced(p){for(const {t,f}of calculationOrder(p)){if(f.type==='computed')f.resultType=resultType(p,t,f);for(const row of t.rows)row[f.id]=calculate(p,t,f,row);}return p;}
function choiceValues(p,f,cfg={}){const source=cfg.tableId?cfg:f.choiceSource,table=source?C.table(p,source.tableId):null;const from=[...(f.choices||[]),...(table?table.rows.map(r=>r[source.fieldId]):[])];return [...new Set(from.filter(v=>!C.empty(v)).flatMap(v=>Array.isArray(v)?v:[v]).map(String))];}
function formValue(fd,f){if(f.type==='location'&&fd.has(f.id+'__lat')){const lat=fd.get(f.id+'__lat'),lng=fd.get(f.id+'__lng');return !lat&&!lng?'':{lat,lng};}if(f.type==='multiselect'&&fd.has(f.id+'__present'))return fd.getAll(f.id);const all=fd.getAll(f.id);return all.length?all.at(-1):undefined;}
function initialValue(f){return ['array','relation','multiselect','images','files'].includes(f.type)?[]:f.type==='boolean'?false:f.type==='computed'?null:'';}
function localDateTime(v){if(C.empty(v))return '';const d=new Date(v);if(Number.isNaN(d.getTime()))return '';const pad=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes())+(d.getSeconds()||d.getMilliseconds()?':'+pad(d.getSeconds())+(d.getMilliseconds()?'.'+String(d.getMilliseconds()).padStart(3,'0'):''):'');}
function contactURL(type,v){if(C.empty(v))return '';try{v=castAdvanced({type,name:'Contact'},v);}catch{return '';}return type==='email'?'mailto:'+encodeURIComponent(v):type==='phone'?'tel:'+v.replace(/[^+\d]/g,''):'';}
function inlineMarkdown(text){const rx=/(\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|\[([^\]\n]+)\]\(([^\s)]+)\))/g;let out='',last=0,m;while((m=rx.exec(text))){out+=C.esc(text.slice(last,m.index));out+=m[2]?'<strong>'+C.esc(m[2])+'</strong>':m[3]?'<em>'+C.esc(m[3])+'</em>':C.safeURL(m[5])?'<a href="'+C.esc(C.safeURL(m[5]))+'" target="_blank" rel="noopener noreferrer">'+C.esc(m[4])+'</a>':C.esc(m[0]);last=rx.lastIndex;}return out+C.esc(text.slice(last));}
function richHTML(value){let out='',list=false;for(const line of String(value||'').split(/\r?\n/)){const li=line.match(/^[-*] (.*)$/);if(li){if(!list){out+='<ul>';list=true;}out+='<li>'+inlineMarkdown(li[1])+'</li>';continue;}if(list){out+='</ul>';list=false;}const h=line.match(/^(#{1,3}) (.*)$/);out+=h?'<h'+(h[1].length+1)+'>'+inlineMarkdown(h[2])+'</h'+(h[1].length+1)+'>':line?'<p>'+inlineMarkdown(line)+'</p>':'';}return out+(list?'</ul>':'');}
function sourceRecords(p,c,s,row){if(c.source==='field'){const t=C.table(p,s.tableId);return {table:t,rows:row?[row]:[],fieldId:c.fieldId};}if(c.relationId&&(c.source!=='table')){const rel=p.relations.find(r=>r.id===c.relationId),t=C.table(p,C.relationTarget(rel||{},s.tableId));let rows=t?C.relationRows(p,rel,s.tableId,row):[];return {table:t,rows:filterRows(p,t,rows,c),relation:rel};}const t=C.table(p,c.tableId||s.tableId);return {table:t,rows:t?filterRows(p,t,t.rows,c):[]};}
function filterRows(p,t,rows,c){if(!t)return [];let out=rows.filter(row=>(c.filters||[]).every(f=>C.match(p,t,row,f)));if(c.sort?.fieldId){const dir=c.sort.direction==='desc'?-1:1;out=[...out].sort((a,b)=>{const aa=a[c.sort.fieldId],bb=b[c.sort.fieldId];return dir*(typeof aa==='number'&&typeof bb==='number'?aa-bb:String(aa??'').localeCompare(String(bb??''),'fr',{numeric:true}));});}if(c.limit)out=out.slice(0,c.limit);return out;}
function validTileURL(value){if(!value)return true;if(typeof value!=='string'||!value.includes('{z}')||!value.includes('{x}')||!value.includes('{y}'))return false;return C.safeURL(value.replace(/\{[zxy]\}/g,'0')).startsWith('https:');}
function viewErrors(p,t,c,label){const es=[],check=(ok,m)=>{if(!ok)es.push(label+' : '+m);},has=(id,types)=>!id||!!C.field(t,id)&&(!types||types.includes(effectiveType(C.field(t,id))));
 for(const key of ['titleFieldId','subtitleFieldId','groupFieldId'])check(has(c[key]),'attribut de présentation absent.');check(has(c.imageFieldId,['image','images']),'attribut photo incompatible.');check(has(c.locationFieldId,['location']),'attribut GPS incompatible.');check(has(c.dateFieldId,['date','datetime']),'attribut de date incompatible.');check(has(c.checkedFieldId,['boolean']),'attribut de checklist incompatible.');check(validTileURL(c.tileUrl),'URL de fond cartographique invalide.');if(c.limit!==undefined)check(Number.isInteger(c.limit)&&c.limit>=1&&c.limit<=10000,'limite de collection invalide.');if(c.fields)check(Array.isArray(c.fields)&&c.fields.every(id=>has(id)),'colonnes de collection invalides.');for(const fl of c.filters||[])check(has(fl.fieldId)&&C.OPS.includes(fl.op),'filtre de collection invalide.');if(c.sort?.fieldId)check(has(c.sort.fieldId)&&['asc','desc'].includes(c.sort.direction),'tri de collection invalide.');return es;}
function validateAdvanced(p){const es=[],check=(ok,m)=>{if(!ok)es.push(m);};for(const t of p.tables||[])for(const f of t.fields||[]){if(f.choiceSource)check(!!C.field(C.table(p,f.choiceSource.tableId),f.choiceSource.fieldId),'Source de choix absente : '+f.name);if(f.choices)check(Array.isArray(f.choices)&&f.choices.every(x=>typeof x==='string'),'Liste de choix invalide.');if(f.format){check(NUMERIC.includes(effectiveType(f))&&['number','currency','percent'].includes(f.format.kind),'Format numérique incompatible : '+f.name);check(f.format.decimals===undefined||Number.isInteger(f.format.decimals)&&f.format.decimals>=0&&f.format.decimals<=6,'Nombre de décimales invalide.');if(f.format.kind==='currency')check(/^[A-Z]{3}$/.test(f.format.currency||'EUR'),'Devise invalide.');}
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
return {NUMERIC,COLLECTION_TYPES:COLLECTIONS,ARRAY_TYPES,MAX_FILE,MAX_MEDIA,FILE_TYPES,castAdvanced,displayAdvanced,effectiveType,resultType,location,safeFile,imageItems,calculationOrder,dependencies,calculate,refreshAdvanced,validateAdvanced,choiceValues,formValue,initialValue,localDateTime,contactURL,richHTML,sourceRecords,filterRows,validTileURL,readMediaFiles,scalarType,distance,resolvedField};
});

/* GEAP Core 1.0 — modèle déclaratif et intégrité, sans dépendance. */
(function(global){
'use strict';
const TYPES=['text','url','integer','decimal','date','boolean','image','reference','array','relation','email','phone','datetime','time','duration','location','multiselect','images','files','richtext','computed'];
const SCREEN_TYPES=['home','list','cards','table','detail','form','grid','tiles','checklist','calendar','kanban','gallery','carousel','map'];
const ACTION_TYPES=['open','detail','add','edit','delete','filter','reset','refresh','back','external'];
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
function addMatchRelation(p,config){return transact(p,q=>{const r={id:config.id||uid('rel'),kind:'match',name:config.name.trim(),sourceTableId:config.sourceTableId,sourceFieldId:config.sourceFieldId,targetTableId:config.targetTableId,targetFieldId:config.targetFieldId,operator:config.operator,multiple:config.multiple!==false};const old=q.relations.find(x=>x.id===r.id);if(old&&old.kind!=='match')fail('Type de relation incompatible.');if(old&&old.sourceTableId!==r.sourceTableId)fail('La table source d’une relation existante ne peut pas changer.');if(old)q.relations=q.relations.map(x=>x.id===r.id?r:x);else q.relations.push(r);const t=table(q,r.sourceTableId);let f=t.fields.find(f=>f.type==='relation'&&f.compute?.relationId===r.id);if(!f){f={id:uid('f'),name:r.name,type:'relation',required:false,primary:false,compute:{kind:'relation',relationId:r.id}};t.fields.push(f);}else f.name=r.name;});}
function removeMatchRelation(p,id){return transact(p,q=>{const r=q.relations.find(r=>r.id===id);if(!r||r.kind!=='match')fail('Relation calculée absente.');const t=table(q,r.sourceTableId),f=t.fields.find(f=>f.compute?.relationId===id);if(q.tables.some(qt=>qt.fields.some(qf=>qf.type==='computed'&&qf.compute?.relationId===id)))fail('Cette relation est utilisée par un calcul.');if(q.screens.some(s=>s.components.some(c=>c.relationId===id)||s.fields.includes(f?.id)))fail('Cette relation ou sa colonne est utilisée dans un écran. Retirez cet usage avant suppression.');q.relations=q.relations.filter(r=>r.id!==id);t.fields=t.fields.filter(x=>x.id!==f?.id);t.rows.forEach(row=>delete row[f?.id]);});}
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
   if(f.type==='array')check(f.compute?.kind==='makeArray'&&Array.isArray(f.compute.sources)&&f.compute.sources.length>0&&new Set(f.compute.sources).size===f.compute.sources.length&&f.compute.sources.every(id=>{const sf=field(t,id);return sf&&(api.scalarType?api.scalarType(sf):!['array','relation','image'].includes(sf.type))&&sf.id!==f.id;}),'Make Array invalide pour '+t.name+'.'+f.name);
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
  checkId(r.id,'relation');if(r.kind==='match'){const st=table(p,r.sourceTableId),tt=table(p,r.targetTableId),sf=field(st,r.sourceFieldId),tf=field(tt,r.targetFieldId);check(!!st&&!!tt&&!!sf&&!!tf&&(api.scalarType?api.scalarType(sf):!['array','relation','image'].includes(sf?.type)),'Source ou cible de correspondance invalide : '+r.name);check(['equals','includes'].includes(r.operator)&&(r.operator==='includes'?['array','multiselect'].includes(tf?.type):!!tf&&(api.scalarType?api.scalarType(tf):!['array','relation','image'].includes(tf.type))),'Opérateur de correspondance incompatible : '+r.name);check(st?.fields.some(f=>f.type==='relation'&&f.compute?.relationId===r.id),'Colonne calculée de relation absente : '+r.name);continue;}const ct=table(p,r.childTableId),pt=table(p,r.parentTableId),f=field(ct,r.childFieldId);
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
  if(a.type==='add')check(target?.type==='form','L’action Ajouter doit viser un formulaire.');
  if(a.type==='detail')check(target?.type==='detail','L’action Fiche doit viser une fiche.');
  if(a.type==='filter'){const t=table(p,target?.tableId);check((api.COLLECTION_TYPES||['list','cards','table']).includes(target?.type)&&!!field(t,a.fieldId)&&OPS.includes(a.op),'Filtre d’action invalide.');if(field(t,a.fieldId)&&a.op!=='empty')try{valueFor(p,t,field(t,a.fieldId),a.value);}catch(e){errors.push('Action '+a.name+' : '+e.message);}}
 }
 if(p.screens.length)check(!!screen(p,p.homeScreenId),'Écran d’accueil absent.');
 check(/^#[0-9a-f]{6}$/i.test(p.theme?.primary||''),'Couleur principale invalide.');
 for(const k of ['background','surface','text','muted','border'])if(p.theme?.[k]!==undefined)check(color(p.theme[k]),'Couleur de présentation invalide : '+k);
 if(p.theme?.font!==undefined)check(Object.hasOwn(FONTS,p.theme.font),'Police de caractères non prise en charge.');
 if(p.theme?.preset!==undefined)check(Object.hasOwn(THEMES,p.theme.preset),'Thème de présentation absent.');
 if(p.theme?.iconData)check(safeImage(p.theme.iconData),'Icône invalide.');
 if(api.validateAdvanced)errors.push(...api.validateAdvanced(p));return [...new Set(errors)];
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
function addField(p,tid,n,type,refTableId,required=false,options={}){return transact(p,q=>{const t=table(q,tid);if(!t)fail('Table introuvable.');const f={id:uid('f'),name:n.trim(),type,required:!!required,primary:false};if(type==='reference')f.refTableId=refTableId;if(type==='array')f.compute={kind:'makeArray',sources:options.sources||[]};if(type==='computed'){f.compute=options.compute;f.required=false;}for(const k of ['format','choices','choiceSource'])if(options[k]!==undefined)f[k]=options[k];if(Number.isFinite(options.min))f.min=options.min;if(Number.isFinite(options.max))f.max=options.max;t.fields.push(f);if(required)for(const s of q.screens.filter(s=>s.type==='form'&&s.tableId===tid))s.fields.push(f.id);for(const r of t.rows)r[f.id]=api.initialValue?api.initialValue(f):type==='boolean'?false:type==='text'||type==='image'?'':null;if(type==='reference')q.relations.push({id:uid('rel'),name:t.name+' → '+table(q,refTableId)?.name,childTableId:tid,childFieldId:f.id,parentTableId:refTableId});});}
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
function exportCSV(p,tid){const t=table(p,tid),cell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';return '\uFEFF'+[t.fields.map(f=>cell(f.name)).join(';'),...t.rows.map(r=>t.fields.map(f=>cell(typeof r[f.id]==='boolean'?r[f.id]?'Oui':'Non':r[f.id]&&typeof r[f.id]==='object'?JSON.stringify(r[f.id]):r[f.id])).join(';'))].join('\r\n');}
function blank(n='Mon application'){return {format:'GEAP',version:1,id:uid('project'),name:n,description:'Une application créée avec GEAP.',theme:{primary:'#177b69'},tables:[],relations:[],screens:[],actions:[],homeScreenId:''};}
const api={THEMES,FONTS,appearance,contrast,onColor,computed,safeURL,imageSource,navPosition,relationSource,relationTarget,relationRows,refreshComputed,addMatchRelation,removeMatchRelation,TYPES,SCREEN_TYPES,ACTION_TYPES,COMPONENT_TYPES,OPS,clone,uid,slug,esc,key,empty,safeImage,table,field,pk,screen,cast,valueFor,label,display,validate,assert,normalise,transact,nextKey,writeRow,removeRow,addTable,addField,deleteField,removeTable,match,records,parseCSV,importCSV,exportCSV,blank};
const advancedFactory=typeof module!=='undefined'&&module.exports?require('./core-advanced.js'):global.GEAPAdvancedCore;if(advancedFactory)Object.assign(api,advancedFactory(api));
global.GEAPCore=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);

