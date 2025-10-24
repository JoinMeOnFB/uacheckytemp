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
    // Mark window active
    state.windows.forEach(w => w.el.classList.remove('active'));
    win.el.classList.add('active');
    // Taskbar active state
    $$('.taskbar-app').forEach(b => b.classList.remove('active'));
    const btn = state.taskButtons.get(win.id);
    if(btn) btn.classList.add('active');
  }

  function makeWindow(opts){
    const id = `w_${Math.random().toString(36).slice(2)}`;
    const el = document.createElement('div');
    el.className = 'window';
    el.dataset.id = id;
    if(opts.appId) el.dataset.appId = opts.appId;

    el.style.left = (opts.left ?? 100) + 'px';
    el.style.top = (opts.top ?? 80) + 'px';
    el.style.width = (opts.width ?? 500) + 'px';
    el.style.height = (opts.height ?? 380) + 'px';

    const iconClass = opts.iconClass ?? `${opts.appId || 'app'}-icon`;
    el.innerHTML = `
      <div class="titlebar" draggable="false">
        <span class="window-icon ${iconClass}"></span>
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
    titlebar.addEventListener('dblclick', ()=> toggleMaximize(win));
    el.addEventListener('mousedown', ()=> setZTop(win));

    // Resizing
    $$('.resize-handle', el).forEach(h => enableResize(win, h));

    windowsRoot.appendChild(el);
    state.windows.set(id, win);
    setZTop(win);

    // Taskbar button
    const btn = document.createElement('button');
    btn.className = `taskbar-app app-${opts.appId ?? 'app'}`;
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
    win.el.classList.remove('active');
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
      textarea.value = (opts?.initialValue ?? localStorage.getItem(key)) || '';
      $('.toolbar', win.content).addEventListener('click', (e)=>{
        const b = e.target.closest('button'); if(!b) return;
        const act = b.dataset.act;
        if(act === 'new'){ textarea.value = ''; }
        if(act === 'save'){ localStorage.setItem(key, textarea.value); }
        if(act === 'load'){ textarea.value = localStorage.getItem(key) || ''; }
      });
    },
    calculator(win){
      win.title.textContent = 'Calculator';
      win.content.innerHTML = `
        <div class="calc">
          <input class="calc-display" type="text" value="0" aria-label="Calculator display" />
          <div class="calc-keys">
            <button data-k="C">C</button>
            <button data-k="back">⌫</button>
            <button class="op" data-k="/">÷</button>
            <button class="op" data-k="*">×</button>
            <button data-k="7">7</button>
            <button data-k="8">8</button>
            <button data-k="9">9</button>
            <button class="op" data-k="-">−</button>
            <button data-k="4">4</button>
            <button data-k="5">5</button>
            <button data-k="6">6</button>
            <button class="op" data-k="+">+</button>
            <button data-k="1">1</button>
            <button data-k="2">2</button>
            <button data-k="3">3</button>
            <button class="equal" data-k="=">=</button>
            <button data-k="0" style="grid-column: span 2">0</button>
            <button data-k=".">.</button>
          </div>
        </div>
      `;
      const display = $('.calc-display', win.content);
      let current = '0', operand = null, op = null, justEq = false;
      function update(){ display.value = current; }
      function inputDigit(d){
        if(justEq){ current = '0'; justEq = false; }
        if(current === '0') current = d; else current += d; update();
      }
      function inputDot(){ if(!current.includes('.')) { current += '.'; update(); } }
      function doOp(nextOp){
        if(op && operand != null){
          const a = parseFloat(operand), b = parseFloat(current);
          let r = 0; if(op === '+') r = a+b; if(op === '-') r = a-b; if(op === '*') r = a*b; if(op === '/') r = b===0? 0 : a/b;
          current = String(Number.isFinite(r) ? +r.toFixed(10) : 0);
          operand = current;
        } else {
          operand = current;
        }
        op = nextOp; current = '0'; update();
      }
      function equals(){
        if(op && operand != null){
          const a = parseFloat(operand), b = parseFloat(current);
          let r = 0; if(op === '+') r = a+b; if(op === '-') r = a-b; if(op === '*') r = a*b; if(op === '/') r = b===0? 0 : a/b;
          current = String(Number.isFinite(r) ? +r.toFixed(10) : 0);
          operand = null; op = null; justEq = true; update();
        }
      }
      function clearAll(){ current = '0'; operand = null; op = null; update(); }
      function back(){ if(justEq){ clearAll(); return; } if(current.length>1) current = current.slice(0,-1); else current = '0'; update(); }
      $('.calc-keys', win.content).addEventListener('click', (e)=>{
        const b = e.target.closest('button'); if(!b) return; const k = b.dataset.k;
        if(!k) return; if(/^[0-9]$/.test(k)) inputDigit(k); else if(k==='.') inputDot(); else if(k==='=') equals(); else if(k==='C') clearAll(); else if(k==='back') back(); else doOp(k);
      });
    },
    paint(win){
      win.title.textContent = 'Paint';
      win.content.innerHTML = `
        <div class="paint">
          <div class="toolbar">
            <input type="color" value="#1f9eff" aria-label="Color" />
            <input type="range" min="1" max="40" value="6" aria-label="Brush size" />
            <button data-act="clear">Clear</button>
            <button data-act="save">Save</button>
          </div>
          <canvas></canvas>
        </div>
      `;
      const canvas = $('canvas', win.content);
      const color = $('input[type="color"]', win.content);
      const size = $('input[type="range"]', win.content);
      const ctx = canvas.getContext('2d');
      function resizeCanvas(){
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = Math.max(100, rect.width * dpr);
        canvas.height = Math.max(100, rect.height * dpr);
        ctx.scale(dpr, dpr);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      }
      // Delay resize until appended & visible
      requestAnimationFrame(resizeCanvas);
      let drawing = false, last = null;
      function drawTo(x, y){
        if(!drawing) return; ctx.strokeStyle = color.value; ctx.lineWidth = +size.value; ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(x, y); ctx.stroke(); last = {x, y};
      }
      canvas.addEventListener('pointerdown', e=>{ drawing = true; const r = canvas.getBoundingClientRect(); last = { x: e.clientX - r.left, y: e.clientY - r.top }; canvas.setPointerCapture(e.pointerId); });
      canvas.addEventListener('pointermove', e=>{ if(!drawing) return; const r = canvas.getBoundingClientRect(); drawTo(e.clientX - r.left, e.clientY - r.top); });
      window.addEventListener('pointerup', ()=>{ drawing = false; });
      $('.toolbar', win.content).addEventListener('click', (e)=>{
        const b = e.target.closest('button'); if(!b) return; const act = b.dataset.act;
        if(act==='clear'){ ctx.clearRect(0,0,canvas.width,canvas.height); }
        if(act==='save'){
          const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = 'painting.png'; a.click();
        }
      });
      // Handle window resize
      new ResizeObserver(resizeCanvas).observe(canvas);
    },
    explorer(win){
      win.title.textContent = 'Explorer';
      const fs = {
        name: 'Computer', type: 'folder', children: [
          { name: 'Documents', type: 'folder', children: [
            { name: 'Notes.txt', type: 'file', content: 'Welcome to your Documents!\n\nThis is a sample text file.' },
          ]},
          { name: 'Pictures', type: 'folder', children: [
            { name: 'Readme.txt', type: 'file', content: 'This folder could contain pictures.' }
          ]},
          { name: 'Downloads', type: 'folder', children: [
            { name: 'About.txt', type: 'file', content: 'Downloaded files appear here.' }
          ]}
        ]
      };
      let cwd = fs, path = [fs];
      function render(){
        win.content.innerHTML = `
          <div class="explorer">
            <div class="toolbar"><span class="breadcrumb">${path.map(p=>p.name).join(' / ')}</span></div>
            <div class="nav"></div>
            <div class="main"></div>
          </div>
        `;
        const nav = $('.nav', win.content);
        const main = $('.main', win.content);
        // Nav
        [fs, ...fs.children].forEach(node=>{
          const item = document.createElement('div'); item.className = 'item';
          item.innerHTML = `<span class="icon explorer-icon"></span><span>${node.name}</span>`;
          item.addEventListener('click', ()=>{ if(node.type==='folder'){ cwd = node; path = node===fs? [fs] : [fs, node]; render(); } });
          nav.appendChild(item);
        });
        // Main items
        cwd.children?.forEach(node=>{
          const item = document.createElement('div'); item.className = 'item';
          const icon = node.type==='folder' ? 'explorer-icon' : 'notepad-icon';
          item.innerHTML = `<span class="icon ${icon}"></span><span>${node.name}</span>`;
          item.addEventListener('dblclick', ()=>{
            if(node.type==='folder'){ cwd = node; path.push(node); render(); }
            else { const w = launch('notepad', { title: node.name, storageKey: `explorer-${node.name}` , initialValue: node.content }); setZTop(w); }
          });
          main.appendChild(item);
        });
      }
      render();
    },
    minesweeper(win){
      win.title.textContent = 'Minesweeper';
      const W = 9, H = 9, M = 10;
      win.content.innerHTML = `
        <div class="sweeper">
          <div class="hud">
            <span>Mines: <strong class="mines">${M}</strong></span>
            <span>Time: <strong class="time">0</strong>s</span>
            <button class="reset">New Game</button>
          </div>
          <div class="board" style="grid-template-columns: repeat(${W}, 26px)"></div>
        </div>
      `;
      const boardEl = $('.board', win.content);
      const minesEl = $('.mines', win.content);
      const timeEl = $('.time', win.content);
      let timerId = null, started = false, over = false;
      function makeBoard(){
        const cells = Array.from({length: H}, ()=> Array.from({length: W}, ()=> ({mine:false, r:false, f:false, n:0})));
        return cells;
      }
      let cells = makeBoard();
      function neighbors(x,y){ const ns=[]; for(let dy=-1; dy<=1; dy++){ for(let dx=-1; dx<=1; dx++){ if(dx||dy){ const nx=x+dx, ny=y+dy; if(nx>=0&&nx<W&&ny>=0&&ny<H) ns.push([nx,ny]); } } } return ns; }
      function placeMines(ex,ey){
        let left = M; while(left>0){ const x = Math.floor(Math.random()*W), y = Math.floor(Math.random()*H); if((x===ex&&y===ey)||cells[y][x].mine) continue; cells[y][x].mine = true; left--; }
        for(let y=0;y<H;y++){ for(let x=0;x<W;x++){ if(cells[y][x].mine) continue; cells[y][x].n = neighbors(x,y).filter(([nx,ny])=>cells[ny][nx].mine).length; } }
      }
      function startTimer(){ if(timerId) return; const t0 = Date.now(); timerId = setInterval(()=>{ timeEl.textContent = Math.floor((Date.now()-t0)/1000); }, 1000); }
      function stopTimer(){ if(timerId){ clearInterval(timerId); timerId=null; } }
      function renderBoard(){
        boardEl.innerHTML = '';
        for(let y=0;y<H;y++){
          for(let x=0;x<W;x++){
            const cell = cells[y][x];
            const b = document.createElement('button'); b.className = 'cell'; b.dataset.x = x; b.dataset.y = y;
            if(cell.r){ b.classList.add('revealed'); if(cell.mine){ b.classList.add('mine'); b.textContent = '💣'; } else if(cell.n>0){ b.textContent = String(cell.n); } }
            if(cell.f && !cell.r){ b.classList.add('flag'); b.textContent = '🚩'; }
            boardEl.appendChild(b);
          }
        }
      }
      function flood(x,y){ const stack=[[x,y]]; while(stack.length){ const [cx,cy]=stack.pop(); const c=cells[cy][cx]; if(c.r||c.mine) continue; c.r=true; if(c.n===0){ neighbors(cx,cy).forEach(([nx,ny])=>{ const n=cells[ny][nx]; if(!n.r&&!n.mine) stack.push([nx,ny]); }); } }
      }
      function reveal(x,y){
        const c = cells[y][x]; if(c.r||c.f||over) return; if(!started){ placeMines(x,y); started=true; startTimer(); }
        if(c.mine){ c.r=true; over=true; stopTimer(); // reveal all mines
          for(let yy=0; yy<H; yy++){ for(let xx=0; xx<W; xx++){ if(cells[yy][xx].mine) cells[yy][xx].r = true; } }
        } else { if(c.n===0) flood(x,y); else c.r=true; }
        checkWin(); renderBoard();
      }
      function toggleFlag(x,y){ const c=cells[y][x]; if(c.r||over) return; c.f = !c.f; const flags = cells.flat().filter(c=>c.f).length; minesEl.textContent = Math.max(0, M - flags); renderBoard(); }
      function checkWin(){ const total = W*H; const revealed = cells.flat().filter(c=>c.r).length; const mines = cells.flat().filter(c=>c.mine).length; if(revealed === total - mines){ over = true; stopTimer(); }
      }
      boardEl.addEventListener('click', (e)=>{ const b=e.target.closest('.cell'); if(!b) return; reveal(+b.dataset.x, +b.dataset.y); });
      boardEl.addEventListener('contextmenu', (e)=>{ const b=e.target.closest('.cell'); if(!b) return; e.preventDefault(); toggleFlag(+b.dataset.x, +b.dataset.y); });
      $('.reset', win.content).addEventListener('click', ()=>{ stopTimer(); timeEl.textContent='0'; started=false; over=false; cells=makeBoard(); minesEl.textContent = String(M); renderBoard(); });
      renderBoard();
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
