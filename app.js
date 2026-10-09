function encodeState(links) {
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(links))));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeState(raw) {
  try {
    let b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  } catch (e) {
    return [];
  }
}

function normalizeUrl(raw) {
  const trimmed = raw.trim();
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : 'https://' + trimmed;
  try {
    const u = new URL(candidate);
    return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : null;
  } catch (e) {
    return null;
  }
}

const COLORS = [
  '#1f77b4', '#4c71af', '#669ac1', '#668562',
  '#9ca66f', '#73ac9f', '#9467bd', '#a779af',
  '#cb98bf', '#e7a458', '#ffbb78', '#ff9896',
  '#d62728', '#d06060', '#f7b6d2', '#e377c2',
  '#cb7855', '#c5b0d5', '#7f7f7f', '#53484d',
  '#9a8578', '#dabbc3',
];

function isValidLink(link) {
  if (!link || typeof link.t !== 'string' || typeof link.u !== 'string') return false;
  try {
    const u = new URL(link.u);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  } catch (e) {
    return false;
  }
  if (link.c && !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(link.c)) link.c = null;
  return true;
}

let links = decodeState(location.hash.slice(1)).filter(isValidLink);

const listEl = document.getElementById('list');
const emptyEl = document.getElementById('empty-state');
const titleInput = document.getElementById('title-input');
const urlInput = document.getElementById('url-input');
const editToggle = document.getElementById('edit-toggle');

function persist() {
  history.replaceState(null, '', links.length ? '#' + encodeState(links) : location.pathname + location.search);
}

function renumber() {
  Array.from(listEl.children).forEach((li, i) => {
    li.dataset.i = i;
    li.querySelector('.entry-index').textContent = String(i + 1).padStart(2, '0');
  });
}

function render() {
  listEl.innerHTML = '';
  emptyEl.style.display = links.length ? 'none' : 'block';

  links.forEach((link, i) => {
    const li = document.createElement('li');
    li.className = 'entry';
    li.dataset.i = i;
    li._link = link;

    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.title = 'change color';
    dot.style.setProperty('--dot-color', link.c || 'transparent');

    const index = document.createElement('span');
    index.className = 'entry-index';
    index.textContent = String(i + 1).padStart(2, '0');

    const a = document.createElement('a');
    a.className = 'entry-title';
    a.href = link.u;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = link.t;

    const handle = document.createElement('span');
    handle.className = 'handle';
    handle.textContent = '⋮⋮';
    handle.title = 'drag to reorder';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove';
    removeBtn.setAttribute('aria-label', 'remove ' + link.t);
    removeBtn.textContent = '×';

    li.append(dot, index, a, handle, removeBtn);
    listEl.appendChild(li);
  });

  persist();
}

document.getElementById('url-input').addEventListener('input', (e) => e.target.setCustomValidity(''));

document.getElementById('add-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const title = titleInput.value.trim();
  const url = normalizeUrl(urlInput.value.trim());

  if (!url) {
    urlInput.setCustomValidity('Enter a valid http(s) link.');
    urlInput.reportValidity();
    return;
  }
  if (!title) return;

  urlInput.setCustomValidity('');
  links.push({ t: title, u: url });
  titleInput.value = '';
  urlInput.value = '';
  titleInput.focus();
  render();
});

function startEditEntry(li) {
  const link = li._link;
  li.innerHTML = '';
  li.classList.add('entry-editing');

  const editTitle = document.createElement('input');
  editTitle.type = 'text';
  editTitle.className = 'edit-title';
  editTitle.value = link.t;
  editTitle.maxLength = 120;

  const editUrl = document.createElement('input');
  editUrl.type = 'url';
  editUrl.className = 'edit-url';
  editUrl.value = link.u;

  li.append(editTitle, editUrl);
  editTitle.focus();
  editTitle.select();

  let done = false;
  function commit() {
    if (done) return;
    done = true;
    const t = editTitle.value.trim();
    const u = normalizeUrl(editUrl.value.trim());
    if (t && u) { link.t = t; link.u = u; }
    render();
  }
  function cancel() {
    if (done) return;
    done = true;
    render();
  }

  [editTitle, editUrl].forEach((input) => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });
  });

  li.addEventListener('focusout', () => {
    requestAnimationFrame(() => {
      if (!li.contains(document.activeElement)) commit();
    });
  });
}

listEl.addEventListener('click', (e) => {
  const removeBtn = e.target.closest('.remove');
  if (removeBtn) {
    const li = removeBtn.closest('.entry');
    links.splice(links.indexOf(li._link), 1);
    render();
    return;
  }

  if (!document.body.classList.contains('editing')) return;

  const dot = e.target.closest('.dot');
  if (dot) {
    openColorDialog(dot.closest('.entry')._link);
    return;
  }

  const title = e.target.closest('.entry-title');
  if (title) {
    e.preventDefault();
    startEditEntry(title.closest('.entry'));
  }
});

editToggle.addEventListener('click', () => {
  document.body.classList.toggle('editing');
  editToggle.classList.toggle('active');
  editToggle.textContent = document.body.classList.contains('editing') ? '✓' : '✎';
});

let dragEl = null;

listEl.addEventListener('mousedown', (e) => {
  const handle = e.target.closest('.handle');
  if (!handle) return;
  handle.closest('.entry').draggable = true;
});

listEl.addEventListener('mouseup', () => {
  Array.from(listEl.children).forEach((li) => { li.draggable = false; });
});

listEl.addEventListener('dragstart', (e) => {
  dragEl = e.target.closest('.entry');
  if (!dragEl) return;
  dragEl.classList.add('dragging');
});

listEl.addEventListener('dragover', (e) => {
  e.preventDefault();
  if (!dragEl) return;
  const target = e.target.closest('.entry');
  if (!target || target === dragEl) return;
  const before = (e.clientY - target.getBoundingClientRect().top) < target.offsetHeight / 2;
  listEl.insertBefore(dragEl, before ? target : target.nextSibling);
  renumber();
});

listEl.addEventListener('dragend', () => {
  if (!dragEl) return;
  dragEl.classList.remove('dragging');
  dragEl.draggable = false;
  dragEl = null;
  links = Array.from(listEl.children).map((li) => li._link);
  persist();
});

const colorDialog = document.getElementById('color-dialog');
const swatchesEl = document.getElementById('swatches');
let colorTarget = null;

const noneSwatch = document.createElement('button');
noneSwatch.type = 'button';
noneSwatch.className = 'swatch swatch-none';
noneSwatch.title = 'no color';
noneSwatch.dataset.color = '';
swatchesEl.appendChild(noneSwatch);

COLORS.forEach((hex) => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'swatch';
  btn.style.background = hex;
  btn.dataset.color = hex;
  swatchesEl.appendChild(btn);
});

const customColorInput = document.getElementById('custom-color-input');

function openColorDialog(link) {
  colorTarget = link;
  customColorInput.value = link.c || '#000000';
  colorDialog.showModal();
}

swatchesEl.addEventListener('click', (e) => {
  const swatch = e.target.closest('.swatch');
  if (!swatch || !colorTarget) return;
  colorTarget.c = swatch.dataset.color || null;
  colorDialog.close();
  render();
});

customColorInput.addEventListener('input', () => {
  if (!colorTarget) return;
  colorTarget.c = customColorInput.value;
  render();
});

customColorInput.addEventListener('change', () => colorDialog.close());

colorDialog.addEventListener('click', (e) => {
  if (e.target === colorDialog) colorDialog.close();
});

render();
