(function () {
  var params = new URLSearchParams(window.location.search);
  var isWebmaster = params.get('mode') === 'webmaster';
  var restricted = document.getElementById('restricted');
  var app = document.getElementById('studio-app');
  if (!isWebmaster) {
    restricted.hidden = false;
    app.hidden = true;
    return;
  }

  restricted.hidden = true;
  app.hidden = false;

  var STORAGE_KEY = 'resigrip_studio_state_v1';
  var iframe = document.getElementById('site-preview');
  var statusEl = document.getElementById('studio-status');
  var outputEl = document.getElementById('studio-output');
  var tokenControls = document.getElementById('token-controls');

  var tokenSchema = [
    { key: '--bg', label: 'Surface · --bg', type: 'color' },
    { key: '--surface', label: 'Surface · --surface', type: 'text' },
    { key: '--surface-2', label: 'Surface · --surface-2', type: 'text' },
    { key: '--text', label: 'Text · --text', type: 'color' },
    { key: '--text-muted', label: 'Text · --text-muted', type: 'text' },
    { key: '--accent', label: 'Accent · --accent/--amber', type: 'color', alias: '--amber' },
    { key: '--link', label: 'Accent · --link', type: 'color' },
    { key: '--link-hover', label: 'Accent · --link-hover', type: 'color' },
    { key: '--border', label: 'Borders · --border', type: 'text' },
    { key: '--focus', label: 'States · --focus', type: 'text' },
    { key: '--gradient-header', label: 'Gradients · --gradient-header', type: 'text' },
    { key: '--gradient-accent', label: 'Gradients · --gradient-accent', type: 'text' },
    { key: '--shadow-1', label: 'Shadows · --shadow-1', type: 'text' },
    { key: '--shadow-2', label: 'Shadows · --shadow-2', type: 'text' },
    { key: '--font-size-base', label: 'Typography · --font-size-base', type: 'range', min: 14, max: 22, unit: 'px' },
    { key: '--line-height-base', label: 'Typography · --line-height-base', type: 'range', min: 1.2, max: 2, step: 0.05 }
  ];

  var state = {
    theme: 'dark',
    tokens: {},
    text: {}
  };

  var defaultsByTheme = { dark: {}, light: {} };
  var textSelectors = {
    heroHeadline: '.hero-title',
    heroSubheadline: '.hero-lead',
    sobreText: '#sobre p',
    heroCta: '.hero-actions .btn-primary'
  };
  var defaultTexts = {};

  function setStatus(message) {
    statusEl.textContent = message || '';
  }

  function canUseStorage() {
    try {
      var key = '__studio_test__';
      window.localStorage.setItem(key, '1');
      window.localStorage.removeItem(key);
      return true;
    } catch (error) {
      return false;
    }
  }

  function getPreviewDocument() {
    try {
      return iframe.contentDocument || iframe.contentWindow.document;
    } catch (error) {
      return null;
    }
  }

  function captureThemeDefaults(doc) {
    var root = doc.documentElement;
    var computed = doc.defaultView.getComputedStyle(root);
    var out = {};
    tokenSchema.forEach(function (item) {
      var value = computed.getPropertyValue(item.key).trim();
      if (item.type === 'range') {
        if (item.key === '--font-size-base') {
          out[item.key] = parseFloat(value) || 16;
        } else {
          out[item.key] = parseFloat(value) || 1.6;
        }
      } else {
        out[item.key] = value;
      }
    });
    return out;
  }

  function styleTextMap(obj) {
    var keys = Object.keys(obj);
    if (!keys.length) {
      return ':root{}';
    }
    var lines = keys.map(function (key) {
      return '  ' + key + ': ' + obj[key] + ';';
    });
    return ':root{\n' + lines.join('\n') + '\n}';
  }

  function applyTokens() {
    var doc = getPreviewDocument();
    if (!doc) {
      setStatus('Não foi possível aceder ao preview (origem/CORS).');
      return;
    }
    var styleEl = doc.getElementById('studio-token-overrides');
    if (!styleEl) {
      styleEl = doc.createElement('style');
      styleEl.id = 'studio-token-overrides';
      doc.head.appendChild(styleEl);
    }

    var tokenValues = {};
    tokenSchema.forEach(function (item) {
      var val = state.tokens[item.key];
      if (item.type === 'range') {
        if (item.key === '--font-size-base') {
          tokenValues[item.key] = Number(val) + 'px';
        } else {
          tokenValues[item.key] = String(val);
        }
      } else {
        tokenValues[item.key] = val;
      }
      if (item.alias) {
        tokenValues[item.alias] = tokenValues[item.key];
      }
    });

    styleEl.textContent = styleTextMap(tokenValues);
    refreshOutput('css');
  }

  function applyTextOverrides() {
    var doc = getPreviewDocument();
    if (!doc) {
      return;
    }
    Object.keys(textSelectors).forEach(function (key) {
      var el = doc.querySelector(textSelectors[key]);
      if (!el) return;
      var value = state.text[key];
      el.textContent = value || defaultTexts[key] || el.textContent;
    });
  }

  function renderTokenControls() {
    tokenSchema.forEach(function (item) {
      var label = document.createElement('label');
      label.textContent = item.label;

      if (item.type === 'range') {
        var range = document.createElement('input');
        range.type = 'range';
        range.min = item.min;
        range.max = item.max;
        if (item.step) range.step = item.step;
        range.value = state.tokens[item.key];

        var number = document.createElement('input');
        number.type = 'text';
        number.value = state.tokens[item.key];

        range.addEventListener('input', function () {
          state.tokens[item.key] = Number(range.value);
          number.value = String(state.tokens[item.key]);
          state.theme = 'custom';
          refreshThemeButtons();
          applyTokens();
        });

        number.addEventListener('change', function () {
          var parsed = parseFloat(number.value);
          if (!Number.isFinite(parsed)) return;
          state.tokens[item.key] = parsed;
          range.value = String(parsed);
          state.theme = 'custom';
          refreshThemeButtons();
          applyTokens();
        });

        label.appendChild(range);
        label.appendChild(number);
        tokenControls.appendChild(label);
        return;
      }

      var row = document.createElement('div');
      row.className = 'token-row';

      var textInput = document.createElement('input');
      textInput.type = 'text';
      textInput.value = state.tokens[item.key];
      row.appendChild(textInput);

      if (item.type === 'color') {
        var colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = normalizeColor(state.tokens[item.key]);

        colorInput.addEventListener('input', function () {
          state.tokens[item.key] = colorInput.value;
          textInput.value = colorInput.value;
          state.theme = 'custom';
          refreshThemeButtons();
          applyTokens();
        });
        row.appendChild(colorInput);
      }

      textInput.addEventListener('input', function () {
        state.tokens[item.key] = textInput.value;
        state.theme = 'custom';
        refreshThemeButtons();
        applyTokens();
      });

      label.appendChild(row);
      tokenControls.appendChild(label);
    });
  }

  function normalizeColor(value) {
    if (!value) return '#000000';
    var hex = value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
    if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
      return '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    }
    return '#000000';
  }

  function refreshThemeButtons() {
    document.querySelectorAll('[data-theme]').forEach(function (button) {
      button.classList.toggle('is-active', button.getAttribute('data-theme') === state.theme);
    });
  }

  function syncTextInputs() {
    document.querySelectorAll('[data-text-key]').forEach(function (input) {
      var key = input.getAttribute('data-text-key');
      input.value = state.text[key] || defaultTexts[key] || '';
    });
  }

  function syncTokenInputs() {
    tokenControls.innerHTML = '<h2>Tokens</h2>';
    renderTokenControls();
  }

  function refreshOutput(type) {
    if (type === 'json') {
      outputEl.value = JSON.stringify({ theme: state.theme, tokens: state.tokens }, null, 2);
      return;
    }
    var exportTokens = {};
    Object.keys(state.tokens).forEach(function (key) {
      if (key === '--font-size-base') {
        exportTokens[key] = state.tokens[key] + 'px';
      } else {
        exportTokens[key] = String(state.tokens[key]);
      }
    });
    exportTokens['--amber'] = exportTokens['--accent'];
    outputEl.value = styleTextMap(exportTokens);
  }

  function saveLocal() {
    if (!canUseStorage()) {
      setStatus('localStorage indisponível neste navegador.');
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setStatus('Preset guardado localmente.');
    } catch (error) {
      setStatus('Não foi possível guardar o preset.');
    }
  }

  function loadLocal() {
    if (!canUseStorage()) return;
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (parsed && parsed.tokens && parsed.text) {
        state = parsed;
      }
    } catch (error) {
      setStatus('Estado local inválido, a usar defaults.');
    }
  }

  function applyTheme(theme) {
    var finalTheme = theme === 'light' ? 'light' : (theme === 'custom' ? 'custom' : 'dark');
    state.theme = finalTheme;
    if (finalTheme === 'dark' || finalTheme === 'light') {
      state.tokens = Object.assign({}, defaultsByTheme[finalTheme]);
    }
    var doc = getPreviewDocument();
    if (doc) {
      doc.documentElement.setAttribute('data-theme', finalTheme === 'light' ? 'light' : 'dark');
    }
    syncTokenInputs();
    refreshThemeButtons();
    applyTokens();
    applyTextOverrides();
  }

  function copyOutput() {
    outputEl.select();
    outputEl.setSelectionRange(0, outputEl.value.length);
    try {
      document.execCommand('copy');
      setStatus('Conteúdo copiado.');
    } catch (error) {
      setStatus('Não foi possível copiar automaticamente.');
    }
  }

  document.querySelectorAll('[data-theme]').forEach(function (button) {
    button.addEventListener('click', function () {
      applyTheme(button.getAttribute('data-theme'));
    });
  });

  document.querySelectorAll('[data-text-key]').forEach(function (input) {
    input.addEventListener('input', function () {
      var key = input.getAttribute('data-text-key');
      state.text[key] = input.value;
      applyTextOverrides();
    });
  });

  document.getElementById('copy-css').addEventListener('click', function () {
    refreshOutput('css');
    copyOutput();
  });

  document.getElementById('copy-json').addEventListener('click', function () {
    refreshOutput('json');
    copyOutput();
  });

  document.getElementById('save-local').addEventListener('click', function () {
    saveLocal();
  });

  document.getElementById('reset-defaults').addEventListener('click', function () {
    state.text = {};
    applyTheme('dark');
    syncTextInputs();
    setStatus('Defaults repostos.');
  });

  iframe.addEventListener('load', function () {
    var doc = getPreviewDocument();
    if (!doc) {
      setStatus('Preview bloqueado por política de origem.');
      return;
    }

    doc.documentElement.setAttribute('data-theme', 'dark');
    defaultsByTheme.dark = captureThemeDefaults(doc);
    doc.documentElement.setAttribute('data-theme', 'light');
    defaultsByTheme.light = captureThemeDefaults(doc);

    Object.keys(textSelectors).forEach(function (key) {
      var el = doc.querySelector(textSelectors[key]);
      if (el) defaultTexts[key] = el.textContent.trim();
    });

    loadLocal();

    if (!Object.keys(state.tokens).length) {
      state.tokens = Object.assign({}, defaultsByTheme.dark);
    }

    if (['dark', 'light', 'custom'].indexOf(state.theme) === -1) {
      state.theme = 'dark';
    }

    syncTokenInputs();
    syncTextInputs();
    refreshThemeButtons();
    applyTheme(state.theme);
    applyTextOverrides();
    setStatus('Studio ativo em runtime. Sem alterações em ficheiros do site.');
  });
})();
