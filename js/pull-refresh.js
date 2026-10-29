/* Actualisation par tirage vers le bas.

   Le geste natif ne suffit pas : iOS ne le propose pas en mode application
   installee, Android le desactive aussi une fois l'application installee, et
   `overscroll-behavior: none` le neutralise ici. On mesure donc le doigt
   nous-memes, ce qui donne le meme resultat sur les deux systemes et dans
   tous les modes d'affichage. */
(function () {
  'use strict';

  var SEUIL_MIN = 64;   /* px de doigt avant de declencher */
  var SEUIL_MAX = 110;
  var ZONE_MORTE = 6;   /* px avant d'armer le geste */
  var FREIN = 0.55;     /* le doigt tire plus loin que l'indicateur */
  var DUREE_MIN = 550;  /* ms : evite un temoin qui clignote */
  var HAUT_TEMOIN = 40;

  var temoin = null;
  var icone = null;
  var etat = null;      /* geste en cours */
  var occupe = false;   /* actualisation en cours */
  var repli = null;     /* minuter du retour en place */

  function seuil() {
    return Math.round(Math.max(SEUIL_MIN, Math.min(SEUIL_MAX, window.innerHeight * 0.14)));
  }

  /* Le temoin se glisse sous l'entete : sur la connexion il n'y a pas
     d'entete, il se pose alors en haut de l'ecran. */
  function poser() {
    var header = document.querySelector('header');
    var haut = 0;
    if (header && !document.body.classList.contains('is-bare')) {
      var r = header.getBoundingClientRect();
      if (r && r.height) haut = r.bottom;
      else haut = 66; /* JSDOM et mises en page non calcules */
    }
    temoin.style.top = Math.round(haut) + 'px';
  }

  function monter() {
    if (temoin) return;
    temoin = document.createElement('div');
    temoin.id = 'kd-ptr';
    temoin.setAttribute('aria-hidden', 'true');
    temoin.innerHTML = '<span class="material-symbols-outlined" id="kd-ptr-icone">keyboard_arrow_down</span>';
    document.body.appendChild(temoin);
    icone = temoin.querySelector('#kd-ptr-icone');
    poser();
  }

  /* Le declenchement se mesure sur les px reels du doigt, mais le temoin se
     deplace avec retenue : il est deja complet avant le seuil, ce qui donne
     le retour "lachez, ca va rafraichir" sans que l'indicateur depasse. */
  function dessiner(dy) {
    if (!temoin) return;
    var p = Math.min(1, dy / seuil());
    var course = Math.min(HAUT_TEMOIN, dy * FREIN);
    temoin.style.transform = 'translateY(' + Math.round(course - HAUT_TEMOIN) + 'px)';
    temoin.style.opacity = String(Math.min(1, course / 14));
    if (icone && !occupe) icone.style.transform = 'rotate(' + Math.round(p * 180) + 'deg)';
  }

  function clavierOuvert() {
    var vv = window.visualViewport;
    return !!vv && window.innerHeight - vv.height - vv.offsetTop > 80;
  }

  function refuse(e) {
    if (occupe) return true;
    if (!e.touches || !e.touches.length) return true;
    /* En haut de page seulement : sinon on contrarie le scroll normal. */
    if (window.scrollY > 0) return true;
    /* Une feuille ou un tiroir ouvert possede deja le geste vertical. */
    if (document.body.classList.contains('kd-sheet-open')) return true;
    if (document.querySelector('#cart-drawer:not(.hidden), #operation-drawer:not(.hidden), dialog[open]')) return true;
    /* Champ focalise : le geste ferait fuir le clavier. */
    var actif = document.activeElement;
    if (actif && /^(input|textarea|select)$/i.test(actif.tagName)) return true;
    if (clavierOuvert()) return true;
    return false;
  }

  function onStart(e) {
    /* Un nouveau contact abandonne le geste precedent : sans cela un
       touchend perdu (le systeme reprend la main) laisserait le geste arme,
       et le prochain lever de doigt declencherait une actualisation que
       personne n'a demandee. */
    if (etat && etat.arme) ranger();
    etat = null;
    if (refuse(e)) return;
    poser();
    var t = e.touches[0];
    etat = { y0: t.clientY, x0: t.clientX, arme: false, dy: 0 };
  }

  function onMove(e) {
    if (!etat) return;
    var t = e.touches[0];
    var dy = t.clientY - etat.y0;
    var dx = t.clientX - etat.x0;

    if (!etat.arme) {
      /* On n'arme que vers le bas et sur un geste vertical : sinon on laisse
         la page scroller normalement. */
      if (dy > ZONE_MORTE && dy > Math.abs(dx)) etat.arme = true;
      else if (dy < -ZONE_MORTE || Math.abs(dx) > Math.abs(dy)) { etat = null; return; }
      else return;
    }

    if (dy <= 0) { etat = null; ranger(); return; }

    /* Des que le geste est arme on prend la main : sans preventDefault,
       iOS fait rebondir la page et Android affiche son propre temoin. */
    if (e.cancelable) e.preventDefault();
    etat.dy = dy;
    dessiner(dy);
  }

  function onEnd() {
    if (!etat) return;
    var arme = etat.arme;
    var dy = etat.dy;
    etat = null;
    if (!arme) return;
    if (dy >= seuil()) actualiser();
    else ranger();
  }

  function ranger() {
    if (!temoin || occupe) return;
    if (repli) clearTimeout(repli);
    temoin.classList.add('kd-ptr-sortie');
    dessiner(0);
    repli = setTimeout(function () {
      if (temoin && !occupe) temoin.classList.remove('kd-ptr-sortie');
    }, 280);
  }

  function actualiser() {
    if (occupe) return;
    occupe = true;
    if (repli) { clearTimeout(repli); repli = null; }
    poser();
    temoin.classList.remove('kd-ptr-sortie');
    temoin.classList.add('kd-ptr-actif');
    temoin.style.transform = 'translateY(0)';
    temoin.style.opacity = '1';
    if (icone) { icone.textContent = 'progress_activity'; icone.style.transform = ''; }

    var depart = Date.now();
    var requetes = [];
    if (typeof KD.reload === 'function') requetes.push(KD.reload());
    if (typeof KD.checkUpdate === 'function') requetes.push(KD.checkUpdate());

    Promise.all(requetes).then(function () {
      /* Duree minimale : sinon le temoin disparait avant d'etre vu. */
      var reste = Math.max(0, DUREE_MIN - (Date.now() - depart));
      setTimeout(function () {
        occupe = false;
        if (temoin) {
          temoin.classList.remove('kd-ptr-actif');
          if (icone) icone.textContent = 'keyboard_arrow_down';
        }
        ranger();
        if (typeof KD.toast === 'function') KD.toast('Actualis\u00e9', 'sync');
      }, reste);
    }, function (err) {
      console.warn('[KD] actualisation incomplete :', err);
      occupe = false;
      if (temoin) temoin.classList.remove('kd-ptr-actif');
      if (icone) icone.textContent = 'keyboard_arrow_down';
      ranger();
      if (typeof KD.toast === 'function') KD.toast('Actualisation impossible', 'cloud_off');
    });
  }

  /* Declenche sans geste : bouton de secours et tests. */
  KD.pullRefresh = function () { actualiser(); };
  KD.pullRefresh.seuil = seuil;

  function init() {
    monter();
    /* touchmove doit pouvoir etre annule : d'ou passive: false, obligatoire
       ici car c'est ce qui empeche iOS de rebondir. */
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd, { passive: true });
    document.addEventListener('touchcancel', onEnd, { passive: true });
    window.addEventListener('resize', poser);
    window.addEventListener('orientationchange', poser);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();