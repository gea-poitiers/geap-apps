/* Cuisine GEA · Couche de présentation dédiée.
   Le moteur GEAP (données, préférences, relations, formulaires, workflows) reste inchangé. */
(function(){
  'use strict';
  if(!window.GEAPRuntime)return;
  const Base=window.GEAPRuntime;
  const render=Base.prototype.render;
  const escapeText=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const recipeScreen='recettes_list';
  function nav(screen,label,icon,sub,cls=''){
    return `<button class="cuisine-shortcut ${cls}" type="button" data-app-do="menu" data-screen="${screen}">
      <span class="cuisine-shortcut-icon" aria-hidden="true">${icon}</span>
      <span class="cuisine-shortcut-text"><strong>${label}</strong><small>${sub}</small></span>
      <span class="cuisine-shortcut-arrow" aria-hidden="true">↗</span></button>`;
  }
  function home(root){
    const hero=root.querySelector('.app-hero');
    if(!hero)return;
    hero.classList.add('cuisine-home-hero');
    hero.innerHTML=`<div class="cuisine-hero-inner">
       <div class="cuisine-overline"><span class="cuisine-spark">✦</span> VOTRE CARNET DE CUISINE</div>
       <h2>Le plaisir de cuisiner,<br><em>à votre façon.</em></h2>
       <p>Une envie, un ingrédient, une idée : retrouvez vos recettes préférées et gardez la trace de vos découvertes.</p>
       <button class="cuisine-primary-cta" type="button" data-app-do="menu" data-screen="${recipeScreen}">Explorer les recettes <span aria-hidden="true">↗</span></button>
       </div><div class="cuisine-hero-corner" aria-hidden="true">RECETTES • ENVIES • SOUVENIRS</div>`;
    const grid=root.querySelector('.app-component-grid');
    if(!grid)return;
    grid.classList.add('cuisine-home-content');
    grid.innerHTML=`<section class="cuisine-welcome" aria-label="Parcourir le carnet">
         <div class="cuisine-section-heading"><div><span class="cuisine-eyebrow">À VOUS DE CHOISIR</span><h3>Qu'est-ce qu'on cuisine ?</h3></div><span class="cuisine-handdrawn">✳</span></div>
         <div class="cuisine-shortcuts">
         ${nav('recettes_list','Toutes les recettes','🍽️','Votre carnet gourmand','accent')}
         ${nav('categories_list','Par catégories','◒','Selon vos envies')}
         ${nav('ingredients_list','Par ingrédients','✳','Avec ce que vous avez')}
         </div></section>
         <section class="cuisine-editorial" aria-label="Un carnet personnel">
         <div class="cuisine-editorial-picture" role="img" aria-label="Ingrédients frais et pâte à cuisiner"></div>
         <div class="cuisine-editorial-copy"><span class="cuisine-eyebrow">VOTRE CUISINE, VOTRE HISTOIRE</span><h3>Gardez vos idées <em>bien au chaud.</em></h3>
         <p>Notez vos recettes, retrouvez leurs ingrédients et ajoutez une photo lorsqu'elles passent de l'idée à l'assiette.</p>
         <button class="cuisine-outline-cta" type="button" data-app-do="menu" data-screen="recette_form">+ Ajouter une recette <span aria-hidden="true">↗</span></button></div>
         </section><p class="cuisine-footnote">Cuisine GEA <span aria-hidden="true">✦</span> Un carnet simple, à enrichir au fil des repas.</p>`;
  }
  function listings(root,s,app){
    const content=root.querySelector('.app-content'); if(!content)return;
    const kicker=content.querySelector(':scope > .app-kicker');
    const ribbon=document.createElement('div');ribbon.className='cuisine-list-banner';
    ribbon.innerHTML='<span>CUISINE GEA <b>✦</b> LES IDÉES À PARTAGER</span>';
    const preferences=content.querySelector(':scope > .app-preferences');
    if(preferences)preferences.after(ribbon);else content.prepend(ribbon);
    const descr=content.querySelector(':scope > .app-sub');
    const titles={recettes_list:'Toutes vos inspirations',categories_list:'Une envie particulière ?',ingredients_list:'Partir d’un ingrédient',chefs_list:'Nos bonnes adresses'};
    const desc={recettes_list:'Feuilletez votre carnet et retrouvez vos favoris.',categories_list:'Des idées pour chaque occasion.',ingredients_list:'Que préparer avec ce que vous avez ?',chefs_list:'Des chefs et des sources d’inspiration.'};
    if(kicker)kicker.textContent='LE CARNET GOURMAND  /  '+(s.tableId==='recettes'?'RECETTES':s.name.toLocaleUpperCase('fr'));
    const h2=content.querySelector(':scope > h2');if(h2&&titles[s.id])h2.textContent=titles[s.id];
    if(descr){let count=descr.textContent.match(/\d+/)?.[0];descr.textContent=(count?count+' éléments · ':'')+desc[s.id];}
    const cards=content.querySelectorAll('.app-cards .app-row');
    const t=app.p.tables.find(t=>t.id===s.tableId);
    const rows=t?app.engine.screenRecords(s,app.state,app.state.extraFilters||[]):[];
    cards.forEach((card)=>{
      let name=(card.querySelector('strong')?.textContent||'').trim();
      card.setAttribute('aria-label',name?`Ouvrir ${name}`:'Ouvrir la fiche');
      if(s.tableId==='recettes'){
        const row=rows.find(r=>String(r.recette_nom||'').trim()===name);
        if(row){
          let flags=document.createElement('span');flags.className='cuisine-card-flags';
          const duration=Number(row.recette_preparation||0)+Number(row.recette_cuisson||0);
          if(duration>0){const el=document.createElement('span');el.textContent='◷ '+duration+' min';flags.append(el);}
          if(row.recette_faite===true){const el=document.createElement('span');el.className='is-done';el.textContent='✓ Réalisée';flags.append(el);}
          if(flags.childElementCount)card.append(flags);
          const sub=card.querySelector('.app-row-content small');
          if(sub&&row.recette_categorie)sub.textContent=String(row.recette_categorie);
        }
      }
    });
  }
  function detail(root,s,app){
    const content=root.querySelector('.app-content');if(!content)return;
    const r=app.row();
    const kicker=content.querySelector(':scope > .app-kicker');
    if(kicker)kicker.textContent=s.tableId==='recettes'?'À PRÉPARER AVEC PLAISIR':'LE CARNET GOURMAND';
    const h2=content.querySelector(':scope > h2');if(h2)h2.classList.add('cuisine-recipe-title');
    const detail=content.querySelector(':scope > .app-detail');
    const grid=content.querySelector(':scope > .app-component-grid');
    if(s.tableId==='recettes'&&detail){
      const imageGridItem=[...(grid?.children||[])].find(el=>el.querySelector('img.app-image'));
      if(imageGridItem){
        const photo=document.createElement('div');photo.className='cuisine-detail-photo';photo.append(imageGridItem);
        detail.before(photo);
      }
      if(r){
        const bar=document.createElement('div');bar.className='cuisine-detail-meta';
        const total=Number(r.recette_preparation||0)+Number(r.recette_cuisson||0);
        const cat=r.recette_categorie?`<span>✧ ${escapeText(r.recette_categorie)}</span>`:'';
        bar.innerHTML=cat+(total?`<span>◷ ${total} min au total</span>`:'')+(r.recette_faite?'<span>✓ Déjà cuisinée</span>':'');
        detail.before(bar);
      }
      grid?.classList.add('cuisine-recipe-components');
    }else if(grid){grid.classList.add('cuisine-secondary-detail');}
  }
  function form(root,s){
    const content=root.querySelector('.app-content'); if(!content)return;
    content.classList.add('cuisine-form-content');
    const kicker=content.querySelector(':scope > .app-kicker');if(kicker)kicker.textContent='CUISINE GEA / LE CARNET';
  }
  Base.prototype.render=function(){
    render.apply(this,arguments);
    const screen=this.current();if(!screen)return;
    const root=this.root;
    root.dataset.cuisineScreen=screen.id;
    root.dataset.cuisineType=screen.type;
    root.style.setProperty('--brand','#284b3d');
    root.style.setProperty('--on-brand','#ffffff');
    root.style.setProperty('--app-bg','#fbf8f3');
    root.style.setProperty('--app-surface','#fffefd');
    root.style.setProperty('--ink','#273b31');
    root.style.setProperty('--muted','#7b8177');
    root.style.setProperty('--line','#e9e5dd');
    const mark=root.querySelector('.app-mark');if(mark){mark.textContent='';mark.title='Cuisine GEA';}
    const head=root.querySelector('.app-head h1');if(head&&screen.id==='cuisine_home')head.textContent='Cuisine GEA';
    if(screen.id==='cuisine_home')home(root);
    else if(['recettes_list','categories_list','ingredients_list','chefs_list'].includes(screen.id))listings(root,screen,this);
    else if(screen.type==='detail')detail(root,screen,this);
    else if(screen.type==='form')form(root,screen);
  };
})();
