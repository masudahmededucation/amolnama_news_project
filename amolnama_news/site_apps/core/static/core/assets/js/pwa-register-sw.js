if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').then(function (reg) {
      // Force immediate update — no waiting, no asking
      reg.addEventListener('updatefound', function () {
        var newSW = reg.installing;
        if (newSW) {
          newSW.addEventListener('statechange', function () {
            if (newSW.state === 'activated') {
              // Silently reload to use new version
              window.location.reload();
            }
          });
        }
      });
    }).catch(function () {});
  });
}
