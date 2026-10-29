/* Vue finances : logique appelee par KD.views.finances.mount() apres injection du fragment. */
(function () {
  'use strict';
  KD.views = KD.views || {};

  KD.views.finances = {
    title: 'Finances',
    mount: function () {
        // DOM Interactions & Tactile Delights
        (function() {

          // 2. Drawer Modal Behavior
          const drawer = document.getElementById('operation-drawer');
          const openBtn = document.getElementById('btn-add-tx');
          const closeBtn = document.getElementById('close-drawer');
          const submitBtn = document.getElementById('submit-operation');
          const exportBtn = document.getElementById('btn-export');
          const toast = document.getElementById('toast');
          const toastText = document.getElementById('toast-text');

          function showToast(msg) {
            toastText.textContent = msg;
            toast.classList.remove('opacity-0', 'pointer-events-none');
            toast.classList.add('opacity-100');
            setTimeout(() => {
              toast.classList.add('opacity-0', 'pointer-events-none');
              toast.classList.remove('opacity-100');
            }, 2400);
          }

          if (openBtn && drawer) {
            openBtn.addEventListener('click', () => {
              drawer.classList.remove('hidden');
              drawer.classList.add('flex');
            });
          }

          if (closeBtn && drawer) {
            closeBtn.addEventListener('click', () => {
              drawer.classList.add('hidden');
              drawer.classList.remove('flex');
            });
          }

          if (submitBtn && drawer) {
            submitBtn.addEventListener('click', () => {
              drawer.classList.add('hidden');
              drawer.classList.remove('flex');
              showToast('Opération comptabilisée');
            });
          }

          if (exportBtn) {
            exportBtn.addEventListener('click', () => {
              showToast('Rapport financier Octobre généré');
            });
          }

          // Toggle In / Out Tabs inside Drawer
          const tabIn = document.getElementById('tab-in');
          const tabOut = document.getElementById('tab-out');
          if (tabIn && tabOut) {
            tabIn.addEventListener('click', () => {
              tabIn.classList.add('bg-surface-container-lowest', 'text-primary', 'font-bold', 'shadow-sm');
              tabIn.classList.remove('text-on-surface-variant');
              tabOut.classList.remove('bg-surface-container-lowest', 'text-primary', 'font-bold', 'shadow-sm');
              tabOut.classList.add('text-on-surface-variant');
            });
            tabOut.addEventListener('click', () => {
              tabOut.classList.add('bg-surface-container-lowest', 'text-primary', 'font-bold', 'shadow-sm');
              tabOut.classList.remove('text-on-surface-variant');
              tabIn.classList.remove('bg-surface-container-lowest', 'text-primary', 'font-bold', 'shadow-sm');
              tabIn.classList.add('text-on-surface-variant');
            });
          }
        })();
    }
  };
})();
