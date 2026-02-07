// Simple interactivity: search reveal, mobile menu, theme toggle
(function(){
  const searchBtn = document.querySelector('#searchBtn');
  const searchInput = document.querySelector('#searchInput');
  const themeBtn = document.querySelector('#themeBtn');

  if(searchBtn && searchInput){
    searchBtn.addEventListener('click', () => {
      const expanded = searchBtn.getAttribute('aria-expanded') === 'true';
      searchBtn.setAttribute('aria-expanded', String(!expanded));
      if(!expanded){
        searchInput.focus();
      }else{
        searchInput.value = '';
      }
    });
  }

  // Theme toggle: light/dark (respects system by default)
  if(themeBtn){
    const apply = (mode) => {
      document.documentElement.dataset.theme = mode;
      if(mode === 'light'){
        document.documentElement.style.colorScheme = 'light';
      }else if(mode === 'dark'){
        document.documentElement.style.colorScheme = 'dark';
      }else{
        document.documentElement.style.colorScheme = 'light dark';
      }
    };
    let saved = localStorage.getItem('theme') || 'auto';
    apply(saved);
    themeBtn.addEventListener('click', () => {
      saved = saved === 'light' ? 'dark' : saved === 'dark' ? 'auto' : 'light';
      localStorage.setItem('theme', saved);
      apply(saved);
      themeBtn.querySelector('span').textContent = saved.toUpperCase();
    });
  }

  // Dummy search
  const form = document.querySelector('#searchForm');
  if(form){
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = (searchInput?.value || '').trim();
      if(q){
        alert('Search for: ' + q + '\n(This is a static template. Implement real search server-side.)');
      }
    });
  }
})();


// --- Active menu highlight script ---
document.addEventListener("DOMContentLoaded", function(){
  const navLinks = document.querySelectorAll(".nav a, .submenu.ribbon a");
  navLinks.forEach(link => {
    link.addEventListener("click", function(e){
      // remove active from all
      navLinks.forEach(l => l.classList.remove("active"));
      // add to clicked
      this.classList.add("active");
    });
  });
});

// --- Persistent active menu (supports duplicate hrefs via text key) ---
document.addEventListener("DOMContentLoaded", function(){
  const links = Array.from(document.querySelectorAll(".nav a, .submenu.ribbon a"));

  // Utility to normalize href to pathname + hash
  const norm = (href) => {
    try {
      const u = new URL(href, window.location.href);
      return (u.pathname.split("/").pop() || "index.html") + (u.hash || "");
    } catch(e){
      const a = document.createElement("a");
      a.href = href;
      return (a.pathname.split("/").pop() || "index.html") + (a.hash || "");
    }
  };

  // Key builder includes normalized href + visible text to distinguish same-page items
  const keyFor = (el) => (norm(el.getAttribute("href")||"") + "|" + (el.textContent||"").trim().toLowerCase());

  // Restore last active from localStorage if present
  const saved = localStorage.getItem("activeNavKey");

  // Clear any existing active
  links.forEach(l => l.classList.remove("active"));

  let applied = false;

  // 1) If a saved key exists, try to match it first (works across page loads even for same href items)
  if (saved){
    const target = links.find(l => keyFor(l) === saved);
    if (target){
      target.classList.add("active");
      applied = true;
    }
  }

  // 2) If nothing applied, try to match current URL (page + hash) to an item (e.g., submenu hashes)
  if (!applied){
    const currentKeyPrefix = norm(window.location.href);
    // Prefer exact hash match if any
    let candidate = links.find(l => norm(l.getAttribute("href")||"") === currentKeyPrefix);
    if (!candidate){
      // Fallback to page-only match (first occurrence on the page)
      const pageOnly = (currentKeyPrefix.split("#")[0]);
      candidate = links.find(l => norm(l.getAttribute("href")||"").split("#")[0] === pageOnly);
    }
    if (candidate){
      candidate.classList.add("active");
      applied = true;
    }
  }

  // 3) Default to Home
  if (!applied){
    const home = links.find(l => (l.getAttribute("href")||"").endsWith("index.html"));
    if (home) home.classList.add("active");
  }

  // Click handler: persist selection and apply immediately
  links.forEach(link => {
    link.addEventListener("click", function(){
      const key = keyFor(this);
      localStorage.setItem("activeNavKey", key);
      links.forEach(l => l.classList.remove("active"));
      this.classList.add("active");
    });
  });
});

