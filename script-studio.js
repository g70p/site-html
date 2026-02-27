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

  var STORAGE_KEY = 'resigrip_studio_state_v3';
  var LEGACY_STORAGE_KEY = 'resigrip_studio_state_v2';
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

  if (!iframe || !statusEl || !outputEl || !tokenControls || !tokenMapEl || !tokenHelp || !textLogEl || !selectionNameEl || !selectionPathEl || !selectionStylesEl || !copySelectorButton || !pickerButton || !inlineEditButton) {
    app.hidden = true;
    restricted.hidden = false;
    if (restricted) {
      restricted.textContent = 'Studio indisponível: estrutura incompleta.';
    }
    return;
  }

  var tokenSchema = [
    { key: '--bg', label: 'Fundo da página', category: 'Surface', editor: 'color', usage: 'body e secções base' },
    { key: '--surface', label: 'Superfície base', category: 'Surface', editor: 'color', usage: 'cards, painéis, blocos' },
    { key: '--surface-2', label: 'Superfície alternativa', category: 'Surface', editor: 'color', usage: 'variações de cartões' },
    { key: '--footer-bg', label: 'Fundo do footer', category: 'Surface', editor: 'color', usage: 'rodapé principal' },
    { key: '--text', label: 'Texto principal', category: 'Text', editor: 'color', usage: 'texto geral' },
    { key: '--text-muted', label: 'Texto secundário', category: 'Text', editor: 'color', usage: 'legendas e subtítulos' },
    { key: '--footer-text', label: 'Texto do footer', category: 'Text', editor: 'color', usage: 'copyright do rodapé' },
    { key: '--accent', label: 'Cor de destaque', category: 'Accent', editor: 'color', usage: 'botões/estado ativo', alias: '--amber' },
    { key: '--link', label: 'Cor de links', category: 'Accent', editor: 'color', usage: 'links no conteúdo' },
    { key: '--link-hover', label: 'Hover de links', category: 'Accent', editor: 'color', usage: 'hover de links' },
    { key: '--border', label: 'Bordas base', category: 'Borders', editor: 'color', usage: 'divisórias e cartões' },
    { key: '--focus', label: 'Focus ring', category: 'States', editor: 'color', usage: 'estados de foco' },
    { key: '--gradient-header', label: 'Gradiente do header', category: 'Gradients', editor: 'gradient', usage: 'fundo do topo fixo' },
    { key: '--gradient-accent', label: 'Gradiente de destaque', category: 'Gradients', editor: 'gradient', usage: 'botões e blocos accent' },
    { key: '--shadow-1', label: 'Sombra curta', category: 'Shadows', editor: 'text', usage: 'componentes base' },
    { key: '--shadow-2', label: 'Sombra profunda', category: 'Shadows', editor: 'text', usage: 'blocos em destaque' },
    { key: '--font-size-base', label: 'Tamanho base da fonte', category: 'Typography', editor: 'range', min: 14, max: 22, unit: 'px', usage: 'texto geral do documento' },
    { key: '--line-height-base', label: 'Altura de linha base', category: 'Typography', editor: 'range', min: 1.2, max: 2, step: 0.05, usage: 'legibilidade global' }
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
    if (!keys.length) return ':root{}';
    return ':root{\n' + keys.map(function (key) {
      return '  ' + key + ': ' + obj[key] + ';';
    }).join('\n') + '\n}';
  }

  function normalizeHex(value) {
    var hex = String(value || '').trim();
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex.toLowerCase();
    if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
      return ('#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]).toLowerCase();
    }
    return null;
  }

  function colorToHex(value) {
    var hex = normalizeHex(value);
    if (hex) return hex;
    var match = String(value || '').trim().match(/^rgba?\(([^)]+)\)$/i);
    if (!match) return null;
    var parts = match[1].split(',').map(function (x) { return x.trim(); });
    if (parts.length < 3) return null;
    var r = parseFloat(parts[0]);
    var g = parseFloat(parts[1]);
    var b = parseFloat(parts[2]);
    if ([r, g, b].some(function (n) { return Number.isNaN(n); })) return null;
    return '#' + [r, g, b].map(function (n) {
      var out = Math.max(0, Math.min(255, Math.round(n))).toString(16);
      return out.length === 1 ? '0' + out : out;
    }).join('');
  }

  function parseGradientColors(value) {
    var regex = /(#[0-9a-fA-F]{3,6}|rgba?\([^\)]+\))/g;
    var found = [];
    var match;
    while ((match = regex.exec(String(value || ''))) !== null) {
      var raw = match[0];
      var hex = colorToHex(raw);
      if (!hex) continue;
      var alphaMatch = raw.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*([0-9.]+)\)$/i);
      found.push({ raw: raw, hex: hex, alpha: alphaMatch ? alphaMatch[1] : null, index: found.length });
    }
    return found;
  }

  function replaceNthOccurrence(source, target, replacement, n) {
    var cursor = -1;
    var from = 0;
    for (var i = 0; i <= n; i += 1) {
      cursor = source.indexOf(target, from);
      if (cursor === -1) return source;
      from = cursor + target.length;
    }
    return source.slice(0, cursor) + replacement + source.slice(cursor + target.length);
  }

  function captureThemeDefaults(doc) {
    var root = doc.documentElement;
    var computed = doc.defaultView.getComputedStyle(root);
    var output = {};

    tokenSchema.forEach(function (item) {
      var value = computed.getPropertyValue(item.key).trim();
      if (item.editor === 'range') {
        output[item.key] = parseFloat(value) || (item.key === '--font-size-base' ? 16 : 1.6);
      } else {
        output[item.key] = value;
      }
    });

    return output;
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
      tokenValues[item.key] = item.editor === 'range' && item.key === '--font-size-base'
        ? Number(value) + 'px'
        : String(value);

      if (item.alias) tokenValues[item.alias] = tokenValues[item.key];
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
      if (typeof state.text[key] === 'string') {
        el.textContent = state.text[key];
      }
    });
  }

  function setColorPickerFromText(textInput, colorInput) {
    var hex = colorToHex(textInput.value);
    if (hex) {
      colorInput.value = hex;
      return true;
    }
    return false;
  }

  function renderGradientPickers(item, textInput, parent) {
    var swatches = document.createElement('div');
    swatches.className = 'gradient-pickers';

    parseGradientColors(textInput.value).forEach(function (entry) {
      var wrap = document.createElement('div');
      wrap.className = 'gradient-picker-item';

      var label = document.createElement('span');
      label.textContent = 'Cor ' + String(entry.index + 1);
      wrap.appendChild(label);

      var colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.value = entry.hex;
      colorInput.title = item.key + ' - ponto ' + String(entry.index + 1);
      colorInput.addEventListener('input', function () {
        var nextColor = colorInput.value;
        var replacement = entry.alpha !== null
          ? 'rgba(' + parseInt(nextColor.slice(1, 3), 16) + ',' + parseInt(nextColor.slice(3, 5), 16) + ',' + parseInt(nextColor.slice(5, 7), 16) + ',' + entry.alpha + ')'
          : nextColor;

        state.tokens[item.key] = replaceNthOccurrence(String(state.tokens[item.key]), entry.raw, replacement, entry.index);
        textInput.value = state.tokens[item.key];
        state.theme = 'custom';
        refreshThemeButtons();
        applyTokens();
      });

      wrap.appendChild(colorInput);
      swatches.appendChild(wrap);
    });

    parent.appendChild(swatches);
  }

  function renderTokenControls() {
    tokenSchema.forEach(function (item) {
      var label = document.createElement('label');
      label.textContent = item.label;
      label.title = 'Onde é usado: ' + item.usage;

      if (item.editor === 'range') {
        var range = document.createElement('input');
        range.type = 'range';
        range.min = item.min;
        range.max = item.max;
        if (item.step) range.step = item.step;
        range.value = state.tokens[item.key];

        var rangeText = document.createElement('input');
        rangeText.type = 'text';
        rangeText.value = String(state.tokens[item.key]);

        range.addEventListener('input', function () {
          state.tokens[item.key] = Number(range.value);
          rangeText.value = String(state.tokens[item.key]);
          state.theme = 'custom';
          refreshThemeButtons();
          applyTokens();
        });

        rangeText.addEventListener('change', function () {
          var parsed = parseFloat(rangeText.value);
          if (Number.isNaN(parsed)) {
            rangeText.value = String(state.tokens[item.key]);
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
        rangeRow.appendChild(rangeText);
        label.appendChild(rangeRow);
      } else {
        var row = document.createElement('div');
        row.className = 'token-row';

        var textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.value = String(state.tokens[item.key] || '');
        row.appendChild(textInput);

        var isColorFamily = item.editor === 'color' || item.editor === 'gradient';
        var colorInput;
        if (isColorFamily) {
          colorInput = document.createElement('input');
          colorInput.type = 'color';
          colorInput.value = colorToHex(textInput.value) || '#000000';
          colorInput.title = item.key;
          colorInput.addEventListener('input', function () {
            if (item.editor === 'gradient') {
              var first = parseGradientColors(state.tokens[item.key]);
              if (first.length) {
                state.tokens[item.key] = replaceNthOccurrence(String(state.tokens[item.key]), first[0].raw, colorInput.value, 0);
                textInput.value = state.tokens[item.key];
              }
            } else {
              state.tokens[item.key] = colorInput.value;
              textInput.value = colorInput.value;
            }
            state.theme = 'custom';
            refreshThemeButtons();
            applyTokens();
            syncTokenInputs();
          });
          row.appendChild(colorInput);
        }

        textInput.addEventListener('input', function () {
          state.tokens[item.key] = textInput.value;
          state.theme = 'custom';
          refreshThemeButtons();
          applyTokens();
        });

        textInput.addEventListener('change', function () {
          if (item.editor === 'color') {
            var valid = setColorPickerFromText(textInput, colorInput);
            if (!valid) setStatus('Valor inválido para ' + item.key + '. Use HEX ou RGB/RGBA.');
          }
          if (item.editor === 'gradient') {
            syncTokenInputs();
          }
        });

        label.appendChild(row);
        if (item.editor === 'gradient') {
          renderGradientPickers(item, textInput, label);
        }
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
      var block = document.createElement('div');
      block.className = 'token-map-group';

      var title = document.createElement('h3');
      title.textContent = category;
      block.appendChild(title);

      var desc = document.createElement('p');
      desc.textContent = tokenCategoryDescriptions[category];
      block.appendChild(desc);

      tokenSchema.forEach(function (item) {
        if (item.category !== category) return;
        var text = document.createElement('p');
        text.textContent = item.key + ' — ' + item.label + '. Uso: ' + item.usage + '.';
        block.appendChild(text);
      });

      tokenMapEl.appendChild(block);
    });
  }

  function syncTokenInputs() {
    tokenControls.innerHTML = '<h2>Tokens</h2>';
    renderTokenControls();
  }

  function syncTextInputs() {
    document.querySelectorAll('[data-text-key]').forEach(function (input) {
      var key = input.getAttribute('data-text-key');
      input.value = typeof state.text[key] === 'string' ? state.text[key] : (defaultTexts[key] || '');
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
      exportTokens[key] = key === '--font-size-base' ? state.tokens[key] + 'px' : String(state.tokens[key]);
    });
    exportTokens['--amber'] = exportTokens['--accent'];

    var css = styleTextMap(exportTokens);
    if (state.selectorOverrides.length) {
      css += '\n\n/* Sugestões de overrides por seletor (preview) */\n';
      state.selectorOverrides.forEach(function (override) {
        css += '/* ' + override.selector + ' => ' + override.note + ' */\n';
      });
    }
    outputEl.value = css;
  }

  function copyText(value, successMessage) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(function () {
        setStatus(successMessage);
      }).catch(function () {
        fallbackCopy(value, successMessage);
      });
      return;
    }
    fallbackCopy(value, successMessage);
  }

  function fallbackCopy(value, successMessage) {
    var helper = document.createElement('textarea');
    helper.value = value;
    helper.setAttribute('readonly', 'readonly');
    helper.style.position = 'absolute';
    helper.style.left = '-9999px';
    document.body.appendChild(helper);
    helper.select();
    try {
      document.execCommand('copy');
      setStatus(successMessage);
    } catch (error) {
      setStatus('Não foi possível copiar automaticamente.');
    }
    document.body.removeChild(helper);
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
      if (!raw) {
        raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
      }
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
      }
      parts.unshift(part);
      current = current.parentElement;
      if (parts.length >= 4) break;
    }
    return parts.join(' > ');
  }

  function getElementSignature(el) {
    if (!el) return '';
    var tag = el.tagName.toLowerCase();
    var id = el.id ? '#' + el.id : '';
    var classes = el.classList.length ? '.' + Array.prototype.join.call(el.classList, '.') : '';
    return tag + id + classes;
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

    selectedSelector = getCssSelector(el);
    selectionNameEl.textContent = getElementSignature(el);
    selectionPathEl.textContent = 'Caminho: ' + getBreadcrumb(el);
    copySelectorButton.disabled = false;

    var doc = getPreviewDocument();
    if (!doc) return;
    var computed = doc.defaultView.getComputedStyle(el);

    selectionStylesEl.innerHTML = '';
    ['color', 'background-color', 'font-size', 'font-weight', 'line-height'].forEach(function (prop) {
      var row = document.createElement('div');
      row.textContent = prop + ': ' + computed.getPropertyValue(prop);
      selectionStylesEl.appendChild(row);
    });
  }

  function ensureRuntimeStyles(doc) {
    if (doc.getElementById('studio-runtime-style')) return;
    var styleEl = doc.createElement('style');
    styleEl.id = 'studio-runtime-style';
    styleEl.textContent = '.studio-selected-element{outline:2px dashed #ffb000 !important;outline-offset:2px;cursor:crosshair !important;}\n.studio-editable-element{outline:1px dotted rgba(255,176,0,.55);outline-offset:2px;}';
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

    clearSelectionHighlight(doc);
    event.target.classList.add('studio-selected-element');
    updateSelectionPanel(event.target);
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
    state.textLog.unshift({
      timestamp: new Date().toISOString(),
      selector: getCssSelector(el),
      before: beforeText,
      after: afterText
    });
    renderTextLog();
  }

  function handleEditableFocus(event) {
    var target = event.target;
    if (!isEditableElement(target)) return;
    target.setAttribute('data-before-edit', target.textContent);
  }

  function handleEditableBlur(event) {
    var target = event.target;
    if (!isEditableElement(target)) return;
    var before = target.getAttribute('data-before-edit') || '';
    var after = target.textContent;
    target.removeAttribute('data-before-edit');
    registerTextLog(target, before, after);
    setStatus('Texto atualizado no preview (runtime).');
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
      var li = document.createElement('li');
      li.textContent = '[' + entry.timestamp + '] ' + entry.selector + ' | "' + entry.before + '" → "' + entry.after + '"';
      textLogEl.appendChild(li);
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
      if (el) defaultTexts[key] = el.textContent.trim();
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
