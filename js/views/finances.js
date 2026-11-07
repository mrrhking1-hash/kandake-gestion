/* Indicateurs financiers calcules depuis les journaux reels de l'appareil. */
(function () {
  'use strict';
  KD.views = KD.views || {};
  KD.views.finances = {
    title: 'Finances',
    mount: function () {
      var drawer = document.getElementById('operation-drawer');
      var amount = document.getElementById('operation-amount');
      var description = document.getElementById('operation-description');
      var category = document.getElementById('operation-category');
      var submit = document.getElementById('submit-operation');
      var toast = document.getElementById('toast');
      var toastText = document.getElementById('toast-text');
      var period = document.getElementById('finance-period');
      var type = 'entree';
      var listeners = [];

      function on(target, event, fn) {
        target.addEventListener(event, fn);
        listeners.push(function () { target.removeEventListener(event, fn); });
      }
      function announce(text) {
        if (!toast || !toastText) return;
        toastText.textContent = text;
        toast.classList.remove('opacity-0', 'pointer-events-none');
        toast.classList.add('opacity-100');
        setTimeout(function () { toast.classList.add('opacity-0', 'pointer-events-none'); }, 2200);
      }
      function money(value) { return KD.money(Number(value) || 0, 'USD'); }
      function set(id, value) { var el = document.getElementById(id); if (el) el.textContent = value; }
      function currentMonth() {
        var now = new Date();
        return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
      }
      function inPeriod(date) { return String(date || '').slice(0, 7) === period.value; }
      function setType(next) {
        type = next;
        var inBtn = document.getElementById('tab-in');
        var outBtn = document.getElementById('tab-out');
        inBtn.className = type === 'entree' ? 'flex-1 py-2 rounded-md bg-surface-container-lowest text-primary font-bold' : 'flex-1 py-2 rounded-md text-on-surface-variant';
        outBtn.className = type === 'sortie' ? 'flex-1 py-2 rounded-md bg-surface-container-lowest text-primary font-bold' : 'flex-1 py-2 rounded-md text-on-surface-variant';
        submit.textContent = type === 'sortie' ? 'Enregistrer la dépense' : 'Enregistrer l’entrée';
      }
      function render() {
        var monthSales = KD.getSales().filter(function (s) { return s && inPeriod(s.date); });
        var ca = { Beauty: 0, Art: 0 };
        monthSales.forEach(function (s) {
          if (s.rubriques) {
            ca.Beauty += Number(s.rubriques.Beauty) || 0;
            ca.Art += Number(s.rubriques.Art) || 0;
          } else ca.Beauty += Number(s.totalUsd) || 0;
        });
        set('fin-ca-total', money(ca.Beauty + ca.Art));
        set('fin-ca-beauty', money(ca.Beauty));
        set('fin-ca-art', money(ca.Art));

        var monthMovements = KD.getMovements().filter(function (m) { return m && inPeriod(m.date); });
        var expenses = { Beauty: 0, Art: 0, General: 0 };
        var operatingExpenses = { Beauty: 0, Art: 0 };
        monthMovements.filter(function (m) { return m.type === 'sortie'; }).forEach(function (m) {
          var cat = m.category === 'Beauty' ? 'Beauty' : m.category === 'Art' ? 'Art' : 'General';
          var amount = Number(m.amountUsd) || 0;
          expenses[cat] += amount;
          /* Les paiements de stock apparaissent dans les sorties de trésorerie,
             mais leur coût est déjà inclus dans la marge lors de la vente. */
          if (!m.orderId && cat !== 'General') operatingExpenses[cat] += amount;
        });
        set('fin-dep-total', money(expenses.Beauty + expenses.Art + expenses.General));
        set('fin-dep-beauty', money(expenses.Beauty));
        set('fin-dep-art', money(expenses.Art));
        set('fin-dep-note', (expenses.General ? money(expenses.General) + ' de dépenses générales non réparties. ' : '') + 'Les sorties sans activité enregistrées auparavant restent classées en général.');
        var purchaseDue = typeof KD.getPurchaseOrders === 'function' ? KD.getPurchaseOrders().reduce(function (sum, order) {
          return order.status === 'annulee' ? sum : sum + Math.max(0, (Number(order.totalUsd) || 0) - (Number(order.paidUsd) || 0));
        }, 0) : 0;
        set('fin-purchase-due', money(purchaseDue));

        var inventory = { Beauty: 0, Art: 0 };
        var withoutCost = { Beauty: 0, Art: 0 };
        KD.getProducts().forEach(function (p) {
          var cat = p.cat === 'Art' ? 'Art' : 'Beauty';
          var stock = Number(p.stock) || 0;
          if (p.purchasePrice == null) { if (stock > 0) withoutCost[cat] += stock; }
          else inventory[cat] += stock * Number(p.purchasePrice || 0);
        });
        set('fin-stock-beauty', money(inventory.Beauty));
        set('fin-stock-art', money(inventory.Art));
        set('fin-stock-note', (withoutCost.Beauty + withoutCost.Art) + ' unité(s) en stock sans prix d’achat renseigné; la valeur affichée est partielle.');

        var gross = { Beauty: 0, Art: 0 };
        var salesWithoutCost = 0;
        monthSales.forEach(function (s) {
          if (!Array.isArray(s.articles) || !s.articles.length) { salesWithoutCost++; return; }
          s.articles.forEach(function (item) {
            var cat = item.categorie === 'Art' ? 'Art' : 'Beauty';
            var qty = Number(item.quantite) || 0;
            if (item.prixAchatUsd == null || !isFinite(Number(item.prixAchatUsd))) salesWithoutCost++;
            else gross[cat] += (Number(item.prixVenteUsd) - Number(item.prixAchatUsd)) * qty;
          });
        });
        set('fin-benefice-beauty', money(gross.Beauty - operatingExpenses.Beauty));
        set('fin-benefice-art', money(gross.Art - operatingExpenses.Art));
        set('fin-benefice-note', 'Marge brute connue moins dépenses de fonctionnement classées. ' + salesWithoutCost + ' ticket(s)/ligne(s) sans coût d’achat connu exclus; ' + money(expenses.General) + ' de dépenses générales ne sont pas répartis. Estimation partielle.');

        var list = document.getElementById('fin-movements');
        var rows = monthMovements.slice(0, 8);
        list.innerHTML = rows.length ? '' : '<p class="font-body-sm text-on-surface-variant">Aucun mouvement sur cette période.</p>';
        rows.forEach(function (m) {
          var row = document.createElement('div');
          row.className = 'flex items-center justify-between gap-2 p-2 rounded-lg bg-surface-container-low';
          var label = document.createElement('span');
          label.className = 'min-w-0 truncate font-body-sm text-primary';
          label.textContent = (m.type === 'sortie' ? 'Dépense' : 'Entrée') + ' · ' + (m.category || 'Général') + (m.description ? ' · ' + m.description : '');
          var value = document.createElement('strong');
          value.className = 'shrink-0 font-data-mono text-primary';
          value.textContent = (m.type === 'sortie' ? '−' : '+') + money(m.amountUsd);
          row.appendChild(label); row.appendChild(value); list.appendChild(row);
        });
      }
      period.value = currentMonth();
      on(period, 'change', render);
      on(document.getElementById('btn-add-tx'), 'click', function () { drawer.classList.remove('hidden'); drawer.classList.add('flex'); });
      on(document.getElementById('close-drawer'), 'click', function () { drawer.classList.add('hidden'); drawer.classList.remove('flex'); });
      on(document.getElementById('tab-in'), 'click', function () { setType('entree'); });
      on(document.getElementById('tab-out'), 'click', function () { setType('sortie'); });
      on(submit, 'click', function () {
        var value = Number(amount.value);
        if (!isFinite(value) || value <= 0) { announce('Saisissez un montant supérieur à 0.'); amount.focus(); return; }
        var ok = KD.addMovement({ type: type, amountUsd: value, category: category.value, description: description.value });
        if (!ok) { announce('Mouvement non enregistré.'); return; }
        amount.value = ''; description.value = '';
        drawer.classList.add('hidden'); drawer.classList.remove('flex');
        render(); announce(type === 'sortie' ? 'Dépense enregistrée.' : 'Entrée enregistrée.');
      });
      on(document, 'kd:sales', render);
      on(document, 'kd:movements', render);
      on(document, 'kd:purchase-orders', render);
      on(document, 'kd:products', render);
      setType('entree'); render();
      this.unmount = function () { listeners.forEach(function (remove) { remove(); }); };
    },
    unmount: function () {}
  };
})();
