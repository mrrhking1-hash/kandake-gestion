/* Vue ventes : logique appelee par KD.views.ventes.mount() apres injection du fragment. */
(function () {
  'use strict';
  KD.views = KD.views || {};

  KD.views.ventes = {
    title: 'Ventes',
    mount: function () {
        var KPI = {
          today:  { label: 'CA aujourd\'hui',    ca: '$3 180',   delta: '+12,6 %', sub: '18 transactions',        prev: 'Hier : 2 820 $',  basket: '$412', rate: '68 %' },
          week:   { label: 'CA sur 7 jours',     ca: '$18 940',  delta: '+9,4 %',  sub: '96 transactions',        prev: 'Semaine pr\u00e9c. : $17 315 $', basket: '$401', rate: '64 %' },
          month:  { label: 'CA sur 30 jours',    ca: '$42 850',  delta: '+18,4 %', sub: '128 transactions',       prev: 'Mois pr\u00e9c. : $36 180 $', basket: '$412', rate: '71 %' }
        };

        var CARDS = Array.prototype.slice.call(document.getElementById('orders').children);
        var EMPTY = document.getElementById('orders-empty');
        var range = 0;
        var kpiKey = 'today';
        var status = 'all';

        /* Meme principe que le stock : apres un rechargement, la periode et le
           statut de commande choisis sont remis en place, pas remis a zero. */
        var ETAT_KEY = 'kandake.ventes-etat';
        function lireEtat() {
          try { return JSON.parse(window.localStorage.getItem(ETAT_KEY) || 'null'); } catch (e) { return null; }
        }
        function sauverEtat() {
          try {
            window.localStorage.setItem(ETAT_KEY, JSON.stringify({ range: range, kpiKey: kpiKey, status: status }));
          } catch (e) {}
        }
        function activeChip(sel, attr, val) {
          document.querySelectorAll(sel).forEach(function (c) {
            var actif = c.getAttribute(attr) === String(val);
            c.classList.toggle('bg-primary', actif);
            c.classList.toggle('text-on-primary', actif);
            c.classList.toggle('bg-surface-container', !actif);
            c.classList.toggle('text-on-surface-variant', !actif);
          });
        }

        function applyFilters() {
          var shown = 0;
          CARDS.forEach(function (card) {
            var okPeriod = parseInt(card.getAttribute('data-days'), 10) <= range;
            var okStatus = status === 'all' || card.getAttribute('data-status') === status;
            var visible = okPeriod && okStatus;
            card.style.display = visible ? '' : 'none';
            if (visible) shown++;
          });
          EMPTY.classList.toggle('hidden', shown !== 0);
        }

        function paintKpi() {
          var k = KPI[kpiKey];
          document.getElementById('kpi-label').textContent = k.label;
          document.getElementById('kpi-ca').textContent = k.ca;
          document.getElementById('kpi-delta').textContent = k.delta;
          document.getElementById('kpi-sub').textContent = k.sub;
          document.getElementById('kpi-prev').textContent = k.prev;
          document.getElementById('kpi-basket').textContent = k.basket;
          document.getElementById('kpi-rate').textContent = k.rate;
        }

        document.querySelectorAll('.period').forEach(function (chip) {
          chip.addEventListener('click', function () {
            range = parseInt(chip.getAttribute('data-days'), 10);
            kpiKey = chip.getAttribute('data-kpi');
            activeChip('.period', 'data-days', range);
            paintKpi();
            applyFilters();
            sauverEtat();
          });
        });

        document.querySelectorAll('.status').forEach(function (chip) {
          chip.addEventListener('click', function () {
            status = chip.getAttribute('data-status');
            activeChip('.status', 'data-status', status);
            applyFilters();
            sauverEtat();
          });
        });

        document.getElementById('orders').addEventListener('click', function (e) {
          var card = e.target.closest('[data-status]');
          if (!card || card.classList.contains('chip')) return;
          var ref = card.querySelector('.font-data-mono').textContent;
          KD.toast('Re\u00e7u ' + ref + ' pr\u00eat \u00e0 l\'envoi WhatsApp', 'receipt_long');
        });

        document.getElementById('export').addEventListener('click', function () {
          KD.toast('Journal des ventes export\u00e9 (' + KPI[kpiKey].label.toLowerCase() + ')', 'download');
        });

        /* Restauration apres rechargement : periode, indicateur et statut
           redeviennent ce qu'ils etaient avant l'actualisation. */
        var etat = lireEtat();
        if (etat && typeof etat === 'object') {
          var chipRange = etat.range != null
            && document.querySelector('.period[data-days="' + etat.range + '"]');
          if (chipRange) {
            range = parseInt(etat.range, 10);
            kpiKey = chipRange.getAttribute('data-kpi');
          } else if (etat.kpiKey && KPI[etat.kpiKey]) {
            kpiKey = etat.kpiKey;
          }
          if (etat.status != null && etat.status !== ''
              && document.querySelector('.status[data-status="' + etat.status + '"]')) {
            status = etat.status;
          }
          activeChip('.period', 'data-days', range);
          activeChip('.status', 'data-status', status);
          paintKpi();
        }

        applyFilters();
    }
  };
})();
