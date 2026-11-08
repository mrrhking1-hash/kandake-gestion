/* Vue reglages : logique appelee par KD.views.reglages.mount() apres injection du fragment. */
(function () {
  'use strict';
  KD.views = KD.views || {};

  KD.views.reglages = {
    title: 'Réglages',
    mount: function () {
        /* ---------------------------------------------------------- taux de change
           Le taux est modifiable et memorise sur l'appareil (KD.setFxRate) ;
           la caisse le relit a chaque conversion, sans rechargement. */
        const fxInput = document.getElementById('fx-input');
        const fxError = document.getElementById('fx-error');
        const fxRate = document.getElementById('fx-rate');
        const fxReset = document.getElementById('fx-reset');
        const fxEditor = document.getElementById('fx-editor');
        let fxLock = null;

        function refresh() {
          if (fxRate) fxRate.textContent = KD.fxLabel();
        }

        function showError(on) {
          if (!fxError) return;
          fxError.classList.toggle('hidden', !on);
          if (fxInput) fxInput.classList.toggle('border-error', on);
        }

        function closeFxEditor() {
          fxEditor.classList.add('hidden'); fxEditor.classList.remove('flex');
          if (KD.unfreezeFormSheet) KD.unfreezeFormSheet(fxEditor, fxLock);
          fxLock = null;
        }
        document.getElementById('fx-edit').addEventListener('click', () => {
          fxInput.value = String(KD.getFxRate());
          fxEditor.classList.remove('hidden'); fxEditor.classList.add('flex');
          if (KD.freezeFormSheet) fxLock = KD.freezeFormSheet(fxEditor);
          fxInput.focus();
        });
        fxEditor.querySelectorAll('[data-form-close], [data-form-cancel]').forEach((button) => button.addEventListener('click', closeFxEditor));
        fxEditor.addEventListener('click', (event) => { if (event.target === fxEditor || event.target.hasAttribute('data-form-backdrop')) closeFxEditor(); });
        document.getElementById('fx-save').addEventListener('click', () => {
            const saved = KD.setFxRate(fxInput.value);
            if (saved === null) {
              showError(true); fxInput.focus();
              return;
            }
            showError(false);
            refresh();
            closeFxEditor();
            KD.toast('Taux mis à jour : ' + KD.fxLabel());
        });
        fxInput.addEventListener('input', () => showError(false));
        fxInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('fx-save').click(); } });

        if (fxReset) {
          fxReset.addEventListener('click', () => {
            KD.resetFxRate();
            showError(false);
            refresh();
            KD.toast('Taux réinitialisé : ' + KD.fxLabel());
          });
        }

        refresh();

        /* Le partage est un réglage local réellement appliqué après encaissement. */
        const shareSwitch = document.getElementById('share-receipt-switch');
        if (shareSwitch) {
          var shareOn = window.localStorage.getItem('kandake.share-receipt') === 'true';
          function paintShare() { shareSwitch.setAttribute('aria-checked', String(shareOn)); shareSwitch.classList.toggle('bg-primary', shareOn); shareSwitch.classList.toggle('justify-end', shareOn); shareSwitch.classList.toggle('bg-surface-variant', !shareOn); shareSwitch.classList.toggle('justify-start', !shareOn); }
          paintShare();
          shareSwitch.addEventListener('click', function () { shareOn = !shareOn; window.localStorage.setItem('kandake.share-receipt', String(shareOn)); paintShare(); KD.toast(shareOn ? 'Partage du reçu proposé après encaissement' : 'Partage du reçu désactivé'); });
        }
        var user = KD.currentUser && KD.currentUser();
        var userName = document.getElementById('settings-user-name'); if (userName && user) userName.textContent = user.name;
        var userRole = document.getElementById('settings-user-role'); if (userRole && user) userRole.textContent = (KD.ROLES[user.role] || {}).label || 'Compte';
        var store = {}; try { store = JSON.parse(localStorage.getItem('kandake.store-profile') || '{}'); } catch (e) {}
        function paintStore() { var n=document.getElementById('store-name'), a=document.getElementById('store-address'); if(n)n.textContent=store.name||'Kandake Maison & Beauté'; if(a)a.textContent=store.address||'Adresse non renseignée'; }
        paintStore();
        var storeEditor=document.getElementById('store-editor');
        var storeLock=null;
        function closeStoreEditor(){if(!storeEditor)return;storeEditor.classList.add('hidden');storeEditor.classList.remove('flex');if(KD.unfreezeFormSheet)KD.unfreezeFormSheet(storeEditor,storeLock);storeLock=null;}
        var editStore=document.getElementById('edit-store');
        if(editStore)editStore.addEventListener('click',function(){
          document.getElementById('store-edit-name').value=store.name||'Kandake Maison & Beauté';
          document.getElementById('store-edit-address').value=store.address||'';
          storeEditor.classList.remove('hidden');storeEditor.classList.add('flex');
          if(KD.freezeFormSheet)storeLock=KD.freezeFormSheet(storeEditor);
          document.getElementById('store-edit-name').focus();
        });
        ['store-edit-close','store-edit-cancel'].forEach(function(id){var button=document.getElementById(id);if(button)button.addEventListener('click',closeStoreEditor);});
        storeEditor.addEventListener('click',function(event){if(event.target===storeEditor||event.target.hasAttribute('data-store-backdrop'))closeStoreEditor();});
        document.getElementById('store-edit-save').addEventListener('click',function(){
          store.name=document.getElementById('store-edit-name').value.trim()||'Kandake Maison & Beauté';
          store.address=document.getElementById('store-edit-address').value.trim();
          localStorage.setItem('kandake.store-profile',JSON.stringify(store));paintStore();closeStoreEditor();KD.toast('Identité de la boutique enregistrée');
        });
        function onSettingsKeydown(event){if(event.key==='Escape'){if(storeEditor&&!storeEditor.classList.contains('hidden'))closeStoreEditor();if(fxEditor&&!fxEditor.classList.contains('hidden'))closeFxEditor();if(teamEditor&&!teamEditor.classList.contains('hidden'))closeTeamEditor();}}
        document.addEventListener('keydown',onSettingsKeydown);
        var network=document.getElementById('network-status'); function paintNetwork(){if(network)network.textContent=navigator.onLine?'En ligne · données locales':'Hors ligne · données locales';} window.addEventListener('online',paintNetwork);window.addEventListener('offline',paintNetwork);paintNetwork();
        var productCount=document.getElementById('local-products-count');if(productCount&&KD.getProducts)productCount.textContent=KD.getProducts().length+' référence(s) catalogue enregistrées localement';
        var backup=document.getElementById('backup-export');if(backup)backup.addEventListener('click',function(){var keys=['kandake.products','kandake.sales','kandake.mouvements','kandake.clients','kandake.commandes-fournisseurs','kandake.fx_rate','kandake.store-profile'];var data={format:'kandake-backup-v1',createdAt:new Date().toISOString(),data:{}};keys.forEach(function(k){var v=localStorage.getItem(k);if(v!==null)data.data[k]=v;});var blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='kandake-sauvegarde.json';a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);KD.toast('Copie locale téléchargée · comptes exclus');});

        const updateBtn = document.getElementById('update-btn');
        if (updateBtn) {
          updateBtn.addEventListener('click', () => {
            if (typeof KD.checkUpdate !== 'function') {
              KD.toast('Mise à jour indisponible sur cet appareil', 'cloud_off');
              return;
            }
            KD.toast('Recherche de mise à jour…', 'progress_activity');
            KD.checkUpdate().then((disponible) => {
              /* Si une version attend, KD.checkUpdate a déjà affiché la
                 barre "Nouvelle version disponible" : inutile d'en rajouter. */
              if (!disponible) KD.toast('Votre application est à jour', 'check_circle');
            }).catch(() => {
              KD.toast('Vérification impossible hors connexion', 'cloud_off');
            });
          });
        }

        /* ------------------------------------------------ équipe & rôles */
        const teamList = document.getElementById('team-list');
        const teamCount = document.getElementById('team-count');

        function initials(name) {
          return String(name || '?')
            .trim().split(/\s+/).slice(0, 2)
            .map((w) => w[0]).join('').toUpperCase();
        }

        const teamEditor = document.getElementById('team-editor');
        let editingUserId = null, teamLock = null;
        const teamRole = document.getElementById('team-edit-role');
        teamRole.innerHTML = Object.keys(KD.ROLES).map((key) => '<option value="' + key + '">' + KD.ROLES[key].label + '</option>').join('');
        function closeTeamEditor() {
          teamEditor.classList.add('hidden'); teamEditor.classList.remove('flex');
          if (KD.unfreezeFormSheet) KD.unfreezeFormSheet(teamEditor, teamLock);
          teamLock = null;
        }
        teamEditor.querySelectorAll('[data-form-close], [data-form-cancel]').forEach((button) => button.addEventListener('click', closeTeamEditor));
        teamEditor.addEventListener('click', (event) => { if (event.target === teamEditor || event.target.hasAttribute('data-form-backdrop')) closeTeamEditor(); });
        function openTeamEditor(user) {
          editingUserId = user ? user.id : null;
          document.getElementById('team-editor-title').textContent = user ? 'Modifier la personne' : 'Ajouter une personne';
          document.getElementById('team-edit-name').value = user ? user.name : '';
          document.getElementById('team-edit-phone').value = user ? (user.phone || '') : '';
          teamRole.value = user ? user.role : 'vendeuse';
          document.getElementById('team-edit-password').value = '';
          document.getElementById('team-password-help').textContent = user ? 'Laisser vide pour conserver le mot de passe actuel.' : 'Choisissez un mot de passe d’au moins 4 caractères.';
          document.getElementById('team-edit-password').required = !user;
          document.getElementById('team-edit-error').classList.add('hidden');
          teamEditor.classList.remove('hidden'); teamEditor.classList.add('flex');
          if (KD.freezeFormSheet) teamLock = KD.freezeFormSheet(teamEditor);
          document.getElementById('team-edit-name').focus();
        }
        document.getElementById('team-edit-save').addEventListener('click', () => {
          const name = document.getElementById('team-edit-name').value.trim();
          const phone = document.getElementById('team-edit-phone').value.trim();
          const role = teamRole.value;
          const password = document.getElementById('team-edit-password').value;
          const error = document.getElementById('team-edit-error');
          const showTeamError = (message) => { error.textContent = message; error.classList.remove('hidden'); };
          if (!name) { showTeamError('Le nom est requis.'); return; }
          if (!editingUserId && password.length < 4) { showTeamError('Le mot de passe doit contenir au moins 4 caractères.'); return; }
          if (editingUserId) {
            const changes = { name, phone, role };
            if (password) changes.password = password;
            if (!KD.updateUser(editingUserId, changes)) { showTeamError('Impossible d’enregistrer ces modifications. Vérifiez les droits et le compte administrateur.'); return; }
          } else {
            const users = KD.getUsers();
            users.push({ id: 'u' + Date.now(), name, phone, role, password, active: true });
            if (!KD.saveUsers(users)) { showTeamError('Impossible d’enregistrer cette personne.'); return; }
          }
          closeTeamEditor(); renderTeam(); KD.toast(editingUserId ? 'Fiche mise à jour' : 'Personne ajoutée');
        });
        function row(u) {
          const el = document.createElement('div');
          el.className = 'p-space-sm bg-surface-container-low rounded-lg flex items-center gap-2.5';
          const avatar = document.createElement('span'); avatar.className = 'w-9 h-9 rounded-full bg-secondary-container/30 text-secondary font-bold flex items-center justify-center text-xs shrink-0'; avatar.textContent = initials(u.name);
          const info = document.createElement('div'); info.className = 'flex-1 min-w-0';
          const name = document.createElement('p'); name.className = 'font-body-md text-body-sm font-semibold text-primary truncate'; name.textContent = u.name;
          const meta = document.createElement('p'); meta.className = 'font-body-sm text-[11px] text-on-surface-variant truncate'; meta.textContent = (u.phone || 'Téléphone non renseigné') + ' · ' + ((KD.ROLES[u.role] || {}).label || u.role);
          info.append(name, meta);
          const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'w-9 h-9 rounded-full bg-surface-container-lowest text-secondary'; edit.setAttribute('aria-label', 'Modifier ' + u.name); edit.innerHTML = '<span class="material-symbols-outlined">edit</span>'; edit.addEventListener('click', () => openTeamEditor(u));
          const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'w-9 h-9 rounded-full bg-surface-container-lowest text-error'; remove.setAttribute('aria-label', 'Retirer ' + u.name); remove.innerHTML = '<span class="material-symbols-outlined">person_remove</span>';
          remove.addEventListener('click', () => { const list = KD.getUsers().filter((x) => x.id !== u.id); if (!list.length) { KD.toast('Conserver au moins une personne'); return; } if (!KD.saveUsers(list)) { KD.toast('Conserver un administrateur et votre compte actif'); return; } renderTeam(); KD.toast(u.name + ' retiré de l’équipe'); });
          el.append(avatar, info, edit, remove); return el;
        }

        function updateCount() {
          const users = KD.getUsers();
          const admins = users.filter((u) => u.role === 'admin').length;
          teamCount.textContent = users.length + (users.length > 1 ? ' personnes' : ' personne') +
            ' · ' + admins + ' admin' + (admins > 1 ? 's' : '');
        }

        function renderTeam() {
          const users = KD.getUsers();
          teamList.innerHTML = '';
          users.forEach((u) => teamList.appendChild(row(u)));
          updateCount();
        }

        const teamAdd = document.getElementById('team-add');
        if (teamAdd) teamAdd.addEventListener('click', () => openTeamEditor(null));

        if (teamList) renderTeam();

        this.unmount = function () {
          document.removeEventListener('keydown', onSettingsKeydown);
          window.removeEventListener('online', paintNetwork); window.removeEventListener('offline', paintNetwork);
          if (storeEditor && !storeEditor.classList.contains('hidden')) closeStoreEditor();
          if (fxEditor && !fxEditor.classList.contains('hidden')) closeFxEditor();
          if (teamEditor && !teamEditor.classList.contains('hidden')) closeTeamEditor();
        };

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
          logoutBtn.addEventListener('click', function () {
            /* Ferme la session puis renvoie vers la page de connexion.
               KD.go applique la garde de session et redirige.
               Pas de toast ici : la redirection le detruirait aussitôt. */
            KD.logout();
            KD.go('accueil');
          });
        }
    }
  };
})();
