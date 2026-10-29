/* Kandake Gestion - routeur applicatif.
 *
 * Le shell (index.html) ne contient que le header, le conteneur de vue et la nav.
 * Chaque onglet charge son fragment HTML puis branche sa logique : aucune page
 * n'est jamais rechargée, Tailwind n'est donc compilé qu'une seule fois.
 */
(function () {
  'use strict';

  var KD = window.KD || (window.KD = {});

  /* ------------------------------------------------------------- routes -- */
  KD.ROUTES = {
    accueil:  { file: 'views/accueil.html',  script: 'js/views/accueil.js',  label: 'Accueil',  icon: 'grid_view',            path: 'dashboard',
                desc: 'Tableau de bord de la boutique Kandake : ventes du jour, panier moyen, alertes de stock et journal de caisse.' },
    stocks:   { file: 'views/stocks.html',   script: 'js/views/stocks.js',   label: 'Stocks',   icon: 'inventory_2',         path: 'stocks',
                desc: 'Inventaire, niveaux de stock et alertes d\u2019approvisionnement de la boutique Kandake.' },
    caisse:   { file: 'views/caisse.html',   script: 'js/views/caisse.js',   label: 'Caisse',   icon: 'point_of_sale',       path: 'pos',
                desc: 'Point de vente Kandake : catalogue, panier, r\u00e8glement et encaissement instantan\u00e9.' },
    ventes:   { file: 'views/ventes.html',   script: 'js/views/ventes.js',   label: 'Ventes',   icon: 'receipt_long',        path: 'orders',
                desc: 'Journal des commandes, suivi des encaissements et export des ventes de la boutique Kandake.' },
    finances: { file: 'views/finances.html', script: 'js/views/finances.js', label: 'Finances', icon: 'account_balance_wallet', path: 'finance',
                desc: 'Tableau de gestion, tr\u00e9sorerie et grand livre comptable de Kandake Maison &amp; Beaut\u00e9.' },
    reglages: { file: 'views/reglages.html', script: 'js/views/reglages.js', label: 'R\u00e9glages', icon: 'settings',            path: 'settings',
                desc: 'Configuration de la boutique, de la caisse, de l\u2019\u00e9quipe et de la PWA Kandake.' },
    /* Vue hors navigation : la connexion occupe tout l'ecran (bare) et ne
       figure ni dans la barre du bas ni dans l'ordre de prechargement. */
    connexion: { file: 'views/connexion.html', script: 'js/views/connexion.js', label: 'Connexion', icon: 'login', path: 'login',
                bare: true, hidden: true,
                desc: 'Acc\u00e8s \u00e0 la gestion de la boutique Kandake Maison &amp; Beaut\u00e9.' }
  };

  var DEFAULT_ROUTE = 'accueil';
  var AUTH_ROUTE = 'connexion';
  var ORDER = Object.keys(KD.ROUTES).filter(function (k) { return !KD.ROUTES[k].hidden; });

  var root      = null;   // #view-root
  var loaded    = {};     // vue -> module de logique déjà chargé
  var current   = null;   // vue actuellement affichée
  var pending   = null;   // vue en cours de chargement
  var inflight  = null;   // numéro de requête, pour ignorer les réponses obsolètes
  var prefetched = {};

  /* ------------------------------------------------------------ helpers -- */
  function routeFromHash() {
    var name = (location.hash || '').replace(/^#\/?/, '').split('?')[0];
    return KD.ROUTES[name] ? name : null;
  }

  function labelFor(name) {
    return KD.ROUTES[name] ? KD.ROUTES[name].label : 'Kandake';
  }

  /* Charge le module de logique d'une vue une seule fois.
     Le délai évite qu'un script qui ne répond jamais bloque l'affichage. */
  function loadScript(src) {
    if (loaded[src]) return loaded[src];
    loaded[src] = new Promise(function (resolve, reject) {
      var settled = false;
      var done = function (fn, arg) {
        if (settled) return;
        settled = true;
        fn(arg);
      };
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { done(resolve); };
      s.onerror = function () { done(reject, new Error('script indisponible : ' + src)); };
      document.head.appendChild(s);
      setTimeout(function () { done(resolve); }, 3000);
    });
    return loaded[src];
  }

  /* Barre de progression : n'apparaît que si le chargement dure vraiment. */
  var barTimer = null;
  function progress(on) {
    var bar = document.getElementById('route-bar');
    if (!bar) return;
    clearTimeout(barTimer);
    if (on) {
      barTimer = setTimeout(function () {
        bar.setAttribute('data-show', 'true');
      }, 120);
    } else {
      bar.setAttribute('data-show', 'false');
    }
  }

  function renderFailure(name, err) {
    var retry = '<button type="button" class="mt-4 h-11 px-5 rounded-lg bg-primary text-on-primary font-label-md text-label-md" data-retry>R\u00e9essayer</button>';
    root.innerHTML =
      '<div class="flex flex-col items-center justify-center text-center gap-2 px-margin py-24">' +
        '<span class="material-symbols-outlined text-[40px] text-outline-variant">cloud_off</span>' +
        '<h2 class="font-headline-sm text-headline-sm text-primary">Vue indisponible</h2>' +
        '<p class="font-body-sm text-body-sm text-on-surface-variant max-w-xs">' +
          'La vue <strong>' + labelFor(name) + '</strong> n\'a pas pu \u00eatre charg\u00e9e. ' +
          'V\u00e9rifiez votre connexion ou r\u00e9installez l\'application.' +
        '</p>' + retry +
      '</div>';
    var btn = root.querySelector('[data-retry]');
    if (btn) btn.addEventListener('click', function () { go(name, true); });
    /* Le chrome doit rester cohérent même si la vue n'a pas chargé : sans
       ceci la connexion garderait une barre du bas visible dont chaque tap
       renverrait silencieusement vers la connexion. */
    if (name !== current) { root.setAttribute('data-view', name); current = name; }
    KD.setRoute(name);
    console.warn('[router]', err);
  }

  /* Attentes de rendu : KD.reload() doit savoir quand la vue est prete. */
  var attentes = [];

  function flushAttentes(nom, err) {
    if (!attentes.length) return;
    var liste = attentes;
    attentes = [];
    liste.forEach(function (cb) {
      try { cb(nom, err); } catch (e) { console.warn('[router] callback de rendu :', e); }
    });
  }

  /* --------------------------------------------------------- navigation -- */
  function go(name, force, done) {
    if (!KD.ROUTES[name]) name = DEFAULT_ROUTE;
    if (name === current && !force) { if (done) done(name); return; }

    if (location.hash !== '#/' + name) {
      // pushState évite de re-déclencher hashchange dans certains navigateurs ;
      // on met à jour le hash nous-mêmes puis on rend.
      if (history.pushState) history.pushState({ view: name }, '', '#/' + name);
      else location.hash = '#/' + name;
      if (!history.pushState) { render(name, done, force); return; } // le hashchange fera le rendu
    }
    render(name, done, force);
  }

  /* Applique le chrome (barre du bas, header) dès la décision de route, avant
     le fetch : sur mobile le réseau est lent, et une barre du bas visible mais
     inerte est exactement le symptôme "les clics ne marchent pas". */
  function preChrome(name) {
    var route = KD.ROUTES[name];
    if (!route) return;
    document.body.classList.toggle('is-bare', !!route.bare);
  }

  function render(name, done, force) {
    var route = KD.ROUTES[name];
    if (!route) { if (done) done(name, new Error('route inconnue : ' + name)); return; }
    /* current n'est écrit qu'une fois le rendu terminé : sans cette garde, un
       double clic ou un pushState suivi d'un hashchange relançait deux rendus
       (et deux requêtes) pour la même vue. Un rendu forcé (actualisation)
       fait exception : c'est justement pour rejouer une vue déjà affichée,
       y compris après un échec. */
    if (name === pending) {
      if (done) attentes.push(done);   /* rendu en vol : on s'y raccroche */
      return;
    }
    if (name === current && !force) {
      if (done) done(name);
      return;
    }

    preChrome(name);
    pending = name;
    var token = ++inflight;
    progress(true);

    Promise.all([
      fetch(route.file, { credentials: 'same-origin' }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status + ' sur ' + route.file);
        return r.text();
      }),
      loadScript(route.script).catch(function (e) {
        console.warn('[router] logique de vue absente :', e.message);
      })
    ])
      .then(function (res) {
        // une navigation plus récente a pris le relais : on jette ce résultat
        if (token !== inflight) { flushAttentes(current); return; }

        var view = KD.views && KD.views[name];
        if (current && KD.views[current] && KD.views[current].unmount) {
          try { KD.views[current].unmount(); } catch (e) { console.warn(e); }
        }

        root.innerHTML = res[0];
        current = name;
        pending = null;

        if (view && view.mount) {
          try { view.mount(root); } catch (e) { console.error('[router] mount() :', e); }
        }

        KD.setRoute(name);
        souvenirRoute(name);
        progress(false);

        root.setAttribute('data-view', name);
        root.classList.remove('view-enter');
        // force un reflow pour rejouer l'animation a chaque navigation
        void root.offsetWidth;
        root.classList.add('view-enter');

        window.scrollTo(0, 0);
        prefetchRest(name);
        if (done) done(name);
        flushAttentes(name);
      })
      .catch(function (err) {
        if (token !== inflight) {
          if (done) done(current, err);
          flushAttentes(current, err);
          return;
        }
        pending = null;
        progress(false);
        renderFailure(name, err);
        if (done) done(name, err);
        flushAttentes(name, err);
      });
  }

  /* Préchauffe les autres vues quand le navigateur est idle : la navigation
     suivante devient instantanée, et le service worker les met en cache. */
  function prefetchRest(except) {
    var run = function () {
      ORDER.forEach(function (name) {
        if (name === except || prefetched[name]) return;
        prefetched[name] = true;
        fetch(KD.ROUTES[name].file).catch(function () { prefetched[name] = false; });
        loadScript(KD.ROUTES[name].script).catch(function () {});
      });
    };
    if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 2500 });
    else setTimeout(run, 1200);
  }

  /* ------------------------------------------------------------- events -- */
  var ROUTE_KEY = 'kandake.route';

  /* Memoire du dernier onglet. Un rechargement (ou un redemarrage de la PWA
     depuis l'ecran d'accueil) ouvre parfois l'app sans hash dans l'URL : au
     lieu de retomber systematiquement sur l'accueil, on ressert la page ou
     l'utilisateur se trouvait. La connexion (route bare) n'est pas memorisee. */
  function souvenirRoute(name) {
    if (!name) return;
    var route = KD.ROUTES[name];
    if (!route || route.bare) return;
    try { window.localStorage.setItem(ROUTE_KEY, name); } catch (e) {}
  }
  function dernierRoute() {
    try { return window.localStorage.getItem(ROUTE_KEY) || null; } catch (e) { return null; }
  }

  function onRouteChange() {
    var requested = routeFromHash();
    if (!requested) {
      var fallback = current || DEFAULT_ROUTE;
      if (history.replaceState) history.replaceState(null, '', '#/' + fallback);
      return;
    }
    var name = KD.guard(requested);
    /* Une route bloquee est remplacee dans l'URL plutot que rendue. */
    if (name !== requested) {
      if (history.replaceState) history.replaceState(null, '', '#/' + name);
      return;
    }
    if (name !== current) render(name);
  }

  /* Redirige vers la connexion si la session est fermee. Retourne le nom de
     route reellement affiche. */
  KD.guard = function (name) {
    if (!KD.ROUTES[name]) return null;
    var open = KD.isAuthenticated();
    if (!open && name !== AUTH_ROUTE) return AUTH_ROUTE;
    if (open && name === AUTH_ROUTE) return DEFAULT_ROUTE;
    return name;
  };

  /* Re-rend la vue et resout quand elle est prete. C'est le geste
     "actualiser" qui s'en sert. Pendant une navigation, c'est la vue en cours
     de rendu qu'il faut recharger : current est encore l'ancienne, et
     rafraichir celle-ci ramenerait l'utilisateur en arriere. */
  KD.reload = function (name) {
    return new Promise(function (resolve) {
      var cible = name || pending || current;
      go(cible, true, function (nom, err) { resolve({ vue: nom, erreur: err || null }); });
    });
  };

  KD.go = function (name) {
    var target = KD.guard(name);
    if (!target) return;
    go(target, target === name);
  };

  KD.startRouter = function () {
    root = document.getElementById('view-root');
    if (!root) { console.error('[router] #view-root introuvable'); return; }

    /* Point d'entree : une session fermee impose la page de connexion, et y
       rester tant qu'on ne s'est pas connecte. */
    var requested = routeFromHash();
    var start = KD.guard(requested) || KD.guard(dernierRoute()) || DEFAULT_ROUTE;
    if (start !== requested || !requested) {
      if (history.replaceState) history.replaceState({ view: start }, '', '#/' + start);
    }
    render(start);

    window.addEventListener('hashchange', onRouteChange);
    window.addEventListener('popstate', onRouteChange);

    /* Tous les liens internes passent par le routeur, y compris la barre du
       bas. S'appuyer sur le hashchange natif pour la barre du bas n'était pas
       fiable sur mobile : selon le navigateur, l'événement arrive tard, ou pas
       du tout pour un lien de même document. En passant par go(), le rendu est
       immédiat et l'URL mise à jour par pushState. */
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#/"]');
      if (!a) return;
      var target = a.getAttribute('href').replace(/^#\//, '');
      if (!KD.ROUTES[target]) return;   // "#/" seul : on laisse le hashchange trancher
      e.preventDefault();
      /* La garde de session s'applique aussi aux liens de la barre du bas :
         un tap sur Stocks hors session doit ramener sur la connexion. */
      var allowed = KD.guard(target);
      if (!allowed) return;
      go(allowed, allowed === target);
    });
  };

  if (!window.tailwind) {
    console.warn('[router] Tailwind Play CDN absent : le style pourrait ne pas se compiler.');
  }

  /* Démarrage autonome : ce fichier ne dépend pas de l'ordre de chargement
     avec js/app.js, quel que soit l'état du document à son évaluation. */
  function autostart() {
    if (document.getElementById('view-root')) KD.startRouter();
    else console.error('[router] #view-root introuvable dans le shell');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autostart);
  } else {
    autostart();
  }
})();