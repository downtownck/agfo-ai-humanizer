/* =============================================================
 * AGFO AI Humanizer — MS Word Task Pane Script
 * Version: 4.0.1  |  Author: AGFOCERT / Cemal Gurkan Kara
 * ============================================================= */

'use strict';

// Office.js hazir olunca basla
Office.onReady(function (info) {
  if (info.host === Office.HostType.Word) {
    AgfoHumanizer.init();
  }
});

var AgfoHumanizer = (function () {

  // ---------- STATE ----------
  var state = {
    provider: 'openai',
    keys: { openai: '', gemini: '', claude: '' },
    models: {
      openai: 'gpt-4o-mini',
      gemini: 'gemini-1.5-flash',
      claude: 'claude-3-5-sonnet-20241022'
    },
    mode: 'OTO',
    lang: 'Turkish',
    lastHtml: '',
    lastText: ''
  };

  // ---------- HELPERS ----------
  function qs(id) { return document.getElementById(id); }

  function setStatus(msg, type) {
    var el = qs('status-msg');
    el.className = 'status ' + (type || 'info');
    el.textContent = msg;
  }

  function clearStatus() {
    var el = qs('status-msg');
    el.className = 'status';
    el.textContent = '';
  }

  // ---------- STORAGE ----------
  function saveSettings() {
    try {
      localStorage.setItem('agfo_provider', state.provider);
      sessionStorage.setItem('agfo_key_openai', qs('key-openai').value.trim());
      sessionStorage.setItem('agfo_key_gemini', qs('key-gemini').value.trim());
      sessionStorage.setItem('agfo_key_claude', qs('key-claude').value.trim());
      localStorage.setItem('agfo_model_openai', qs('model-openai').value);
      localStorage.setItem('agfo_model_gemini', qs('model-gemini').value);
      localStorage.setItem('agfo_model_claude', qs('model-claude').value);
      setStatus('Ayarlar kaydedildi.', 'success');
    } catch (e) {
      setStatus('Kaydetme hatasi: ' + e.message, 'error');
    }
  }

  function loadSettings() {
    try {
      var p = localStorage.getItem('agfo_provider');
      if (p) { state.provider = p; activateProviderTab(p); }
      var ko = sessionStorage.getItem('agfo_key_openai'); if (ko) qs('key-openai').value = ko;
      var kg = sessionStorage.getItem('agfo_key_gemini'); if (kg) qs('key-gemini').value = kg;
      var kc = sessionStorage.getItem('agfo_key_claude'); if (kc) qs('key-claude').value = kc;
      var mo = localStorage.getItem('agfo_model_openai'); if (mo) qs('model-openai').value = mo;
      var mg = localStorage.getItem('agfo_model_gemini'); if (mg) qs('model-gemini').value = mg;
      var mc = localStorage.getItem('agfo_model_claude'); if (mc) qs('model-claude').value = mc;
    } catch (e) { /* sessizce gec */ }
  }

  // ---------- PROVIDER TABS ----------
  function activateProviderTab(provider) {
    state.provider = provider;
    document.querySelectorAll('.ptab').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-provider') === provider);
    });
    ['openai', 'gemini', 'claude'].forEach(function (p) {
      qs('api-' + p).style.display = p === provider ? 'block' : 'none';
    });
  }

  // ---------- MODE BUTTONS ----------
  function activateMode(mode) {
    state.mode = mode;
    document.querySelectorAll('.mode-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-mode') === mode);
    });
  }

  // ---------- PROMPT BUILDER ----------
  function buildPrompt(mode, lang) {
    var base = 'You are an expert editorial assistant. Rewrite the supplied text naturally, fluently, and faithfully. Preserve the meaning, structure, names, facts, and terminology. Improve readability without adding unsupported claims.';

    var modeInstructions = {
      'OTO':          'Automatically detect the best humanization approach for this text.',
      'GENEL':        'Apply general humanization: improve flow, naturalness, and readability.',
      'YAPISAL':      'Focus on structural improvements: reorganize paragraphs, improve logical flow.',
      'TON':          'Adjust the tone to be more natural, warm, and engaging.',
      'AKADEMIK':     'Maintain academic rigor while improving clarity and readability.',
      'KELIME':       'Focus on vocabulary improvements: replace repetitive or robotic words.',
      'KATMANLI':     'Apply layered humanization: tone, structure, and vocabulary simultaneously.',
      'BURST':        'Apply aggressive humanization for maximum naturalness and creativity.',
      'CGK_DRAMA':    'Rewrite with dramatic, engaging narrative style while preserving facts.',
      'CGK_AKADEMIK': 'Rewrite in a sophisticated academic style with precise terminology.'
    };

    var instruction = modeInstructions[mode] || modeInstructions['OTO'];

    return base + '\n\nMode instruction: ' + instruction +
      '\n\nMANDATORY OUTPUT FORMAT:\n' +
      '- Return clean body HTML only.\n' +
      '- Use only these tags when useful: <h2>, <h3>, <p>, <strong>, <em>, <ul>, <ol>, <li>, <blockquote>.\n' +
      '- Do not return Markdown fences, explanations, <html>, <head>, <body>, scripts, or styles.\n' +
      '- Preserve paragraphing. Do not collapse the whole result into one plain-text block.\n' +
      '- Output language: ' + lang + '.\n' +
      '- Selected mode: ' + mode + '.';
  }

  // ---------- API CALLS ----------
  function getApiConfig() {
    var p = state.provider;
    var key = '';
    var model = '';
    var url = '';
    var headers = { 'Content-Type': 'application/json' };

    if (p === 'openai') {
      key = qs('key-openai').value.trim();
      model = qs('model-openai').value;
      url = 'https://api.openai.com/v1/chat/completions';
      headers['Authorization'] = 'Bearer ' + key;
    } else if (p === 'gemini') {
      key = qs('key-gemini').value.trim();
      model = qs('model-gemini').value;
      url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
            encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key);
    } else if (p === 'claude') {
      key = qs('key-claude').value.trim();
      model = qs('model-claude').value;
      url = 'https://api.anthropic.com/v1/messages';
      headers['x-api-key'] = key;
      headers['anthropic-version'] = '2023-06-01';
    }

    if (!key) return { error: 'API anahtari girilmedi. Lutfen API Ayarlari bolumunden anahtarinizi girin.' };
    return { provider: p, key: key, model: model, url: url, headers: headers };
  }

  function buildRequestBody(config, systemPrompt, userText) {
    var p = config.provider;
    var temp = 0.2;
    var maxTokens = 2500;

    if (p === 'openai') {
      return JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userText }
        ],
        max_completion_tokens: maxTokens,
        temperature: temp
      });
    } else if (p === 'gemini') {
      return JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt + '\n\n' + userText }] }],
        generationConfig: { temperature: temp, maxOutputTokens: maxTokens }
      });
    } else if (p === 'claude') {
      return JSON.stringify({
        model: config.model,
        system: systemPrompt,
        messages: [{ role: 'user', content: userText }],
        max_tokens: maxTokens,
        temperature: temp
      });
    }
    return '{}';
  }

  function parseApiResponse(config, data) {
    var p = config.provider;
    var text = '';
    if (p === 'openai' && data.choices && data.choices[0]) {
      text = data.choices[0].message.content || '';
    } else if (p === 'gemini' && data.candidates && data.candidates[0]) {
      text = (data.candidates[0].content.parts[0] || {}).text || '';
    } else if (p === 'claude' && data.content && data.content[0]) {
      text = data.content[0].text || '';
    }
    text = text.replace(/^```(?:html|markdown|md)?\s*/i, '').replace(/\s*```$/i, '').trim();
    return text;
  }

  function callApi(systemPrompt, userText, onSuccess, onError) {
    var config = getApiConfig();
    if (config.error) { onError(config.error); return; }

    var body = buildRequestBody(config, systemPrompt, userText);

    fetch(config.url, {
      method: 'POST',
      headers: config.headers,
      body: body
    })
    .then(function (res) {
      return res.json().then(function (data) {
        return { status: res.status, data: data };
      });
    })
    .then(function (res) {
      if (res.status < 200 || res.status >= 300) {
        var errMsg = (res.data.error && res.data.error.message) ? res.data.error.message : JSON.stringify(res.data.error || res.data);
        onError('API HTTP ' + res.status + ': ' + errMsg);
        return;
      }
      var output = parseApiResponse(config, res.data);
      if (!output) { onError('Bos cikti alindi.'); return; }
      onSuccess(output);
    })
    .catch(function (err) {
      onError('Baglanti hatasi: ' + (err.message || err));
    });
  }

  // ---------- FORMAT OUTPUT ----------
  function formatOutput(raw) {
    var text = (raw || '').trim();
    if (!text) return '';

    if (/<(p|h2|h3|h4|ul|ol|li|blockquote|strong|em)\b/i.test(text)) {
      return text;
    }

    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');

    var lines = text.split('\n');
    var html = '';
    var para = [];

    function flushPara() {
      if (!para.length) return;
      var p = para.join(' ').trim();
      para = [];
      if (p) html += '<p>' + p + '</p>\n';
    }

    lines.forEach(function (line) {
      line = line.trim();
      if (!line) { flushPara(); return; }
      if (/^###\s+(.+)$/.test(line)) { flushPara(); html += '<h3>' + line.replace(/^###\s+/, '') + '</h3>\n'; return; }
      if (/^##\s+(.+)$/.test(line))  { flushPara(); html += '<h2>' + line.replace(/^##\s+/, '') + '</h2>\n'; return; }
      if (/^[-*\u2022]\s+(.+)$/.test(line)) {
        flushPara();
        html += '<ul><li>' + line.replace(/^[-*\u2022]\s+/, '') + '</li></ul>\n';
        return;
      }
      para.push(line);
    });
    flushPara();
    return html.trim();
  }

  // ---------- WORD DOCUMENT OPERATIONS ----------
  function getSelectedText(callback) {
    Word.run(function (context) {
      var selection = context.document.getSelection();
      selection.load('text');
      return context.sync().then(function () {
        callback(null, selection.text);
      });
    }).catch(function (err) {
      callback('Secim alinamadi: ' + err.message, null);
    });
  }

  function getAllText(callback) {
    Word.run(function (context) {
      var body = context.document.body;
      body.load('text');
      return context.sync().then(function () {
        callback(null, body.text);
      });
    }).catch(function (err) {
      callback('Belge okunamadi: ' + err.message, null);
    });
  }

  function insertHtmlAtSelection(html, callback) {
    Word.run(function (context) {
      var selection = context.document.getSelection();
      selection.insertHtml(html, Word.InsertLocation.replace);
      return context.sync().then(function () {
        callback(null);
      });
    }).catch(function (err) {
      callback('Belgeye yazilamadi: ' + err.message);
    });
  }

  function appendHtmlToDocument(html, callback) {
    Word.run(function (context) {
      var body = context.document.body;
      body.insertHtml(html, Word.InsertLocation.end);
      return context.sync().then(function () {
        callback(null);
      });
    }).catch(function (err) {
      callback('Belgeye eklenemedi: ' + err.message);
    });
  }

  // ---------- MAIN HUMANIZE ----------
  function runHumanize() {
    var text = (qs('hc-input').value || '').trim();
    if (!text) { setStatus('Lutfen metin girin.', 'error'); return; }

    var btn = qs('btn-run');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Isleniyor...';
    setStatus('Model yaniti bekleniyor...', 'info');

    var systemPrompt = buildPrompt(state.mode, qs('lang-select').value);

    callApi(systemPrompt, text,
      function (output) {
        var html = formatOutput(output);
        state.lastHtml = html;
        state.lastText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

        qs('hc-output').innerHTML = html;
        qs('hc-output').style.display = 'block';
        qs('output-section').style.display = 'block';
        qs('used-mode').textContent = state.mode;

        btn.disabled = false;
        btn.innerHTML = '\uD83D\uDE80 \u0130nsanla\u015Ft\u0131r';
        setStatus('Tamamlandi! \u2705', 'success');
      },
      function (err) {
        btn.disabled = false;
        btn.innerHTML = '\uD83D\uDE80 \u0130nsanla\u015Ft\u0131r';
        setStatus('Hata: ' + err, 'error');
      }
    );
  }

  // ---------- INIT ----------
  function init() {
    loadSettings();

    document.querySelectorAll('.ptab').forEach(function (b) {
      b.addEventListener('click', function () {
        activateProviderTab(b.getAttribute('data-provider'));
      });
    });

    document.querySelectorAll('.mode-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        activateMode(b.getAttribute('data-mode'));
      });
    });

    qs('btn-save-key').addEventListener('click', saveSettings);

    qs('hc-input').addEventListener('input', function () {
      qs('char-count').textContent = this.value.length;
    });

    qs('btn-get-selection').addEventListener('click', function () {
      getSelectedText(function (err, text) {
        if (err) { setStatus(err, 'error'); return; }
        if (!text || !text.trim()) { setStatus('Belgede secili metin bulunamadi.', 'error'); return; }
        qs('hc-input').value = text;
        qs('char-count').textContent = text.length;
        clearStatus();
      });
    });

    qs('btn-get-all').addEventListener('click', function () {
      getAllText(function (err, text) {
        if (err) { setStatus(err, 'error'); return; }
        qs('hc-input').value = text;
        qs('char-count').textContent = text.length;
        clearStatus();
      });
    });

    qs('btn-run').addEventListener('click', runHumanize);

    qs('btn-replace').addEventListener('click', function () {
      if (!state.lastHtml) { setStatus('Once insanlastirma yapin.', 'error'); return; }
      insertHtmlAtSelection(state.lastHtml, function (err) {
        if (err) setStatus(err, 'error');
        else setStatus('Secim degistirildi. \u2705', 'success');
      });
    });

    qs('btn-append').addEventListener('click', function () {
      if (!state.lastHtml) { setStatus('Once insanlastirma yapin.', 'error'); return; }
      appendHtmlToDocument(state.lastHtml, function (err) {
        if (err) setStatus(err, 'error');
        else setStatus('Belge sonuna eklendi. \u2705', 'success');
      });
    });

    qs('btn-copy').addEventListener('click', function () {
      if (!state.lastText) { setStatus('Kopyalanacak icerik yok.', 'error'); return; }
      navigator.clipboard.writeText(state.lastText).then(function () {
        setStatus('Panoya kopyalandi. \u2705', 'success');
      }).catch(function () {
        setStatus('Kopyalama basarisiz.', 'error');
      });
    });
  }

  return { init: init };
})();
