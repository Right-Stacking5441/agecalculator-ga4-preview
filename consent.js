/* agecalculator.com Google Consent Mode v2. Analytics is off until the
   visitor accepts. Never loads or fires GA on localhost, previews, or any
   host other than agecalculator.com and www.agecalculator.com. */
(function () {
  var KEY = 'agecalculator.analyticsConsent';
  var GA_MEASUREMENT_ID = 'G-DQQ5G4H336';
  var host = location.hostname;
  var isProd = host === 'agecalculator.com' || host === 'www.agecalculator.com';
  var gaTransportBlocked = false;
  var cookieSettingsOpener = null;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };

  window.gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500
  });

  function siteRoot() {
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src || '';
      var m = src.match(/^(.*)\/consent\.js(?:\?|$)/);
      if (m) {
        return m[1].replace(/\/$/, '') + '/';
      }
    }
    return '/';
  }

  function siteRootPath() {
    try {
      return new URL(siteRoot()).pathname.replace(/\/$/, '') || '';
    } catch (e) {
      return '';
    }
  }

  function pathWithinSite(pathname) {
    var p = pathname || location.pathname;
    var root = siteRootPath();
    if (root && (p === root || p.indexOf(root + '/') === 0)) {
      p = p.slice(root.length) || '/';
    }
    p = p.replace(/\/index\.html$/i, '/');
    if (p && p.charAt(0) !== '/') {
      p = '/' + p;
    }
    return p || '/';
  }

  function isEmbedOrWidget(pathname) {
    var p = pathWithinSite(pathname).replace(/\/$/, '') || '/';
    return p === '/embed' || p === '/widget';
  }

  /* Drop the query string (dob, tz, today, on, year, a, b, start, end,
     test, in, age, months, size, had, inc, demo, and any later date or
     name parameter) and collapse /past/1990/ to /past/. */
  function sanitizeAnalyticsUrl(raw) {
    if (!raw) {
      return '';
    }
    try {
      var u = new URL(raw, location.href);
      u.search = '';
      u.hash = '';
      u.pathname = u.pathname
        .replace(/(\/past)\/\d{4}\/index\.html$/i, '$1/')
        .replace(/(\/past)\/\d{4}\/?$/, '$1/');
      return u.toString();
    } catch (e) {
      return '';
    }
  }

  function sanitizedTitle(pathname, title) {
    var p = pathWithinSite(pathname || location.pathname);
    if (/^\/past\/\d{4}\/?$/.test(p)) {
      return 'How old was I? Age on any past date';
    }
    return title || document.title || '';
  }

  function analyticsPageFields() {
    var loc = sanitizeAnalyticsUrl(location.href);
    var ref = sanitizeAnalyticsUrl(document.referrer);
    var fields = {
      page_location: loc,
      page_title: sanitizedTitle(),
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    };
    if (ref) {
      fields.page_referrer = ref;
    }
    return fields;
  }

  function scrubCollectUrlString(url) {
    if (!url) {
      return url;
    }
    try {
      var u = new URL(url, location.href);
      if (!/google-analytics\.com$|\.google-analytics\.com$|analytics\.google\.com$/.test(u.hostname)) {
        return url;
      }
      if (u.searchParams.has('dl')) {
        u.searchParams.set('dl', sanitizeAnalyticsUrl(u.searchParams.get('dl')));
      }
      if (u.searchParams.has('dr')) {
        var cleanedDr = sanitizeAnalyticsUrl(u.searchParams.get('dr'));
        if (cleanedDr) {
          u.searchParams.set('dr', cleanedDr);
        } else {
          u.searchParams.delete('dr');
        }
      }
      if (u.searchParams.has('dt')) {
        u.searchParams.set('dt', sanitizedTitle(undefined, u.searchParams.get('dt')));
      }
      var keys = [];
      u.searchParams.forEach(function (_, k) { keys.push(k); });
      keys.forEach(function (k) {
        if (k === 'ep.search_term') {
          u.searchParams.delete(k);
          return;
        }
        var v = u.searchParams.get(k);
        if (!v) {
          return;
        }
        if (/^https?:\/\//i.test(v) || v.charAt(0) === '/' || /[?&](dob|tz|today|on|year)=/.test(v) || /\/past\/\d{4}/.test(v)) {
          var cleaned = sanitizeAnalyticsUrl(v);
          if (cleaned) {
            u.searchParams.set(k, cleaned);
          }
        }
      });
      return u.toString();
    } catch (e) {
      return url;
    }
  }

  function scrubCollectBody(body) {
    if (typeof body !== 'string' || body.indexOf('=') === -1) {
      return body;
    }
    return body.split('\n').map(function (line) {
      if (line.indexOf('=') === -1) {
        return line;
      }
      try {
        var u = new URL(scrubCollectUrlString('https://region1.google-analytics.com/g/collect?' + line));
        return u.search.slice(1);
      } catch (e) {
        return line;
      }
    }).join('\n');
  }

  function isGaCollectUrl(url) {
    if (!url) {
      return false;
    }
    try {
      var u = new URL(typeof url === 'string' ? url : String(url), location.href);
      if (!/google-analytics\.com$|\.google-analytics\.com$|analytics\.google\.com$/.test(u.hostname)) {
        return false;
      }
      return /\/(?:g|j)\/collect(?:\?|$)|\/collect(?:\?|$)/.test(u.pathname);
    } catch (e) {
      return false;
    }
  }

  function shouldDropCollect(url) {
    return gaTransportBlocked && isGaCollectUrl(url);
  }

  /* Enhanced measurement can send later events (scroll, outbound click,
     form_start, form_submit) that do not always go through our config
     call. Scrub dl/dr/dt and any URL-like event parameter on the way out.
     After Reject, drop collect requests so a queued event cannot leave
     the browser. */
  function installCollectScrubber() {
    if (window.__AGECALC_GA_SCRUB) {
      return;
    }
    window.__AGECALC_GA_SCRUB = true;
    if (navigator.sendBeacon) {
      var beacon = navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon = function (url, data) {
        if (shouldDropCollect(url)) {
          return true;
        }
        url = scrubCollectUrlString(url);
        if (typeof data === 'string') {
          data = scrubCollectBody(data);
        }
        return beacon(url, data);
      };
    }
    if (window.fetch) {
      var origFetch = window.fetch.bind(window);
      window.fetch = function (input, init) {
        var fetchUrl = typeof input === 'string' ? input : (input && input.url);
        if (shouldDropCollect(fetchUrl)) {
          return Promise.resolve(new Response('', { status: 204, statusText: 'No Content' }));
        }
        if (typeof input === 'string') {
          input = scrubCollectUrlString(input);
        } else if (input && input.url) {
          try {
            input = new Request(scrubCollectUrlString(input.url), input);
          } catch (e) { /* keep original */ }
        }
        if (init && typeof init.body === 'string') {
          init = Object.assign({}, init, { body: scrubCollectBody(init.body) });
        }
        return origFetch(input, init);
      };
    }
    if (window.XMLHttpRequest) {
      var open = XMLHttpRequest.prototype.open;
      var send = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function (method, url) {
        this.__agecalcGaUrl = url;
        if (typeof url === 'string') {
          if (shouldDropCollect(url)) {
            arguments[1] = 'about:blank';
          } else {
            arguments[1] = scrubCollectUrlString(url);
          }
        }
        return open.apply(this, arguments);
      };
      XMLHttpRequest.prototype.send = function () {
        if (shouldDropCollect(this.__agecalcGaUrl)) {
          return;
        }
        return send.apply(this, arguments);
      };
    }
    var imgDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (imgDesc && imgDesc.set && imgDesc.get) {
      Object.defineProperty(HTMLImageElement.prototype, 'src', {
        configurable: true,
        enumerable: imgDesc.enumerable,
        get: function () {
          return imgDesc.get.call(this);
        },
        set: function (value) {
          if (shouldDropCollect(value)) {
            return;
          }
          if (isGaCollectUrl(value)) {
            value = scrubCollectUrlString(value);
          }
          imgDesc.set.call(this, value);
        }
      });
    }
  }
  installCollectScrubber();

  function loadGa() {
    if (!isProd || isEmbedOrWidget() || window.__AGECALC_GA_LOADED) {
      return;
    }
    if (!GA_MEASUREMENT_ID || /PLACEHOLDER|XXXXXXXX/i.test(GA_MEASUREMENT_ID)) {
      return;
    }
    window.__AGECALC_GA_LOADED = true;
    var fields = analyticsPageFields();
    window.gtag('set', {
      page_location: fields.page_location,
      page_referrer: fields.page_referrer || '',
      page_title: fields.page_title
    });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
    document.head.appendChild(s);
    window.gtag('js', new Date());
    window.gtag('config', GA_MEASUREMENT_ID, fields);
  }

  function applyConsent(choice) {
    if (choice === 'granted') {
      gaTransportBlocked = false;
      window['ga-disable-' + GA_MEASUREMENT_ID] = false;
      window.gtag('consent', 'update', {
        analytics_storage: 'granted',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
      });
      loadGa();
    } else {
      /* Order matters: tell gtag first, then disable, then drop any
         collect that was already queued (scroll and similar). Cookies
         are cleared by the Reject handler after this returns. */
      window.gtag('consent', 'update', {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
      });
      window['ga-disable-' + GA_MEASUREMENT_ID] = true;
      gaTransportBlocked = true;
    }
  }

  function store(choice) {
    try {
      localStorage.setItem(KEY, choice);
    } catch (e) { /* ignore */ }
  }

  function clearStoredChoice() {
    try {
      localStorage.removeItem(KEY);
    } catch (e) { /* ignore */ }
  }

  function clearGaCookies() {
    var names = [];
    var raw = document.cookie ? document.cookie.split(';') : [];
    for (var i = 0; i < raw.length; i++) {
      var name = raw[i].split('=')[0].trim();
      if (name === '_ga' || name === '_gid' || name === '_gat' ||
          name.indexOf('_ga_') === 0 || name.indexOf('_gat_') === 0) {
        names.push(name);
      }
    }
    var hostName = location.hostname;
    var domains = ['', hostName];
    if (hostName.indexOf('.') !== -1) {
      domains.push('.' + hostName);
      var parts = hostName.split('.');
      if (parts.length > 2) {
        domains.push('.' + parts.slice(-2).join('.'));
      }
    }
    var paths = ['/'];
    var pathName = location.pathname || '/';
    if (pathName && paths.indexOf(pathName) === -1) {
      paths.push(pathName);
    }
    if (pathName.length > 1 && pathName.charAt(pathName.length - 1) === '/') {
      var trimmed = pathName.slice(0, -1);
      if (trimmed && paths.indexOf(trimmed) === -1) {
        paths.push(trimmed);
      }
    } else if (pathName !== '/') {
      paths.push(pathName + '/');
    }
    names.forEach(function (name) {
      paths.forEach(function (path) {
        document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=' + path;
        domains.forEach(function (domain) {
          if (!domain) {
            return;
          }
          document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=' + path + '; domain=' + domain;
        });
      });
    });
  }

  function restoreFocus() {
    var target = cookieSettingsOpener;
    cookieSettingsOpener = null;
    if (target && document.contains(target) && typeof target.focus === 'function') {
      try {
        target.focus({ preventScroll: true });
      } catch (e) {
        try { target.focus(); } catch (e2) { /* ignore */ }
      }
      return;
    }
    var heading = document.querySelector('main h1, [role="main"] h1, h1, main, [role="main"]');
    if (heading) {
      if (!heading.hasAttribute('tabindex')) {
        heading.setAttribute('tabindex', '-1');
      }
      try {
        heading.focus({ preventScroll: true });
      } catch (e) {
        try { heading.focus(); } catch (e2) { /* ignore */ }
      }
    }
  }

  function hideBanner(opts) {
    var el = document.getElementById('consent-banner');
    if (el) {
      el.hidden = true;
    }
    document.documentElement.classList.remove('has-consent-banner');
    document.documentElement.classList.add('consent-chosen');
    document.body.classList.remove('has-consent-banner');
    syncBannerHeight();
    if (opts && opts.silent) {
      cookieSettingsOpener = null;
    } else {
      restoreFocus();
    }
  }

  /* Pad the page by the banner height while it is open (CSS reads
     --consent-h). The banner itself is a max-height flex container:
     the copy (or the whole text column) scrolls, and Accept/Reject
     stay in view. First-visit copy is never hidden. The keep-clear
     rule for #dob-q only applies when that field is on screen. */
  function readSafeAreaBottom() {
    var probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;padding-bottom:env(safe-area-inset-bottom, 0px);';
    document.body.appendChild(probe);
    var v = parseFloat(window.getComputedStyle(probe).paddingBottom) || 0;
    document.body.removeChild(probe);
    return v;
  }

  function viewHeight() {
    var vv = window.visualViewport;
    return (vv && vv.height) ? vv.height : window.innerHeight;
  }

  function fieldIsOnScreen(field) {
    if (!field) {
      return false;
    }
    var box = field.getBoundingClientRect();
    if (!box.height) {
      return false;
    }
    return box.bottom > 0 && box.top < viewHeight();
  }

  function syncBannerHeight() {
    var el = document.getElementById('consent-banner');
    var root = document.documentElement;
    var open = el && !el.hidden && !root.classList.contains('consent-chosen');
    if (!open) {
      root.style.removeProperty('--consent-banner-max');
      root.style.setProperty('--consent-h', '0px');
      return;
    }
    var p = el.querySelector('.consent-copy');
    var header = document.querySelector('.mast');
    var field = document.getElementById('dob-q');
    var status = el.querySelector('.consent-status');
    var statusShowing = !!(status && !status.hidden && (status.textContent || '').trim());
    if (p) {
      p.classList.remove('is-visually-hidden');
    }
    root.style.removeProperty('--consent-banner-max');

    var vh = viewHeight();
    var rem = parseFloat(window.getComputedStyle(root).fontSize) || 16;
    var cssCap = Math.min(vh * 0.5, vh - 4.5 * rem);
    if (!(cssCap > 0)) {
      cssCap = vh;
    }
    var headerBottom = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
    var ceiling = vh - headerBottom - 8;
    var fieldOnScreen = fieldIsOnScreen(field);
    if (fieldOnScreen) {
      var clearField = vh - field.getBoundingClientRect().bottom - 8;
      if (clearField < ceiling) {
        ceiling = clearField;
      }
    }
    var safeBottom = readSafeAreaBottom();
    var padBottom = parseFloat(window.getComputedStyle(el).paddingBottom) || 0;
    if (safeBottom > padBottom) {
      ceiling -= (safeBottom - padBottom);
    }

    /* Chrome is the banner without the Legal copy: padding, status and
       buttons. Measuring it by visually hiding the copy for one frame
       works in both the row and column layouts. */
    var chrome = el.offsetHeight;
    if (p) {
      p.classList.add('is-visually-hidden');
      chrome = el.offsetHeight;
      p.classList.remove('is-visually-hidden');
    }

    var line = 22;
    if (p) {
      line = parseFloat(window.getComputedStyle(p).lineHeight);
      if (!isFinite(line) || line <= 0) {
        line = (parseFloat(window.getComputedStyle(p).fontSize) || 15) * 1.45;
      }
    }
    var twoLines = line * 2;

    var maxBanner = cssCap;
    if (ceiling < maxBanner) {
      maxBanner = ceiling;
    }
    /* Never shrink past the chrome (buttons must stay on screen). If
       that slightly covers an in-view field at extreme zoom, so be it;
       first-visit copy is still shown in any leftover space. */
    if (maxBanner < chrome) {
      maxBanner = chrome;
    }
    if (maxBanner < 0) {
      maxBanner = 0;
    }
    /* First visit: keep at least one line of Legal's copy visible.
       Grow past the 50dvh cap if that is the only way, but never over
       the header or an on-screen date field. */
    if (p && !statusShowing) {
      var oneLine = line;
      var needed = chrome + oneLine;
      if (maxBanner < needed) {
        var hardCap = vh - headerBottom - 8;
        if (fieldOnScreen && ceiling < hardCap) {
          hardCap = ceiling;
        }
        if (hardCap > maxBanner) {
          maxBanner = hardCap < needed ? hardCap : needed;
        }
      }
      var copyMin = maxBanner - chrome;
      if (copyMin < 0) {
        copyMin = 0;
      }
      root.style.setProperty('--consent-copy-min', copyMin + 'px');
    } else {
      root.style.removeProperty('--consent-copy-min');
    }
    root.style.setProperty('--consent-banner-max', maxBanner + 'px');

    if (p && statusShowing) {
      var room = el.offsetHeight - chrome;
      if (room < twoLines) {
        p.classList.add('is-visually-hidden');
        root.style.setProperty('--consent-banner-max', chrome + 'px');
      }
    }

    /* Second pass: if the in-view field is still covered, shrink toward
       chrome, but do not hide first-visit copy. */
    if (p && fieldOnScreen) {
      var overlap = field.getBoundingClientRect().bottom + 8 - el.getBoundingClientRect().top;
      if (overlap > 0) {
        var shrunk = el.offsetHeight - overlap;
        if (shrunk < chrome) {
          shrunk = chrome;
        }
        root.style.setProperty('--consent-banner-max', shrunk + 'px');
        if (statusShowing) {
          room = el.offsetHeight - chrome;
          if (room < twoLines) {
            p.classList.add('is-visually-hidden');
            root.style.setProperty('--consent-banner-max', chrome + 'px');
          } else {
            p.classList.remove('is-visually-hidden');
          }
        }
      }
    }
    root.style.setProperty('--consent-h', el.offsetHeight + 'px');
  }
  window.addEventListener('resize', syncBannerHeight);
  window.addEventListener('orientationchange', syncBannerHeight);

  function placeBanner(el) {
    var skip = document.querySelector('.skip');
    if (skip && skip.parentNode) {
      skip.insertAdjacentElement('afterend', el);
    } else if (document.body.firstChild) {
      document.body.insertBefore(el, document.body.firstChild);
    } else {
      document.body.appendChild(el);
    }
  }

  function bindBannerButtons(el) {
    if (el.getAttribute('data-bound') === '1') {
      return;
    }
    el.setAttribute('data-bound', '1');
    var accept = document.getElementById('consent-accept');
    var reject = document.getElementById('consent-reject');
    if (accept) {
      accept.addEventListener('click', function () {
        store('granted');
        applyConsent('granted');
        hideBanner();
      });
    }
    if (reject) {
      reject.addEventListener('click', function () {
        store('denied');
        applyConsent('denied');
        clearGaCookies();
        hideBanner();
      });
    }
  }

  function bannerStrings() {
    var root = siteRoot();
    return {
      aria_label: 'Analytics cookies',
      text: 'This site uses Google Analytics only if you accept. No analytics cookies are set unless you accept. The dates you type are never sent. See the <a href="' + root + 'privacy/">privacy page</a>.',
      accept: 'Accept',
      reject: 'Reject',
      on: 'Analytics is currently on.',
      off: 'Analytics is currently off.'
    };
  }

  function storedChoice() {
    try {
      var c = localStorage.getItem(KEY);
      if (c === 'granted' || c === 'denied') {
        return c;
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function updateBannerChoiceState(el) {
    if (!el) {
      return;
    }
    var choice = storedChoice();
    var t = bannerStrings();
    var accept = document.getElementById('consent-accept');
    var reject = document.getElementById('consent-reject');
    var status = el.querySelector('.consent-status');
    if (!status) {
      status = document.createElement('p');
      status.className = 'consent-status';
      var copy = el.querySelector('.consent-copy');
      if (copy && copy.parentNode) {
        copy.insertAdjacentElement('afterend', status);
      } else {
        el.insertBefore(status, el.querySelector('.consent-actions'));
      }
    }
    if (choice === 'granted') {
      status.hidden = false;
      status.textContent = t.on;
      if (accept) {
        accept.setAttribute('aria-pressed', 'true');
        accept.classList.add('is-selected');
      }
      if (reject) {
        reject.setAttribute('aria-pressed', 'false');
        reject.classList.remove('is-selected');
      }
    } else if (choice === 'denied') {
      status.hidden = false;
      status.textContent = t.off;
      if (reject) {
        reject.setAttribute('aria-pressed', 'true');
        reject.classList.add('is-selected');
      }
      if (accept) {
        accept.setAttribute('aria-pressed', 'false');
        accept.classList.remove('is-selected');
      }
    } else {
      status.hidden = true;
      status.textContent = '';
      if (accept) {
        accept.removeAttribute('aria-pressed');
        accept.classList.remove('is-selected');
      }
      if (reject) {
        reject.removeAttribute('aria-pressed');
        reject.classList.remove('is-selected');
      }
    }
  }

  function showBanner() {
    if (isEmbedOrWidget() && pathWithinSite().replace(/\/$/, '') === '/widget') {
      return;
    }
    var el = document.getElementById('consent-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'consent-banner';
      el.setAttribute('role', 'region');
      var t = bannerStrings();
      el.setAttribute('aria-label', t.aria_label);
      el.setAttribute('tabindex', '-1');
      el.innerHTML =
        '<div class="consent-text">' +
        '<p class="consent-copy">' + t.text + '</p>' +
        '<p class="consent-status" hidden></p>' +
        '</div>' +
        '<div class="consent-actions">' +
        '<button type="button" id="consent-accept">' + t.accept + '</button>' +
        '<button type="button" id="consent-reject">' + t.reject + '</button>' +
        '</div>';
      placeBanner(el);
    }
    el.hidden = false;
    document.documentElement.classList.add('has-consent-banner');
    document.documentElement.classList.remove('consent-chosen');
    document.body.classList.add('has-consent-banner');
    updateBannerChoiceState(el);
    syncBannerHeight();
    bindBannerButtons(el);
  }

  function focusBanner() {
    var banner = document.getElementById('consent-banner');
    if (!banner) {
      return;
    }
    if (!banner.hasAttribute('tabindex')) {
      banner.setAttribute('tabindex', '-1');
    }
    try {
      banner.focus({ preventScroll: true });
    } catch (err) {
      banner.focus();
    }
  }

  /* Never stores a choice of its own. Withdrawal happens only when the
     visitor presses Reject. If the first-visit banner is already open
     and nothing is stored, this just focuses the banner. */
  function openCookieSettings(event) {
    if (event) {
      event.preventDefault();
      var link = event.target && event.target.closest &&
          event.target.closest('a[href="#cookie-settings"]');
      if (link) {
        cookieSettingsOpener = link;
      }
    }
    var el = document.getElementById('consent-banner');
    var alreadyOpen = !!(el && !el.hidden &&
      !document.documentElement.classList.contains('consent-chosen'));
    if (alreadyOpen) {
      updateBannerChoiceState(el);
      focusBanner();
      return;
    }
    showBanner();
    focusBanner();
  }

  window.agecalcOpenCookieSettings = openCookieSettings;

  document.addEventListener('click', function (event) {
    var link = event.target && event.target.closest &&
        event.target.closest('a[href="#cookie-settings"]');
    if (link) {
      openCookieSettings(event);
    }
  });

  var choice = null;
  try {
    choice = localStorage.getItem(KEY);
  } catch (e) {
    choice = null;
  }

  function init() {
    if (isEmbedOrWidget() && pathWithinSite().replace(/\/$/, '') === '/widget') {
      return;
    }
    if (choice === 'granted' || choice === 'denied') {
      applyConsent(choice);
      hideBanner({ silent: true });
    } else {
      showBanner();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
