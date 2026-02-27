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

  var STORAGE_KEY = 'resigrip_studio_state_v2';
  var iframe = document.getElementById('site-preview');
  var statusEl = document.getElementById('studio-status');
  var outputEl = document.getElementById('studio-output');
  var tokenControls = document.getElementById('token-controls');
  var tokenMapEl = document.getElementById('token-map');
  var tokenHelp = document.getElementById('token-help');
  var textLogEl = document.getElementById('text-log');

  var selectionNameEl = document.getElementById('selection-name');
  var selectionPathEl = document.getElementById('selection-path');
  var selectionStylesEl = document.getElementById('selection-styles');
  var copySelectorButton = document.getElementById('copy-selector');
  var pickerButton = document.getElementById('toggle-picker');
  var inlineEditButton = document.getElementById('toggle-inline-edit');

  var tokenSchema = [
    { key: '--bg', label: 'Fundo da página', category: 'Surface', type: 'color', usage: 'body e secções base' },
    { key: '--surface', label: 'Superfície base', category: 'Surface', type: 'text', usage: 'cards, painéis, blocos' },
    { key: '--surface-2', label: 'Superfície alternativa', category: 'Surface', type: 'text', usage: 'variações de cartões' },
    { key: '--text', label: 'Texto principal', category: 'Text', type: 'color', usage: 'texto geral' },
    { key: '--text-muted', label: 'Texto secundário', category: 'Text', type: 'text', usage: 'legendas e subtítulos' },
    { key: '--footer-text', label: 'Texto do footer', category: 'Text', type: 'text', usage: 'copyright do rodapé' },
    { key: '--accent', label: 'Cor de destaque', category: 'Accent', type: 'color', usage: 'botões/estado ativo', alias: '--amber' },
    { key: '--link', label: 'Cor de links', category: 'Accent', type: 'color', usage: 'links no conteúdo' },
    { key: '--link-hover', label: 'Hover de links', category: 'Accent', type: 'color', usage: 'hover de links' },
    { key: '--border', label: 'Bordas base', category: 'Borders', type: 'text', usage: 'divisórias e cartões' },
    { key: '--focus', label: 'Focus ring', category: 'States', type: 'text', usage: 'estados de foco' },
    { key: '--gradient-header', label: 'Gradiente do header', category: 'Gradients', type: 'text', usage: 'fundo do topo fixo' },
    { key: '--gradient-accent', label: 'Gradiente de destaque', category: 'Gradients', type: 'text', usage: 'botões e blocos accent' },
    { key: '--shadow-1', label: 'Sombra curta', category: 'Shadows', type: 'text', usage: 'componentes base' },
    { key: '--shadow-2', label: 'Sombra profunda', category: 'Shadows', type: 'text', usage: 'blocos em destaque' },
    { key: '--font-size-base', label: 'Tamanho base da fonte', category: 'Typography', type: 'range', min: 14, max: 22, unit: 'px', usage: 'texto geral do documento' },
    { key: '--line-height-base', label: 'Altura de linha base', category: 'Typography', type: 'range', min: 1.2, max: 2, step: 0.05, usage: 'legibilidade global' }
  ];

  var tokenCategoryDescriptions = {
    Surface: 'Fundos e planos dos blocos.',
    Text: 'Cores de leitura e hierarquia textual.',
    Accent: 'Elementos de ação e destaque visual.',
    Borders: 'Linhas de separação e contornos.',
    States: 'Estados de foco, hover e ativo.',
    Gradients: 'Camadas visuais com transição de cor.',
    Shadows: 'Profundidade e elevação dos componentes.',
    Typography: 'Escala e ritmo tipográfico.'
  };

  var state = {
    theme: 'dark',
    tokens: {},
    text: {},
    textLog: [],
    selectorOverrides: [],
    pickerActive: false,
    inlineEditActive: false
  };

  var defaultsByTheme = { dark: {}, light: {} };
  var textSelectors = {
    heroHeadline: '.hero-title',
    heroSubheadline: '.hero-lead',
    sobreText: '#sobre p',
    heroCta: '.hero-actions .btn-primary',
    footerCopyright: '.site-footer .muted'
  };
  var defaultTexts = {};
  var selectedElement = null;
  var selectedSelector = '';

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

  function normalizeColor(value) {
    if (!value) return '#000000';
    var hex = value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
    if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
      return '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    }
    return '#000000';
  }

  function captureThemeDefaults(doc) {
    var root = doc.documentElement;
    var computed = doc.defaultView.getComputedStyle(root);
    var out = {};
    tokenSchema.forEach(function (item) {
      var value = computed.getPropertyValue(item.key).trim();
      if (item.type === 'range') {
        out[item.key] = parseFloat(value) || (item.key === '--font-size-base' ? 16 : 1.6);
      } else {
        out[item.key] = value;
      }
    });
    return out;
  }

  function applyTokens() {
    var doc = getPreviewDocument();
    if (!doc) return;

    var styleEl = doc.getElementById('studio-token-overrides');
    if (!styleEl) {
      styleEl = doc.createElement('style');
      styleEl.id = 'studio-token-overrides';
      doc.head.appendChild(styleEl);
    }

    var tokenValues = {};
    tokenSchema.forEach(function (item) {
      var value = state.tokens[item.key];
      if (item.type === 'range') {
        tokenValues[item.key] = item.key === '--font-size-base' ? Number(value) + 'px' : String(value);
      } else {
        tokenValues[item.key] = value;
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
    if (!doc) return;

    Object.keys(textSelectors).forEach(function (key) {
      var el = doc.querySelector(textSelectors[key]);
      if (!el) return;
      var value = state.text[key];
      if (typeof value === 'string') {
        el.textContent = value;
      }
    });
  }

  function renderTokenControls() {
    tokenSchema.forEach(function (item) {
      var label = document.createElement('label');
      label.textContent = item.label;
      label.title = 'Onde é usado: ' + item.usage;

      if (item.type === 'range') {
        var range = document.createElement('input');
        range.type = 'range';
        range.min = item.min;
        range.max = item.max;
        range.value = state.tokens[item.key];
        if (item.step) range.step = item.step;

        var textInputRange = document.createElement('input');
        textInputRange.type = 'text';
        textInputRange.value = String(state.tokens[item.key]);

        range.addEventListener('input', function () {
          state.tokens[item.key] = Number(range.value);
          textInputRange.value = String(state.tokens[item.key]);
          state.theme = 'custom';
          refreshThemeButtons();
          applyTokens();
        });

        textInputRange.addEventListener('change', function () {
          var parsed = parseFloat(textInputRange.value);
          if (Number.isNaN(parsed)) {
            textInputRange.value = String(state.tokens[item.key]);
            return;
          }
          state.tokens[item.key] = parsed;
          range.value = String(parsed);
          state.theme = 'custom';
          refreshThemeButtons();
          applyTokens();
        });

        var rangeRow = document.createElement('div');
        rangeRow.className = 'token-row';
        rangeRow.appendChild(range);
        rangeRow.appendChild(textInputRange);
        label.appendChild(rangeRow);
      } else {
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
      }

      var meta = document.createElement('div');
      meta.className = 'token-meta';
      meta.textContent = item.key + ' · ' + item.usage;
      label.appendChild(meta);
      tokenControls.appendChild(label);
    });
  }

  function renderTokenMap() {
    tokenMapEl.innerHTML = '';
    Object.keys(tokenCategoryDescriptions).forEach(function (category) {
      var wrap = document.createElement('div');
      wrap.className = 'token-map-group';

      var title = document.createElement('h3');
      title.textContent = category;
      wrap.appendChild(title);

      var description = document.createElement('p');
      description.textContent = tokenCategoryDescriptions[category];
      wrap.appendChild(description);

      tokenSchema.forEach(function (item) {
        if (item.category !== category) return;
        var tokenText = document.createElement('p');
        tokenText.textContent = item.key + ' — ' + item.label + '. Uso: ' + item.usage + '.';
        wrap.appendChild(tokenText);
      });

      tokenMapEl.appendChild(wrap);
    });
  }

  function syncTokenInputs() {
    tokenControls.innerHTML = '<h2>Tokens</h2>';
    renderTokenControls();
  }

  function syncTextInputs() {
    document.querySelectorAll('[data-text-key]').forEach(function (input) {
      var key = input.getAttribute('data-text-key');
      var fallback = defaultTexts[key] || '';
      var value = typeof state.text[key] === 'string' ? state.text[key] : fallback;
      input.value = value;
    });
  }

  function refreshThemeButtons() {
    document.querySelectorAll('[data-theme]').forEach(function (button) {
      button.classList.toggle('is-active', button.getAttribute('data-theme') === state.theme);
    });
  }

  function refreshOutput(type) {
    if (type === 'json') {
      outputEl.value = JSON.stringify({
        theme: state.theme,
        tokens: state.tokens,
        selectorOverrides: state.selectorOverrides
      }, null, 2);
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

    var cssBlock = styleTextMap(exportTokens);
    if (state.selectorOverrides.length) {
      cssBlock += '\n\n/* Sugestões de overrides por seletor (preview) */\n';
      state.selectorOverrides.forEach(function (override) {
        cssBlock += '/* ' + override.selector + ' => ' + override.note + ' */\n';
      });
    }
    outputEl.value = cssBlock;
  }

  function copyText(value, successMessage) {
    var copied = false;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(function () {
        setStatus(successMessage);
      }).catch(function () {
        fallbackCopy(value, successMessage);
      });
      return;
    }
    copied = fallbackCopy(value, successMessage);
    if (!copied) {
      setStatus('Não foi possível copiar automaticamente.');
    }
  }

  function fallbackCopy(value, successMessage) {
    var helper = document.createElement('textarea');
    helper.value = value;
    helper.setAttribute('readonly', 'readonly');
    helper.style.position = 'absolute';
    helper.style.left = '-9999px';
    document.body.appendChild(helper);
    helper.select();
    var copied = false;
    try {
      copied = document.execCommand('copy');
      if (copied) {
        setStatus(successMessage);
      }
    } catch (error) {
      copied = false;
    }
    document.body.removeChild(helper);
    return copied;
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
      setStatus('Não foi possível guardar o preset local.');
    }
  }

  function loadLocal() {
    if (!canUseStorage()) return;
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (parsed && parsed.tokens && parsed.text) {
        state.theme = parsed.theme || 'dark';
        state.tokens = parsed.tokens;
        state.text = parsed.text;
        state.textLog = Array.isArray(parsed.textLog) ? parsed.textLog : [];
        state.selectorOverrides = Array.isArray(parsed.selectorOverrides) ? parsed.selectorOverrides : [];
      }
    } catch (error) {
      setStatus('Estado local inválido, a usar defaults.');
    }
  }

  function applyTheme(theme) {
    var nextTheme = theme === 'light' ? 'light' : (theme === 'custom' ? 'custom' : 'dark');
    state.theme = nextTheme;

    if (nextTheme === 'dark' || nextTheme === 'light') {
      state.tokens = Object.assign({}, defaultsByTheme[nextTheme]);
    }

    var doc = getPreviewDocument();
    if (doc) {
      doc.documentElement.setAttribute('data-theme', nextTheme === 'light' ? 'light' : 'dark');
    }

    syncTokenInputs();
    refreshThemeButtons();
    applyTokens();
    applyTextOverrides();
  }

  function getElementSignature(el) {
    if (!el) return '';
    var tag = el.tagName.toLowerCase();
    var id = el.id ? '#' + el.id : '';
    var classes = el.classList.length ? '.' + Array.prototype.join.call(el.classList, '.') : '';
    return tag + id + classes;
  }

  function cssEscape(value) {
    if (window.CSS && window.CSS.escape) return window.CSS.escape(value);
    return String(value).replace(/([^a-zA-Z0-9_-])/g, '\\$1');
  }

  function getCssSelector(el) {
    if (!el || !el.tagName) return '';
    if (el.id) return '#' + cssEscape(el.id);

    var parts = [];
    var current = el;
    while (current && current.nodeType === 1 && current.tagName.toLowerCase() !== 'html') {
      var part = current.tagName.toLowerCase();
      if (current.classList.length) {
        part += '.' + Array.prototype.map.call(current.classList, cssEscape).join('.');
      } else {
        var index = 1;
        var sibling = current.previousElementSibling;
        while (sibling) {
          if (sibling.tagName === current.tagName) index += 1;
          sibling = sibling.previousElementSibling;
        }
        part += ':nth-of-type(' + index + ')';
      }
      parts.unshift(part);
      current = current.parentElement;
      if (parts.length >= 4) break;
    }
    return parts.join(' > ');
  }

  function getBreadcrumb(el) {
    var crumbs = [];
    var current = el;
    while (current && current.nodeType === 1 && crumbs.length < 5) {
      crumbs.unshift(current.tagName.toLowerCase());
      current = current.parentElement;
    }
    return crumbs.join(' > ');
  }

  function updateSelectionPanel(el) {
    if (!el) {
      selectionNameEl.textContent = 'Nenhum elemento selecionado.';
      selectionPathEl.textContent = 'Caminho: —';
      selectionStylesEl.innerHTML = '';
      copySelectorButton.disabled = true;
      selectedSelector = '';
      return;
    }

    selectedElement = el;
    selectedSelector = getCssSelector(el);
    selectionNameEl.textContent = getElementSignature(el);
    selectionPathEl.textContent = 'Caminho: ' + getBreadcrumb(el);

    var doc = getPreviewDocument();
    if (!doc) return;
    var computed = doc.defaultView.getComputedStyle(el);
    selectionStylesEl.innerHTML = '';

    [
      { label: 'color', value: computed.color },
      { label: 'background-color', value: computed.backgroundColor },
      { label: 'font-size', value: computed.fontSize },
      { label: 'font-weight', value: computed.fontWeight },
      { label: 'line-height', value: computed.lineHeight }
    ].forEach(function (item) {
      var row = document.createElement('div');
      row.textContent = item.label + ': ' + item.value;
      selectionStylesEl.appendChild(row);
    });

    copySelectorButton.disabled = false;
  }

  function ensureRuntimeStyles(doc) {
    var styleEl = doc.getElementById('studio-runtime-style');
    if (styleEl) return;
    styleEl = doc.createElement('style');
    styleEl.id = 'studio-runtime-style';
    styleEl.textContent = '.studio-selected-element{outline:2px dashed #ffb000 !important; outline-offset:2px; cursor:crosshair !important;}\n.studio-editable-element{outline:1px dotted rgba(255,176,0,.55); outline-offset:2px;}';
    doc.head.appendChild(styleEl);
  }

  function clearSelectionHighlight(doc) {
    var selected = doc.querySelector('.studio-selected-element');
    if (selected) selected.classList.remove('studio-selected-element');
  }

  function handlePickerClick(event) {
    if (!state.pickerActive) return;
    event.preventDefault();
    event.stopPropagation();

    var doc = getPreviewDocument();
    if (!doc) return;
    var target = event.target;
    clearSelectionHighlight(doc);
    target.classList.add('studio-selected-element');
    updateSelectionPanel(target);
    setStatus('Elemento selecionado no preview.');
  }

  function isEditableElement(el) {
    if (!el || !el.tagName) return false;
    var tag = el.tagName.toLowerCase();
    if (['script', 'style', 'input', 'textarea', 'select', 'option'].indexOf(tag) !== -1) return false;
    return ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'button', 'li', 'small', 'span', 'div'].indexOf(tag) !== -1;
  }

  function registerTextLog(el, beforeText, afterText) {
    if (beforeText === afterText) return;
    var entry = {
      timestamp: new Date().toISOString(),
      selector: getCssSelector(el),
      before: beforeText,
      after: afterText
    };
    state.textLog.unshift(entry);
    renderTextLog();
  }

  function handleEditableFocus(event) {
    var target = event.target;
    if (!isEditableElement(target)) return;
    target.setAttribute('data-before-edit', target.textContent);
  }

  function finishEditable(target) {
    if (!target || !isEditableElement(target)) return;
    var before = target.getAttribute('data-before-edit') || '';
    var after = target.textContent;
    target.removeAttribute('data-before-edit');
    registerTextLog(target, before, after);
    setStatus('Texto atualizado no preview (runtime).');
  }

  function handleEditableBlur(event) {
    finishEditable(event.target);
  }

  function handleEditableKeydown(event) {
    if (!state.inlineEditActive) return;
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.target.blur();
    }
  }

  function toggleInlineEditing(forceValue) {
    var doc = getPreviewDocument();
    if (!doc) return;
    var enabled = typeof forceValue === 'boolean' ? forceValue : !state.inlineEditActive;
    state.inlineEditActive = enabled;
    inlineEditButton.textContent = enabled ? 'Terminar edição' : 'Editar texto';
    inlineEditButton.classList.toggle('is-active', enabled);

    var candidates = doc.body ? doc.body.querySelectorAll('p,h1,h2,h3,h4,h5,h6,a,button,li,small,span,div') : [];
    Array.prototype.forEach.call(candidates, function (el) {
      if (!isEditableElement(el)) return;
      if (enabled) {
        el.setAttribute('contenteditable', 'true');
        el.classList.add('studio-editable-element');
      } else {
        el.removeAttribute('contenteditable');
        el.classList.remove('studio-editable-element');
      }
    });

    setStatus(enabled ? 'Edição inline ativa.' : 'Edição inline desativada.');
  }

  function togglePicker(forceValue) {
    var enabled = typeof forceValue === 'boolean' ? forceValue : !state.pickerActive;
    state.pickerActive = enabled;
    pickerButton.textContent = enabled ? 'Desativar seleção' : 'Ativar seleção';
    pickerButton.classList.toggle('is-active', enabled);
    setStatus(enabled ? 'Seleção por clique ativa.' : 'Seleção por clique desativada.');
  }

  function renderTextLog() {
    textLogEl.innerHTML = '';
    if (!state.textLog.length) {
      var empty = document.createElement('li');
      empty.textContent = 'Sem alterações de texto até ao momento.';
      textLogEl.appendChild(empty);
      return;
    }

    state.textLog.forEach(function (entry) {
      var item = document.createElement('li');
      item.textContent = '[' + entry.timestamp + '] ' + entry.selector + ' | "' + entry.before + '" → "' + entry.after + '"';
      textLogEl.appendChild(item);
    });
  }

  function applyPreviewListeners() {
    var doc = getPreviewDocument();
    if (!doc) return;
    ensureRuntimeStyles(doc);

    doc.addEventListener('click', handlePickerClick, true);
    doc.addEventListener('focusin', handleEditableFocus, true);
    doc.addEventListener('blur', handleEditableBlur, true);
    doc.addEventListener('keydown', handleEditableKeydown, true);
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

  pickerButton.addEventListener('click', function () {
    togglePicker();
  });

  inlineEditButton.addEventListener('click', function () {
    toggleInlineEditing();
  });

  copySelectorButton.addEventListener('click', function () {
    if (!selectedSelector) return;
    copyText(selectedSelector, 'Seletor CSS copiado.');
  });

  document.getElementById('toggle-token-help').addEventListener('click', function () {
    tokenHelp.hidden = !tokenHelp.hidden;
    this.textContent = tokenHelp.hidden ? 'Mostrar ajuda de tokens' : 'Ocultar ajuda de tokens';
  });

  document.getElementById('copy-css').addEventListener('click', function () {
    refreshOutput('css');
    copyText(outputEl.value, 'CSS variables copiadas.');
  });

  document.getElementById('copy-json').addEventListener('click', function () {
    refreshOutput('json');
    copyText(outputEl.value, 'JSON preset copiado.');
  });

  document.getElementById('copy-log').addEventListener('click', function () {
    var logText = state.textLog.map(function (entry) {
      return '[' + entry.timestamp + '] ' + entry.selector + '\nAntes: ' + entry.before + '\nDepois: ' + entry.after;
    }).join('\n\n');
    copyText(logText || 'Sem entradas de LOG.', 'LOG copiado.');
  });

  document.getElementById('clear-log').addEventListener('click', function () {
    state.textLog = [];
    renderTextLog();
    setStatus('LOG limpo.');
  });

  document.getElementById('save-local').addEventListener('click', function () {
    saveLocal();
  });

  document.getElementById('reset-defaults').addEventListener('click', function () {
    state.text = {};
    state.textLog = [];
    state.selectorOverrides = [];
    renderTextLog();
    applyTheme('dark');
    syncTextInputs();
    applyTextOverrides();
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
      if (el) {
        defaultTexts[key] = el.textContent.trim();
      }
    });

    loadLocal();

    if (!Object.keys(state.tokens).length) {
      state.tokens = Object.assign({}, defaultsByTheme.dark);
    }

    if (['dark', 'light', 'custom'].indexOf(state.theme) === -1) {
      state.theme = 'dark';
    }

    renderTokenMap();
    syncTokenInputs();
    syncTextInputs();
    renderTextLog();
    refreshThemeButtons();
    applyTheme(state.theme);
    applyTextOverrides();
    updateSelectionPanel(null);
    applyPreviewListeners();
    togglePicker(false);
    toggleInlineEditing(false);
    setStatus('WEBMASTER STUDIO ativo em runtime. Sem alterações em ficheiros do site.');
  });
})();
