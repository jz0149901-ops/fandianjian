'use strict';

(() => {
  let deferredPrompt;
  const installDialog = document.createElement('dialog');
  installDialog.setAttribute('aria-labelledby', 'installTitle');
  installDialog.innerHTML = '<div class="row"><h2 id="installTitle">把饭点见放到手机桌面</h2>' +
    '<form method="dialog"><button class="link-button">关闭</button></form></div>' +
    '<p><strong>iPhone</strong>　用 Safari 打开，点「分享」→「添加到主屏幕」。如果有「作为网页 App 打开」，可开启它。</p>' +
    '<p><strong>Android</strong>　用 Chrome 打开，点右上角菜单 →「添加到主屏幕」或「安装应用」。</p>' +
    '<p class="subtle">此页面使用当前浏览器的本地演示数据。</p>';
  document.body.append(installDialog);

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt=event;
  });
  document.addEventListener('click', async event => {
    if (!event.target.closest?.('[data-install]')) return;
    if (!deferredPrompt) {
      if (!installDialog.open) installDialog.showModal();
      return;
    }
    const prompt=deferredPrompt;
    deferredPrompt=undefined;
    try {
      await prompt.prompt();
    } catch {
      if (!installDialog.open) installDialog.showModal();
    }
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }, {once:true});
  }
})();
