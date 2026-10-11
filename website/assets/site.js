(() => {
  'use strict';
  const themeKey = 'cefaci.site.theme';
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  let explicitTheme = null;
  try { const value = localStorage.getItem(themeKey); if (value === 'dark' || value === 'light') explicitTheme = value; } catch {}
  const applyTheme = () => {
    const dark = explicitTheme === 'dark' || (explicitTheme === null && systemTheme.matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.setAttribute('aria-pressed', String(dark));
      button.setAttribute('aria-label', dark ? 'Activează tema de zi' : 'Activează tema de noapte');
      const icon = button.querySelector('[data-theme-icon]'); if (icon) icon.textContent = dark ? '☀' : '☾';
    });
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? '#10142d' : '#E8EBF2';
  };
  applyTheme();
  systemTheme.addEventListener('change', () => { if (explicitTheme === null) applyTheme(); });
  document.querySelectorAll('[data-theme-toggle]').forEach(button => button.addEventListener('click', () => {
    explicitTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(themeKey, explicitTheme); } catch {}
    applyTheme();
  }));
  const screens = {
    plan: {image: 'plan', alt: 'CeFaci: alegerea unui singur loc, a întregii seri sau a unui plan construit manual', caption: 'Tu alegi cum începe seara.'},
    surpriza: {image: 'surpriza', alt: 'Ecran real CeFaci: o surpriză pregătită de Bilu pentru ieșirea ta', caption: 'Ai chef de ceva spontan? Bilu vine cu o idee.'},
    loc: {image: 'loc', alt: 'Ecran real CeFaci: detalii despre un loc, cu adresă și opțiuni pentru ieșire', caption: 'Un loc nou, cu detaliile de care ai nevoie.'},
  };
  document.querySelectorAll('[data-screen]').forEach(button => button.addEventListener('click', () => {
    const screen = screens[button.dataset.screen]; const image = document.getElementById('app-screen'); const caption = document.getElementById('screen-caption');
    if (!screen || !image || !caption) return;
    image.src = '/assets/' + screen.image + '.webp'; image.alt = screen.alt; caption.textContent = screen.caption;
    document.querySelectorAll('[data-screen]').forEach(item => { const selected = item === button; item.classList.toggle('active', selected); item.setAttribute('aria-pressed', String(selected)); });
  }));
  let dialog = document.getElementById('storage-dialog');
  if (!dialog && document.querySelector('[data-storage-open]')) {
    dialog = document.createElement('dialog'); dialog.id = 'storage-dialog'; dialog.setAttribute('aria-labelledby', 'storage-title');
    const heading = document.createElement('h2'); heading.id = 'storage-title'; heading.textContent = 'Stocare, pe înțeles.';
    const copy = document.createElement('p'); copy.textContent = 'Acest site nu folosește cookies, analytics sau marketing. Numai dacă schimbi tema, preferința cefaci.site.theme se salvează în browser. Stocarea conturilor Client, Business și Admin este separată.';
    const clear = document.createElement('button'); clear.type = 'button'; clear.className = 'button blue'; clear.dataset.storageClear = ''; clear.textContent = 'Șterge preferința temei';
    const result = document.createElement('p'); result.id = 'storage-result'; result.setAttribute('role', 'status');
    const close = document.createElement('button'); close.type = 'button'; close.dataset.storageClose = ''; close.textContent = 'Închide';
    dialog.append(heading, copy, clear, result, close); document.body.appendChild(dialog);
  }
  if (dialog) {
    document.querySelectorAll('[data-storage-open]').forEach(button => button.addEventListener('click', () => dialog.showModal()));
    dialog.querySelectorAll('[data-storage-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
    dialog.querySelector('[data-storage-clear]')?.addEventListener('click', () => {
      let removed = true; try { localStorage.removeItem(themeKey); } catch { removed = false; }
      explicitTheme = null; applyTheme();
      const result = dialog.querySelector('#storage-result'); if (result) result.textContent = removed ? 'Preferința a fost ștearsă. Tema urmează din nou dispozitivul.' : 'Browserul nu permite accesul la stocare. Tema urmează dispozitivul pentru această vizită.';
    });
  }
})();
