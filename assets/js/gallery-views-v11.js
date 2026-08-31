(() => {
  if (window.__JETVAULT_GALLERY_VIEWS_V11__) return;
  window.__JETVAULT_GALLERY_VIEWS_V11__ = true;

  const backend = window.ScottishAeroBackend;
  if (!backend) return;
  let db = null;
  let syncTimer = null;
  let lightboxTimer = null;
  const cache = new Map();

  const fmt = n => Number(n || 0).toLocaleString('en-GB');

  async function client(){
    if (db) return db;
    db = await backend.ensureClient();
    return db;
  }

  async function fetchCounts(ids){
    const clean=[...new Set((ids||[]).filter(Boolean))];
    if(!clean.length) return new Map();
    const c=await client();
    if(!c) return new Map();
    const {data,error}=await c.rpc('get_photo_view_counts',{p_photo_ids:clean});
    if(error){console.warn('Jetvault view counts unavailable',error.message);return new Map();}
    const result=new Map(clean.map(id=>[id,{views:0,organic_views:0,promotional_views:0}]));
    (data||[]).forEach(row=>result.set(String(row.photo_id),{
      views:Number(row.views||0),
      organic_views:Number(row.organic_views||0),
      promotional_views:Number(row.promotional_views||0)
    }));
    result.forEach((v,k)=>cache.set(k,v));
    return result;
  }

  function cleanArchiveLabels(root=document){
    root.querySelectorAll?.('.archive-stamp').forEach(node=>{
      node.textContent=(node.textContent||'').replace(/^SA\s*\/\s*/i,'JV / ');
    });
    root.querySelectorAll?.('.lightbox__info .eyebrow').forEach(node=>{
      node.textContent=(node.textContent||'').replace(/^SA\s*\/\s*/i,'JV / ');
    });
    root.querySelectorAll?.('.lightbox-origin').forEach(node=>{
      node.textContent=(node.textContent||'').replace(/SCOTTISH\.AERO/gi,'JETVAULT');
    });
  }

  function bindImageFallbacks(){
    document.querySelectorAll('.gallery-grid .photo-card img').forEach(img=>{
      if(img.dataset.jvV11Bound) return;
      img.dataset.jvV11Bound='1';
      img.addEventListener('error',()=>{
        const card=img.closest('.photo-card');
        if(card) card.dataset.imageError='1';
      },{once:true});
      if(img.complete && !img.naturalWidth){
        const card=img.closest('.photo-card');
        if(card) card.dataset.imageError='1';
      }
    });
  }

  async function syncCards(){
    clearTimeout(syncTimer);
    syncTimer=setTimeout(async()=>{
      const nodes=[...document.querySelectorAll('[data-card-social]')];
      const ids=nodes.map(n=>n.dataset.cardSocial).filter(Boolean);
      if(!ids.length) return;
      const counts=await fetchCounts(ids);
      nodes.forEach(node=>{
        const id=node.dataset.cardSocial;
        const info=counts.get(id)||cache.get(id)||{views:0};
        let pill=node.querySelector('[data-jv-view-count]');
        if(!pill){
          pill=document.createElement('span');
          pill.className='photo-card__view-count';
          pill.dataset.jvViewCount='';
          pill.innerHTML='<i>◉</i><b>0</b>';
          node.append(pill);
        }
        const b=pill.querySelector('b'); const wanted=fmt(info.views); if(b && b.textContent!==wanted) b.textContent=wanted;
      });
      bindImageFallbacks();
      cleanArchiveLabels();
    },90);
  }

  async function syncLightbox(){
    clearTimeout(lightboxTimer);
    lightboxTimer=setTimeout(async()=>{
      const dialog=document.querySelector('[data-lightbox]');
      if(!dialog?.open) return;
      const id=new URLSearchParams(location.search).get('photo');
      if(!id) return;
      const counts=await fetchCounts([id]);
      const info=counts.get(id)||{views:0};
      const social=document.querySelector('[data-photo-social] .social-bar');
      const share=document.querySelector('.lightbox-share');
      const host=social||share;
      if(!host) return;
      let pill=document.querySelector('[data-jv-lightbox-views]');
      if(!pill){
        pill=document.createElement('span');
        pill.className='jv-lightbox-view';
        pill.dataset.jvLightboxViews='';
        pill.innerHTML='<span>◉</span><b>0</b><span>views</span>';
        if(social) social.append(pill); else share.append(pill);
      }
      const b=pill.querySelector('b'); const wanted=fmt(info.views); if(b && b.textContent!==wanted) b.textContent=wanted;
      cleanArchiveLabels(dialog);
    },650); // allow the just-opened view to be recorded first
  }

  const observer=new MutationObserver(()=>{
    cleanArchiveLabels();
    bindImageFallbacks();
    syncCards();
    syncLightbox();
  });

  function boot(){
    cleanArchiveLabels();
    bindImageFallbacks();
    syncCards();
    observer.observe(document.body,{childList:true,subtree:true});
    document.querySelector('[data-lightbox]')?.addEventListener('close',()=>syncCards());
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
