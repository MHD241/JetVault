(() => {
  if (window.__JETVAULT_BACKEND_V12__) return;
  window.__JETVAULT_BACKEND_V12__ = true;

  const cfg = window.JETVAULT_CONFIG || window.SCOTTISH_AERO_CONFIG || {};
  const META_PROFILE = '__SA_PROFILE__';
  const META_POST = '__SA_POST__';
  let client = null;

  const escSearch = v => String(v || '').replace(/[(),]/g,' ').replace(/\s+/g,' ').trim();
  const slugify = v => String(v || '').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const formatDate = v => {
    if (!v) return 'Unknown';
    try { return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(String(v).includes('T') ? v : `${v}T12:00:00`)); }
    catch(_) { return 'Unknown'; }
  };

  async function ensureLibrary(){
    if (window.supabase?.createClient) return;
    await new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      s.onload=resolve;s.onerror=reject;document.head.append(s);
    });
  }

  async function ensureClient(){
    if (client) return client;
    await ensureLibrary();
    client = window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    });
    return client;
  }

  function mapPhoto(r){
    const fullUrl = r.image_url || '';
    const thumbUrl = String(r.thumbnail_url || '').trim() || fullUrl;
    return {
      id:r.id,ownerId:r.owner_id,photographerName:r.photographer_name || 'Unknown',
      photographer:slugify(r.photographer_name),fullUrl,thumbUrl,src:thumbUrl,
      reg:r.registration || 'Unknown',aircraft:r.aircraft_type || 'Unknown',
      airline:r.airline || 'Unknown',airport:r.airport || 'Unknown',
      takenAt:r.taken_at || null,date:formatDate(r.taken_at),caption:r.caption || '',
      alt:r.alt_text || `${r.airline || 'Aircraft'} ${r.aircraft_type || ''}`.trim(),
      ratio:r.ratio || 'standard',featured:Boolean(r.featured),createdAt:r.created_at || null,status:r.status || 'approved'
    };
  }

  async function currentUser(){
    const db=await ensureClient(); const {data}=await db.auth.getSession();
    return data?.session?.user || null;
  }

  async function currentProfile(){
    const db=await ensureClient(); const user=await currentUser(); if(!user) return null;
    const {data,error}=await db.from('profiles').select('*').eq('id',user.id).maybeSingle();
    if(error) throw error; return data || null;
  }

  async function getProfile(key){
    const db=await ensureClient(); const wanted=String(key||'').trim();
    if(!wanted) return null;
    let q=await db.from('profiles').select('*').eq('username',wanted.toLowerCase()).maybeSingle();
    if(q.data) return q.data;
    const {data}=await db.from('profiles').select('*').limit(150);
    return (data||[]).find(p=>slugify(p.display_name)===wanted.toLowerCase()) || null;
  }

  async function listProfiles(){
    const db=await ensureClient();
    const {data,error}=await db.from('profiles').select('id,display_name,username,bio,avatar_url,location,favourite_airport,favourite_aircraft,is_manager,is_crew,created_at').order('is_crew',{ascending:false}).order('created_at',{ascending:true});
    if(error) throw error; return data || [];
  }

  async function listPhotos(opts={}){
    const db=await ensureClient();
    const page=Math.max(0,Number(opts.page||0)), pageSize=Math.max(1,Math.min(60,Number(opts.pageSize||24)));
    let q=db.from('photos').select('id,owner_id,photographer_name,image_url,thumbnail_url,registration,aircraft_type,airline,airport,taken_at,caption,alt_text,ratio,featured,created_at,status',{count:'exact'})
      .eq('status',opts.status || 'approved')
      .not('registration','in',`("${META_PROFILE}","${META_POST}")`);
    if(opts.featured===true) q=q.eq('featured',true);
    if(opts.ownerId) q=q.eq('owner_id',opts.ownerId);
    if(opts.airport) q=q.eq('airport',opts.airport);
    if(opts.airline) q=q.eq('airline',opts.airline);
    const s=escSearch(opts.search);
    if(s) q=q.or(`registration.ilike.%${s}%,aircraft_type.ilike.%${s}%,airline.ilike.%${s}%,airport.ilike.%${s}%,photographer_name.ilike.%${s}%`);
    q=q.order('featured',{ascending:false}).order('created_at',{ascending:false}).range(page*pageSize,page*pageSize+pageSize-1);
    const {data,error,count}=await q;
    if(error) throw error;
    return {items:(data||[]).map(mapPhoto),count:Number(count||0),page,pageSize};
  }

  async function getPhoto(id){
    const db=await ensureClient();
    const {data,error}=await db.from('photos').select('id,owner_id,photographer_name,image_url,thumbnail_url,registration,aircraft_type,airline,airport,taken_at,caption,alt_text,ratio,featured,created_at,status').eq('id',id).maybeSingle();
    if(error) throw error; return data ? mapPhoto(data) : null;
  }

  async function filterData(){
    const db=await ensureClient();
    const {data,error}=await db.from('photos').select('airport,airline').eq('status','approved').not('registration','in',`("${META_PROFILE}","${META_POST}")`).limit(1000);
    if(error) throw error;
    return {
      airports:[...new Set((data||[]).map(x=>x.airport).filter(Boolean))].sort(),
      airlines:[...new Set((data||[]).map(x=>x.airline).filter(Boolean))].sort()
    };
  }

  async function getSocialCounts(ids){
    ids=[...new Set((ids||[]).filter(Boolean))];
    if(!ids.length) return {};
    const db=await ensureClient();
    const [likes,comments,user]=await Promise.all([
      db.from('content_likes').select('content_id').in('content_id',ids),
      db.from('comments').select('content_id').in('content_id',ids),
      currentUser()
    ]);
    let mine={data:[]};
    if(user) mine=await db.from('content_likes').select('content_id').eq('user_id',user.id).in('content_id',ids);
    const out={}; ids.forEach(id=>out[id]={likes:0,comments:0,liked:false});
    (likes.data||[]).forEach(x=>{if(out[x.content_id])out[x.content_id].likes++});
    (comments.data||[]).forEach(x=>{if(out[x.content_id])out[x.content_id].comments++});
    (mine.data||[]).forEach(x=>{if(out[x.content_id])out[x.content_id].liked=true});
    return out;
  }

  async function toggleLike(photoId){
    const db=await ensureClient(), user=await currentUser();
    if(!user) throw new Error('Sign in to like photographs.');
    const {data:existing}=await db.from('content_likes').select('content_id').eq('content_id',photoId).eq('user_id',user.id).maybeSingle();
    if(existing) {
      const {error}=await db.from('content_likes').delete().eq('content_id',photoId).eq('user_id',user.id);
      if(error) throw error;
    } else {
      const {error}=await db.from('content_likes').insert({content_id:photoId,user_id:user.id});
      if(error) throw error;
    }
    return (await getSocialCounts([photoId]))[photoId];
  }

  async function getComments(photoId){
    const db=await ensureClient();
    const {data,error}=await db.from('comments').select('id,user_id,author_name,body,created_at,parent_id').eq('content_id',photoId).order('created_at',{ascending:true}).limit(100);
    if(error) throw error; return data || [];
  }

  async function addComment(photoId,body){
    const db=await ensureClient(), user=await currentUser(), profile=await currentProfile();
    if(!user) throw new Error('Sign in to comment.');
    const text=String(body||'').trim(); if(!text) throw new Error('Write a comment first.');
    const {error}=await db.from('comments').insert({content_id:photoId,user_id:user.id,author_name:profile?.display_name||user.email||'Member',body:text.slice(0,800)});
    if(error) throw error;
  }

  async function trackPhotoView(photoId){
    try{
      const db=await ensureClient();
      await db.from('photo_views').insert({photo_id:photoId,source:'organic'});
    }catch(_){}
  }

  async function stats(){
    const db=await ensureClient();
    const [p,u,c]=await Promise.all([
      db.from('photos').select('id',{count:'exact',head:true}).eq('status','approved').not('registration','in',`("${META_PROFILE}","${META_POST}")`),
      db.from('profiles').select('id',{count:'exact',head:true}),
      db.from('profiles').select('id',{count:'exact',head:true}).eq('is_crew',true)
    ]);
    return {photos:Number(p.count||0),members:Number(u.count||0),crew:Number(c.count||0)};
  }

  async function decodeImage(blob){
    if('createImageBitmap' in window){
      try{
        const bmp=await createImageBitmap(blob);
        return {width:bmp.width,height:bmp.height,draw:(ctx,w,h)=>ctx.drawImage(bmp,0,0,w,h),close:()=>bmp.close?.()};
      }catch(_){}
    }
    return await new Promise((resolve,reject)=>{
      const url=URL.createObjectURL(blob), img=new Image();
      img.onload=()=>resolve({width:img.naturalWidth,height:img.naturalHeight,draw:(ctx,w,h)=>ctx.drawImage(img,0,0,w,h),close:()=>URL.revokeObjectURL(url)});
      img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Could not decode this image.'))};
      img.src=url;
    });
  }

  async function renderWebp(source,maxSide,quality){
    const scale=Math.min(1,maxSide/Math.max(source.width,source.height));
    const w=Math.max(1,Math.round(source.width*scale)), h=Math.max(1,Math.round(source.height*scale));
    const canvas=document.createElement('canvas'); canvas.width=w; canvas.height=h;
    const ctx=canvas.getContext('2d',{alpha:false}); ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    source.draw(ctx,w,h);
    const blob=await new Promise(r=>canvas.toBlob(r,'image/webp',quality));
    if(!blob || blob.type!=='image/webp') throw new Error('Your browser could not create WebP.');
    return {blob,width:w,height:h};
  }

  async function makeThumbnailBlob(blob,maxSide=960){
    const src=await decodeImage(blob);
    try{return (await renderWebp(src,maxSide,.72)).blob} finally{src.close?.()}
  }

  async function uploadPhotoPair(file,userId,prefix='photo'){
    if(!file?.type?.startsWith('image/')) throw new Error('Choose a photograph first.');
    if(file.size>25*1024*1024) throw new Error('Please keep uploads under 25 MB.');
    const db=await ensureClient(), src=await decodeImage(file);
    let full,thumb;
    try{
      full=await renderWebp(src,2560,.84);
      thumb=await renderWebp(src,960,.72);
    } finally { src.close?.(); }
    const id=crypto.randomUUID(), base=`${userId}/${prefix}-${id}`;
    const up=async(path,blob)=>{
      const {error}=await db.storage.from('photos').upload(path,blob,{contentType:'image/webp',cacheControl:'31536000',upsert:false});
      if(error) throw error;
      return db.storage.from('photos').getPublicUrl(path).data.publicUrl;
    };
    const [imageUrl,thumbnailUrl]=await Promise.all([
      up(`${base}-full.webp`,full.blob),up(`${base}-thumb.webp`,thumb.blob)
    ]);
    const ratioValue=full.width/full.height;
    return {imageUrl,thumbnailUrl,ratio:ratioValue>1.55?'wide':ratioValue<.9?'tall':'standard'};
  }

  async function signOut(){ const db=await ensureClient(); await db.auth.signOut(); }

  const api={configured:Boolean(cfg.supabaseUrl&&cfg.supabaseAnonKey),ensureClient,currentUser,currentProfile,getProfile,listProfiles,listPhotos,getPhoto,filterData,getSocialCounts,toggleLike,getComments,addComment,trackPhotoView,stats,uploadPhotoPair,makeThumbnailBlob,mapPhoto,formatDate,slugify,signOut,META_PROFILE,META_POST};
  window.JetVault=api;
  window.ScottishAeroBackend=api;
})();
