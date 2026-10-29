/* Vue connexion : identifiant puis mot de passe. Appele par KD.views.connexion.mount(). */
(function () {
  'use strict';
  KD.views = KD.views || {};

  KD.views.connexion = {
    title: 'Connexion',
    mount: function () {
      var form = document.getElementById('login-form');
      var idInput = document.getElementById('login-id');
      var passInput = document.getElementById('login-pass');
      var error = document.getElementById('login-error');
      var errorText = document.getElementById('login-error-text');
      var togglePass = document.getElementById('toggle-pass');

      function showError(message) {
        if (!error) return;
        if (message) {
          if (errorText) errorText.textContent = message;
          error.classList.remove('hidden');
        } else {
          error.classList.add('hidden');
        }
      }

      /* Afficher / masquer le mot de passe. */
      if (togglePass) {
        togglePass.addEventListener('click', function () {
          var shown = passInput.type === 'text';
          passInput.type = shown ? 'password' : 'text';
          togglePass.setAttribute('aria-label', shown ? 'Afficher le mot de passe' : 'Masquer le mot de passe');
          togglePass.querySelector('.material-symbols-outlined').textContent = shown ? 'visibility' : 'visibility_off';
          passInput.focus();
        });
      }

      /* Acces rapide : l'application est aussi utilisable sans identification,
         ce qui ne doit pas etre confondu avec une session ouverte. */
      var cancel = document.getElementById('login-cancel');
      if (cancel) {
        cancel.addEventListener('click', function () {
          KD.login();
          KD.go('accueil');
        });
      }

      if (form) {
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          showError(null);

          var id = (idInput.value || '').trim();
          var pass = passInput.value || '';

          if (!id || !pass) {
            showError('Renseignez votre nom et votre mot de passe.');
            (id ? passInput : idInput).focus();
            return;
          }

          var user = KD.authenticate(id, pass);

          if (!user) {
            /* On distingue les deux cas : un identifiant inconnu et un mot de
               passe faux ne doivent pas se ressembler. */
            showError(KD.matchUser(id)
              ? 'Mot de passe incorrect.'
              : 'Personne introuvable dans l’équipe.');
            passInput.select();
            return;
          }

          KD.login(user.id);
          KD.go('accueil');
          KD.toast('Bienvenue, ' + KD.firstName());
        });

        [idInput, passInput].forEach(function (el) {
          if (el) el.addEventListener('input', function () { showError(null); });
        });
      }

      /* Pas de focus au demarrage : sur mobile cela ouvrirait le clavier
         par-dessus la page. On ne cible le mot de passe que si
         l'identifiant est deja rempli. */
      if (idInput.value) passInput.focus();

      /* ---- Clavier iOS/Android ----
         dvh n'est pas reduit par le clavier sur iOS : sans cette mesure le
         bloc reste centre sur une hauteur qui n'est plus visible et le champ
         saisie passe sous le clavier. On suit visualViewport, qui lui est
         fiable sur les deux systemes. */
      var shell = document.querySelector('.login-shell');
      var vv = window.visualViewport;

      function syncViewport() {
        if (!shell || !vv) return;
        /* Plus de 80px de difference = clavier ouvert, pas un simple
           redimensionnement de la fenetre. */
        var hidden = Math.round(window.innerHeight - vv.height - vv.offsetTop);
        shell.style.minHeight = hidden > 80 ? Math.round(vv.height) + 'px' : '';
        if (hidden > 80) {
          var focused = document.activeElement;
          if (focused === idInput || focused === passInput) {
            focused.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }
        }
      }

      if (shell && vv) {
        vv.addEventListener('resize', syncViewport);
        vv.addEventListener('scroll', syncViewport);
        window.addEventListener('orientationchange', syncViewport);
        syncViewport();
        KD.views.connexion.unmount = function () {
          vv.removeEventListener('resize', syncViewport);
          vv.removeEventListener('scroll', syncViewport);
          window.removeEventListener('orientationchange', syncViewport);
        };
      }
    }
  };
})();