(function () {
  let deferredPrompt = null;
  let isAppInstalled = false;

  function isStandaloneMode() {
    if (!window) return false;
    try {
      if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
    } catch (error) {
      // Ignore browser unsupported matchMedia usage.
    }
    return window.navigator && window.navigator.standalone === true;
  }

  function getDeviceInfo() {
    const ua = window.navigator && window.navigator.userAgent ? window.navigator.userAgent : '';
    const platform = window.navigator && window.navigator.platform ? window.navigator.platform : '';

    const isIOS = /iPhone|iPad|iPod/i.test(ua) || (platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(ua);
    const isMac = /Macintosh/i.test(ua);
    const isWindows = /Windows/i.test(ua);
    const isLinux = /Linux/i.test(ua);

    const isChrome = /Chrome|Chromium/i.test(ua) && !/Edg/i.test(ua);
    const isEdge = /Edg/i.test(ua);
    const isFirefox = /Firefox/i.test(ua);
    const isSafari = /AppleWebKit/i.test(ua) && !/Chrome|Chromium|Edg|Android/i.test(ua);
    const isOpera = /OPR|Opera/i.test(ua);

    // Detect in-app browsers more precisely across Android and iOS.
    // Facebook's app UA strings include marker tokens like FBAN/FBAV/FBIOS on both platforms,
    // while Messenger uses the Messenger app name plus a webkit mobile UA.
    const isFacebookApp = /(?:FBAN|FBAV|FBIOS|FB4A|FB_IAB|FBAAN|FBDV|FBMD)/i.test(ua);
    const isMessengerApp = /Messenger/i.test(ua) && /(?:Android|iPhone|iPad|iPod|AppleWebKit)/i.test(ua);
    const isInstagramApp = /Instagram/i.test(ua);
    const isTwitterApp = /Twitter/i.test(ua);
    const isLinkedInApp = /LinkedInApp/i.test(ua);
    const isWhatsAppApp = /WhatsApp/i.test(ua);
    const isTikTokApp = /TikTok/i.test(ua);
    const isInAppBrowser = isFacebookApp || isMessengerApp || isInstagramApp || isTwitterApp || isLinkedInApp || isWhatsAppApp || isTikTokApp;

    return {
      isIOS,
      isAndroid,
      isMac,
      isWindows,
      isLinux,
      isChrome,
      isEdge,
      isFirefox,
      isSafari,
      isOpera,
      isFacebookApp,
      isMessengerApp,
      isInstagramApp,
      isTwitterApp,
      isLinkedInApp,
      isWhatsAppApp,
      isTikTokApp,
      isInAppBrowser,
      ua
    };
  }

  function getInAppBrowserName(device) {
    if (device.isMessengerApp) return 'Facebook Messenger';
    if (device.isFacebookApp) return 'Facebook App';
    if (device.isInstagramApp) return 'Instagram';
    if (device.isTwitterApp) return 'Twitter';
    if (device.isLinkedInApp) return 'LinkedIn';
    if (device.isWhatsAppApp) return 'WhatsApp';
    if (device.isTikTokApp) return 'TikTok';
    return 'In-App Browser';
  }

  function getInstallInstructions(device) {
    if (device.isIOS) {
      return {
        title: 'Add to Home Screen',
        icon: '⇪',
        text: 'Open this page in Safari on iPhone, tap the Share button, then choose "Add to Home Screen".',
        hint: 'If you opened PAT from Messenger or another app, switch to Safari first, then follow the Share → Add to Home Screen steps.'
      };
    }

    if (device.isAndroid) {
      if (device.isChrome || device.isEdge) {
        return {
          title: 'Install App',
          icon: '⬇',
          text: 'Open the menu (⋮) and tap "Install app" to add PAT to your home screen.',
          hint: 'After installation, launch it from your home screen to continue.'
        };
      }
      return {
        title: 'Add to Home Screen',
        icon: '⬇',
        text: 'Open the menu and choose "Add to Home Screen" to install PAT.',
        hint: 'After installation, launch it from your home screen to continue.'
      };
    }

    if (device.isMac || device.isWindows || device.isLinux) {
      if (device.isChrome || device.isEdge) {
        return {
          title: 'Install App',
          icon: '⬇',
          text: 'Click the install icon in the address bar or use the menu to install PAT as an app.',
          hint: 'After installation, launch it from your applications to continue.'
        };
      }
      return {
        title: 'Install App',
        icon: '⬇',
        text: 'Use your browser menu to add PAT to your applications.',
        hint: 'After installation, launch the installed app to continue.'
      };
    }

    return {
      title: 'Install App',
      icon: '⇪',
      text: 'Please install this app to your device before signing in.',
      hint: 'After installation, reopen it to continue.'
    };
  }

  function setAppState(isAllowed) {
    const appEl = document.getElementById('app');
    const navEl = document.getElementById('bottomNav');
    const currentPage = window.__PAT_CURRENT_PAGE__ || 'login';
    const isAuthPage = currentPage === 'login' || currentPage === 'register';

    if (isAllowed && !isAuthPage) {
      // Mark the app as unlocked for the PWA gate and remove the gating class
      document.body.classList.remove('pwa-gate');
      document.body.classList.add('pwa-gate-unlocked');
      if (appEl) appEl.style.display = '';
      if (navEl) navEl.style.display = 'flex';
      return;
    }

    // Ensure the unlocked marker is removed and the gate is active.
    // Auth pages must always hide the navigation bar even when the app is installed.
    document.body.classList.remove('pwa-gate-unlocked');
    document.body.classList.add('pwa-gate');
    if (appEl) appEl.style.display = isAuthPage ? '' : 'none';
    if (navEl) navEl.style.display = 'none';
  }

  function ensureInstallScreen(screenType = 'install') {
    let screen = document.getElementById('pwa-install-screen');
    if (screen) return screen;

    const device = getDeviceInfo();
    let instructions;

    // PWA-only mode: browsers that are not installed must be blocked until they install PAT.
    if (device.isIOS && !device.isInAppBrowser) {
      instructions = {
        title: 'Add to Home Screen',
        icon: '⌂',
        text: 'PAT only opens in standalone mode. Open this page in Safari, tap the Share button, then choose "Add to Home Screen".',
        hint: 'After installation, launch PAT from your home screen to continue.',
        isInAppBrowser: false
      };
    }

    if (screenType === 'inapp-browser') {
      const browserName = getInAppBrowserName(device);
      instructions = {
        title: 'Open in Safari',
        icon: '🔗',
        text: browserName === 'Facebook Messenger' ? 'PAT must be opened in Safari on iPhone. Please leave Messenger, open Safari, then tap Share → Add to Home Screen.' : 'This app works best in a normal browser. Please open this page in your device browser to continue.',
        hint: browserName + ' detected. On iPhone, use Safari and tap Share, then choose "Add to Home Screen".',
        isInAppBrowser: true
      };
    } else {
      instructions = getInstallInstructions(device);
    }

    screen = document.createElement('div');
    screen.id = 'pwa-install-screen';
    screen.setAttribute('role', 'dialog');
    screen.setAttribute('aria-live', 'polite');

    const card = document.createElement('div');
    card.className = 'pwa-install-card';

    const icon = document.createElement('div');
    icon.className = 'pwa-install-icon';
    icon.textContent = instructions.icon;

    const title = document.createElement('h1');
    title.textContent = instructions.title;

    const text = document.createElement('p');
    text.textContent = instructions.text;

    const hint = document.createElement('p');
    hint.className = 'pwa-install-hint';
    hint.textContent = instructions.hint;

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'pwa-install-buttons';

    if (instructions.isInAppBrowser) {
      // For in-app browsers like Facebook Messenger, the page is intentionally blocked.
      // Users must exit the app and install/open PAT in Safari or the installed PWA.
    } else if (device.isIOS && !device.isInAppBrowser) {
      const installBtn = document.createElement('button');
      installBtn.className = 'pwa-install-btn pwa-install-btn-primary';
      installBtn.textContent = 'Add to Home Screen';
      installBtn.addEventListener('click', () => {
        // iOS Safari does not support the install prompt; guide the user to use the Share sheet.
        alert('On iPhone, tap the Share button in Safari and choose "Add to Home Screen".');
      });
      buttonContainer.appendChild(installBtn);
    } else if (deferredPrompt) {
      const installBtn = document.createElement('button');
      installBtn.className = 'pwa-install-btn pwa-install-btn-primary';
      installBtn.textContent = 'Install Now';

      installBtn.addEventListener('click', async () => {
        // show spinner and disable button while prompt runs
        try {
          installBtn.disabled = true;
          if (!installBtn.dataset.origText) installBtn.dataset.origText = installBtn.textContent;
          const spinner = document.createElement('span');
          spinner.className = 'install-spinner';
          spinner.setAttribute('aria-hidden', 'true');
          installBtn.prepend(spinner);
        } catch (e) {}

        if (deferredPrompt) {
          try {
            deferredPrompt.prompt();
            const result = await deferredPrompt.userChoice;
            if (result && result.outcome === 'accepted') {
              isAppInstalled = true;
              localStorage.setItem('pwa_installed', '1');
              syncPwaGate();
              return;
            }
          } catch (err) {
            console.error('Install prompt error:', err);
          }
          deferredPrompt = null;
          // show install screen in case the prompt was dismissed
          ensureInstallScreen('install');
        }

        // cleanup spinner and re-enable
        try {
          const s = installBtn.querySelector('.install-spinner');
          if (s) s.remove();
          if (installBtn.dataset.origText) installBtn.textContent = installBtn.dataset.origText;
          installBtn.disabled = false;
        } catch (e) {}
      });
      buttonContainer.appendChild(installBtn);
    }


    card.appendChild(icon);
    card.appendChild(title);
    card.appendChild(text);
    card.appendChild(hint);
    card.appendChild(buttonContainer);
    screen.appendChild(card);
    document.body.appendChild(screen);

    return screen;
  }

  function removeInstallScreen() {
    const screen = document.getElementById('pwa-install-screen');
    if (screen) screen.remove();
  }

  function checkInstallStatus() {
    const device = getDeviceInfo();

    // PWA-only access: the app must be installed / launched in standalone mode.
    // Browsers that are not installed as a PWA are blocked entirely.
    if (isStandaloneMode() || localStorage.getItem('pwa_installed') === '1') {
      isAppInstalled = true;
      return true;
    }
    isAppInstalled = false;
    return false;
  }

  function syncPwaGate() {
    const device = getDeviceInfo();
    const isInstalled = checkInstallStatus();

    // Block in-app browsers entirely (even if installed)
    if (device.isInAppBrowser) {
      setAppState(false);
      ensureInstallScreen('inapp-browser');
      return;
    }

    // Only allow access once the app is installed as a standalone PWA.
    if (!isInstalled) {
      setAppState(false);
      ensureInstallScreen('install');
      showIOSInstallBanner();
      return;
    }

    // Allow installed apps
    setAppState(true);
    removeInstallScreen();
    removeIOSInstallBanner();
  }

  function showIOSInstallBanner() {
    try {
      const alreadySeen = sessionStorage.getItem('ios-install-banner-seen') === '1';
      if (alreadySeen || document.getElementById('ios-install-banner')) return;
    } catch (e) { /* ignore */ }

    const banner = document.createElement('div');
    banner.id = 'ios-install-banner';
    banner.setAttribute('role', 'status');
    banner.textContent = 'iPhone: Share → Add to Home Screen';
    Object.assign(banner.style, {
      position: 'fixed',
      left: '50%',
      bottom: '92px',
      transform: 'translateX(-50%)',
      background: 'rgba(11, 87, 164, 0.96)',
      color: '#fff',
      padding: '8px 12px',
      borderRadius: '999px',
      fontSize: '11px',
      fontWeight: '700',
      letterSpacing: '0.02em',
      zIndex: '2147483646',
      boxShadow: '0 6px 18px rgba(11, 87, 164, 0.18)',
      whiteSpace: 'nowrap',
      cursor: 'pointer'
    });

    banner.addEventListener('click', () => {
      try { sessionStorage.setItem('ios-install-banner-seen', '1'); } catch (e) {}
      alert('On iPhone, tap the Share button in Safari and choose "Add to Home Screen".');
    });

    try { sessionStorage.setItem('ios-install-banner-seen', '1'); } catch (e) {}
    document.body.appendChild(banner);
  }

  function removeIOSInstallBanner() {
    const banner = document.getElementById('ios-install-banner');
    if (banner) banner.remove();
  }

  // Hide navigation initially (before DOM is ready) to prevent flash
  const style = document.createElement('style');
  style.textContent = 'body:not(.pwa-gate-unlocked) #bottomNav { display: none !important; }';
  document.head.appendChild(style);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncPwaGate, { once: true });
  } else {
    syncPwaGate();
  }

  const standaloneMedia = window.matchMedia && window.matchMedia('(display-mode: standalone)');
  if (standaloneMedia) {
    if (standaloneMedia.addEventListener) {
      standaloneMedia.addEventListener('change', syncPwaGate);
    } else if (standaloneMedia.addListener) {
      standaloneMedia.addListener(syncPwaGate);
    }
  }

  window.addEventListener('pageshow', syncPwaGate);

  // Listen for beforeinstallprompt (Chrome, Edge, Opera)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const screen = document.getElementById('pwa-install-screen');
    if (screen) {
      screen.remove();
      ensureInstallScreen('install');
    }
  });

  // Listen for appinstalled event
  window.addEventListener('appinstalled', () => {
    isAppInstalled = true;
    localStorage.setItem('pwa_installed', '1');
    deferredPrompt = null;
    syncPwaGate();
  });
})();
