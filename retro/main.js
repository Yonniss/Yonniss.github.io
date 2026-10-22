// Yannis OS: gestor de ventanas y programas del escritorio.
// Todo el texto visible está en el HTML; aquí solo hay comportamiento.

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(max-width: 699px)');

const desktop = $('#desktop');
const taskbar = $('.taskbar');
const tasks = $('.tasks');
const startBtn = $('.start');
const startMenu = $('#startmenu');

// ─── Ventanas ───
const wins = $$('.win');
const taskBtns = new Map();
let z = 10, cascade = 0;

wins.forEach(w => { w.hidden = true; });
taskbar.hidden = false;

function place(w) {
  if (w.dataset.placed) return;
  w.dataset.placed = '1';
  const [px, py] = (w.dataset.pos || '').split(',').map(Number);
  const n = cascade++ % 8;
  let left = w.dataset.pos ? px : 150 + n * 28;
  let top = w.dataset.pos ? py : 30 + n * 28;
  const d = desktop.getBoundingClientRect();
  const minLeft = mobile.matches ? 0 : $('.icons').getBoundingClientRect().right - d.left + 12;
  const gadgets = $('.gadgets');
  const maxRight = gadgets.offsetParent ? gadgets.getBoundingClientRect().left - d.left - 12 : d.width - 8;
  left = Math.max(minLeft, Math.min(left, maxRight - w.offsetWidth));
  left = Math.max(0, Math.min(left, d.width - w.offsetWidth - 8));
  top = Math.max(0, Math.min(top, d.height - w.offsetHeight - 8));
  w.style.left = left + 'px';
  w.style.top = top + 'px';
}

function activate(w) {
  w.style.zIndex = ++z;
  wins.forEach(o => o.classList.toggle('idle', o !== w));
  taskBtns.forEach((b, id) => b.classList.toggle('active', id === w.id));
}

function topmost() {
  return wins.filter(w => !w.hidden).sort((a, b) => b.style.zIndex - a.style.zIndex)[0];
}

function activateTop() {
  const w = topmost();
  if (w) return activate(w);
  wins.forEach(o => o.classList.add('idle'));
  taskBtns.forEach(b => b.classList.remove('active'));
}

function addTask(w) {
  const b = document.createElement('button');
  b.innerHTML = `<svg aria-hidden="true"><use href="#${w.dataset.icon}"/></svg><span></span>`;
  b.lastChild.textContent = w.dataset.short;
  b.addEventListener('click', () => {
    const isActive = !w.hidden && b.classList.contains('active');
    isActive ? minimize(w) : openWin(w.id);
  });
  tasks.append(b);
  taskBtns.set(w.id, b);
}

function openWin(id) {
  const w = document.getElementById(id);
  if (!w) return;
  const wasClosed = !taskBtns.has(id);
  w.hidden = false;
  if (wasClosed) addTask(w);
  place(w);
  activate(w);
  w.focus({ preventScroll: true });
  if (wasClosed) w.dispatchEvent(new Event('winopen'));
}

function minimize(w) {
  w.hidden = true;
  activateTop();
}

function closeWin(w) {
  w.hidden = true;
  taskBtns.get(w.id)?.remove();
  taskBtns.delete(w.id);
  w.dispatchEvent(new Event('winclose'));
  activateTop();
}

wins.forEach(w => {
  w.addEventListener('pointerdown', () => activate(w));
  $('.min', w).addEventListener('click', () => minimize(w));
  $('.max', w).addEventListener('click', () => w.classList.toggle('maxed'));
  $('.close', w).addEventListener('click', () => closeWin(w));
  $$('[data-close]', w).forEach(b => b.addEventListener('click', () => closeWin(w)));

  const bar = $('.titlebar', w);
  bar.addEventListener('dblclick', e => { if (!e.target.closest('button') && !mobile.matches) w.classList.toggle('maxed'); });
  bar.addEventListener('pointerdown', e => {
    if (e.target.closest('button') || w.classList.contains('maxed') || mobile.matches) return;
    const sx = e.clientX, sy = e.clientY, ox = w.offsetLeft, oy = w.offsetTop;
    const d = desktop.getBoundingClientRect();
    bar.setPointerCapture(e.pointerId);
    const move = ev => {
      w.style.left = Math.max(80 - w.offsetWidth, Math.min(ox + ev.clientX - sx, d.width - 80)) + 'px';
      w.style.top = Math.max(0, Math.min(oy + ev.clientY - sy, d.height - 30)) + 'px';
    };
    const up = () => { bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', up); };
    bar.addEventListener('pointermove', move);
    bar.addEventListener('pointerup', up);
  });
});

// ─── Iconos, menú Inicio, reloj ───
function toggleStart(open = startMenu.hidden) {
  startMenu.hidden = !open;
  startBtn.setAttribute('aria-expanded', open);
  if (open) $('button, a', startMenu).focus();
}

startBtn.addEventListener('click', () => toggleStart());
document.addEventListener('pointerdown', e => {
  if (!startMenu.hidden && !e.target.closest('#startmenu, .start')) toggleStart(false);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !startMenu.hidden) { toggleStart(false); startBtn.focus(); }
});

$$('[data-open]').forEach(b => b.addEventListener('click', () => {
  toggleStart(false);
  openWin(b.dataset.open);
}));

// ─── Gadgets: reloj analógico y "ahora suena" ───
{
  const hand = (cls, deg) => $(`.g-clock .${cls}`).setAttribute('transform', `rotate(${deg} 50 50)`);
  const tickHands = () => {
    if (!$('.gadgets').offsetParent) return;
    const t = new Date();
    hand('h', (t.getHours() % 12) * 30 + t.getMinutes() / 2);
    hand('m', t.getMinutes() * 6);
    hand('s', t.getSeconds() * 6);
  };
  tickHands();
  setInterval(tickHands, 1000);

  const track = $('.g-track');
  const meter = $('.g-meter');
  document.addEventListener('music', e => {
    const state = e.detail;
    track.textContent = state === 'play' ? $('#w-player .track span').textContent : track.dataset[state === 'pause' ? 'paused' : 'idle'];
    if (state !== 'play') meter.style.setProperty('--rock', .35);
  });
}
$$('#startmenu a').forEach(a => a.addEventListener('click', () => toggleStart(false)));

const clock = $('.clock');
function tickClock() {
  clock.textContent = new Date().toLocaleTimeString(document.documentElement.lang, { hour: '2-digit', minute: '2-digit' });
}
tickClock();
setInterval(tickClock, 10000);

// ─── Pestañas (Propiedades del sistema) ───
$$('[role="tablist"]').forEach(list => {
  const tabs = $$('[role="tab"]', list);
  const select = tab => tabs.forEach(t => {
    const on = t === tab;
    t.setAttribute('aria-selected', on);
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
  });
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', e => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!step) return;
      const next = tabs[(i + step + tabs.length) % tabs.length];
      select(next);
      next.focus();
    });
  });
  select(tabs.find(t => t.getAttribute('aria-selected') === 'true'));
});

// ─── Reproductor: un riff de guitarra distorsionada con Web Audio ───
{
  const w = $('#w-player');
  const playBtn = $('.play', w);
  const timeEl = $('.time', w);
  const canvas = $('canvas', w);
  const g = canvas.getContext('2d');

  // [semitonos sobre Mi grave, apagado con la palma]
  const RIFF = [[0,1],[0,1],[0,0],[0,1],[0,1],[3,0],[0,1],[5,0],[0,1],[0,1],[0,0],[0,1],[7,0],[6,0],[5,0],[3,0]];
  const EIGHTH = 60 / 140 / 2;
  let ac, input, analyser, data, timer, raf;
  let playing = false, step = 0, nextTime = 0, elapsed = 0, startedAt = 0;

  function distortion(k) {
    const n = 44100, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = i * 2 / n - 1;
      curve[i] = (3 + k) * x * 20 * (Math.PI / 180) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  function setup() {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    input = ac.createGain();
    const drive = ac.createWaveShaper();
    drive.curve = distortion(300);
    drive.oversample = '4x';
    const cab = ac.createBiquadFilter();
    cab.type = 'lowpass';
    cab.frequency.value = 3400;
    const master = ac.createGain();
    master.gain.value = 0.18;
    analyser = ac.createAnalyser();
    analyser.fftSize = 128;
    data = new Uint8Array(analyser.frequencyBinCount);
    input.connect(drive).connect(cab).connect(master).connect(analyser).connect(ac.destination);
  }

  function note(t, semi, muted) {
    const f = 82.41 * 2 ** (semi / 12) ;
    const dur = EIGHTH * (muted ? 0.5 : 0.95);
    const env = ac.createGain();
    const tone = ac.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = muted ? 900 : 5000;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.9, t + 0.005);
    env.gain.exponentialRampToValueAtTime(0.35, t + dur * 0.7);
    env.gain.linearRampToValueAtTime(0, t + dur);
    env.connect(tone).connect(input);
    // quinta de power chord + octava
    [[1, 'sawtooth', 0.5, -6], [1.5, 'sawtooth', 0.35, 5], [2, 'square', 0.12, 0]].forEach(([r, type, vol, cents]) => {
      const o = ac.createOscillator(), v = ac.createGain();
      o.type = type;
      o.frequency.value = f * r;
      o.detune.value = cents;
      v.gain.value = vol;
      o.connect(v).connect(env);
      o.start(t);
      o.stop(t + dur + 0.02);
    });
  }

  function schedule() {
    while (nextTime < ac.currentTime + 0.12) {
      const [semi, muted] = RIFF[step++ % RIFF.length];
      note(nextTime, semi, muted);
      nextTime += EIGHTH;
    }
  }

  function draw() {
    const W = canvas.width, H = canvas.height, bars = 24, bw = W / bars;
    const css = getComputedStyle(canvas);
    const bar = css.getPropertyValue('--bar').trim() || '#3cf05a';
    const hot = css.getPropertyValue('--bar-hot').trim() || '#f0d93c';
    g.clearRect(0, 0, W, H);
    if (playing) {
      analyser.getByteFrequencyData(data);
      const level = data.slice(1, bars + 1).reduce((s, v) => s + v, 0) / bars / 255;
      $('.g-meter').style.setProperty('--rock', Math.min(1, 0.3 + level * 1.6));
    }
    for (let i = 0; i < bars; i++) {
      const v = playing ? data[i + 1] / 255 : 0;
      const h = Math.max(2, v * H);
      g.fillStyle = v > 0.8 ? hot : bar;
      g.fillRect(i * bw + 1, H - h, bw - 2, h);
    }
    const secs = Math.floor(elapsed + (playing ? ac.currentTime - startedAt : 0));
    timeEl.textContent = String(Math.floor(secs / 60)).padStart(2, '0') + ':' + String(secs % 60).padStart(2, '0');
    if (playing) raf = requestAnimationFrame(draw);
  }

  function play() {
    if (!ac) setup();
    ac.resume();
    playing = true;
    nextTime = ac.currentTime + 0.05;
    startedAt = ac.currentTime;
    timer = setInterval(schedule, 25);
    playBtn.setAttribute('aria-pressed', 'true');
    playBtn.textContent = '❚❚';
    document.dispatchEvent(new CustomEvent('music', { detail: 'play' }));
    draw();
  }

  function pause() {
    if (!playing) return;
    elapsed += ac.currentTime - startedAt;
    playing = false;
    clearInterval(timer);
    cancelAnimationFrame(raf);
    playBtn.setAttribute('aria-pressed', 'false');
    playBtn.textContent = '▶';
    document.dispatchEvent(new CustomEvent('music', { detail: 'pause' }));
    draw();
  }

  function stop() {
    pause();
    elapsed = 0;
    step = 0;
    document.dispatchEvent(new CustomEvent('music', { detail: 'stop' }));
    draw();
  }

  playBtn.addEventListener('click', () => (playing ? pause() : play()));
  $('.stop', w).addEventListener('click', stop);
  w.addEventListener('winclose', stop);
  window.stopMusic = stop;
  draw();
}

// ─── Cubo.exe: timer de speedcubing (como TermTimer, pero con ventanas) ───
const FACES = ['R', 'L', 'U', 'D', 'F', 'B'];
const AXIS = { R: 0, L: 0, U: 1, D: 1, F: 2, B: 2 };

// 20 movimientos: nunca la misma cara seguida ni tres en el mismo eje (R L R)
function scramble() {
  const moves = [];
  while (moves.length < 20) {
    const f = FACES[Math.floor(Math.random() * 6)];
    const [a, b] = moves.slice(-2).map(m => m[0]);
    if (f === b) continue;
    if (a && AXIS[a] === AXIS[f] && AXIS[b] === AXIS[f]) continue;
    moves.push(f + ['', "'", '2'][Math.floor(Math.random() * 3)]);
  }
  return moves.join(' ');
}

{
  const w = $('#w-cube');
  const out = $('output', w);
  const scr = $('.scramble', w);
  const list = $('.times', w);
  const avg = $('.avg', w);
  const times = [];
  let start = 0, raf = 0;
  const fmt = ms => (ms / 1000).toFixed(2);

  const tick = () => { out.textContent = fmt(performance.now() - start); raf = requestAnimationFrame(tick); };

  function render() {
    list.replaceChildren(...times.slice(0, 5).map(t => Object.assign(document.createElement('li'), { textContent: fmt(t) })));
    if (times.length < 5) { avg.textContent = ''; return; }
    // ao5: se quitan el mejor y el peor de los últimos 5
    const last = times.slice(0, 5).sort((a, b) => a - b).slice(1, 4);
    avg.textContent = `${avg.dataset.label}: ${fmt(last.reduce((s, t) => s + t, 0) / 3)}`;
  }

  function toggle() {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
      const t = performance.now() - start;
      out.textContent = fmt(t);
      out.classList.remove('running');
      times.unshift(t);
      render();
      scr.textContent = scramble();
    } else {
      start = performance.now();
      out.classList.add('running');
      tick();
    }
  }

  $('.toggle', w).addEventListener('click', toggle);
  $('.reshuffle', w).addEventListener('click', () => { scr.textContent = scramble(); });
  w.addEventListener('keydown', e => {
    if (e.code !== 'Space' || e.repeat || e.target.closest('button')) return;
    e.preventDefault();
    toggle();
  });
  w.addEventListener('winopen', () => { scr.textContent = scramble(); });
  w.addEventListener('winclose', () => {
    cancelAnimationFrame(raf);
    raf = 0;
    out.classList.remove('running');
  });
}

// ─── Correo: arma un mailto con asunto y cuerpo ───
$('#w-mail form').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target;
  location.href = `mailto:yanniselflorin@gmail.com?subject=${encodeURIComponent(f.subject.value)}&body=${encodeURIComponent(f.body.value)}`;
});

// ─── Pantallas completas ───
function showOverlay(el, onClose) {
  el.hidden = false;
  const opened = performance.now();
  const close = e => {
    if (e.type === 'pointermove' && performance.now() - opened < 800) return;
    if (performance.now() - opened < 250) return;
    el.hidden = true;
    ['keydown', 'pointerdown', 'pointermove'].forEach(t => document.removeEventListener(t, close, true));
    onClose?.();
  };
  ['keydown', 'pointerdown', ...(onClose ? ['pointermove'] : [])].forEach(t => document.addEventListener(t, close, true));
}

// Arranque y apagado
const boot = $('.boot');
function bootUp(then) {
  if (reduced) return then?.();
  boot.hidden = false;
  setTimeout(() => { boot.hidden = true; then?.(); }, 1300);
}

$('[data-shutdown]').addEventListener('click', () => {
  toggleStart(false);
  window.stopMusic();
  const off = $('.shutdown');
  off.hidden = false;
  $('[data-boot]', off).focus();
});
$('[data-boot]').addEventListener('click', () => {
  $('.shutdown').hidden = true;
  bootUp();
});

// Código Konami → pantallazo azul
{
  const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let progress = 0;
  document.addEventListener('keydown', e => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    progress = key === KONAMI[progress] ? progress + 1 : (key === KONAMI[0] ? 1 : 0);
    if (progress < KONAMI.length) return;
    progress = 0;
    window.stopMusic();
    showOverlay($('.bsod'));
  });
}

// ─── Estado inicial ───
const HASH = {
  '#sobre-mi': 'w-about', '#about': 'w-about',
  '#proyectos': 'w-projects', '#projects': 'w-projects',
  '#stack': 'w-system', '#contacto': 'w-mail', '#contact': 'w-mail',
};

function welcome() {
  if (!mobile.matches) openWin('w-projects');
  openWin('w-about');
  if (HASH[location.hash]) openWin(HASH[location.hash]);
  const balloon = $('.balloon');
  balloon.hidden = false;
  $('button', balloon).addEventListener('click', () => { balloon.hidden = true; });
  setTimeout(() => { balloon.hidden = true; }, 9000);
}

let booted = false;
try { booted = sessionStorage.getItem('booted') === '1'; sessionStorage.setItem('booted', '1'); } catch {}
booted ? welcome() : bootUp(welcome);

// ─── Para quien abra las DevTools ───
const hello = {
  es: 'Si estás leyendo esto, eres de los míos.\nPrueba ↑↑↓↓←→←→BA.',
  en: "If you're reading this, you're one of us.\nTry ↑↑↓↓←→←→BA.",
};
console.log(
  '%c ┌───┬───┬───┐\n │ R │ U │ F │\n ├───┼───┼───┤\n │ L │ D │ B │\n └───┴───┴───┘\n\n' + (hello[document.documentElement.lang] || hello.en),
  'font: 13px/1.4 monospace; color: #1866e0'
);
