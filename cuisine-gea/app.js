
/* Persistance et cycle de vie de la PWA. Les écritures sont attendues avant validation. */
(async function(){
'use strict';
const C=window.GEAPCore,initial=C.normalise(JSON.parse(document.getElementById('geap-model').textContent));
const status=document.getElementById('storage-status'),net=document.getElementById('network-status'),tools=document.getElementById('app-tools');
const signature=JSON.stringify(initial.tables.map(t=>({id:t.id,fields:t.fields})));
const dbName='geap-'+initial.id+'-'+new URL('.',location.href).pathname;
let db,app,stored;
const download=(data,name)=>{const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1500);};
const message=m=>{document.getElementById('app-message').textContent=m;};
const snapshot=p=>({format:'GEAP_DATA',version:1,projectId:p.id,modelSignature:signature,tables:p.tables.map(t=>({id:t.id,rows:t.rows}))});
function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(dbName,1);req.onupgradeneeded=()=>req.result.createObjectStore('state');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);req.onblocked=()=>reject(new Error('Base bloquée par un autre onglet.'));});}
function read(){return new Promise((resolve,reject)=>{const tx=db.transaction('state','readonly'),req=tx.objectStore('state').get('data');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function persist(data){return new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put(data,'data');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Écriture annulée.'));});}
function apply(data){if(data.format!=='GEAP_DATA'||data.projectId!==initial.id||data.modelSignature!==signature)throw new Error('Cette sauvegarde ne correspond pas au modèle de cette application.');return C.normalise({...initial,tables:initial.tables.map(t=>({...t,rows:data.tables.find(x=>x.id===t.id)?.rows||[]}))});}
try{db=await openDB();db.onversionchange=()=>db.close();stored=await read();}catch(e){status.textContent='Stockage indisponible';message('Impossible d’ouvrir IndexedDB. Les modifications seront bloquées pour éviter toute perte de données. '+e.message);}
let p=initial;
if(stored){try{p=apply(stored);}catch(e){const box=document.getElementById('migration');box.hidden=false;document.querySelector('.pwa-toolbar').hidden=true;box.querySelector('p').textContent='Le modèle a changé ou les données ne sont plus compatibles. Téléchargez votre sauvegarde avant de repartir des données initiales. Aucune donnée locale n’a été effacée.';document.getElementById('old-backup').onclick=()=>download(stored,'sauvegarde-avant-migration.json');document.getElementById('reset-model').onclick=async()=>{if(confirm('Avez-vous téléchargé vos anciennes données ? Les données locales seront remplacées.')){await persist(snapshot(initial));location.reload();}};return;}}
app=new GEAPRuntime(document.getElementById('app'),p,{onChange:async q=>{if(!db)throw new Error('Stockage local indisponible : modification non enregistrée.');status.textContent='Enregistrement…';try{await persist(snapshot(q));status.textContent='Données enregistrées sur cet appareil';}catch(e){status.textContent='Échec de l’enregistrement';throw new Error('Écriture impossible. Exportez une sauvegarde ; l’espace de stockage est peut-être plein.');}}});
if(db)status.textContent='Données enregistrées sur cet appareil';
let dirtyElsewhere=false;
if('BroadcastChannel' in window){const bc=new BroadcastChannel(dbName);const old=app.options.onChange;app.options.onChange=async q=>{if(dirtyElsewhere)throw new Error('Des données ont changé dans un autre onglet. Rechargez cette page avant de modifier.');await old(q);bc.postMessage('changed');};bc.onmessage=()=>{dirtyElsewhere=true;message('Les données ont changé dans un autre onglet. Rechargez la page avant de poursuivre.');};}
document.getElementById('backup').onclick=()=>download(snapshot(app.p),C.slug(initial.name)+'-donnees.json');
document.getElementById('restore').onclick=()=>document.getElementById('restore-file').click();
document.getElementById('restore-file').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>100*1024*1024)throw new Error('Fichier trop volumineux (100 Mo maximum).');const q=apply(JSON.parse(await file.text()));if(!confirm('Remplacer les données de cet appareil par cette sauvegarde ?'))return;await app.commit(q);app.update(q);message('Sauvegarde restaurée.');}catch(err){message(err.message);}finally{e.target.value='';}};
document.getElementById('tools-toggle').onclick=()=>{tools.hidden=!tools.hidden;};
const updateNetwork=()=>net.textContent=navigator.onLine?'Connexion disponible':'Mode hors ligne';updateNetwork();addEventListener('online',updateNetwork);addEventListener('offline',updateNetwork);
let promptEvent;const install=document.getElementById('install');
addEventListener('beforeinstallprompt',e=>{e.preventDefault();promptEvent=e;install.textContent='Installer l’application';});
install.onclick=async()=>{if(promptEvent){await promptEvent.prompt();promptEvent=null;}else message('iPhone / iPad : Safari → Partager → Sur l’écran d’accueil. Android : menu du navigateur → Installer l’application. Ouvrez d’abord l’adresse HTTPS.');};
if('serviceWorker'in navigator&&['https:','http:'].includes(location.protocol)){
 try{let reloading=false,userUpdating=false;const hadController=!!navigator.serviceWorker.controller;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!reloading&&(hadController||userUpdating)){reloading=true;location.reload();}});
 const reg=await navigator.serviceWorker.register('./service-worker.js',{updateViaCache:'none'});
 const showUpdate=()=>{const b=document.getElementById('update');b.hidden=false;b.onclick=()=>{userUpdating=true;reg.waiting?.postMessage('ACTIVATE');};};
 if(reg.waiting)showUpdate();reg.addEventListener('updatefound',()=>{const w=reg.installing;w?.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)showUpdate();});});
 await navigator.serviceWorker.ready;document.getElementById('offline-status').textContent='Disponible hors ligne';
 addEventListener('online',()=>reg.update().catch(()=>{}));
 }catch(e){document.getElementById('offline-status').textContent='Cache hors ligne indisponible';message('L’application fonctionne, mais le service worker n’a pas pu être installé : '+e.message);}
}else{document.getElementById('offline-status').textContent='Publication HTTPS requise';message(location.protocol==='file:'?'Un fichier ouvert localement ne constitue pas une PWA installable. Publiez ce dossier sur un hébergement HTTPS.':'Cette adresse ne permet pas d’activer le cache hors ligne. Ouvrez la version publiée en HTTPS pour installer l’application.');}
})();

