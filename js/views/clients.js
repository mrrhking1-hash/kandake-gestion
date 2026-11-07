/* Répertoire client : coordonnées, crédit courant et ventes associées. */
(function () {
  'use strict';
  KD.views = KD.views || {};
  KD.views.clients = {
    title: 'Clients',
    mount: function () {
      var listView = document.getElementById('clients-list-view');
      var detailView = document.getElementById('client-detail-view');
      var formView = document.getElementById('client-form-view');
      var search = document.getElementById('client-search');
      var activeId = null;
      var editId = null;
      var removers = [];
      function on(el, event, fn) { el.addEventListener(event, fn); removers.push(function () { el.removeEventListener(event, fn); }); }
      function money(value) { return KD.money(Number(value) || 0, 'USD'); }
      function salesFor(client) {
        var name = String(client.name || '').trim().toLocaleLowerCase();
        return KD.getSales().filter(function (sale) {
          return sale.clientId === client.id || (!sale.clientId && String(sale.clientName || '').trim().toLocaleLowerCase() === name);
        });
      }
      function spentFor(client) { return salesFor(client).reduce(function (sum, sale) { return sum + (Number(sale.totalUsd) || 0); }, 0); }
      function button(text, cls) { var el = document.createElement('button'); el.type = 'button'; el.className = cls; el.textContent = text; return el; }
      function show(view) {
        listView.classList.toggle('hidden', view !== 'list');
        detailView.classList.toggle('hidden', view !== 'detail');
        formView.classList.toggle('hidden', view !== 'form');
      }
      function renderList() {
        var root = document.getElementById('clients-list');
        var query = String(search.value || '').trim().toLocaleLowerCase();
        root.innerHTML = '';
        var clients = KD.getClients().filter(function (c) { return !query || (c.name + ' ' + c.phone).toLocaleLowerCase().indexOf(query) !== -1; });
        document.getElementById('client-count').textContent = clients.length + (clients.length === 1 ? ' client' : ' clients');
        document.getElementById('clients-empty').classList.toggle('hidden', clients.length > 0);
        clients.forEach(function (client) {
          var card = button('', 'w-full rounded-xl bg-surface-container-lowest p-space-sm shadow-sm text-left active:scale-[0.99]');
          card.className += ' flex items-center justify-between gap-3';
          var info = document.createElement('span'); info.className = 'min-w-0 flex-1';
          var name = document.createElement('strong'); name.className = 'block truncate text-primary'; name.textContent = client.name;
          var phone = document.createElement('span'); phone.className = 'block truncate font-body-sm text-[12px] text-on-surface-variant'; phone.textContent = client.phone || 'Aucun numéro enregistré';
          info.appendChild(name); info.appendChild(phone);
          var amounts = document.createElement('span'); amounts.className = 'shrink-0 text-right';
          var credit = document.createElement('strong'); credit.className = 'block font-data-mono text-primary'; credit.textContent = money(client.creditUsd);
          var spent = document.createElement('span'); spent.className = 'block font-body-sm text-[10px] text-on-surface-variant'; spent.textContent = 'dépensé ' + money(spentFor(client));
          amounts.appendChild(credit); amounts.appendChild(spent); card.appendChild(info); card.appendChild(amounts);
          card.addEventListener('click', function () { activeId = client.id; renderDetail(); show('detail'); });
          root.appendChild(card);
        });
      }
      function renderDetail() {
        var client = KD.getClients().filter(function (c) { return c.id === activeId; })[0];
        if (!client) { show('list'); renderList(); return; }
        document.getElementById('client-detail-name').textContent = client.name;
        document.getElementById('client-detail-phone').textContent = client.phone || 'Aucun numéro enregistré';
        document.getElementById('client-detail-email').textContent = client.email || '';
        document.getElementById('client-detail-address').textContent = client.address || '';
        document.getElementById('client-detail-credit').textContent = money(client.creditUsd);
        document.getElementById('client-detail-spent').textContent = money(spentFor(client));
      }
      function openForm(client) {
        editId = client ? client.id : null;
        document.getElementById('client-form-title').textContent = client ? 'Modifier le client' : 'Nouveau client';
        document.getElementById('client-name').value = client ? client.name : '';
        document.getElementById('client-phone').value = client ? client.phone || '' : '';
        document.getElementById('client-email').value = client ? client.email || '' : '';
        document.getElementById('client-address').value = client ? client.address || '' : '';
        document.getElementById('client-credit').value = client ? Number(client.creditUsd) || 0 : 0;
        document.getElementById('client-save').textContent = client ? 'Enregistrer les changements' : 'Enregistrer le client';
        show('form');
      }
      on(search, 'input', renderList);
      on(document.getElementById('client-add'), 'click', function () { openForm(null); });
      on(document.getElementById('client-form-close'), 'click', function () { show(activeId ? 'detail' : 'list'); });
      on(document.getElementById('client-back-list'), 'click', function () { show('list'); renderList(); });
      on(document.getElementById('client-edit'), 'click', function () {
        var client = KD.getClients().filter(function (c) { return c.id === activeId; })[0];
        if (client) openForm(client);
      });
      on(document.getElementById('client-save'), 'click', function () {
        var name = document.getElementById('client-name').value.trim();
        var phone = document.getElementById('client-phone').value.trim();
        var email = document.getElementById('client-email').value.trim();
        var address = document.getElementById('client-address').value.trim();
        var credit = Number(document.getElementById('client-credit').value);
        if (!name || !isFinite(credit) || credit < 0) { KD.toast('Vérifiez le nom et le crédit saisis.', 'error'); return; }
        var duplicate = KD.findClientByName(name);
        if (duplicate && duplicate.id !== editId) { KD.toast('Un client porte déjà ce nom.', 'error'); return; }
        var ok = editId ? KD.updateClient(editId, { name: name, phone: phone, email: email, address: address, creditUsd: credit })
          : !!KD.addClient({ name: name, phone: phone, email: email, address: address, creditUsd: credit });
        if (!ok) { KD.toast('Le client n’a pas pu être enregistré.', 'error'); return; }
        activeId = editId || KD.findClientByName(name).id;
        renderList(); renderDetail(); show(editId ? 'detail' : 'list');
        KD.toast(editId ? 'Fiche client mise à jour.' : 'Client ajouté.');
      });
      on(document, 'kd:clients', function () { renderList(); if (activeId) renderDetail(); });
      on(document, 'kd:sales', function () { renderList(); if (activeId) renderDetail(); });
      renderList();
      this.unmount = function () { removers.forEach(function (remove) { remove(); }); };
    },
    unmount: function () {}
  };
})();
