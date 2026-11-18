/* agecalculator.com Google Consent Mode v2. Analytics is off until the
   visitor accepts. Never loads or fires GA on localhost, previews, or any
   host other than agecalculator.com and www.agecalculator.com. */
(function () {
  var KEY = 'agecalculator.analyticsConsent';
  var GA_MEASUREMENT_ID = 'G-DQQ5G4H336';
  var host = location.hostname;
  var isProd = host === 'agecalculator.com' || host === 'www.agecalculator.com';

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

  /* Enhanced measurement can send later events (scroll, outbound click,
     form_start, form_submit) that do not always go through our config
     call. Scrub dl/dr/dt and any URL-like event parameter on the way out. */
  function installCollectScrubber() {
    if (window.__AGECALC_GA_SCRUB) {
      return;
    }
    window.__AGECALC_GA_SCRUB = true;
    if (navigator.sendBeacon) {
      var beacon = navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon = function (url, data) {
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
      XMLHttpRequest.prototype.open = function (method, url) {
        if (typeof url === 'string') {
          arguments[1] = scrubCollectUrlString(url);
        }
        return open.apply(this, arguments);
      };
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
      window['ga-disable-' + GA_MEASUREMENT_ID] = false;
      window.gtag('consent', 'update', {
        analytics_storage: 'granted',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
      });
      loadGa();
    } else {
      window.gtag('consent', 'update', {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
      });
      window['ga-disable-' + GA_MEASUREMENT_ID] = true;
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
    names.forEach(function (name) {
      document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
      domains.forEach(function (domain) {
        if (!domain) {
          return;
        }
        document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=' + domain;
      });
    });
  }

  function hideBanner() {
    var el = document.getElementById('consent-banner');
    if (el) {
      el.hidden = true;
    }
    document.documentElement.classList.remove('has-consent-banner');
    document.documentElement.classList.add('consent-chosen');
    document.body.classList.remove('has-consent-banner');
    syncBannerHeight();
  }

  /* Pad the page by the banner height while it is open (CSS reads
     --consent-h), so it never sits on top of the header or the last lines.
     At large text sizes the copy scrolls inside the banner. Unlike dino.game,
     there is no 3-line floor, so the banner cannot grow over the header on
     short viewports at 200% text. */
  function syncBannerHeight() {
    var el = document.getElementById('consent-banner');
    var root = document.documentElement;
    var open = el && !el.hidden && !root.classList.contains('consent-chosen');
    var p = open ? el.querySelector('p') : null;
    var header = document.querySelector('.mast');
    if (p && header) {
      root.style.removeProperty('--consent-p-max');
      var headerBottom = header.getBoundingClientRect().bottom;
      var rest = el.offsetHeight - p.offsetHeight;
      var room = window.innerHeight - headerBottom - rest - 8;
      if (room < 0) {
        room = 0;
      }
      root.style.setProperty('--consent-p-max', room + 'px');
    } else {
      root.style.removeProperty('--consent-p-max');
    }
    var h = open ? el.offsetHeight : 0;
    root.style.setProperty('--consent-h', h + 'px');
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
      text: 'This site uses Google Analytics only if you accept. No analytics cookies are set until you choose. The dates you type are never sent. See the <a href="' + root + 'privacy/">privacy page</a>, or <a href="#cookie-settings">Cookie settings</a>.',
      accept: 'Accept',
      reject: 'Reject'
    };
  }

  function showBanner() {
    if (isEmbedOrWidget() && pathWithinSite().replace(/\/$/, '') === '/widget') {
      return;
    }
    var el = document.getElementById('consent-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'consent-banner';
      el.setAttribute('role', 'dialog');
      var t = bannerStrings();
      el.setAttribute('aria-label', t.aria_label);
      el.setAttribute('tabindex', '-1');
      el.innerHTML =
        '<p>' + t.text + '</p>' +
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
    syncBannerHeight();
    bindBannerButtons(el);
  }

  function openCookieSettings(event) {
    if (event) {
      event.preventDefault();
    }
    store('denied');
    applyConsent('denied');
    clearGaCookies();
    showBanner();
    var banner = document.getElementById('consent-banner');
    if (banner) {
      if (!banner.hasAttribute('tabindex')) {
        banner.setAttribute('tabindex', '-1');
      }
      try {
        banner.focus({ preventScroll: true });
      } catch (err) {
        banner.focus();
      }
    }
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
      hideBanner();
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
