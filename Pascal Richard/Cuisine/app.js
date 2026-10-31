
/* PWA : présentation et cycle de vie. Le moteur délègue la persistance à l’adaptateur local. */
(async function(){
'use strict';
const C=window.GEAPCore,D=window.GEAPData,initial=C.normalise(JSON.parse(document.getElementById('geap-model').textContent));
const status=document.getElementById('storage-status'),net=document.getElementById('network-status'),tools=document.getElementById('app-tools');
const download=(data,name)=>{const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1500);};
const message=m=>{document.getElementById('app-message').textContent=m;};
const engine=D.createLocal(initial);let app;
try{await engine.ready;status.textContent='Données enregistrées sur cet appareil';}catch(e){
 if(e.storedState){const box=document.getElementById('migration'),reset=document.getElementById('reset-model');box.hidden=false;document.querySelector('.pwa-toolbar').hidden=true;box.querySelector('p').textContent='Le modèle ou les données ne sont plus compatibles. Exportez les anciennes données. Aucune migration ni suppression automatique n’a été effectuée.';reset.disabled=true;reset.hidden=e.code!=='SCHEMA_MISMATCH';document.getElementById('old-backup').onclick=()=>{download(e.storedState,'sauvegarde-avant-migration.json');reset.disabled=false;};reset.onclick=async()=>{if(confirm('Les anciennes données ont-elles été sauvegardées ? Cette réinitialisation explicite les remplacera par les données initiales.')){try{await engine.resetAfterBackup({confirmed:true});location.reload();}catch(error){box.querySelector('p').textContent=error.message;}}};return;}
 status.textContent='Stockage local indisponible';message('Les données initiales peuvent être consultées, mais les modifications sont bloquées. '+e.message);
}
app=new GEAPRuntime(document.getElementById('app'),engine.project(),{engine,onChange:()=>{status.textContent='Données enregistrées sur cet appareil';},onExternal:()=>message('Les données ont changé dans un autre onglet. Rechargez la page avant de poursuivre.')});
document.getElementById('backup').onclick=async()=>{try{download(await engine.exportData(),C.slug(initial.name)+'-donnees.json');}catch(e){message(e.message);}};
document.getElementById('restore').onclick=()=>document.getElementById('restore-file').click();
document.getElementById('restore-file').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>100*1024*1024)throw new Error('Fichier trop volumineux (100 Mo maximum).');const state=JSON.parse(await file.text());D.fromSnapshot(initial,state);if(!confirm('Remplacer les données de cet appareil par cette sauvegarde ?'))return;await app._execute(()=>engine.importData(state));app.render();message('Sauvegarde restaurée.');}catch(err){message(err.message);}finally{e.target.value='';}};
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

