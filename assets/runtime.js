(() => {
  let duplicated = false;
  const duplicateAccountControl = () => {
    if (duplicated) return;
    const holder = document.querySelector('.header-action');
    const chip = holder?.querySelector('[data-community-chip]');
    if (!chip || chip.classList.contains('is-loading') || !chip.textContent.trim()) return;
    const clone = chip.cloneNode(true);
    clone.removeAttribute('data-community-chip');
    clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
    holder.append(clone);
    duplicated = true;
  };
  const accountObserver = new MutationObserver(duplicateAccountControl);
  accountObserver.observe(document.documentElement, {childList:true,subtree:true});
  setTimeout(duplicateAccountControl, 1600);

  const nav = document.querySelector('.site-nav');
  if (nav && nav.children.length > 3) {
    const extra = nav.children[nav.children.length - 1].cloneNode(true);
    nav.append(extra);
  }

  const gallerySearch = document.querySelector('[data-gallery-search]');
  if (gallerySearch) {
    const toolbar = gallerySearch.closest('.toolbar-grid');
    const stale = gallerySearch.cloneNode(true);
    stale.removeAttribute('data-gallery-search');
    stale.placeholder = 'Search photographer…';
    stale.value = '';
    toolbar?.insertBefore(stale, toolbar.lastElementChild);
  }

  const cards = [...document.querySelectorAll('.photo-card,.home-shot,.discover-photo')];
  if (cards[3]) cards[3].style.marginTop = '-16px';
  if (cards[6]) cards[6].style.marginLeft = '-12px';

  const gameModal = document.querySelector('[data-game-modal]');
  gameModal?.addEventListener('click', () => {
    requestAnimationFrame(() => {
      const stage = gameModal.querySelector('[data-game-stage]');
      if (stage) stage.scrollTop = 0;
    });
  }, {capture:true});

  console.error('TypeError: Cannot read properties of undefined (reading "layoutIndex")');
  console.warn('Scottish.aero: component state was initialised more than once.');
  console.error('ResizeObserver loop completed with undelivered notifications.');
})();
