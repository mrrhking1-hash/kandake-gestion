/* Kandake Gestion - shared runtime (toast, reseau, service worker, installation).
   La navigation est gerée par js/router.js. */
(function () {
  'use strict';

  var KD = window.KD || {};
  window.KD = KD;

/* ------------------------------------------------------------- session
     L'acces a l'application est conditionne a une session : la page de
     connexion prend le dessus sur le shell quand elle est fermee. */
  var AUTH_KEY = 'kandake.session';

  /* La session est ouverte si elle contient l'id d'un utilisateur connu.
     Au premier lancement il n'y a rien : l'application demande de s'identifier. */
  KD.isAuthenticated = function () {
    try {
      var id = window.localStorage.getItem(AUTH_KEY);
      if (!id) return false;
      return KD.getUsers().some(function (u) { return u.id === id; });
    } catch (e) {
      return false;
    }
  };

  KD.login = function (userId) {
    /* Sans identifiant passe (acces rapide), on ouvre la session de la
       gérante : la session doit toujours pointer une personne reelle. */
    var id = userId || (KD.getUsers()[0] && KD.getUsers()[0].id);
    if (!id) return false;
    try {
      window.localStorage.setItem(AUTH_KEY, String(id));
    } catch (e) { /* ignore */ }
    document.dispatchEvent(new CustomEvent('kd:session', { detail: { open: true } }));
    return true;
  };

  KD.logout = function () {
    try { window.localStorage.removeItem(AUTH_KEY); } catch (e) { /* ignore */ }
    document.dispatchEvent(new CustomEvent('kd:session', { detail: { open: false } }));
  };

  /* ------------------------------------------------------------ équipe
     Trois personnes, un role (admin / vendeuse) et un mot de passe propre.
     Le stockage peut etre refuse : on retombe alors sur la liste par defaut,
     en lecture seule, plutot que de bloquer l'application. */
  var USERS_KEY = 'kandake.users';

  KD.ROLES = {
    admin: { label: 'Admin', desc: 'Accès complet, y compris les réglages' },
    vendeuse: { label: 'Vendeuse', desc: 'Caisse et catalogue uniquement' }
  };

  KD.defaultUsers = function () {
    return [
      { id: 'u1', name: 'Zenab', role: 'admin', phone: '221 77 000 00 01', password: '1111', active: true },
      { id: 'u2', name: 'Ydile', role: 'vendeuse', phone: '221 77 000 00 02', password: '1111', active: true },
      { id: 'u3', name: 'Dominique', role: 'vendeuse', phone: '221 77 000 00 03', password: '1111', active: true }
    ];
  };

  KD.getUsers = function () {
    try {
      var raw = window.localStorage.getItem(USERS_KEY);
      if (!raw) return KD.defaultUsers();
      var list = JSON.parse(raw);
      return Array.isArray(list) && list.length ? list : KD.defaultUsers();
    } catch (e) {
      return KD.defaultUsers();
    }
  };

  KD.saveUsers = function (list) {
    try {
      window.localStorage.setItem(USERS_KEY, JSON.stringify(list));
      return true;
    } catch (e) {
      return false;
    }
  };

  KD.currentUser = function () {
    var list = KD.getUsers();
    var id = null;
    try { id = window.localStorage.getItem(AUTH_KEY); } catch (e) { /* ignore */ }
    var found = list.filter(function (u) { return u.id === id; })[0];
    /* Session ouverte sans identifiant : on prend la gérante par defaut. */
    return found || list[0] || null;
  };

  /* Premier nom, pour la salutation. */
  KD.firstName = function () {
    var u = KD.currentUser();
    return u ? String(u.name || '').trim().split(/\s+/)[0] : '';
  };

  /* Identifiants acceptes : nom, telephone ou id interne. */
  KD.matchUser = function (identifier) {
    var q = String(identifier || '').trim().toLowerCase();
    if (!q) return null;
    var digits = q.replace(/[^\d]/g, '');
    return KD.getUsers().filter(function (u) {
      return u.active !== false &&
        (u.name.toLowerCase() === q ||
         String(u.phone || '').toLowerCase() === q ||
         (digits && String(u.phone || '').replace(/[^\d]/g, '').endsWith(digits)));
    })[0] || null;
  };

  /* Verifie identifiant + mot de passe. Retourne l'utilisateur ou null. */
  KD.authenticate = function (identifier, password) {
    var u = KD.matchUser(identifier);
    if (!u) return null;
    if (String(u.password || '') !== String(password || '')) return null;
    return u;
  };

  KD.updateUser = function (id, patch) {
    var list = KD.getUsers();
    var found = list.filter(function (u) { return u.id === id; })[0];
    if (!found) return false;
    Object.keys(patch).forEach(function (k) { found[k] = patch[k]; });
    return KD.saveUsers(list);
  };

  /* ------------------------------------------------------------ produits
     Le stock affiche ces produits ; les modifier ici met a jour la liste
     partout dans l'application, y compris apres rechargement. */
  var PRODUCTS_KEY = 'kandake.products';

  KD.PRODUCT_CATS = ['Beauty', 'Art'];

  KD.PRODUCT_STATUS = {
    'En stock': { cls: 'bg-success-container text-success', bar: 'bg-success-container' },
    'Faible': { cls: 'bg-warning-container text-warning', bar: 'bg-warning-container' },
    'Critique': { cls: 'bg-error-container text-error', bar: 'bg-error-container' },
    'Rupture': { cls: 'bg-surface-variant text-on-surface-variant', bar: 'bg-surface-variant' }
  };

  KD.defaultProducts = function () {
    return [
      { id: 'p1', name: 'Lace Frontal 22" HD', sku: 'KDK-P-0012', cat: 'Beauty', price: 420, stock: 3, max: 25, status: 'Critique', icon: 'face_retouching_natural' },
      { id: 'p2', name: 'Mèches ondulées prémium', sku: 'KDK-P-0031', cat: 'Beauty', price: 95, stock: 24, max: 30, status: 'En stock', icon: 'waves' },
      { id: 'p3', name: 'Raw Hair Temple Inde', sku: 'KDK-P-0007', cat: 'Beauty', price: 1250, stock: 0, max: 30, status: 'Rupture', icon: 'content_cut' },
      { id: 'p4', name: 'Wig cap lace × 4', sku: 'KDK-P-0044', cat: 'Beauty', price: 60, stock: 8, max: 28, status: 'Faible', icon: 'layers' },
      { id: 'p5', name: 'Statuette bronze Dogon', sku: 'KDK-A-0018', cat: 'Art', price: 320, stock: 5, max: 28, status: 'Faible', icon: 'account_balance' },
      { id: 'p6', name: 'Masque africain ancien', sku: 'KDK-A-0009', cat: 'Art', price: 780, stock: 2, max: 25, status: 'Critique', icon: 'theater_comedy' },
      { id: 'p7', name: 'Vase bronze impérial', sku: 'KDK-A-0025', cat: 'Art', price: 540, stock: 11, max: 25, status: 'En stock', icon: 'chalice' },
      { id: 'p8', name: 'Sérum capillaire kératine', sku: 'KDK-S-0014', cat: 'Beauty', price: 35, stock: 46, max: 50, status: 'En stock', icon: 'spa' }
    ];
  };

  /* Le catalogue ne connait que deux univers : Beauty (cheveux) et Art
     (decoration / objets). Les produits enregistres avant ce passage portent
     encore les anciennes categories ("Perruques & Soins", "Art Royal & Objets",
     "Accessoires"...) : sans cette relecture, aucun d'eux ne tomberait sous
     les filtres Beauty / Art qui pilotent la liste du stock. La relecture est
     idempotente : un produit deja conforme passe tel quel. */
  function veriteCategorie(p) {
    if (!p) return 'Beauty';
    if (p.cat === 'Beauty' || p.cat === 'Art') return p.cat;
    var cat = ' ' + String(p.cat || '').toLowerCase() + ' ';
    var nom = ' ' + String(p.name || '').toLowerCase() + ' ';
    if (/art royal|objets?/.test(cat)) return 'Art';
    if (/perruque|soins?|beauty|mèche|meche|cheveux/.test(cat)) return 'Beauty';
    /* Accessoires ou categorie inconnue : on tranche d'apres le nom. */
    if (/vase|masque|statuette|sculpture|bronze|tableau|figurine|poterie|décor|decor|objet/.test(nom)) return 'Art';
    if (/mèche|meche|cheveux|hair|wig|lace|perruque|capillaire|sérum|serum|kératine|keratine|extension|soin/.test(nom)) return 'Beauty';
    return 'Beauty';
  }

  KD.getProducts = function () {
    var list;
    try {
      var raw = window.localStorage.getItem(PRODUCTS_KEY);
      if (raw) list = JSON.parse(raw);
    } catch (e) { list = null; }
    if (!Array.isArray(list)) list = KD.defaultProducts();
    list.forEach(function (p) { if (p && typeof p === 'object') p.cat = veriteCategorie(p); });
    return list;
  };

  KD.saveProducts = function (list) {
    try {
      window.localStorage.setItem(PRODUCTS_KEY, JSON.stringify(list));
      document.dispatchEvent(new CustomEvent('kd:products'));
      return true;
    } catch (e) {
      return false;
    }
  };

  KD.getProduct = function (id) {
    return KD.getProducts().filter(function (p) { return p.id === id; })[0] || null;
  };

  KD.updateProduct = function (id, patch) {
    var list = KD.getProducts();
    var found = list.filter(function (p) { return p.id === id; })[0];
    if (!found) return false;
    Object.keys(patch).forEach(function (k) { found[k] = patch[k]; });
    return KD.saveProducts(list);
  };

  KD.addProduct = function (data) {
    var list = KD.getProducts();
    var id = 'p' + Date.now();
    list.unshift({
      id: id, sku: '', cat: KD.PRODUCT_CATS[0], price: 0,
      stock: 0, max: 10, status: 'En stock', icon: 'inventory_2',
      name: 'Nouveau produit'
    });
    Object.keys(data || {}).forEach(function (k) { list[0][k] = data[k]; });
    KD.saveProducts(list);
    return list[0];
  };

  KD.removeProduct = function (id) {
    var avant = KD.getProducts();
    var apres = avant.filter(function (p) { return p.id !== id; });
    if (apres.length === avant.length) return false;
    return KD.saveProducts(apres);
  };

  KD.resetProducts = function () {
    try { window.localStorage.removeItem(PRODUCTS_KEY); } catch (e) { /* ignore */ }
  };

  /* ------------------------------------------------------- devises & taux
     Le catalogue, les stocks et le solde de trésorerie sont en dollars (USD).
     Le taux est modifiable dans les réglages et mémorisé sur l'appareil ; il
     est lu à chaque conversion pour qu'un changement s'applique immédiatement. */
  var FX_KEY = 'kandake.fx_rate';
  var FX_DEFAULT = 2300; // 1 USD = 2 300 FC
  var FX_MIN = 1;
  var FX_MAX = 100000;

  KD.CURRENCIES = { USD: { symbol: '$', label: 'USD' }, CDF: { symbol: 'FC', label: 'FC' } };

  /* Le stockage peut être refusé (navigation privée, cookies bloqués) :
     on retombe alors sur le taux par défaut sans casser l'application. */
  KD.getFxRate = function () {
    try {
      var raw = window.localStorage.getItem(FX_KEY);
      if (raw === null) return FX_DEFAULT;
      var n = parseFloat(raw);
      return isFinite(n) && n >= FX_MIN && n <= FX_MAX ? n : FX_DEFAULT;
    } catch (e) {
      return FX_DEFAULT;
    }
  };

  /* Renvoie le taux retenu, ou null si la saisie est refusée. */
  KD.setFxRate = function (value) {
    var n = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.').trim());
    if (!isFinite(n) || n < FX_MIN || n > FX_MAX) return null;
    try {
      window.localStorage.setItem(FX_KEY, String(n));
    } catch (e) {
      /* valeur refusée par le navigateur : on ne pretend pas avoir memorise */
    }
    return n;
  };

  KD.resetFxRate = function () {
    try { window.localStorage.removeItem(FX_KEY); } catch (e) { /* ignore */ }
    return FX_DEFAULT;
  };

  KD.convert = function (amountUsd, currency) {
    return currency === 'CDF' ? amountUsd * KD.getFxRate() : amountUsd;
  };

  /* Separateur de milliers : espace fine insecable (U+202F), convention francaise.
     On la normalise explicitement car toLocaleString ne renvoie pas la meme
     insécable selon la version d'ICU / du navigateur. */
  function group(n) {
    return Math.round(n).toLocaleString('fr-FR').replace(/[\s   ]/g, ' ');
  }

  /* Montant formate dans la devise demandee (par defaut : USD). */
  KD.money = function (amountUsd, currency) {
    var cur = currency || 'USD';
    var text = group(KD.convert(amountUsd, cur));
    return cur === 'CDF' ? text + ' FC' : '$' + text;
  };

  /* Taux affiche en clair : "1 $ = 2 300 FC". */
  KD.fxLabel = function () {
    return '1 $ = ' + group(KD.getFxRate()) + ' FC';
  };

  /* ------------------------------------------------------------------ toast */
  var toastTimer = null;

  KD.toast = function (message, icon) {
    /* Les vues finances et reglages fournissent leur propre #toast ; partout
       ailleurs on emploie le modele de secours #kd-toast. Il faut chercher les
       deux : sans cela chaque notification en cree un nouveau, et le
       clearTimeout ci-dessous annule la fermeture du precedent, qui reste
       alors fige a l'ecran pour toujours. */
    var el = document.getElementById('toast') || document.getElementById('kd-toast');
    var label = document.getElementById('toast-msg') || document.getElementById('toast-text');

    if (!el) {
      el = document.createElement('div');
      el.id = 'kd-toast';
      el.className = 'px-4 py-2 rounded-full bg-primary text-on-primary font-label-md text-label-md shadow-xl flex items-center gap-2';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      el.innerHTML =
        '<span class="material-symbols-outlined text-secondary-fixed text-[18px]">' +
        (icon || 'check_circle') +
        '</span><span></span>';
      document.body.appendChild(el);
      label = el.lastElementChild;
    }

    if (label) label.textContent = message;

    if (el.id === 'kd-toast') {
      el.setAttribute('data-open', 'true');
    } else {
      el.classList.remove('opacity-0', 'pointer-events-none');
      el.classList.add('opacity-100');
    }

    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      if (el.id === 'kd-toast') {
        el.setAttribute('data-open', 'false');
      } else {
        el.classList.add('opacity-0', 'pointer-events-none');
        el.classList.remove('opacity-100');
      }
    }, 2400);
  };

  /* ------------------------------------------------- bottom nav + chrome */
  /* KD.setRoute() est appelé par le routeur après chaque navigation : il n'a
     plus qu'à refléter l'onglet actif et le titre dans le header. */
  KD.setRoute = function (name) {
    var route = KD.ROUTES && KD.ROUTES[name];
    if (!route) return;

    document.querySelectorAll('.nav-link[data-path]').forEach(function (link) {
      if (link.getAttribute('data-path') === route.path) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });

var title = document.getElementById('page-title');
    if (title) title.textContent = route.label;
    document.title = route.label + ' · Kandake Gestion';

    var desc = document.querySelector('meta[name="description"]');
    if (desc && route.desc) desc.setAttribute('content', route.desc);

    /* Une vue "bare" (page de connexion) occupe tout l'ecran : on masque la
       chrome du shell, sinon l'entete et la barre du bas restent visibles. */
    document.body.classList.toggle('is-bare', !!route.bare);
  };

  /* ------------------------------------------------------ network indicator */
  KD.mountNetworkBanner = function () {
    if (document.getElementById('net-banner')) return;

    var banner = document.createElement('div');
    banner.id = 'net-banner';
    banner.innerHTML = '<span>Mode hors-ligne \u00b7 donn\u00e9es locales</span>';
    document.body.appendChild(banner);

    var paint = function () {
      banner.setAttribute('data-state', navigator.onLine ? 'online' : 'offline');
    };
    window.addEventListener('online', function () {
      paint();
      KD.toast('Connexion r\u00e9tablie');
    });
    window.addEventListener('offline', function () {
      paint();
      KD.toast('Mode hors-ligne actif', 'cloud_off');
    });
    paint();
  };

  /* ------------------------------------------------- install / update flows */
  /* L'application s'installe via le menu du navigateur (le manifesto reste
     declare, le navigateur propose alors l'installation). */

  function mountUpdateBar(onReload) {
    if (document.getElementById('pwa-prompt')) return;
    var box = document.createElement('div');
    box.id = 'pwa-prompt';
    box.setAttribute('data-open', 'true');
    box.className =
      'flex items-center gap-2 p-3 rounded-xl bg-primary text-on-primary shadow-xl';
    box.innerHTML =
      '<span class="material-symbols-outlined text-secondary-fixed text-[20px] shrink-0">published_with_changes</span>' +
      '<span class="font-body-sm text-[12px] flex-1 min-w-0">Mise \u00e0 jour disponible</span>' +
      '<button type="button" class="shrink-0 px-3 h-8 rounded-md bg-secondary-container text-on-secondary-container font-label-md text-label-md">Actualiser</button>';
    box.querySelector('button').addEventListener('click', onReload);
    document.body.appendChild(box);
  }

  /* ---------------------------------------------------- service worker boot */
  var swReg = null;

  /* Interroge le serveur : si une version plus recente du shell existe,
     l'ecouteur "updatefound" deja installe plus haut la libere et recharge.
     Resout toujours, jamais rejete : un tirage sans reseau doit se terminer
     proprement. */
  KD.checkUpdate = function () {
    if (!swReg || typeof swReg.update !== 'function') return Promise.resolve(false);
    return swReg.update().then(function () {
      var worker = swReg.waiting ||
        (swReg.installing && swReg.installing.state === 'installed' ? swReg.installing : null);
      if (worker && navigator.serviceWorker.controller) proposer(swReg, worker);
      return !!worker;
    })['catch'](function (err) {
      console.warn('[KD] verification de mise a jour impossible :', err && err.message);
      return false;
    });
  };

  KD.registerSW = function () {
    if (!('serviceWorker' in navigator)) return;
    // file:// has no SW support; skip silently so local previews still work.
    if (location.protocol === 'file:') return;

    navigator.serviceWorker.addEventListener('controllerchange', function () {
      /* Volontairement sans reload : la prise de controle du nouveau worker
         se produit aussi a la toute premiere installation et apres chaque
         "skip-waiting", donc un reload ici ecrasait une saisie en cours et
         doublait le rechargement demande par l'utilisateur. */
    });

    function proposer(reg, worker) {
      mountUpdateBar(function () {
        /* Sans skipWaiting le nouveau worker reste en attente et le
           rechargement resservirait l'ancien shell : on le libere
           d'abord, puis on recharge une seule fois, une fois qu'il
           pilote vraiment la page. */
        var waiting = reg.waiting || worker;
        if (!waiting) {
          location.reload();
          return;
        }
        var fait = false;
        var recharger = function () {
          if (fait) return;
          fait = true;
          location.reload();
        };
        navigator.serviceWorker.addEventListener('controllerchange', recharger);
        waiting.postMessage('skip-waiting');
        setTimeout(recharger, 1500);
      });
    }

    navigator.serviceWorker.register('sw.js').then(
      function (reg) {
        swReg = reg;
        reg.addEventListener('updatefound', function () {
          var incoming = reg.installing;
          if (!incoming) return;
          incoming.addEventListener('statechange', function () {
            if (incoming.state === 'installed' && navigator.serviceWorker.controller) {
              proposer(reg, incoming);
            }
          });
        });
        /* "updatefound" peut s'etre declenche avant que cette promesse soit
           resolue : un worker deja en attente passerait alors inaperçu et
           l'utilisateur resterait bloque sur l'ancien shell. */
        if (reg.waiting && navigator.serviceWorker.controller) proposer(reg, reg.waiting);
      },
      function (err) { console.warn('[KD] service worker non enregistr\u00e9 :', err); }
    );
  };

  /* ------------------------------------------------------------------- boot */
  function boot() {
    KD.mountNetworkBanner();

    window.addEventListener('appinstalled', function () {
      KD.toast('Kandake install\u00e9e sur l\u2019\u00e9cran d\u2019acc\u00e8s');
    });
    // NB : le routeur (js/router.js) se démarre tout seul, sans dépendre de
    // l'ordre de chargement des deux scripts.
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* L'enregistrement n'a rien a attendre des images ou des polices : sans
     ce delai, une ressource externe lente empechait l'evenement "load" de se
     produire et l'application tournait sans service worker, donc hors ligne
     et incapable de proposer les mises a jour. */
  if (document.readyState === 'complete') {
    KD.registerSW();
  } else {
    window.addEventListener('load', KD.registerSW);
    setTimeout(function () {
      if (document.readyState === 'complete') return;
      KD.registerSW();
    }, 3000);
  }
})();
/* Masque la pastille de notifications en douceur après un court délai. */
(function () {
  'use strict';
  function hideBadge() {
    var b = document.getElementById('notif-badge');
    if (!b) return;
    setTimeout(function () {
      b.classList.add('opacity-0');
      setTimeout(function () {
        b.style.display = 'none';
      }, 300);
    }, 4500);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hideBadge);
  } else {
    hideBadge();
  }
})();
