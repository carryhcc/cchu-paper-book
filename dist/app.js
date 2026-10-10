const root = document.documentElement;
const themeButton = document.querySelector('.theme-toggle');
let paperTone = 'cream';
try { if (localStorage.getItem('cchu-paper-tone') === 'white') paperTone = 'white'; } catch {}
function applyTone() {
  root.dataset.paper = paperTone;
  themeButton?.setAttribute('aria-label', paperTone === 'cream' ? '切换到纯白纸色' : '切换到米白纸色');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.content = paperTone === 'cream' ? '#ece9e2' : '#eff0ed';
}
applyTone();
themeButton?.addEventListener('click', () => {
  paperTone = paperTone === 'cream' ? 'white' : 'cream';
  applyTone();
  try { localStorage.setItem('cchu-paper-tone', paperTone); } catch {}
});
const copyButton = document.querySelector('#copy-email');
const copyStatus = document.querySelector('#copy-status');
copyButton?.addEventListener('click', async () => {
  copyButton.disabled = true;
  copyStatus.textContent = '正在复制…';
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText('hu.cc@qq.com');
    copyStatus.textContent = '邮箱已复制，期待你的来信。';
  } catch { copyStatus.textContent = '请手动复制：hu.cc@qq.com'; }
  finally { copyButton.disabled = false; }
});

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const compactBook = window.matchMedia('(max-width: 900px)');
const chapterNodes = [...document.querySelectorAll('.book-chapter')];
const chapters = chapterNodes.map(element => ({
  element, stage: element.querySelector('.book-stage'), sheet: element.querySelector('.book-sheet'),
  pieces: [...element.querySelectorAll('.paper-piece')].map(piece => ({ element: piece, depth: Number(piece.dataset.depth) || 40, delay: Number(piece.dataset.delay) || 0 }))
}));
const directory = [...document.querySelectorAll('.chapter-nav a')];
const clamp = value => Math.min(1, Math.max(0, value));
const smooth = value => { const p = clamp(value); return p * p * (3 - 2 * p); };
let pending = false;
let desktop = false;
let activeIndex = 0;
let unit = window.innerHeight * 1.2;
let sharedStage;
let frame;
let pageStatus;
let previousButton;
let nextButton;
if (chapters.length) {
  sharedStage = document.createElement('div');
  sharedStage.className = 'bound-stage';
  frame = document.createElement('div');
  frame.className = 'bound-frame';
  const binding = document.createElement('div');
  binding.className = 'bound-binding';
  binding.setAttribute('aria-hidden', 'true');
  frame.append(binding);
  chapters.forEach((chapter, index) => {
    const left = chapter.sheet.querySelector('.page-left');
    const right = chapter.sheet.querySelector('.page-right');
    const front = document.createElement('div');
    front.className = 'turn-front';
    while (right.firstChild) front.append(right.firstChild);
    right.append(front);
    if (chapters[index + 1]) {
      const back = chapters[index + 1].sheet.querySelector('.page-left').cloneNode(true);
      back.className = 'turn-back';
      back.setAttribute('aria-hidden', 'true');
      back.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
      back.querySelectorAll('a,button').forEach(node => node.tabIndex = -1);
      back.querySelectorAll('.paper-piece').forEach(node => { node.style.setProperty('--lift', '0px'); node.style.setProperty('--fold', '0deg'); });
      right.append(back);
    }
    chapter.left = left;
    chapter.right = right;
    chapter.shell = document.createElement('div');
    chapter.shell.className = 'bound-shell';
    frame.append(chapter.shell);
  });
  sharedStage.append(frame);
  const controls = document.createElement('div');
  controls.className = 'book-controls';
  previousButton = document.createElement('button');
  previousButton.type = 'button'; previousButton.textContent = '← 上一页';
  nextButton = document.createElement('button');
  nextButton.type = 'button'; nextButton.textContent = '下一页 →';
  pageStatus = document.createElement('span');
  pageStatus.className = 'mono'; pageStatus.setAttribute('role', 'status');
  controls.append(previousButton, pageStatus, nextButton);
  document.body.append(controls);
  document.querySelector('main').prepend(sharedStage);
  previousButton.addEventListener('click', () => navigatePage(activeIndex - 1));
  nextButton.addEventListener('click', () => navigatePage(activeIndex + 1));
}
function liftPaper(chapter, amount, mobile) {
  chapter.pieces.forEach(({ element, depth, delay }) => {
    const p = smooth((amount - delay) / (1 - delay));
    const sculpted = element.classList.contains('fold-toy');
    element.style.setProperty('--paper-open', p.toFixed(3));
    element.style.setProperty('--wing-fold', `${(78 - p * 98).toFixed(2)}deg`);
    element.style.setProperty('--accordion-fold', `${(76 - p * 56).toFixed(2)}deg`);
    element.style.setProperty('--flap-fold', `${(-p * 135).toFixed(2)}deg`);
    element.style.setProperty('--letter-rise', `${(-p * 38).toFixed(2)}px`);
    element.style.setProperty('--petal-fold', `${(75 - p * 50).toFixed(2)}deg`);
    const sculptural = element.matches('.art-arch,.art-window,.art-leaf,.art-card,.tool-art');
    const hingeAngle = sculpted ? 28 : sculptural ? 38 : 12;
    element.style.setProperty('--lift', `${(p * depth * (mobile ? 0.16 : 1)).toFixed(2)}px`);
    element.style.setProperty('--fold', `${(-p * (mobile ? 3 : hingeAngle)).toFixed(2)}deg`);
    element.style.setProperty('--shadow-y', `${(2 + p * (mobile ? 4 : 20)).toFixed(2)}px`);
    element.style.setProperty('--shadow-blur', `${(5 + p * (mobile ? 7 : 22)).toFixed(2)}px`);
    element.style.setProperty('--support-height', `${(p * depth * 0.4).toFixed(2)}px`);
  });
}
function measureBook() {
  desktop = chapters.length > 0 && !compactBook.matches && !reducedMotion.matches;
  root.classList.toggle('bound-mode', desktop);
  root.classList.toggle('book-motion', !reducedMotion.matches && !desktop);
  unit = window.innerHeight * 1.2;
  chapters.forEach(chapter => {
    if (desktop) chapter.shell.append(chapter.sheet);
    else chapter.stage.append(chapter.sheet);
    chapter.sheet.inert = false;
    chapter.sheet.removeAttribute('aria-hidden');
  });
}
function renderBook() {
  if (!chapters.length) { pending = false; return; }
  const viewport = window.innerHeight;
  if (desktop) {
    const mainTop = document.querySelector('main').offsetTop;
    const journey = Math.max(0, (window.scrollY - mainTop) / unit);
    const current = Math.min(chapters.length - 1, Math.floor(journey));
    const phase = clamp(journey - current);
    const turn = current < chapters.length - 1 ? smooth((phase - 0.62) / 0.38) : 0;
    activeIndex = turn >= 0.5 ? Math.min(current + 1, chapters.length - 1) : current;
    chapters.forEach((chapter, index) => {
      const visible = index === current || index === current + 1;
      chapter.shell.style.visibility = visible ? 'visible' : 'hidden';
      chapter.shell.classList.toggle('waiting-sheet', index !== current);
      chapter.shell.style.zIndex = index === current ? '3' : '2';
      chapter.shell.style.pointerEvents = index === current && turn < 0.05 ? 'auto' : 'none';
      chapter.sheet.inert = index !== current;
      chapter.sheet.setAttribute('aria-hidden', index === current ? 'false' : 'true');
      chapter.left.style.opacity = index === current + 1 && turn < 0.97 ? '0' : '1';
      chapter.right.style.transform = index === current ? `rotateY(${-180 * turn}deg)` : 'rotateY(0deg)';
      let amount = 0;
      if (index === current) {
        const entry = current === 0 ? 0.12 + 0.88 * smooth(phase / 0.25) : 0.3 + 0.7 * smooth(phase / 0.25);
        const closing = current === chapters.length - 1 ? 1 : 1 - smooth((phase - 0.45) / 0.17);
        amount = entry * closing;
      } else if (index === current + 1) amount = 0.3 * smooth((phase - 0.85) / 0.15);
      liftPaper(chapter, amount, false);
    });
    frame.style.setProperty('--turn-shade', (Math.sin(turn * Math.PI) * 0.18).toFixed(3));
    frame.dataset.turn = turn.toFixed(3);
  } else {
    activeIndex = 0;
    chapters.forEach((chapter, index) => {
      chapter.left.style.opacity = '';
      chapter.right.style.transform = '';
      const top = chapter.element.offsetTop;
      const amount = reducedMotion.matches ? 1 : smooth((window.scrollY + viewport * 0.6 - top) / (viewport * 0.75));
      liftPaper(chapter, amount, true);
      if (window.scrollY + viewport * 0.4 >= top) activeIndex = index;
    });
  }
  directory.forEach((link, index) => {
    if (index === activeIndex) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
  if (previousButton) {
    previousButton.disabled = activeIndex === 0;
    nextButton.disabled = activeIndex === chapters.length - 1;
    const label = ['封面', '关于我', '项目作品', '技能', '联系'][activeIndex];
    const text = `${String(activeIndex + 1).padStart(2, '0')} / 05 · ${label}`;
    if (pageStatus.textContent !== text) pageStatus.textContent = text;
  }
  pending = false;
}
function queueBook() {
  if (pending) return;
  pending = true; requestAnimationFrame(renderBook);
}
function navigatePage(index, instant = false) {
  if (index < 0 || index >= chapters.length) return;
  const chapter = chapters[index];
  const destination = desktop ? document.querySelector('main').offsetTop + index * unit + unit * 0.28 : chapter.element.offsetTop - 74;
  window.scrollTo({ top: destination, behavior: instant || reducedMotion.matches ? 'instant' : 'smooth' });
  history.replaceState(null, '', `#${chapter.element.id}`);
}
window.addEventListener('scroll', queueBook, { passive: true });
function reconfigureBook() {
  const index = activeIndex;
  const wasDesktop = desktop;
  measureBook();
  if (wasDesktop !== desktop) navigatePage(index, true);
  renderBook();
}
window.addEventListener('resize', reconfigureBook);
window.addEventListener('pageshow', () => { measureBook(); queueBook(); });
reducedMotion.addEventListener('change', reconfigureBook);
compactBook.addEventListener('change', reconfigureBook);
window.addEventListener('hashchange', () => {
  const index = chapters.findIndex(chapter => `#${chapter.element.id}` === location.hash);
  if (index >= 0) navigatePage(index);
});
document.addEventListener('click', event => {
  const link = event.target.closest('a[href^="#"]');
  if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const index = chapters.findIndex(chapter => `#${chapter.element.id}` === link.getAttribute('href'));
  if (index >= 0) { event.preventDefault(); navigatePage(index); }
});
measureBook(); renderBook();
document.fonts?.ready.then(() => {
  measureBook(); renderBook();
  const index = chapters.findIndex(chapter => `#${chapter.element.id}` === location.hash);
  if (index >= 0) navigatePage(index, true);
});

// Local paper mechanisms use the same scroll progress as the book.
document.addEventListener('click', event => {
  const toy = event.target.closest('.fold-toy');
  if (!toy || toy.closest('.turn-back')) return;
  const opened = toy.getAttribute('aria-pressed') !== 'true';
  toy.setAttribute('aria-pressed', String(opened));
  toy.dataset.touched = 'true';
  const action = toy.querySelector('.toy-action');
  const kind = toy.dataset.fold;
  if (kind === 'pinwheel') {
    const turns = Number(toy.dataset.turns || 0) + 1;
    toy.dataset.turns = String(turns);
    toy.style.setProperty('--spin', `${turns * 90}deg`);
    action.textContent = '再点一下，继续转动 ↻';
  } else if (kind === 'crane') {
    toy.setAttribute('aria-label', opened ? '收拢纸鹤翅膀' : '展开纸鹤翅膀');
    action.textContent = opened ? '再点一下，收拢翅膀 ↙' : '点一下，展开翅膀 ↗';
  } else if (kind === 'accordion') {
    toy.setAttribute('aria-label', opened ? '收起手风琴折页' : '展开手风琴折页');
    action.textContent = opened ? '观察 → 理解 → 实践 · 点击收起 −' : '点一下，展开我的思考过程 ＋';
  } else if (kind === 'envelope') {
    toy.setAttribute('aria-label', opened ? '合上折纸信封' : '打开折纸信封');
    action.textContent = opened ? '保持好奇，继续创造 · 点击合上' : '点一下，打开一封小信 ✉';
  }
});
