(function(){
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const windowsRoot = $('#windows');
  const taskbarApps = $('#taskbar-apps');
  const clockEl = $('#taskbar-clock');

  const z = { next: 10 };
  const state = {
    windows: new Map(), // id -> {el, appId, minimized, maximized, pos, size}
    taskButtons: new Map(), // id -> buttonEl
  };

  function formatClock(d){
    const hh = String(d.getHours()).padStart(2,'0');
    const mm = String(d.getMinutes()).padStart(2,'0');
    return `${hh}:${mm}`;
  }
  function tickClock(){ clockEl.textContent = formatClock(new Date()); }
  tickClock(); setInterval(tickClock, 10000);

  function setZTop(win){
    win.el.style.zIndex = String(z.next++);
    $$('.taskbar-app').forEach(b => b.classList.remove('active'));
    const btn = state.taskButtons.get(win.id);
    if(btn) btn.classList.add('active');
  }

  function makeWindow(opts){
    const id = `w_${Math.random().toString(36).slice(2)}`;
    const el = document.createElement('div');
    el.className = 'window';
    el.dataset.id = id;

    el.style.left = (opts.left ?? 100) + 'px';
    el.style.top = (opts.top ?? 80) + 'px';
    el.style.width = (opts.width ?? 500) + 'px';
    el.style.height = (opts.height ?? 380) + 'px';

    el.innerHTML = `
      <div class="titlebar" draggable="false">
        <div class="title">${opts.title ?? 'Window'}</div>
        <div class="window-controls">
          <button class="window-control btn-min" title="Minimize">_</button>
          <button class="window-control btn-max" title="Maximize">▢</button>
          <button class="window-control btn-close" title="Close">✕</button>
        </div>
      </div>
      <div class="content"></div>
      <div class="resize-handle n"></div>
      <div class="resize-handle s"></div>
      <div class="resize-handle e"></div>
      <div class="resize-handle w"></div>
      <div class="resize-handle nw"></div>
      <div class="resize-handle ne"></div>
      <div class="resize-handle sw"></div>
      <div class="resize-handle se"></div>
    `;

    const win = {
      id,
      el,
      appId: opts.appId,
      minimized: false,
      maximized: false,
      prevRect: null,
      content: $('.content', el),
      title: $('.titlebar .title', el),
    };

    // Controls
    $('.btn-close', el).addEventListener('click', ()=> closeWindow(win));
    $('.btn-min', el).addEventListener('click', ()=> minimizeWindow(win));
    $('.btn-max', el).addEventListener('click', ()=> toggleMaximize(win));

    // Dragging
    const titlebar = $('.titlebar', el);
    enableDrag(win, titlebar);

    // Resizing
    $$('.resize-handle', el).forEach(h => enableResize(win, h));

    windowsRoot.appendChild(el);
    state.windows.set(id, win);
    setZTop(win);

    // Taskbar button
    const btn = document.createElement('button');
    btn.className = 'taskbar-app';
    btn.innerHTML = `<span class="dot"></span><span class="label">${opts.title ?? opts.appId}</span>`;
    btn.addEventListener('click', ()=>{
      if(win.minimized){ restoreWindow(win); }
      setZTop(win); focusWindow(win);
    });
    taskbarApps.appendChild(btn);
    state.taskButtons.set(id, btn);

    return win;
  }

  function focusWindow(win){
    win.el.focus?.();
  }

  function closeWindow(win){
    const btn = state.taskButtons.get(win.id);
    if(btn) btn.remove();
    state.taskButtons.delete(win.id);
    win.el.remove();
    state.windows.delete(win.id);
  }

  function minimizeWindow(win){
    win.minimized = true;
    win.el.style.display = 'none';
    const btn = state.taskButtons.get(win.id);
    if(btn) btn.classList.remove('active');
  }

  function restoreWindow(win){
    win.minimized = false;
    win.el.style.display = '';
    setZTop(win);
  }

  function toggleMaximize(win){
    if(!win.maximized){
      win.prevRect = win.el.getBoundingClientRect();
      win.el.style.left = '0px';
      win.el.style.top = '0px';
      const desktopRect = $('#desktop').getBoundingClientRect();
      win.el.style.width = desktopRect.width + 'px';
      win.el.style.height = (desktopRect.height) + 'px';
      win.maximized = true;
    } else {
      const r = win.prevRect;
      win.el.style.left = r.left + 'px';
      win.el.style.top = r.top + 'px';
      win.el.style.width = r.width + 'px';
      win.el.style.height = r.height + 'px';
      win.maximized = false;
    }
    setZTop(win);
  }

  function enableDrag(win, handle){
    let startX, startY, startLeft, startTop;
    handle.addEventListener('mousedown', (e)=>{
      if(e.target.closest('.window-controls')) return;
      setZTop(win);
      startX = e.clientX; startY = e.clientY;
      const rect = win.el.getBoundingClientRect();
      startLeft = rect.left; startTop = rect.top;
      const onMove = (ev)=>{
        const dx = ev.clientX - startX; const dy = ev.clientY - startY;
        win.el.style.left = startLeft + dx + 'px';
        win.el.style.top = startTop + dy + 'px';
      };
      const onUp = ()=>{
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });
  }

  function enableResize(win, handle){
    const dir = Array.from(handle.classList).find(c => ['n','s','e','w','nw','ne','sw','se'].includes(c));
    handle.addEventListener('mousedown', (e)=>{
      e.preventDefault();
      setZTop(win);
      const rect = win.el.getBoundingClientRect();
      const start = { x: e.clientX, y: e.clientY, l: rect.left, t: rect.top, w: rect.width, h: rect.height };
      const onMove = (ev)=>{
        const dx = ev.clientX - start.x; const dy = ev.clientY - start.y;
        let l = start.l, t = start.t, w = start.w, h = start.h;
        if(dir.includes('e')) w = Math.max(300, start.w + dx);
        if(dir.includes('s')) h = Math.max(200, start.h + dy);
        if(dir.includes('w')) { l = start.l + dx; w = Math.max(300, start.w - dx); }
        if(dir.includes('n')) { t = start.t + dy; h = Math.max(200, start.h - dy); }
        Object.assign(win.el.style, { left: l + 'px', top: t + 'px', width: w + 'px', height: h + 'px' });
      };
      const onUp = ()=>{
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });
  }

  // Apps
  const Apps = {
    notepad(win, opts){
      win.title.textContent = opts?.title ?? 'Notepad';
      const key = opts?.storageKey ?? 'notepad-doc';
      win.content.innerHTML = `
        <div class="notepad">
          <div class="toolbar">
            <button data-act="new">New</button>
            <button data-act="save">Save</button>
            <button data-act="load">Load</button>
          </div>
          <textarea placeholder="Start typing..."></textarea>
        </div>
      `;
      const textarea = $('textarea', win.content);
      textarea.value = localStorage.getItem(key) || '';
      $('.toolbar', win.content).addEventListener('click', (e)=>{
        const b = e.target.closest('button'); if(!b) return;
        const act = b.dataset.act;
        if(act === 'new'){ textarea.value = ''; }
        if(act === 'save'){ localStorage.setItem(key, textarea.value); }
        if(act === 'load'){ textarea.value = localStorage.getItem(key) || ''; }
      });
    }
  };

  function launch(appId, opts){
    const win = makeWindow({ appId, title: opts?.title, left: 120 + Math.random()*60, top: 90 + Math.random()*60 });
    Apps[appId]?.(win, opts);
    return win;
  }

  // Start menu
  const startBtn = $('#start-button');
  const startMenu = $('#start-menu');
  function toggleStart(show){
    const willShow = show ?? startMenu.hasAttribute('hidden');
    if(willShow){
      startMenu.removeAttribute('hidden');
      startBtn.setAttribute('aria-expanded', 'true');
    } else {
      startMenu.setAttribute('hidden', '');
      startBtn.setAttribute('aria-expanded', 'false');
    }
  }
  startBtn.addEventListener('click', ()=> toggleStart());
  document.addEventListener('click', (e)=>{
    if(e.target.closest('#start-button') || e.target.closest('#start-menu')) return;
    toggleStart(false);
  });
  $('#start-menu').addEventListener('click', (e)=>{
    const item = e.target.closest('[data-app]'); if(!item) return;
    const app = item.dataset.app;
    toggleStart(false);
    launch(app, {});
  });

  // Desktop icon launchers
  $('.desktop-icons').addEventListener('dblclick', (e)=>{
    const icon = e.target.closest('.desktop-icon'); if(!icon) return;
    const app = icon.dataset.app; launch(app, {});
  });

  // Keyboard: Win key toggles start
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Meta') toggleStart();
  });

  // Initial focus
  $('#desktop').focus();
})();
