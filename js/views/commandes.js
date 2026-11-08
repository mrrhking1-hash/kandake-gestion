/* Commandes fournisseur Beauty : catalogue, engagements, paiements et réception stock. */
(function () {
  'use strict';
  KD.views = KD.views || {};
  KD.views.commandes = {
    title: 'Commandes Beauty',
    mount: function () {
      var productsRoot = document.getElementById('purchase-products');
      var draftRoot = document.getElementById('purchase-draft-lines');
      var ordersRoot = document.getElementById('purchase-orders');
      var search = document.getElementById('purchase-search');
      var searchClear = document.getElementById('purchase-search-clear');
      var supplier = document.getElementById('purchase-supplier');
      var freight = document.getElementById('purchase-freight');
      var paid = document.getElementById('purchase-paid');
      var submit = document.getElementById('purchase-submit');
      var drawer = document.getElementById('purchase-action-drawer');
      var createDrawer = document.getElementById('purchase-create-drawer');
      var createLock = null;
      var actionLock = null;
      var productLock = null;
      var fields = document.getElementById('purchase-action-fields');
      var actionSubmit = document.getElementById('purchase-action-submit');
      var toast = document.getElementById('purchase-toast');
      var newProductDrawer = document.getElementById('new-product-drawer');
      var selected = Object.create(null);
      var products = [];
      var action = null;
      var removers = [];
      var toastTimer = null;

      function on(el, event, fn) { el.addEventListener(event, fn); removers.push(function () { el.removeEventListener(event, fn); }); }
      function esc(value) { return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
      function money(value) { return KD.money(Number(value) || 0, 'USD'); }
      function toastMsg(message) {
        toast.textContent = message;
        toast.classList.remove('opacity-0', 'pointer-events-none'); toast.classList.add('opacity-100');
        clearTimeout(toastTimer); toastTimer = setTimeout(function () { toast.classList.add('opacity-0', 'pointer-events-none'); toast.classList.remove('opacity-100'); }, 2400);
      }
      function norm(value) { return String(value || '').toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
      function addProduct(product) {
        if (!selected[product.id]) selected[product.id] = { pid: product.id, name: product.name, qty: 0,
          unitCostUsd: product.purchasePrice == null ? '' : Number(product.purchasePrice) };
        selected[product.id].qty++;
        renderDraft(); renderProducts();
      }
      function changeQty(pid, delta) {
        if (!selected[pid]) return;
        selected[pid].qty += delta;
        if (selected[pid].qty <= 0) delete selected[pid];
        renderDraft(); renderProducts();
      }
      function renderProducts() {
        var q = norm(search.value.trim());
        productsRoot.innerHTML = '';
        var visible = products.filter(function (p) { return !q || norm([p.name, p.sku, p.cat].join(' ')).indexOf(q) !== -1; });
        document.getElementById('purchase-no-products').classList.toggle('hidden', visible.length !== 0);
        if (!visible.length && q) document.getElementById('purchase-no-products').textContent = 'Aucun produit ne correspond à cette recherche.';
        else document.getElementById('purchase-no-products').textContent = 'Aucun produit Beauty au catalogue.';
        visible.forEach(function (product) {
          var qty = selected[product.id] ? selected[product.id].qty : 0;
          var status = KD.PRODUCT_STATUS[product.status] || KD.PRODUCT_STATUS['En stock'];
          var card = document.createElement('div');
          card.className = 'relative rounded-xl bg-surface-container-lowest shadow-sm transition-all' + (qty ? ' ring-1 ring-secondary' : '');
          card.setAttribute('data-product-id', product.id);
          card.innerHTML = '<button class="w-full flex flex-col gap-1 p-2.5 text-left active:scale-[0.98] transition-transform" type="button" data-add-product aria-label="Ajouter ' + esc(product.name) + ' à la commande">' +
            '<div class="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center"><span class="material-symbols-outlined text-secondary">' + esc(product.icon || 'inventory_2') + '</span></div>' +
            '<span class="font-body-sm text-[12px] text-primary font-semibold leading-tight line-clamp-2">' + esc(product.name) + '</span>' +
            '<span class="flex justify-between gap-1"><span class="font-label-sm text-[10px] text-on-surface-variant">Stock ' + (Number(product.stock) || 0) + '</span><span class="font-label-sm text-[9px] px-1.5 py-0.5 rounded-full ' + status.cls + '">' + esc(product.status || 'En stock') + '</span></span></button>' +
            '<div class="absolute top-2 right-2 items-center gap-1" data-qty-controls style="display:' + (qty ? 'flex' : 'none') + '">' +
            '<button class="w-7 h-7 rounded-full bg-surface-container text-primary font-bold shadow-sm" type="button" data-step="-1" aria-label="Retirer ' + esc(product.name) + '">−</button>' +
            '<span class="w-7 h-7 rounded-full bg-secondary-fixed text-on-secondary-fixed ring-2 ring-surface-container-lowest font-data-mono text-[12px] font-bold flex items-center justify-center shadow-sm" aria-live="polite">' + qty + '</span>' +
            '<button class="w-7 h-7 rounded-full bg-primary text-on-primary font-bold shadow-sm" type="button" data-step="1" aria-label="Ajouter ' + esc(product.name) + '">+</button></div>';
          productsRoot.appendChild(card);
        });
        searchClear.classList.toggle('hidden', !q);
      }
      function recalc() {
        var subtotal = Object.keys(selected).reduce(function (sum, id) {
          var line = selected[id]; return sum + (Number(line.unitCostUsd) || 0) * line.qty;
        }, 0);
        var shipping = Number(freight.value) || 0;
        var total = subtotal + shipping;
        var payment = Number(paid.value) || 0;
        document.getElementById('purchase-subtotal').textContent = money(subtotal);
        document.getElementById('purchase-freight-total').textContent = money(shipping);
        document.getElementById('purchase-total').textContent = money(total);
        document.getElementById('purchase-due').textContent = money(Math.max(0, total - payment));
        var allCostsValid = Object.keys(selected).length > 0 && Object.keys(selected).every(function (id) {
          return Number(selected[id].unitCostUsd) > 0 && isFinite(Number(selected[id].unitCostUsd));
        });
        submit.disabled = !supplier.value.trim() || !allCostsValid || payment < 0 || payment > total;
      }
      function renderDraft() {
        draftRoot.innerHTML = '';
        var ids = Object.keys(selected);
        if (!ids.length) draftRoot.innerHTML = '<p class="font-body-sm text-on-surface-variant">Aucun article sélectionné.</p>';
        ids.forEach(function (id) {
          var line = selected[id];
          var row = document.createElement('div');
          row.className = 'flex items-center gap-2 p-2 rounded-lg bg-surface-container-low';
          var name = document.createElement('span'); name.className = 'flex-1 min-w-0 truncate font-body-sm text-[12px] text-primary font-semibold'; name.textContent = line.name + ' × ' + line.qty;
          var label = document.createElement('label'); label.className = 'shrink-0 font-label-sm text-[9px] text-on-surface-variant'; label.textContent = 'PU achat $';
          var input = document.createElement('input'); input.type = 'number'; input.min = '0.01'; input.step = '0.01'; input.inputMode = 'decimal'; input.placeholder = '0.00'; input.value = line.unitCostUsd;
          input.className = 'w-[5.5rem] h-9 px-2 rounded-lg bg-surface-container-lowest text-right font-data-mono text-[12px] text-primary';
          input.setAttribute('aria-label', 'Prix d’achat unitaire de ' + line.name);
          input.addEventListener('input', function () { line.unitCostUsd = input.value; recalc(); });
          label.appendChild(input); row.appendChild(name); row.appendChild(label); draftRoot.appendChild(row);
        });
        recalc();
      }
      function renderOrders() {
        var orders = KD.getPurchaseOrders();
        ordersRoot.innerHTML = '';
        var openDue = 0;
        orders.forEach(function (order) {
          if (order.status !== 'annulee') openDue += Math.max(0, (Number(order.totalUsd) || 0) - (Number(order.paidUsd) || 0));
        });
        document.getElementById('purchase-open-balance').textContent = money(openDue);
        document.getElementById('purchase-orders-empty').classList.toggle('hidden', orders.length > 0);
        orders.forEach(function (order) {
          var due = Math.max(0, (Number(order.totalUsd) || 0) - (Number(order.paidUsd) || 0));
          var remaining = order.items.reduce(function (sum, item) { return sum + Math.max(0, item.qtyOrdered - item.qtyReceived); }, 0);
          var statusText = order.status === 'recue' ? 'Reçue' : order.status === 'partielle' ? 'Réception partielle' : 'Commandée';
          var statusClass = order.status === 'recue' ? 'bg-success-container text-success' : 'bg-secondary-fixed text-on-secondary-fixed';
          var card = document.createElement('article'); card.className = 'rounded-xl bg-surface-container-lowest p-space-md shadow-sm space-y-2';
          var head = document.createElement('div'); head.className = 'flex items-start justify-between gap-2';
          var who = document.createElement('div'); who.className = 'min-w-0';
          var title = document.createElement('strong'); title.className = 'block text-primary'; title.textContent = order.supplier;
          var meta = document.createElement('span'); meta.className = 'block font-body-sm text-[11px] text-on-surface-variant'; meta.textContent = order.id + ' · ' + order.date;
          who.appendChild(title); who.appendChild(meta);
          var status = document.createElement('span'); status.className = 'shrink-0 px-2 py-1 rounded-full font-label-sm text-[10px] ' + statusClass; status.textContent = statusText;
          head.appendChild(who); head.appendChild(status); card.appendChild(head);
          var lines = document.createElement('div'); lines.className = 'space-y-1';
          order.items.forEach(function (item) {
            var detail = document.createElement('p'); detail.className = 'font-body-sm text-[12px] text-on-surface-variant';
            detail.textContent = item.name + ' · reçu ' + item.qtyReceived + '/' + item.qtyOrdered;
            lines.appendChild(detail);
          });
          card.appendChild(lines);
          var costs = document.createElement('div'); costs.className = 'rounded-lg bg-surface-container-low p-3 space-y-1 text-body-sm';
          [['Articles', order.merchandiseUsd], ['Transport', order.freightUsd], ['Total', order.totalUsd], ['Payé', order.paidUsd], ['Reste dû', due]].forEach(function (entry) {
            var row = document.createElement('div'); row.className = 'flex justify-between gap-2' + (entry[0] === 'Reste dû' ? ' font-bold text-secondary' : '');
            var label = document.createElement('span'); label.textContent = entry[0];
            var value = document.createElement('strong'); value.textContent = money(entry[1]);
            row.appendChild(label); row.appendChild(value); costs.appendChild(row);
          });
          card.appendChild(costs);
          var actions = document.createElement('div'); actions.className = 'grid grid-cols-2 gap-2';
          if (due > 0) { var payButton = document.createElement('button'); payButton.type = 'button'; payButton.className = 'h-10 px-2 rounded-lg bg-surface-container text-primary font-label-sm text-[11px] font-semibold'; payButton.textContent = 'Enregistrer un paiement'; payButton.setAttribute('data-order-action', 'pay'); payButton.setAttribute('data-order-id', order.id); actions.appendChild(payButton); }
          if (remaining > 0) { var receiveButton = document.createElement('button'); receiveButton.type = 'button'; receiveButton.className = 'h-10 px-2 rounded-lg bg-primary text-on-primary font-label-sm text-[11px] font-semibold'; receiveButton.textContent = 'Valider la réception'; receiveButton.setAttribute('data-order-action', 'receive'); receiveButton.setAttribute('data-order-id', order.id); actions.appendChild(receiveButton); }
          if (actions.children.length === 1) actions.children[0].classList.add('col-span-2');
          if (actions.children.length) card.appendChild(actions);
          ordersRoot.appendChild(card);
        });
      }
      function closeAction() {
        drawer.classList.add('hidden'); drawer.classList.remove('flex'); action = null;
        if (KD.unfreezeFormSheet) KD.unfreezeFormSheet(drawer, actionLock);
        actionLock = null;
      }
      function openCreateOrder() {
        createDrawer.classList.remove('hidden'); createDrawer.classList.add('flex');
        if (KD.freezeFormSheet) createLock = KD.freezeFormSheet(createDrawer);
        document.getElementById('purchase-supplier').focus();
      }
      function closeCreateOrder() {
        createDrawer.classList.add('hidden'); createDrawer.classList.remove('flex');
        if (KD.unfreezeFormSheet) KD.unfreezeFormSheet(createDrawer, createLock);
        createLock = null;
      }
      function openAction(kind, orderId) {
        var order = KD.getPurchaseOrders().filter(function (item) { return item.id === orderId; })[0];
        if (!order) return;
        action = { kind: kind, orderId: orderId };
        fields.innerHTML = '';
        if (kind === 'pay') {
          document.getElementById('purchase-action-title').textContent = 'Paiement fournisseur';
          var due = Math.max(0, order.totalUsd - order.paidUsd);
          fields.innerHTML = '<p class="font-body-sm text-on-surface-variant">Reste à régler pour ' + esc(order.supplier) + ' : <strong>' + money(due) + '</strong></p><label class="kd-form-label">Montant payé (USD)<input class="kd-form-control" id="purchase-pay-amount" type="number" min="0.01" max="' + due + '" step="0.01" inputmode="decimal" value="' + due + '"></label>';
          actionSubmit.textContent = 'Enregistrer le paiement';
        } else {
          document.getElementById('purchase-action-title').textContent = 'Réception de la commande';
          fields.innerHTML = '<p class="font-body-sm text-on-surface-variant">Indique les quantités réellement reçues. Tu peux enregistrer une réception partielle.</p>';
          order.items.forEach(function (item) {
            var outstanding = item.qtyOrdered - item.qtyReceived;
            if (outstanding <= 0) return;
            var label = document.createElement('label'); label.className = 'kd-form-label'; label.textContent = item.name + ' · reste ' + outstanding;
            var input = document.createElement('input'); input.type = 'number'; input.min = '0'; input.max = String(outstanding); input.step = '1'; input.inputMode = 'numeric'; input.value = String(outstanding);
            input.className = 'kd-form-control'; input.setAttribute('data-receive-pid', item.pid); input.setAttribute('aria-label', 'Quantité reçue de ' + item.name);
            label.appendChild(input); fields.appendChild(label);
          });
          actionSubmit.textContent = 'Confirmer la réception';
        }
        drawer.classList.remove('hidden'); drawer.classList.add('flex');
        if (KD.freezeFormSheet) actionLock = KD.freezeFormSheet(drawer);
      }

      on(document.getElementById('purchase-new-order'), 'click', openCreateOrder);
      on(document.getElementById('purchase-create-close'), 'click', closeCreateOrder);
      on(document.getElementById('purchase-create-cancel'), 'click', closeCreateOrder);
      on(createDrawer, 'click', function (event) { if (event.target === createDrawer) closeCreateOrder(); });
      on(document.getElementById('purchase-add-product'), 'click', function () {
        newProductDrawer.classList.remove('hidden'); newProductDrawer.classList.add('flex');
        if (KD.freezeFormSheet) productLock = KD.freezeFormSheet(newProductDrawer);
        document.getElementById('new-product-name').focus();
      });
      function closeNewProduct() { newProductDrawer.classList.add('hidden'); newProductDrawer.classList.remove('flex'); if (KD.unfreezeFormSheet) KD.unfreezeFormSheet(newProductDrawer, productLock); productLock = null; }
      on(document.getElementById('new-product-close'), 'click', closeNewProduct);
      on(document.getElementById('new-product-cancel'), 'click', closeNewProduct);
      on(newProductDrawer, 'click', function (event) { if (event.target === newProductDrawer) closeNewProduct(); });
      on(document.getElementById('new-product-save'), 'click', function () {
        var name = document.getElementById('new-product-name').value.trim();
        var sku = document.getElementById('new-product-sku').value.trim();
        var price = Number(document.getElementById('new-product-price').value);
        if (!name || !isFinite(price) || price <= 0) { toastMsg('Saisis un nom et un prix de vente valides.'); return; }
        var duplicate = KD.getProducts().some(function (product) { return norm(product.name) === norm(name); });
        if (duplicate) { toastMsg('Cette référence existe déjà dans le catalogue.'); return; }
        var product = KD.addProduct({ name: name, sku: sku, cat: 'Beauty', price: price, purchasePrice: null, stock: 0, max: 10 });
        if (!product || !KD.getProduct(product.id)) { toastMsg('La référence n’a pas pu être créée.'); return; }
        selected[product.id] = { pid: product.id, name: product.name, qty: 1, unitCostUsd: '' };
        document.getElementById('new-product-name').value = '';
        document.getElementById('new-product-sku').value = '';
        document.getElementById('new-product-price').value = '';
        search.value = '';
        products = KD.getProducts().filter(function (item) { return item.cat === 'Beauty'; });
        closeNewProduct(); renderProducts(); renderDraft();
        toastMsg('Référence ajoutée au catalogue et à la commande.');
      });
      on(search, 'input', renderProducts);
      on(searchClear, 'click', function () { search.value = ''; renderProducts(); search.focus(); });
      on(supplier, 'input', recalc); on(freight, 'input', recalc); on(paid, 'input', recalc);
      on(productsRoot, 'click', function (event) {
        var card = event.target.closest('[data-product-id]'); if (!card) return;
        var product = products.filter(function (item) { return item.id === card.getAttribute('data-product-id'); })[0]; if (!product) return;
        var step = event.target.closest('[data-step]');
        if (step) changeQty(product.id, Number(step.getAttribute('data-step')));
        else if (event.target.closest('[data-add-product]')) addProduct(product);
      });
      on(submit, 'click', function () {
        var items = Object.keys(selected).map(function (id) { return { pid: id, qty: selected[id].qty, unitCostUsd: Number(selected[id].unitCostUsd) }; });
        var order = KD.createPurchaseOrder({ supplier: supplier.value, items: items, freightUsd: Number(freight.value), paidUsd: Number(paid.value) });
        if (!order) { toastMsg('Vérifie le fournisseur, les coûts, le transport et le paiement.'); return; }
        selected = Object.create(null); freight.value = '0'; paid.value = '0';
        closeCreateOrder(); renderProducts(); renderDraft(); renderOrders(); toastMsg('Commande enregistrée · ' + order.id);
      });
      on(ordersRoot, 'click', function (event) {
        var button = event.target.closest('[data-order-action]'); if (button) openAction(button.getAttribute('data-order-action'), button.getAttribute('data-order-id'));
      });
      on(document.getElementById('purchase-action-close'), 'click', closeAction);
      on(drawer, 'click', function (event) { if (event.target === drawer) closeAction(); });
      on(actionSubmit, 'click', function () {
        if (!action) return;
        var ok = false;
        if (action.kind === 'pay') {
          var amount = Number(document.getElementById('purchase-pay-amount').value);
          ok = KD.payPurchaseOrder(action.orderId, amount);
        } else {
          var received = Array.prototype.map.call(fields.querySelectorAll('[data-receive-pid]'), function (input) {
            return { pid: input.getAttribute('data-receive-pid'), qty: Number(input.value) };
          });
          ok = KD.receivePurchaseOrder(action.orderId, received);
        }
        if (!ok) { toastMsg(action.kind === 'pay' ? 'Paiement invalide ou supérieur au solde dû.' : 'Réception invalide; vérifie les quantités restantes.'); return; }
        closeAction(); renderOrders(); toastMsg(action.kind === 'pay' ? 'Paiement fournisseur enregistré dans les Finances.' : 'Réception enregistrée et stock mis à jour.');
      });
      on(document, 'kd:purchase-orders', renderOrders);
      on(document, 'kd:products', function () { products = KD.getProducts().filter(function (product) { return product.cat === 'Beauty'; }); renderProducts(); });
      on(document, 'keydown', function (event) {
        if (event.key !== 'Escape') return;
        if (!drawer.classList.contains('hidden')) closeAction();
        if (!newProductDrawer.classList.contains('hidden')) closeNewProduct();
        if (!createDrawer.classList.contains('hidden')) closeCreateOrder();
      });
      products = KD.getProducts().filter(function (product) { return product.cat === 'Beauty'; });
      renderProducts(); renderDraft(); renderOrders();
      this.unmount = function () { if (drawer && !drawer.classList.contains('hidden')) closeAction(); if (newProductDrawer && !newProductDrawer.classList.contains('hidden')) closeNewProduct(); if (createDrawer && !createDrawer.classList.contains('hidden')) closeCreateOrder(); removers.forEach(function (remove) { remove(); }); clearTimeout(toastTimer); };
    },
    unmount: function () {}
  };
})();
