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

        function refresh() {
          if (fxRate) fxRate.textContent = KD.fxLabel();
        }

        function showError(on) {
          if (!fxError) return;
          fxError.classList.toggle('hidden', !on);
          if (fxInput) fxInput.classList.toggle('border-error', on);
        }

        if (fxInput) {
          fxInput.value = String(KD.getFxRate());

          const commit = () => {
            const saved = KD.setFxRate(fxInput.value);
            if (saved === null) {
              showError(true);
              return;
            }
            showError(false);
            // on renormalise l'affichage (2300 -> "2 300")
            fxInput.value = String(saved);
            refresh();
            KD.toast('Taux mis à jour : ' + KD.fxLabel());
          };

          // validation en direct pendant la saisie, enregistrement à la sortie
          fxInput.addEventListener('input', () => { showError(false); });
          fxInput.addEventListener('change', commit);
          fxInput.addEventListener('blur', commit);
          fxInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); fxInput.blur(); }
          });
        }

        if (fxReset) {
          fxReset.addEventListener('click', () => {
            KD.resetFxRate();
            if (fxInput) fxInput.value = String(KD.getFxRate());
            showError(false);
            refresh();
            KD.toast('Taux réinitialisé : ' + KD.fxLabel());
          });
        }

        refresh();

        // Micro-interactions for setting toggles and buttons
        document.querySelectorAll('.toggle-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const isChecked = btn.getAttribute('aria-checked') === 'true';
            btn.setAttribute('aria-checked', (!isChecked).toString());
            if (!isChecked) {
              btn.classList.remove('bg-surface-variant', 'justify-start');
              btn.classList.add('bg-primary', 'justify-end');
              KD.toast('Fonction activée');
            } else {
              btn.classList.remove('bg-primary', 'justify-end');
              btn.classList.add('bg-surface-variant', 'justify-start');
              KD.toast('Fonction désactivée');
            }
          });
        });

        const updateBtn = document.getElementById('update-btn');
        if (updateBtn) {
          updateBtn.addEventListener('click', () => {
            KD.toast('Version 2.4.0 Luxe : Votre application est à jour');
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

        /* Une ligne par personne : nom, numéro, role et mot de passe. */
        function row(u) {
          const el = document.createElement('div');
          el.className = 'p-space-sm bg-surface-container-low rounded-lg';
          el.dataset.user = u.id;

          const options = Object.keys(KD.ROLES).map((key) => {
            const sel = u.role === key ? ' selected' : '';
            return '<option value="' + key + '"' + sel + '>' + KD.ROLES[key].label + '</option>';
          }).join('');

          el.innerHTML =
            '<div class="flex items-center gap-2.5">' +
              '<div class="w-8 h-8 shrink-0 rounded-full bg-secondary-container/30 text-secondary font-bold flex items-center justify-center text-xs">' +
                '<span data-initials>' + initials(u.name) + '</span>' +
              '</div>' +
              '<div class="flex-1 min-w-0">' +
                '<input class="w-full bg-transparent outline-none font-body-md text-body-sm font-semibold text-primary" data-field="name" value="' + String(u.name).replace(/"/g, '&quot;') + '" aria-label="Nom">' +
                '<input class="w-full bg-transparent outline-none font-body-sm text-[11px] text-on-surface-variant" data-field="phone" value="' + String(u.phone || '').replace(/"/g, '&quot;') + '" aria-label="Numéro">' +
              '</div>' +
              '<select class="shrink-0 bg-surface-container-lowest border border-surface-variant rounded-md px-2 py-1.5 font-label-sm text-[11px] font-semibold text-primary outline-none" data-field="role" aria-label="Rôle">' + options + '</select>' +
            '</div>' +
            '<div class="flex items-center gap-1.5 mt-2">' +
              '<div class="flex-1 min-w-0 flex items-center gap-1.5 h-8 px-2 rounded-md bg-surface-container-lowest">' +
                '<span class="material-symbols-outlined text-[14px] text-on-surface-variant shrink-0">key</span>' +
                '<input type="password" class="w-full min-w-0 bg-transparent outline-none font-body-sm text-[12px] text-primary" data-field="password" placeholder="' + String(u.password || '').replace(/./g, '•') + '" aria-label="Mot de passe">' +
              '</div>' +
              '<button type="button" class="shrink-0 w-8 h-8 flex items-center justify-center text-on-surface-variant active:scale-90" data-act="see-pass" aria-label="Afficher le mot de passe">' +
                '<span class="material-symbols-outlined text-[15px]">visibility</span>' +
              '</button>' +
              '<button type="button" class="shrink-0 w-8 h-8 flex items-center justify-center text-on-surface-variant active:scale-90" data-act="remove" aria-label="Retirer">' +
                '<span class="material-symbols-outlined text-[15px]">person_remove</span>' +
              '</button>' +
            '</div>';

          /* Les modifications sont enregistrees a la validation du champ,
             pour ne pas ecrire dans le stockage a chaque frappe. */
          el.querySelectorAll('[data-field]').forEach((input) => {
            input.addEventListener('change', () => {
              const field = input.dataset.field;
              const value = input.value;
              if (field === 'password') {
                /* Champ laisse vide : on conserve le mot de passe existant. */
                if (!value) { input.value = ''; return; }
                KD.updateUser(u.id, { password: value });
                input.value = '';
                input.placeholder = value.replace(/./g, '•');
                KD.toast('Mot de passe de ' + initials(u.name) + ' mis à jour');
                return;
              }
              if (field === 'name') {
                KD.updateUser(u.id, { name: value.trim() || u.name });
                el.querySelector('[data-initials]').textContent = initials(value.trim() || u.name);
              } else {
                KD.updateUser(u.id, { [field]: value });
                if (field === 'role') updateCount();
              }
              KD.toast('Fiche mise à jour');
            });
          });

          el.querySelector('[data-act="see-pass"]').addEventListener('click', (e) => {
            const input = el.querySelector('[data-field="password"]');
            const shown = input.type === 'text';
            input.type = shown ? 'password' : 'text';
            e.currentTarget.querySelector('.material-symbols-outlined').textContent = shown ? 'visibility' : 'visibility_off';
          });

          el.querySelector('[data-act="remove"]').addEventListener('click', () => {
            const list = KD.getUsers().filter((x) => x.id !== u.id);
            if (!list.length) { KD.toast('Conserver au moins une personne'); return; }
            KD.saveUsers(list);
            renderTeam();
            KD.toast(u.name + ' retiré de l’équipe');
          });

          return el;
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
        if (teamAdd) {
          teamAdd.addEventListener('click', () => {
            const users = KD.getUsers();
            const n = users.length + 1;
            users.push({ id: 'u' + Date.now(), name: 'Nouvelle personne ' + n, role: 'vendeuse', phone: '', password: '1234', active: true });
            KD.saveUsers(users);
            renderTeam();
            KD.toast('Personne ajoutée');
          });
        }

        if (teamList) renderTeam();

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
