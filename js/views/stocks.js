/* Vue stocks : liste pilotee par les donnees, modifiable au clic sur un produit. */
(function () {
  'use strict';
  KD.views = KD.views || {};

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* Verrouillage du fond : Safari iOS fait defiler la page meme avec
     overflow:hidden sur body, donc on sort le body du flux en memorisant le
     decalage, puis on rend la page telle quelle a la fermeture. Ce geste vit
     hors de mount() : si l'onglet change alors que la feuille est ouverte, le
     verrou doit etre leve quand meme, sinon l'application reste figee. */
  var gelerY = 0;
  /* Les ecouteurs poses sur document vivent au dela de la vue : sans cela,
     chaque aller-retour sur la vue Stocks en ajoute un nouveau. */
  var nettoyer = null;

  function gelerFond() {
    var feuille = document.getElementById('editor');
    gelerY = window.scrollY || window.pageYOffset || 0;
    document.body.style.top = -gelerY + 'px';
    /* Le body sorti du flux devient le point de depart des elements fixes
       qu'il contient : la feuille, ancree en haut, remonterait de gelerY px et
       flotterait au milieu de l'ecran. On la redescend d'autant. */
    if (feuille) feuille.style.top = gelerY + 'px';
    document.body.classList.add('kd-sheet-open', 'sheet-no-scroll', 'kd-body-frozen');
  }

  function defaireFond() {
    var feuille = document.getElementById('editor');
    var y = gelerY;
    gelerY = 0;
    document.body.classList.remove('kd-sheet-open', 'sheet-no-scroll', 'kd-body-frozen');
    document.body.style.top = '';
    if (feuille) feuille.style.top = '';
    /* Le body sortait du flux : la hauteur du document n'est valide qu'apres
       un recalcul. Sans cette attente, scrollTo est borne par l'ancienne
       hauteur et la page remonte en haut au lieu de retrouver sa place. */
    if (!y) return;
    /* Le document n'a pas de hauteur defilable tant que le body est sorti du
       flux : le replacement doit donc attendre la frame suivante, sinon
       scrollTo reste borne a zero et la page remonte en haut. */
    var replacer = function () { window.scrollTo(0, y); };
    if (window.requestAnimationFrame) window.requestAnimationFrame(replacer);
    else setTimeout(replacer, 0);
  }

  KD.views.stocks = {
    title: 'Stocks',
    unmount: function () {
      if (nettoyer) { nettoyer(); nettoyer = null; }
      defaireFond();
    },
    mount: function () {
      var list = document.getElementById('list');
      var empty = document.getElementById('empty');
      var search = document.getElementById('search');
      var chips = Array.prototype.slice.call(document.querySelectorAll('.chip'));
      var activeCat = 'all';

      /* Apres un rechargement (pull-to-refresh), la vue est creee de zero :
         sans memoire, le filtre retomberait sur "Tous". On conserve la
         categorie choisie et la recherche pour revenir exactement au meme
         endroit du stock. */
      var FILTRE_KEY = 'kandake.stocks-filtre';
      function lireFiltre() {
        try { return JSON.parse(window.localStorage.getItem(FILTRE_KEY) || 'null'); }
        catch (e) { return null; }
      }
      function sauverFiltre() {
        try {
          window.localStorage.setItem(FILTRE_KEY, JSON.stringify({ cat: activeCat, q: search.value }));
        } catch (e) {}
      }
      function activeChip(cat) {
        chips.forEach(function (c) {
          var actif = c.getAttribute('data-filter') === cat;
          c.classList.toggle('bg-primary', actif);
          c.classList.toggle('text-on-primary', actif);
          c.classList.toggle('bg-surface-container', !actif);
          c.classList.toggle('text-on-surface-variant', !actif);
        });
      }

      var editor = document.getElementById('editor');
      var form = document.getElementById('ed-form');
      var fId = document.getElementById('ed-id');
      var fName = document.getElementById('ed-name');
      var fSku = document.getElementById('ed-sku');
      var fCat = document.getElementById('ed-cat');
      var fPrice = document.getElementById('ed-price');
      var fStock = document.getElementById('ed-stock');
      var fMax = document.getElementById('ed-max');
      var fStatus = document.getElementById('ed-status');
      var edError = document.getElementById('ed-error');
      var edErrorText = document.getElementById('ed-error-text');
      var saveText = document.getElementById('ed-save-text');

      /* Les listes deroulantes reprennent les valeurs autorisees. */
      fCat.innerHTML = KD.PRODUCT_CATS.map(function (c) {
        return '<option value="' + esc(c) + '">' + esc(c) + '</option>';
      }).join('');
      fStatus.innerHTML = Object.keys(KD.PRODUCT_STATUS).map(function (s) {
        return '<option value="' + esc(s) + '">' + esc(s) + '</option>';
      }).join('');

      function statusOf(p) {
        return KD.PRODUCT_STATUS[p.status] || KD.PRODUCT_STATUS['En stock'];
      }

      /* La carte est enveloppee : le conteneur porte les donnees de filtrage
         et reste immobile, l'article glisse au doigt et decouvre le bouton
         Supprimer, place derriere lui. */
      function card(p) {
        var st = statusOf(p);
        var ratio = p.max > 0 ? Math.min(100, Math.round((p.stock / p.max) * 100)) : 0;

        var wrap = document.createElement('div');
        wrap.className = 'rise kd-swipe rounded-xl overflow-hidden shadow-sm';
        wrap.setAttribute('data-id', p.id);
        wrap.setAttribute('data-name', (p.name + ' ' + (p.sku || '')).toLowerCase());
        wrap.setAttribute('data-cat', p.cat);

        var action = document.createElement('div');
        action.className = 'kd-swipe-act';
        action.innerHTML =
          '<button class="kd-swipe-del flex flex-col items-center justify-center gap-0.5 w-full h-full ' +
          'bg-error-container text-on-error-container active:scale-95 transition-transform" data-del="1" type="button" ' +
          'aria-label="Supprimer ' + esc(p.name) + '">' +
            '<span class="material-symbols-outlined text-[20px]">delete</span>' +
            '<span class="font-label-sm text-[11px]">Supprimer</span>' +
          '</button>';

        var el = document.createElement('article');
        el.className = 'kd-swipe-card flex items-center gap-3 p-3 bg-surface-container-lowest active:scale-[0.99] transition-transform';
        el.setAttribute('role', 'button');
        el.setAttribute('tabindex', '0');
        el.innerHTML =
          '<div class="w-11 h-11 rounded-lg bg-surface-container flex items-center justify-center shrink-0">' +
            '<span class="material-symbols-outlined text-[20px] text-secondary">' + esc(p.icon) + '</span>' +
          '</div>' +
          '<div class="flex-1 min-w-0">' +
            '<div class="flex items-center gap-2">' +
              '<h3 class="font-body-md text-body-md text-primary font-semibold truncate">' + esc(p.name) + '</h3>' +
              '<span class="shrink-0 px-1.5 py-0.5 rounded-full ' + st.cls + ' font-label-sm text-[9px] uppercase">' + esc(p.status) + '</span>' +
            '</div>' +
            '<p class="font-body-sm text-[11px] text-on-surface-variant truncate">' + esc(p.sku || 'Sans référence') + ' · ' + esc(p.cat) + '</p>' +
            '<div class="flex items-center gap-2 mt-1.5">' +
              '<div class="flex-1 h-1.5 rounded-full bg-surface-container overflow-hidden">' +
                '<div class="h-full rounded-full ' + st.bar + '" style="width: ' + ratio + '%"></div>' +
              '</div>' +
              '<span class="font-data-mono text-[11px] text-on-surface-variant shrink-0">' + p.stock + ' en stock</span>' +
            '</div>' +
          '</div>' +
          '<div class="flex flex-col items-end gap-1 shrink-0">' +
            '<span class="font-data-mono text-data-mono text-primary font-bold">' + KD.money(p.price) + '</span>' +
            '<div class="flex items-center gap-1">' +
              '<button class="qty-btn w-7 h-7 rounded-md bg-surface-container flex items-center justify-center text-on-surface active:scale-90" data-step="-1" type="button" aria-label="Retirer une unité de ' + esc(p.name) + '">' +
                '<span class="material-symbols-outlined text-[14px]">remove</span>' +
              '</button>' +
              '<span class="qty w-6 text-center font-data-mono text-[12px] text-primary">0</span>' +
              '<button class="qty-btn w-7 h-7 rounded-md bg-surface-container flex items-center justify-center text-on-surface active:scale-90" data-step="1" type="button" aria-label="Ajouter une unité de ' + esc(p.name) + '">' +
                '<span class="material-symbols-outlined text-[14px]">add</span>' +
              '</button>' +
            '</div>' +
          '</div>';

        wrap.appendChild(action);
        wrap.appendChild(el);
        return wrap;
      }

      function render() {
        list.innerHTML = '';
        carteOuverte = null;
        var produits = KD.getProducts();
        produits.forEach(function (p) { list.appendChild(card(p)); });
        /* Un inventaire vide n'est pas une recherche infructueuse : le message
           et l'icone changent selon ce qui a mis l'affichage a zero. */
        var vide = produits.length === 0;
        if (empty) {
          var icone = empty.querySelector('.material-symbols-outlined');
          var texte = empty.querySelector('p');
          if (icone) icone.textContent = vide ? 'inventory_2' : 'search_off';
          if (texte) texte.textContent = vide
            ? 'Aucun produit dans l’inventaire. Ajoutez-en un avec le bouton +.'
            : 'Aucun article ne correspond à cette recherche.';
        }
        applyFilters();
      }

      function applyFilters() {
        var q = search.value.trim().toLowerCase();
        var shown = 0;
        Array.prototype.forEach.call(list.children, function (el) {
          var okText = !q || (el.getAttribute('data-name') || '').indexOf(q) !== -1;
          var okCat = activeCat === 'all' || el.getAttribute('data-cat') === activeCat;
          var visible = okText && okCat;
          el.style.display = visible ? '' : 'none';
          if (visible) shown++;
        });
        empty.classList.toggle('hidden', shown !== 0);
      }

      /* ------------------------------------------------- glissement de suppression
         Le doigt ne porte que le deplacement horizontal : des qu'il part vers
         le bas, on abandonne le geste et le defilement de la page reprend la
         main (d'ou touch-action: pan-y sur la carte). */
      var LARGEUR_ACTION = 96;
      var carteOuverte = null;
      var geste = null;
      var dernierGeste = 0;

      function largeurAction(wrap) {
        var act = wrap ? wrap.querySelector('.kd-swipe-act') : null;
        return (act && act.offsetWidth) || LARGEUR_ACTION;
      }

      function fermerSwipe() {
        if (!carteOuverte) return;
        var carte = carteOuverte.querySelector('.kd-swipe-card');
        if (carte) {
          carte.classList.add('kd-swipe-glisse');
          carte.style.transform = 'translateX(0)';
        }
        carteOuverte = null;
      }

      function poserCarte(carte, position) {
        carte.classList.add('kd-swipe-glisse');
        carte.style.transform = 'translateX(' + position + 'px)';
      }

      list.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        /* Le bouton Supprimer n'est deja visible que sur une carte ouverte :
           on le laisse a son propre clic. En revanche on part aussi des
           boutons +/−, sinon la moitie droite de la carte serait interdite au
           glissement ; un tap sans mouvement leur rend leur clic normal. */
        if (e.target.closest('.kd-swipe-del')) return;
        var carte = e.target.closest('.kd-swipe-card');
        if (!carte) return;
        geste = {
          carte: carte,
          wrap: carte.parentElement,
          x0: e.clientX,
          y0: e.clientY,
          dx: 0,
          axe: null,
          ouvert: carteOuverte === carte.parentElement,
          bouge: false
        };
        /* Sans cette capture, le doigt qui sort de la carte ne produit plus
           d'evenements et le geste reste bloque a mi-chemin. */
        try { carte.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        carte.classList.remove('kd-swipe-glisse');
      });

      list.addEventListener('pointermove', function (e) {
        if (!geste) return;
        var dx = e.clientX - geste.x0;
        var dy = e.clientY - geste.y0;
        if (!geste.axe) {
          if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
          if (Math.abs(dx) <= Math.abs(dy)) { geste = null; return; }
          geste.axe = 'x';
        }
        geste.dx = dx;
        geste.bouge = true;
        var largeur = largeurAction(geste.wrap);
        var base = geste.ouvert ? -largeur : 0;
        var position = Math.min(0, Math.max(-largeur, base + dx));
        geste.carte.style.transform = 'translateX(' + position + 'px)';
      });

      function finGeste() {
        if (!geste) return;
        var g = geste;
        geste = null;
        if (g.axe !== 'x') return;
        var largeur = largeurAction(g.wrap);
        var base = g.ouvert ? -largeur : 0;
        var position = base + g.dx;
        var part = largeur * 0.45;
        /* Ouvert : il faut avoir tire d'assez pres pour refermer, sinon le
           geste revient ou etait la carte. Ferme : au-dela du seuil, ouverture. */
        var ouvrir = g.ouvert ? position <= -largeur + part : position <= -part;
        poserCarte(g.carte, ouvrir ? -largeur : 0);
        carteOuverte = ouvrir ? g.wrap : (carteOuverte === g.wrap ? null : carteOuverte);
        if (g.bouge) dernierGeste = Date.now();
      }

      list.addEventListener('pointerup', finGeste);
      list.addEventListener('pointercancel', finGeste);

      /* Un clic qui suit immediatement un glissement n'est pas un choix de
         l'utilisateur : on l'ignore pour ne pas ouvrir la feuille d'edition. */
      function gesteRecant() { return Date.now() - dernierGeste < 350; }

      /* Taper ailleurs referme la carte ouverte, a l'exterieur de la liste. */
      function refermerSurToucheExt(e) {
        if (!carteOuverte) return;
        if (carteOuverte.contains(e.target)) return;
        fermerSwipe();
      }

      /* ------------------------------------------------ confirmation suppression */
      var dlg = document.getElementById('del-dialog');
      var dlgName = document.getElementById('del-name');
      var cible = null;

      function fermerDialogue() {
        if (!dlg) return;
        if (typeof dlg.close === 'function' && dlg.open) dlg.close();
        else dlg.removeAttribute('open');
      }

      function demanderSuppression(wrap) {
        var p = wrap ? KD.getProduct(wrap.getAttribute('data-id')) : null;
        if (!p) { fermerSwipe(); return; }
        cible = p;
        if (dlgName) dlgName.textContent = p.name;
        fermerSwipe();
        if (!dlg) return;
        /* Sur un navigateur sans <dialog> modale, la feuille s'affiche quand
           meme : la confirmation reste obligatoire, seule l'inertie du fond
           fait defaut. */
        if (typeof dlg.showModal === 'function') {
          dlg.returnValue = '';
          dlg.showModal();
        } else {
          dlg.setAttribute('open', '');
        }
      }

      function annulerSuppression() {
        cible = null;
        fermerDialogue();
        fermerSwipe();
      }

      function confirmerSuppression() {
        var p = cible;
        cible = null;
        fermerDialogue();
        if (!p) return;
        /* L'element va etre remplace par le re-rendu declenche par l'evenement
           kd:products : on relache la reference avant, sinon elle pointe sur
           un noeud detache. */
        carteOuverte = null;
        var ok = KD.removeProduct(p.id);
        KD.toast(ok ? p.name + ' supprimé de l’inventaire' : 'Suppression impossible');
      }

      if (dlg) {
        document.getElementById('del-cancel').addEventListener('click', annulerSuppression);
        document.getElementById('del-ok').addEventListener('click', confirmerSuppression);
        /* Echap ou clic sur le fond : le navigateur ferme la feuille, il faut
           juste relacher la cible pour ne pas confirmer au hasard. */
        dlg.addEventListener('close', function () { cible = null; });
      }

      /* ------------------------------------------------ feuille de modification */
      function showError(message) {
        if (!message) { edError.classList.add('hidden'); return; }
        document.getElementById('ed-error-text').textContent = message;
        edError.classList.remove('hidden');
      }

      function openEditor(id) {
        var p = id ? KD.getProduct(id) : null;
        fId.value = p ? p.id : '';
        fName.value = p ? p.name : '';
        fSku.value = p ? (p.sku || '') : '';
        fCat.value = p ? p.cat : KD.PRODUCT_CATS[0];
        fPrice.value = p ? String(p.price) : '';
        fStock.value = p ? String(p.stock) : '';
        fMax.value = p ? String(p.max) : '';
        fStatus.value = p ? p.status : 'En stock';
        document.getElementById('ed-title').textContent = p ? 'Modifier le produit' : 'Nouveau produit';
        document.getElementById('ed-icon').textContent = p ? p.icon : 'inventory_2';
        saveText.textContent = p ? 'Enregistrer' : 'Ajouter';
        showError(null);
        editor.classList.remove('hidden');
        gelerFond();
        try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) { /* ignore */ }
        /* Le corps du formulaire defile : c'est lui, et lui seul, qui revient
           en haut a chaque ouverture. */
        setTimeout(function () {
          var corps = document.getElementById('ed-corps');
          if (corps) corps.scrollTop = 0;
        }, 20);
      }

      function closeEditor() {
        editor.classList.add('hidden');
        defaireFond();
        showError(null);
      }

      /* Les prix sont saisis au clavier mobile : on tolere la virgule. */
      function toNumber(value) {
        var n = parseFloat(String(value).replace(/\s| /g, '').replace(',', '.'));
        return isFinite(n) ? n : NaN;
      }

      if (form) {
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          showError(null);

          var name = fName.value.trim();
          var price = toNumber(fPrice.value);
          var stock = toNumber(fStock.value);
          var max = toNumber(fMax.value);

          if (!name) { showError('Le nom du produit est obligatoire.'); return; }
          if (!isFinite(price) || price < 0) { showError('Prix invalide.'); fPrice.focus(); return; }
          if (!isFinite(stock) || stock < 0 || !isFinite(max) || max <= 0) {
            showError('Stock et seuil doivent être des nombres positifs.');
            fStock.focus();
            return;
          }

          var data = {
            name: name,
            sku: fSku.value.trim(),
            cat: fCat.value,
            /* Les prix de la boutique sont en dollars entiers, comme le reste
               de l'application : on arrondit plutot que d'afficher un montant
               different de celui enregistre. */
            price: Math.round(price),
            stock: Math.round(stock),
            max: Math.round(max),
            status: fStatus.value
          };

          if (fId.value) {
            KD.updateProduct(fId.value, data);
            KD.toast(data.name + ' mis à jour');
          } else {
            KD.addProduct(data);
            KD.toast(data.name + ' ajouté');
          }
          closeEditor();
          render();
        });
      }

      ['ed-close', 'ed-cancel', 'ed-overlay'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('click', closeEditor);
      });

      /* Clic sur un produit = le modifier. Les boutons +/- restent séparés,
         le bouton Supprimer ouvre la confirmation. */
      list.addEventListener('click', function (e) {
        if (gesteRecant()) return;
        var del = e.target.closest('[data-del]');
        if (del) {
          demanderSuppression(del.closest('.kd-swipe'));
          return;
        }
        var qty = e.target.closest('.qty-btn');
        if (qty) {
          var out = qty.parentElement.querySelector('.qty');
          var next = Math.max(0, (parseInt(out.textContent, 10) || 0) + parseInt(qty.getAttribute('data-step'), 10));
          out.textContent = next;
          if (next === 0) return;
          KD.toast((qty.getAttribute('data-step') === '1' ? '+1 ' : '-1 ') +
            qty.closest('article').querySelector('h3').textContent + ' · ' + next + ' au panier de transfert');
          return;
        }
        var wrap = e.target.closest('.kd-swipe[data-id]');
        if (!wrap) return;
        /* Une carte deja ouverte se referme au tap : elle ne doit pas
           doubler en ouvrant la feuille d'edition. */
        if (carteOuverte) {
          fermerSwipe();
          return;
        }
        openEditor(wrap.getAttribute('data-id'));
      });

      list.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var wrap = e.target.closest('.kd-swipe[data-id]');
        if (!wrap) return;
        e.preventDefault();
        openEditor(wrap.getAttribute('data-id'));
      });

      /* Le catalogue mis a jour ailleurs dans l'application se reflete ici. */
      function surProduits() { render(); }
      document.addEventListener('kd:products', surProduits);
      document.addEventListener('pointerdown', refermerSurToucheExt, true);

      nettoyer = function () {
        document.removeEventListener('kd:products', surProduits);
        document.removeEventListener('pointerdown', refermerSurToucheExt, true);
      };

      document.getElementById('new-product').addEventListener('click', function () {
        openEditor(null);
      });

      search.addEventListener('input', applyFilters);
      search.addEventListener('input', sauverFiltre);

      chips.forEach(function (chip) {
        chip.addEventListener('click', function () {
          activeCat = chip.getAttribute('data-filter');
          activeChip(activeCat);
          applyFilters();
          sauverFiltre();
        });
      });

      /* Restauration apres rechargement : la categorie et la recherche de
         l'onglet stock sont remises exactement comme l'utilisateur les avait
         laissees, avant tout rendu. */
      var filtre = lireFiltre();
      if (filtre && typeof filtre === 'object') {
        var reprise = chips.some(function (c) { return c.getAttribute('data-filter') === filtre.cat; })
          ? filtre.cat : 'all';
        activeCat = reprise;
        if (typeof filtre.q === 'string') search.value = filtre.q;
        activeChip(activeCat);
      }

      render();
    }
  };
})();