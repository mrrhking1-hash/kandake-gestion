/* Rentabilité produit : marge historique sur les ventes et potentiel du stock. */
(function () {
  'use strict';
  KD.views = KD.views || {};

  KD.views.rentabilite = {
    title: 'Rentabilité',
    mount: function () {
      var list = document.getElementById('profit-products');
      var empty = document.getElementById('profit-empty');
      var category = document.getElementById('profit-category');
      var events = ['kd:sales', 'kd:products', 'kd:purchase-orders'];

      function money(value) { return KD.money(Number(value) || 0, 'USD'); }
      function normalize(value) {
        return String(value || '').trim().toLocaleLowerCase().normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
      }
      function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
        });
      }

      function render() {
        var rows = KD.getProducts().map(function (product) {
          return { product: product, sold: 0, knownQty: 0, unknownQty: 0, margin: 0 };
        });
        var byId = {};
        var byName = {};
        rows.forEach(function (row) {
          byId[row.product.id] = row;
          byName[normalize(row.product.name)] = row;
        });

        var knownMargin = 0;
        var knownLines = 0;
        var unknownLines = 0;
        KD.getSales().forEach(function (sale) {
          (Array.isArray(sale.articles) ? sale.articles : []).forEach(function (item) {
            var row = (item.pid && byId[item.pid]) || byName[normalize(item.nom)];
            var qty = Number(item.quantite) || 0;
            if (qty <= 0) return;

            var hasCost = item.prixAchatUsd != null && isFinite(Number(item.prixAchatUsd)) &&
              item.prixVenteUsd != null && isFinite(Number(item.prixVenteUsd));
            if (!hasCost) {
              unknownLines++;
              if (row) { row.sold += qty; row.unknownQty += qty; }
              return;
            }

            var margin = (Number(item.prixVenteUsd) - Number(item.prixAchatUsd)) * qty;
            knownMargin += margin;
            knownLines++;
            if (row) {
              row.sold += qty;
              row.knownQty += qty;
              row.margin += margin;
            }
          });
        });

        var visibleRows = category.value === 'all' ? rows : rows.filter(function (row) {
          return row.product.cat === category.value;
        });
        list.innerHTML = '';
        var gains = 0;
        var losses = 0;
        var stockMargin = 0;
        var stockWithCost = 0;

        visibleRows.forEach(function (row) {
          var product = row.product;
          var stock = Number(product.stock) || 0;
          var price = Number(product.price);
          var cost = product.purchasePrice == null ? NaN : Number(product.purchasePrice);
          var hasStockCost = isFinite(cost) && isFinite(price);
          var potential = hasStockCost ? (price - cost) * stock : null;
          if (potential !== null && stock > 0) {
            stockMargin += potential;
            stockWithCost++;
          }

          var status;
          var statusColor;
          if (row.knownQty > 0) {
            status = row.margin > 0 ? 'Gain réalisé' : row.margin < 0 ? 'Perte réalisée' : 'Équilibre';
            if (row.unknownQty) status += ' · partiel';
            statusColor = row.margin > 0 ? 'text-success' : row.margin < 0 ? 'text-error' : 'text-on-surface-variant';
            if (row.margin > 0) gains++;
            else if (row.margin < 0) losses++;
          } else if (hasStockCost && stock > 0) {
            var unitMargin = price - cost;
            status = unitMargin > 0 ? 'Gain estimé / unité' : unitMargin < 0 ? 'Perte estimée / unité' : 'Équilibre estimé';
            statusColor = unitMargin > 0 ? 'text-success' : unitMargin < 0 ? 'text-error' : 'text-on-surface-variant';
            if (unitMargin > 0) gains++;
            else if (unitMargin < 0) losses++;
          } else if (row.unknownQty) {
            status = 'Coût historique incomplet';
            statusColor = 'text-on-surface-variant';
          } else {
            status = 'Prix d’achat manquant';
            statusColor = 'text-on-surface-variant';
          }

          var historyNote = row.knownQty && row.unknownQty
            ? row.knownQty + ' unité(s) avec coût connu · ' + row.unknownQty + ' sans coût historique.'
            : row.unknownQty
              ? row.unknownQty + ' unité(s) vendue(s) sans coût historique.'
              : row.knownQty
                ? row.knownQty + ' unité(s) vendue(s) avec coût connu.'
                : 'Aucune vente conservée pour ce produit.';
          var card = document.createElement('article');
          card.className = 'rounded-xl bg-surface-container-lowest p-space-md shadow-sm';
          card.innerHTML =
            '<div class="flex items-start justify-between gap-3">' +
              '<div class="min-w-0"><span class="text-[10px] uppercase tracking-wider text-secondary">' + escapeHtml(product.cat || 'Beauty') + '</span>' +
              '<h4 class="font-semibold text-primary truncate">' + escapeHtml(product.name) + '</h4>' +
              '<p class="text-xs text-on-surface-variant mt-1">Vendu : ' + row.sold + ' unité(s) · Stock : ' + stock + '</p></div>' +
              '<span class="text-right text-xs font-semibold ' + statusColor + '">' + status + '</span>' +
            '</div><div class="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-surface-container">' +
              '<div><span class="block text-[10px] text-on-surface-variant">Marge réalisée</span><strong class="block text-sm text-primary">' +
                (row.knownQty ? money(row.margin) : row.unknownQty ? 'Partielle' : '—') + '</strong></div>' +
              '<div><span class="block text-[10px] text-on-surface-variant">Stock · marge potentielle</span><strong class="block text-sm text-primary">' +
                (potential === null ? 'Coût manquant' : money(potential)) + '</strong></div>' +
            '</div><p class="mt-2 text-[10px] text-on-surface-variant">' + historyNote + '</p>';
          list.appendChild(card);
        });

        empty.classList.toggle('hidden', visibleRows.length !== 0);
        document.getElementById('profit-realized').textContent = knownLines ? money(knownMargin) : 'Données insuffisantes';
        document.getElementById('profit-sales-count').textContent =
          knownLines + ' ligne(s) de vente avec coût connu · ' + unknownLines + ' sans coût historique';
        document.getElementById('profit-gains').textContent = String(gains);
        document.getElementById('profit-losses').textContent = String(losses);
        document.getElementById('profit-stock').textContent = stockWithCost
          ? money(stockMargin) : 'Prix d’achat manquant pour le stock';
      }

      category.addEventListener('change', render);
      events.forEach(function (eventName) { document.addEventListener(eventName, render); });
      this.unmount = function () {
        events.forEach(function (eventName) { document.removeEventListener(eventName, render); });
      };
      render();
    }
  };
})();
