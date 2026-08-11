/* ============================================================
   anna_le — shared site script
   Include on every page: <script src="main.js" defer></script>
   Each init() is guarded, so pages that don't have a given
   element (e.g. the homepage tree) just skip that piece.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  initCustomCursor();
  initActiveNav();
  initPetals();
  initGrassField();
  initFlowerNav();
});

/* ------------------------------------------------------------
   custom cursor — follows the pointer, grows over anything
   clickable. Falls back to the system cursor on touch devices
   (see the @media rule in style.css that hides #cursor there).
   ------------------------------------------------------------ */
function initCustomCursor(){
  if (window.matchMedia('(max-width:820px)').matches) return;

  let cursor = document.getElementById('cursor');
  if (!cursor){
    cursor = document.createElement('div');
    cursor.id = 'cursor';
    document.body.appendChild(cursor);
  }

  // confirm cursor.png actually loads before hiding the native cursor —
  // if it 404s (wrong path/case) we fall back to a plain visible dot
  // instead of leaving the user with no cursor at all
  const test = new Image();
  test.onload = () => {
    document.documentElement.classList.add('custom-cursor-active');
  };
  test.onerror = () => {
    cursor.style.backgroundImage = 'none';
    cursor.style.background = 'var(--green)';
    cursor.style.borderRadius = '50%';
    document.documentElement.classList.add('custom-cursor-active');
    console.warn('main.js: cursor.png failed to load — check the file exists next to your HTML and the filename/case matches.');
  };
  test.src = 'cursor.png';

  document.addEventListener('mousemove', e => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top  = e.clientY + 'px';
  });

  const interactiveSelector = 'a, button, .btn, .file-card, .flower, [data-cursor-grow]';

  document.addEventListener('mouseover', e => {
    if (e.target.closest(interactiveSelector)) cursor.classList.add('active');
  });
  document.addEventListener('mouseout', e => {
    if (e.target.closest(interactiveSelector)) cursor.classList.remove('active');
  });
}

/* ------------------------------------------------------------
   active nav link — marks the current page in nav.links
   based on the file name in the URL, so aria-current styling
   in style.css lights up automatically on every page.
   ------------------------------------------------------------ */
function initActiveNav(){
  const links = document.querySelectorAll('nav.links a[href]');
  if (!links.length) return;

  let current = window.location.pathname.split('/').pop();
  if (current === '') current = 'index.html';

  links.forEach(link => {
    const href = link.getAttribute('href').split('/').pop();
    if (href === current) link.setAttribute('aria-current', 'page');
  });
}

/* ------------------------------------------------------------
   ambient falling petals — opt in per page with:
     <body data-petals>
   Optionally set a count: <body data-petals="20">
   ------------------------------------------------------------ */
function initPetals(){
  const body = document.body;
  if (!body.hasAttribute('data-petals')) return;

  const count = parseInt(body.getAttribute('data-petals'), 10) || 14;
  const colors = ['#ff3d9a', '#ff9f4d', '#7fd4ff', '#ffd23f', '#9dff9e', '#8a5cf6'];

  for (let i = 0; i < count; i++){
    const p = document.createElement('div');
    p.className = 'petal-fall';
    p.textContent = '❁';
    p.style.left = Math.random() * 100 + 'vw';
    p.style.color = colors[i % colors.length];
    p.style.animationDuration = (8 + Math.random() * 8) + 's';
    p.style.animationDelay = (Math.random() * 10) + 's';
    p.style.fontSize = (10 + Math.random() * 10) + 'px';
    body.appendChild(p);
  }
}

/* ------------------------------------------------------------
   grass field generator — homepage only.
   Looks for <g id="grassLayer"></g> inside the tree SVG and
   fills it with a dense, varied field of tapered blades.
   ------------------------------------------------------------ */
function initGrassField(){
  const grassLayer = document.getElementById('grassLayer');
  if (!grassLayer) return;

  const svgNS = 'http://www.w3.org/2000/svg';
  const bladeColors = ['#5fae6a', '#7bc98a', '#3f7a52', '#8fd99c'];
  const bladeCount = 130;

  for (let i = 0; i < bladeCount; i++){
    const x = 5 + Math.random() * 1190;
    const y = 756 + Math.sin(x / 140) * 9 + (Math.random() * 10 - 5);
    const h = 20 + Math.random() * 30;
    const rot = -16 + Math.random() * 32;
    const bow = 2 + Math.random() * 4;
    const color = bladeColors[Math.floor(Math.random() * bladeColors.length)];
    const delay = Math.random() * 1.2;

    const g = document.createElementNS(svgNS, 'g');
    g.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${rot.toFixed(1)})`);

    const path = document.createElementNS(svgNS, 'path');
    const d = `M0,0 C${-bow},${-h * 0.4} ${-bow * 0.6},${-h * 0.75} 0,${-h} `
            + `C${bow * 0.6},${-h * 0.75} ${bow},${-h * 0.4} 0,0 Z`;
    path.setAttribute('d', d);
    path.setAttribute('class', 'blade');
    path.setAttribute('fill', color);
    path.style.animationDelay = delay.toFixed(2) + 's';

    g.appendChild(path);
    grassLayer.appendChild(g);
  }
}

/* ------------------------------------------------------------
   flower navigation — homepage only.
   Each <use class="flower" data-href="..."> navigates to its
   target page on click. Update data-href values as real pages
   go live (currently point at about.html, research.html, etc).
   ------------------------------------------------------------ */
function initFlowerNav(){
  const flowers = document.querySelectorAll('.flower[data-href]');
  if (!flowers.length) return;

  flowers.forEach(node => {
    node.addEventListener('click', () => {
      const href = node.dataset.href;
      if (href) window.location.href = href;
    });
    node.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        const href = node.dataset.href;
        if (href) window.location.href = href;
      }
    });
  });
}