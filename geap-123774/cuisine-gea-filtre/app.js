
/* PWA : présentation et cycle de vie. Le moteur délègue la persistance à l’adaptateur local. */
(async function(){
'use strict';
const C=window.GEAPCore,D=window.GEAPData,initial=C.normalise(JSON.parse(document.getElementById('geap-model').textContent));
const status=document.getElementById('storage-status');
const download=(data,name)=>{const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1500);};
const message=m=>{document.getElementById('app-message').textContent=m;};
const engine=D.createLocal(initial);let app;
try{await engine.ready;status.textContent='Données enregistrées sur cet appareil';}catch(e){
 if(e.storedState){const box=document.getElementById('migration'),reset=document.getElementById('reset-model');box.hidden=false;box.querySelector('p').textContent='Le modèle ou les données ne sont plus compatibles. Exportez les anciennes données. Aucune migration ni suppression automatique n’a été effectuée.';reset.disabled=true;reset.hidden=e.code!=='SCHEMA_MISMATCH';document.getElementById('old-backup').onclick=()=>{download(e.storedState,'sauvegarde-avant-migration.json');reset.disabled=false;};reset.onclick=async()=>{if(confirm('Les anciennes données ont-elles été sauvegardées ? Cette réinitialisation explicite les remplacera par les données initiales.')){try{await engine.resetAfterBackup({confirmed:true});location.reload();}catch(error){box.querySelector('p').textContent=error.message;}}};return;}
 status.textContent='Stockage local indisponible';message('Les données initiales peuvent être consultées, mais les modifications sont bloquées. '+e.message);
}
app=new GEAPRuntime(document.getElementById('app'),engine.project(),{engine,onChange:()=>{status.textContent='Données enregistrées sur cet appareil';},onExternal:()=>message('Les données ont changé dans un autre onglet. Rechargez la page avant de poursuivre.')});
document.getElementById('backup').onclick=async()=>{try{download(await engine.exportData(),C.slug(initial.name)+'-donnees.json');}catch(e){message(e.message);}};
document.getElementById('restore').onclick=()=>document.getElementById('restore-file').click();
document.addEventListener('click',e=>{const target=e.target.closest?.('[data-app-do="data-backup"],[data-app-do="data-restore"]');if(!target)return;e.preventDefault();e.stopPropagation();if(target.dataset.appDo==='data-restore')document.getElementById('restore-file').click();else document.getElementById('backup').click();},true);
document.getElementById('restore-file').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>100*1024*1024)throw new Error('Fichier trop volumineux (100 Mo maximum).');const state=JSON.parse(await file.text());D.fromSnapshot(initial,state);if(!confirm('Remplacer les données de cet appareil par cette sauvegarde ?'))return;await app._execute(()=>engine.importData(state));app.render();message('Sauvegarde restaurée.');}catch(err){message(err.message);}finally{e.target.value='';}};
if('serviceWorker'in navigator&&['https:','http:'].includes(location.protocol)){
 try{
  let reloading=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!reloading){reloading=true;location.reload();}});
  const reg=await navigator.serviceWorker.register('./service-worker.js',{updateViaCache:'none'});
  // Mise à jour silencieuse : le nouveau cache s'active dès qu'il est entièrement prêt.
  // IndexedDB n'est ni supprimée ni réinitialisée.
  reg.update().catch(()=>{});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)reg.update().catch(()=>{});});
  addEventListener('online',()=>reg.update().catch(()=>{}));
  await navigator.serviceWorker.ready;
  document.getElementById('offline-status').textContent='Disponible hors ligne';
 }catch(e){document.getElementById('offline-status').textContent='Cache indisponible';message('Le mode hors ligne n’a pas pu être activé : '+e.message);}
}else{document.getElementById('offline-status').textContent='Publication HTTPS requise';if(location.protocol==='file:')message('Pour installer l’application et utiliser le mode hors ligne, publiez son dossier sur un hébergement HTTPS.');}
})();

