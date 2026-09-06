(() => {
  const J=window.JetVault, UI=window.JVUI;
  const grid=document.querySelector('[data-gallery-grid]'); if(!J||!grid) return;
  const search=document.querySelector('[data-gallery-search]'), airport=document.querySelector('[data-airport-filter]'),
        airline=document.querySelector('[data-airline-filter]'), count=document.querySelector('[data-gallery-count]'),
        sentinel=document.querySelector('[data-gallery-sentinel]'), dialog=document.querySelector('[data-photo-dialog]');
  let page=0,total=0,loading=false,done=false,token=0,timer=null,observer=null;

  function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
  function opts(){return {page,pageSize:24,search:search?.value||'',airport:airport?.value||'',airline:airline?.value||''}}
  function reset(){page=0;total=0;done=false;grid.innerHTML='';token++;load()}
  async function load(){
    if(loading||done)return; loading=true; const my=token;
    try{
      const r=await J.listPhotos(opts()); if(my!==token)return;
      total=r.count; if(!r.items.length)done=true;
      grid.insertAdjacentHTML('beforeend',r.items.map(UI.photoCard).join(''));
      page++; if(grid.children.length>=total)done=true;
      if(count)count.textContent=`${total.toLocaleString()} photographs`;
      if(!grid.children.length)grid.innerHTML='<div class="empty">No photographs matched those filters.</div>';
    }catch(e){if(!grid.children.length)grid.innerHTML=`<div class="empty">Gallery unavailable: ${esc(e.message)}</div>`}
    finally{loading=false}
  }

  async function filterSetup(){
    try{
      const f=await J.filterData();
      const fill=(sel,vals,label)=>{if(!sel)return;sel.innerHTML=`<option value="">${label}</option>`+vals.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('')};
      fill(airport,f.airports,'All airports');fill(airline,f.airlines,'All airlines');
    }catch(_){}
  }

  async function renderComments(id){
    const node=dialog.querySelector('[data-comments]');
    try{
      const rows=await J.getComments(id);
      node.innerHTML=rows.length?rows.map(c=>`<div class="comment"><b>${esc(c.author_name||'Member')}</b><span>${esc(c.body)}</span><small>${new Date(c.created_at).toLocaleString()}</small></div>`).join(''):'<div class="status">No comments yet.</div>';
    }catch(_){node.innerHTML='<div class="status">Comments unavailable.</div>'}
  }

  async function open(id){
    const p=await J.getPhoto(id); if(!p)return;
    dialog.innerHTML=`<button class="lightbox-close" data-close type="button">×</button><div class="lightbox">
      <div class="lightbox-media"><img src="${esc(p.fullUrl)}" alt="${esc(p.alt)}"></div>
      <div class="lightbox-info"><span class="eyebrow">JetVault Archive</span><h2>${esc(p.reg)}</h2><p>${esc(p.caption||'Aviation photograph from the JetVault archive.')}</p>
      <div class="detail-list"><div class="detail-row"><span>Aircraft</span><b>${esc(p.aircraft)}</b></div><div class="detail-row"><span>Operator</span><b>${esc(p.airline)}</b></div><div class="detail-row"><span>Airport</span><b>${esc(p.airport)}</b></div><div class="detail-row"><span>Date</span><b>${esc(p.date)}</b></div><div class="detail-row"><span>Photographer</span><b>${esc(p.photographerName)}</b></div></div>
      <div class="social-row"><button class="mini-button" data-like type="button">♡ <span>Like</span></button><button class="mini-button" data-share type="button">Share</button></div>
      <form data-comment-form><textarea name="body" maxlength="800" placeholder="Add a comment"></textarea><button class="solid-button" type="submit">Comment</button></form>
      <div class="comment-list" data-comments></div></div></div>`;
    dialog.showModal(); document.body.style.overflow='hidden'; history.replaceState(null,'',`gallery.html?photo=${encodeURIComponent(id)}`); J.trackPhotoView(id);
    const counts=await J.getSocialCounts([id]).catch(()=>({}));
    const state=counts[id]||{likes:0,liked:false}; const lb=dialog.querySelector('[data-like]');
    lb.innerHTML=`${state.liked?'♥':'♡'} <span>${state.likes} like${state.likes===1?'':'s'}</span>`;
    lb.onclick=async()=>{try{const s=await J.toggleLike(id);lb.innerHTML=`${s.liked?'♥':'♡'} <span>${s.likes} like${s.likes===1?'':'s'}</span>`}catch(e){UI.toast(e.message)}};
    dialog.querySelector('[data-share]').onclick=async()=>{const url=location.href;try{if(navigator.share)await navigator.share({title:`${p.reg} — JetVault`,url});else{await navigator.clipboard.writeText(url);UI.toast('Link copied')}}catch(_){}};
    dialog.querySelector('[data-close]').onclick=()=>dialog.close();
    dialog.querySelector('[data-comment-form]').onsubmit=async e=>{e.preventDefault();const body=new FormData(e.currentTarget).get('body');try{await J.addComment(id,body);e.currentTarget.reset();renderComments(id)}catch(err){UI.toast(err.message)}};
    renderComments(id);
  }

  grid.addEventListener('click',e=>{const b=e.target.closest('[data-open-photo]');if(b)open(b.dataset.openPhoto)});
  dialog.addEventListener('close',()=>{document.body.style.overflow='';history.replaceState(null,'','gallery.html')});
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
  [airport,airline].forEach(x=>x?.addEventListener('change',reset));
  search?.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(reset,180)});
  observer=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting))load()},{rootMargin:'800px'});
  if(sentinel)observer.observe(sentinel);
  filterSetup(); load();
  const photo=new URLSearchParams(location.search).get('photo'); if(photo)setTimeout(()=>open(photo),150);
})();
