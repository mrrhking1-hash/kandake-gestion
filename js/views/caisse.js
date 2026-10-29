/* Vue caisse : logique appelee par KD.views.caisse.mount() apres injection du fragment. */
(function () {
  'use strict';
  KD.views = KD.views || {};

  /* Le fond doit etre deverrouille meme si l'onglet change alors que le
     panier est ouvert, sinon l'application reste figee. */
  function delogerFond(y) {
    document.body.classList.remove('kd-sheet-open', 'kd-body-frozen');
    document.body.style.top = '';
    var d = document.getElementById('cart-drawer');
    if (d) d.style.top = '';
if (!y) return;
    /* Meme raison que dans la vue stocks : tant que le body est sorti du flux
       le document n'a pas de hauteur defilable, le replacement attend donc la
       frame suivante. */
    var replacer = function () { window.scrollTo(0, y); };
    if (window.requestAnimationFrame) window.requestAnimationFrame(replacer);
    else setTimeout(replacer, 0);
  }

  KD.views.caisse = {
    title: 'Caisse',
    unmount: function () {
      delogerFond(document.body.classList.contains('kd-body-frozen') ? -(parseInt(document.body.style.top, 10) || 0) : 0);
    },
    mount: function () {
      var grid = document.getElementById('pos-grid');
      var CATALOGUE = Array.prototype.slice.call(grid.children);

      var posSearch = document.getElementById('pos-search');
      var posEmpty = document.getElementById('pos-empty');
      var posCat = 'all';

      function applyFilters() {
        var q = posSearch.value.trim().toLowerCase();
        var shown = 0;
        CATALOGUE.forEach(function (t) {
          var okText = !q || t.getAttribute('data-name').toLowerCase().indexOf(q) !== -1;
          var okCat = posCat === 'all' || t.getAttribute('data-cat').indexOf(posCat) !== -1;
          t.style.display = okText && okCat ? '' : 'none';
          if (okText && okCat) shown++;
        });
        posEmpty.classList.toggle('hidden', shown !== 0);
      }

      posSearch.addEventListener('input', applyFilters);
      posSearch.addEventListener('input', sauverEtat);

      var chips = Array.prototype.slice.call(document.querySelectorAll('.chip'));
      chips.forEach(function (chip) {
        chip.addEventListener('click', function () {
          posCat = chip.getAttribute('data-filter');
          colorerSel(chips, 'data-filter', posCat);
          applyFilters();
          sauverEtat();
        });
      });

      /* Sélecteur Beauty / Art */
      var shopBtns = Array.prototype.slice.call(document.querySelectorAll('.shop-btn'));
      shopBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          shopActif = btn.getAttribute('data-shop');
          colorerSel(shopBtns, 'data-shop', shopActif);
          sauverEtat();
        });
      });

      /* Pastilles d'opérations */
      var opBtns = Array.prototype.slice.call(document.querySelectorAll('.op-btn'));
      opBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          opActif = btn.getAttribute('data-op');
          colorerSel(opBtns, 'data-op', opActif);
          sauverEtat();
        });
      });

      /* ------------------------------------------------------------ panier */
      var cart = []; /* { pid, name, price, qty } */

      var cartBar = document.getElementById('cart-bar');
      var barCount = document.getElementById('bar-count');
      var barTotal = document.getElementById('bar-total');
      var drawer = document.getElementById('cart-drawer');
      var lines = document.getElementById('cart-lines');
      var emptyMsg = document.getElementById('cart-empty');
      var subTotal = document.getElementById('sub-total');
      var cartTotal = document.getElementById('cart-total');
      var fxNote = document.getElementById('fx-note');
      var checkout = document.getElementById('checkout');

      /* Le catalogue est en dollars ; le client choisit la devise dans
         laquelle la vente est encaissée. Le taux vient de KD (réglages). */
      var currency = 'USD';

      /* Apres un rechargement la caisse renait de zero : on memorise ce que le
         caissier etait en train de faire (rayon, operation, filtre, devise et
         panier en cours) pour le retrouver exactement au meme endroit. */
      var shopActif = 'beauty';
      var opActif = 'vente';
      var actionActif = null;
      var ETAT_KEY = 'kandake.caisse-etat';
      function lireEtat() {
        try { return JSON.parse(window.localStorage.getItem(ETAT_KEY) || 'null'); } catch (e) { return null; }
      }
      function sauverEtat() {
        try {
          window.localStorage.setItem(ETAT_KEY, JSON.stringify({
            cat: posCat, q: posSearch.value, cur: currency, cart: cart,
            shop: shopActif, op: opActif, action: actionActif
          }));
        } catch (e) {}
      }
      function colorerSel(btns, attr, val) {
        btns.forEach(function (b) {
          var actif = b.getAttribute(attr) === val;
          b.classList.toggle('bg-primary', actif);
          b.classList.toggle('text-on-primary', actif);
          b.classList.toggle('bg-surface-container', !actif);
          b.classList.toggle('text-on-surface-variant', !actif);
        });
      }
      function colorerCur(val) {
        curBtns.forEach(function (b) {
          var actif = b.getAttribute('data-cur') === val;
          b.classList.toggle('bg-primary', actif);
          b.classList.toggle('text-on-primary', actif);
          b.classList.toggle('text-on-surface-variant', !actif);
          b.setAttribute('aria-pressed', actif ? 'true' : 'false');
        });
      }
      function colorerAction(val) {
        actionBtns.forEach(function (b) {
          var actif = b.getAttribute('data-action') === val;
          b.classList.toggle('ring-2', actif);
          b.classList.toggle('ring-inset', actif);
          b.classList.toggle('ring-on-primary/70', actif);
        });
      }

      function money(n) {
        return KD.money(n, currency);
      }

      function count() {
        return cart.reduce(function (n, l) { return n + l.qty; }, 0);
      }

      function total() {
        return cart.reduce(function (n, l) { return n + l.price * l.qty; }, 0);
      }

      function renderCart() {
        var n = count();

        cartBar.classList.toggle('hidden', n === 0);
        barCount.textContent = n + (n > 1 ? ' articles' : ' article');
        barTotal.textContent = money(total());

        emptyMsg.classList.toggle('hidden', cart.length !== 0);
        lines.innerHTML = '';

        cart.forEach(function (l) {
          var row = document.createElement('div');
          row.className = 'flex items-center gap-2 p-2 rounded-lg bg-surface-container-low';
          row.setAttribute('data-line', l.pid);

          var name = document.createElement('span');
          name.className = 'flex-1 min-w-0 font-body-sm text-[12px] text-primary truncate';
          name.textContent = l.name;
          row.appendChild(name);

          var minus = document.createElement('button');
          minus.type = 'button';
          minus.className = 'qty-btn w-7 h-7 rounded-full bg-surface-container text-primary';
          minus.setAttribute('data-step', '-1');
          minus.textContent = '−';
          row.appendChild(minus);

          var qty = document.createElement('span');
          qty.className = 'qty w-6 text-center font-data-mono text-[12px] text-primary';
          qty.textContent = String(l.qty);
          row.appendChild(qty);

          var plus = document.createElement('button');
          plus.type = 'button';
          plus.className = 'qty-btn w-7 h-7 rounded-full bg-surface-container text-primary';
          plus.setAttribute('data-step', '1');
          plus.textContent = '+';
          row.appendChild(plus);

          var sum = document.createElement('span');
          sum.className = 'w-16 text-right font-data-mono text-[12px] text-primary font-bold';
          sum.setAttribute('data-line-total', l.pid);
          sum.textContent = money(l.price * l.qty);
          row.appendChild(sum);

          lines.appendChild(row);
        });

        subTotal.textContent = money(total());
        cartTotal.textContent = money(total());
        /* Le taux n'a de sens que si la vente est en francs congolais. */
        fxNote.textContent = KD.fxLabel();
        fxNote.classList.toggle('hidden', currency !== 'CDF');
        checkout.disabled = cart.length === 0;
        sauverEtat();
      }

      function add(pid, name, price) {
        var line = cart.filter(function (l) { return l.pid === pid; })[0];
        if (line) line.qty += 1;
        else cart.push({ pid: pid, name: name, price: price, qty: 1 });
        renderCart();
      }

      /* Clic sur une tuile du catalogue = ajout au ticket. */
      grid.addEventListener('click', function (e) {
        var tile = e.target.closest('[data-pid]');
        if (!tile) return;
        add(
          tile.getAttribute('data-pid'),
          tile.getAttribute('data-name'),
          parseInt(tile.getAttribute('data-price'), 10) || 0
        );
      });

      /* Quantités depuis le drawer. */
      lines.addEventListener('click', function (e) {
        var btn = e.target.closest('.qty-btn');
        if (!btn) return;
        var row = btn.closest('[data-line]');
        var line = cart.filter(function (l) { return l.pid === row.getAttribute('data-line'); })[0];
        if (!line) return;
        line.qty += parseInt(btn.getAttribute('data-step'), 10);
        if (line.qty <= 0) cart = cart.filter(function (l) { return l.pid !== line.pid; });
        renderCart();
      });

      /* Le tiroir du panier est une feuille modale : onrete la barre du bas et on
         gele le fond, sinon le bouton d'encaissement passe sous la barre et
         le geste fait defiler la page derriere. */
      var panierY = 0;

      function setDrawer(open) {
        drawer.classList.toggle('hidden', !open);
        drawer.classList.toggle('flex', open);
        if (open) {
          if (!panierY) panierY = window.scrollY || window.pageYOffset || 0;
          document.body.style.top = -panierY + 'px';
          /* Meme raison que dans la vue stocks : le body gele devient le point
             de depart du tiroir fixe, qui doit etre redescendu d'autant. */
          drawer.style.top = panierY + 'px';
          document.body.classList.add('kd-sheet-open', 'kd-body-frozen');
        } else {
          delogerFond(panierY);
          panierY = 0;
        }
      }

      document.getElementById('open-cart').addEventListener('click', function () { setDrawer(true); });
      document.getElementById('close-cart').addEventListener('click', function () { setDrawer(false); });

      /* Boutons d'action : entrée/sortie d'argent */
      var actionBtns = Array.prototype.slice.call(document.querySelectorAll('.pay-action-btn'));
      actionBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          actionActif = btn.getAttribute('data-action');
          colorerAction(actionActif);
          var action = actionActif;
          if (typeof KD.toast === 'function') {
            KD.toast(action === 'entree' ? "Entrée d'argent" : "Sortie d'argent", 'sync');
          }
          sauverEtat();
        });
      });

      /* Devise d'encaissement : le ticket s'affiche dans la devise choisie. */
      var curBtns = Array.prototype.slice.call(document.querySelectorAll('.cur-btn'));
      curBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          currency = btn.getAttribute('data-cur');
          colorerCur(currency);
          renderCart();
        });
      });

      checkout.addEventListener('click', function () {
        if (!cart.length) return;
        var n = count();
        var amount = money(total()) + (currency === 'CDF' ? ' ($' + total().toLocaleString('fr-FR') + ')' : '');
        if (typeof KD.toast === 'function') {
          KD.toast(n + (n > 1 ? ' articles encaissés' : ' article encaissé') + ' · ' + amount);
        }
        cart = [];
        renderCart();
        setDrawer(false);
      });

      /* Reprise apres rechargement : la caisse retrouve le rayon, l'operation,
         le filtre, la devise et le panier tels qu'ils etaient. */
      var etat = lireEtat();
      if (etat && typeof etat === 'object') {
        if (chips.some(function (c) { return c.getAttribute('data-filter') === etat.cat; })) {
          posCat = etat.cat;
          colorerSel(chips, 'data-filter', posCat);
        }
        if (typeof etat.q === 'string') posSearch.value = etat.q;
        if (curBtns.some(function (b) { return b.getAttribute('data-cur') === etat.cur; })) {
          currency = etat.cur;
          colorerCur(currency);
        }
        if (['beauty', 'art'].indexOf(etat.shop) !== -1) {
          shopActif = etat.shop;
          colorerSel(shopBtns, 'data-shop', shopActif);
        }
        if (['vente', 'entree', 'sortie'].indexOf(etat.op) !== -1) {
          opActif = etat.op;
          colorerSel(opBtns, 'data-op', opActif);
        }
        if (['entree', 'sortie'].indexOf(etat.action) !== -1) {
          actionActif = etat.action;
          colorerAction(actionActif);
        }
        if (Array.isArray(etat.cart)) {
          cart = etat.cart.filter(function (l) {
            return l && typeof l === 'object' && l.pid && l.name && l.qty > 0;
          });
        }
        applyFilters();
      }

      renderCart();
    }
  };
})();
