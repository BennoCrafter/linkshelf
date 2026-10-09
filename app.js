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

function isValidLink(link) {
  if (!link || typeof link.t !== 'string' || typeof link.u !== 'string') return false;
  try {
    const u = new URL(link.u);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch (e) { return url; }
}

let links = decodeState(location.hash.slice(1)).filter(isValidLink);

const listEl = document.getElementById('list');
const emptyEl = document.getElementById('empty-state');
const titleInput = document.getElementById('title-input');
const urlInput = document.getElementById('url-input');

function persist() {
  history.replaceState(null, '', links.length ? '#' + encodeState(links) : location.pathname + location.search);
}

function render() {
  listEl.innerHTML = '';
  emptyEl.style.display = links.length ? 'none' : 'block';

  links.forEach((link, i) => {
    const li = document.createElement('li');
    li.className = 'entry';

    const a = document.createElement('a');
    a.className = 'entry-title';
    a.href = link.u;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = link.t;

    const domain = document.createElement('span');
    domain.className = 'entry-domain';
    domain.textContent = domainOf(link.u);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove';
    removeBtn.setAttribute('aria-label', 'remove ' + link.t);
    removeBtn.dataset.i = i;
    removeBtn.textContent = '×';

    li.append(a, domain, removeBtn);
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

listEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.remove');
  if (!btn) return;
  links.splice(Number(btn.dataset.i), 1);
  render();
});

render();
