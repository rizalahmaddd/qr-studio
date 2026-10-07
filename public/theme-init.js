try {
  var t = JSON.parse(localStorage.getItem('qr.theme') || '"auto"');
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
} catch (e) {}
