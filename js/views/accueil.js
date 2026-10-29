/* Vue accueil : logique appelee par KD.views.accueil.mount() apres injection du fragment. */
(function () {
  'use strict';
  KD.views = KD.views || {};

  KD.views.accueil = {
    title: 'Accueil',
    mount: function () {
      /* La salutation porte le prenom de la personne connectee. */
      var who = document.getElementById('greeting-name');
      if (who) {
        var name = KD.firstName();
        who.textContent = name || 'bonjour';
      }
    }
  };
})();
