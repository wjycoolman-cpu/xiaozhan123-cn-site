(() => {
  const $ = s => document.querySelector(s);
  const narrow = matchMedia('(max-width: 800px)');
  const sidebar = $('#sidebar'), open = $('#sidebar-open'), close = $('#sidebar-close'), backdrop = $('#sidebar-backdrop');
  function setSidebar(visible, restoreFocus = true) {
    document.body.classList.toggle('sidebar-visible', visible);
    document.body.classList.toggle('sidebar-collapsed', !visible && !narrow.matches);
    open.setAttribute('aria-expanded',String(visible));
    backdrop.hidden = !visible || !narrow.matches;
    sidebar.inert = !visible;
    if (visible && narrow.matches) close.focus();
    if (!visible && restoreFocus) open.focus({preventScroll:true});
  }
  open.addEventListener('click',()=>setSidebar(true));
  close.addEventListener('click',()=>setSidebar(false));
  backdrop.addEventListener('click',()=>setSidebar(false));
  narrow.addEventListener('change',()=>setSidebar(!narrow.matches,false));
  setSidebar(!narrow.matches,false);
  document.addEventListener('keydown',e=>{
    if (e.key==='Escape'&&narrow.matches&&document.body.classList.contains('sidebar-visible')&&!document.querySelector('dialog[open]')) setSidebar(false);
    if ((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&!document.querySelector('dialog[open]')) { e.preventDefault(); if(narrow.matches)setSidebar(false,false); $('#search').focus(); $('#search-panel').scrollIntoView({block:'center'}); }
    if (e.key==='Tab' && narrow.matches && document.body.classList.contains('sidebar-visible')&&!document.querySelector('dialog[open]')) {
      const focusable=[...sidebar.querySelectorAll('a[href],button:not([disabled])')];
      if (e.shiftKey&&document.activeElement===focusable[0]) {e.preventDefault();focusable.at(-1).focus();}
      else if (!e.shiftKey&&document.activeElement===focusable.at(-1)){e.preventDefault();focusable[0].focus();}
    }
  });
  sidebar.addEventListener('click',e=>{
    if (narrow.matches&&e.target.closest('a,.side-nav-item,.sidebar-product,#search-toggle')) {
      setSidebar(false,false);
      if(e.target.closest('#search-toggle'))$('#search').focus({preventScroll:true});
      else if(e.target.closest('.side-nav-item[data-filter]'))$('#catalog').focus({preventScroll:true});
    }
  });
  $('#workspace-search').addEventListener('submit',e=>{e.preventDefault();$('#catalog').scrollIntoView({block:'start',behavior:document.documentElement.dataset.reducedMotion==='true'?'auto':'smooth'});$('#catalog').focus({preventScroll:true});});
  document.querySelector('[data-quick-filter]').addEventListener('click',()=>{$('.filter-tabs [data-filter="game"]').click();$('#catalog').scrollIntoView({block:'start',behavior:document.documentElement.dataset.reducedMotion==='true'?'auto':'smooth'});});
  const renderSidebar = catalog => {
    const fragment=document.createDocumentFragment();
    for (const p of catalog.products) {
      const button=document.createElement('button'); button.type='button';button.className='sidebar-product';button.dataset.detail=p.id;button.textContent=p.name;fragment.append(button);
    }
    $('#sidebar-products').replaceChildren(fragment);
  };
  window.addEventListener('catalog:ready',e=>renderSidebar(e.detail));
  if (window.XiaoZhanCatalog) renderSidebar(window.XiaoZhanCatalog);
})();
