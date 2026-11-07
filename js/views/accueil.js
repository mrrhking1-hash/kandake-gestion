/* Vue accueil : logique appelee par KD.views.accueil.mount() apres injection du fragment. */
(function () {
  'use strict';
  KD.views = KD.views || {};

  /* ------------------------------------------------ donnees & formatage */

  function jour(decalage) {
    var d = new Date();
    if (decalage) d.setDate(d.getDate() + decalage);
    return d.getFullYear() + '-' +
      ('0' + (d.getMonth() + 1)).slice(-2) + '-' +
      ('0' + d.getDate()).slice(-2);
  }

  function toutesLesVentes() {
    return typeof KD.getSales === 'function' ? KD.getSales() : [];
  }

  function ventesDuJour() {
    var auj = jour(0);
    return toutesLesVentes().filter(function (v) { return v && v.date === auj; });
  }

  function ventesDe(date) {
    return toutesLesVentes().filter(function (v) { return v && v.date === date; });
  }

  function somme(liste) {
    return liste.reduce(function (total, v) {
      var n = Number(v && v.totalUsd);
      return total + (isFinite(n) ? n : 0);
    }, 0);
  }

  function usd(n) {
    var v = Number(n);
    if (!isFinite(v)) v = 0;
    return '$' + v.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  }

  function pourcent(n) {
    var v = Number(n);
    if (!isFinite(v)) v = 0;
    return v.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' %';
  }

  function pluriel(n, singulier, plurielMot) {
    return n > 1 ? plurielMot : singulier;
  }

  function dateLongue() {
    var texte = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long'
    });
    return texte.charAt(0).toUpperCase() + texte.slice(1);
  }

  function ecrire(id, texte) {
    var el = document.getElementById(id);
    if (el) el.textContent = texte;
  }

  function largeur(id, valeur) {
    var el = document.getElementById(id);
    if (el) el.style.width = valeur + '%';
  }

  /* ------------------------------------------------------------ indicateurs */

  function peindreJour() {
    var auj = ventesDuJour();
    var totalAuj = somme(auj);
    var totalHier = somme(ventesDe(jour(-1)));

    ecrire('home-ventes-total', usd(totalAuj));
    ecrire('home-hier', 'Hier : ' + usd(totalHier));
    ecrire('home-tx', auj.length
      ? auj.length + pluriel(auj.length, ' vente', ' ventes')
      : 'Aucune vente');
    ecrire('home-transactions', String(auj.length));
    ecrire('home-transactions-note', auj.length
      ? pluriel(auj.length, 'Vente du jour', 'Ventes du jour')
      : 'Aucune vente');
    ecrire('home-panier', usd(auj.length ? totalAuj / auj.length : 0));
    ecrire('home-panier-note', auj.length
      ? 'Sur ' + auj.length + pluriel(auj.length, ' vente', ' ventes')
      : 'Aucune vente');

    /* Variation par rapport a la veille : masquee si la veille est vide,
       faute de base de comparaison fiable. */
    var pill = document.getElementById('home-tendance');
    if (pill) {
      if (totalHier > 0) {
        var variation = (totalAuj - totalHier) / totalHier * 100;
        ecrire('home-tendance-txt', (variation >= 0 ? '+' : '') + pourcent(variation));
        ecrire('home-tendance-icon', variation >= 0 ? 'trending_up' : 'trending_down');
        pill.style.display = 'inline-flex';
      } else {
        pill.style.display = 'none';
      }
    }

    /* Repartition Beauty / Art sur les ventes du jour. */
    var beauty = 0;
    var art = 0;
    auj.forEach(function (v) {
      var rub = (v && v.rubriques) || {};
      beauty += Number(rub.Beauty) || 0;
      art += Number(rub.Art) || 0;
    });
    var total = beauty + art;
    var partBeauty = total ? Math.round(beauty / total * 100) : 0;
    var partArt = total ? 100 - partBeauty : 0;
    ecrire('home-univ-beauty', usd(beauty) + ' • ' + pourcent(partBeauty));
    ecrire('home-univ-art', usd(art) + ' • ' + pourcent(partArt));
    largeur('home-univ-bar-beauty', partBeauty);
    largeur('home-univ-bar-art', partArt);
  }

  function peindreStock() {
    var produits = typeof KD.getProducts === 'function' ? KD.getProducts() : [];
    var ruptures = 0;
    var seuils = 0;
    produits.forEach(function (p) {
      if (!p) return;
      if (p.status === 'Rupture') ruptures += 1;
      else if (p.status === 'Faible' || p.status === 'Critique') seuils += 1;
    });
    var traiter = ruptures + seuils;
    ecrire('home-alertes-titre', traiter
      ? traiter + pluriel(traiter, ' article à traiter', ' articles à traiter')
      : 'Aucun article à traiter');
    ecrire('home-alertes-detail', traiter
      ? ruptures + pluriel(ruptures, ' rupture', ' ruptures') + ' • ' +
        seuils + pluriel(seuils, " seuil d'alerte", " seuils d'alerte")
      : 'Tout est en stock');
  }

  /* ------------------------------------------------------- dernieres ventes */

  function libelleRubriques(v) {
    var rub = (v && v.rubriques) || {};
    var beauty = Number(rub.Beauty) || 0;
    var art = Number(rub.Art) || 0;
    if (beauty > 0 && art > 0) return 'Beauty + Art';
    if (art > 0) return 'Art';
    if (beauty > 0) return 'Beauty';
    return '—';
  }

  function libelleDate(date) {
    if (date === jour(0)) return "Aujourd'hui";
    if (date === jour(-1)) return 'Hier';
    return date || '—';
  }

  function carteVente(v) {
    var lien = document.createElement('a');
    lien.className = 'flex items-center justify-between p-3 rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors';
    lien.href = '#/ventes';

    var gauche = document.createElement('div');
    gauche.className = 'flex items-center gap-3 min-w-0';

    var ronde = document.createElement('div');
    ronde.className = 'w-8 h-8 rounded-full bg-success-container text-success flex items-center justify-center shrink-0';
    var icone = document.createElement('span');
    icone.className = 'material-symbols-outlined text-[16px]';
    icone.textContent = 'arrow_downward';
    ronde.appendChild(icone);

    var bloc = document.createElement('div');
    bloc.className = 'min-w-0';
    var titre = document.createElement('span');
    titre.className = 'font-data-mono text-[13px] text-primary font-bold';
    var lignes = Number(v && v.lignes) || 0;
    titre.textContent = lignes
      ? lignes + pluriel(lignes, ' article', ' articles')
      : 'Vente';
    var sous = document.createElement('p');
    sous.className = 'font-body-sm text-[11px] text-on-surface-variant truncate';
    sous.textContent = libelleDate(v && v.date) + ' · ' + libelleRubriques(v);
    bloc.appendChild(titre);
    bloc.appendChild(sous);

    gauche.appendChild(ronde);
    gauche.appendChild(bloc);

    var droite = document.createElement('div');
    droite.className = 'text-right shrink-0';
    var montant = document.createElement('span');
    montant.className = 'font-data-mono text-data-mono text-primary font-bold';
    montant.textContent = '+ ' + usd(v && v.totalUsd);
    var devise = document.createElement('span');
    devise.className = 'block font-label-sm text-[10px] text-secondary font-semibold';
    devise.textContent = (v && v.currency) || 'USD';
    droite.appendChild(montant);
    droite.appendChild(devise);

    lien.appendChild(gauche);
    lien.appendChild(droite);
    return lien;
  }

  function peindreVentes() {
    var liste = document.getElementById('home-ventes-liste');
    if (!liste) return;
    var vide = document.getElementById('home-ventes-vide');
    liste.innerHTML = '';
    var ventes = toutesLesVentes().slice(0, 3);
    if (!ventes.length) {
      if (vide) vide.classList.remove('hidden');
      return;
    }
    if (vide) vide.classList.add('hidden');
    ventes.forEach(function (v) {
      if (v) liste.appendChild(carteVente(v));
    });
  }

  /* ------------------------------------------------------------------ vue */

  KD.views.accueil = {
    title: 'Accueil',
    mount: function () {
      /* La salutation porte le prenom de la personne connectee. */
      var who = document.getElementById('greeting-name');
      if (who) {
        var name = KD.firstName();
        who.textContent = name || 'bonjour';
      }
      ecrire('home-date', dateLongue());
      peindreJour();
      peindreStock();
      peindreVentes();
    }
  };
})();
