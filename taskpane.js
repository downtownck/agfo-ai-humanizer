/* ============================================================
 * AGFO AI Humanizer - Word Office.js
 * Dynamic Models: OpenRouter + OpenAI + Claude + Gemini
 * ============================================================ */

(function () {
  "use strict";

  const SETTINGS_KEY = "agfo_humanizer_settings_v5";
  const MODEL_CACHE_KEY = "agfo_humanizer_model_cache_v5";

  const MAX_OUTPUT_TOKENS = 2500;
  const TEMPERATURE = 0.2;
  const MODEL_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

  const state = {
    provider: "openrouter",
    outputText: "",
    initialized: false
  };

  const providers = {
    openrouter: {
      label: "OpenRouter",
      keyId: "key-openrouter",
      modelId: "model-openrouter",
      defaultModel: "openai/gpt-4o-mini",
      fallback: [
        { id: "openai/gpt-4o-mini", name: "OpenAI GPT-4o mini" },
        { id: "openai/gpt-4o", name: "OpenAI GPT-4o" },
        { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
        { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash" },
        { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B Instruct" }
      ]
    },
    openai: {
      label: "OpenAI",
      keyId: "key-openai",
      modelId: "model-openai",
      defaultModel: "gpt-4o-mini",
      fallback: [
        { id: "gpt-4o-mini", name: "gpt-4o-mini" },
        { id: "gpt-4o", name: "gpt-4o" },
        { id: "gpt-4.1-mini", name: "gpt-4.1-mini" },
        { id: "gpt-4.1", name: "gpt-4.1" }
      ]
    },
    claude: {
      label: "Claude",
      keyId: "key-claude",
      modelId: "model-claude",
      defaultModel: "claude-3-5-sonnet-20241022",
      fallback: [
        { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet" },
        { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku" },
        { id: "claude-3-opus-20240229", name: "Claude 3 Opus" }
      ]
    },
    gemini: {
      label: "Gemini",
      keyId: "key-gemini",
      modelId: "model-gemini",
      defaultModel: "gemini-2.0-flash",
      fallback: [
        { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
        { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro" },
        { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash" }
      ]
    }
  };

  function $(id) {
    return document.getElementById(id);
  }

  function setStatus(message, type) {
    const el = $("status-msg");
    if (!el) return;

    if (!message) {
      el.style.display = "none";
      el.textContent = "";
      el.className = "status";
      return;
    }

    el.textContent = message;
    el.className = "status " + (type || "info");
    el.style.display = "block";
  }

  function setModelStatus(message, type) {
    const el = $("model-status");
    if (!el) return;

    if (!message) {
      el.style.display = "none";
      el.textContent = "";
      el.className = "status";
      return;
    }

    el.textContent = message;
    el.className = "status " + (type || "info");
    el.style.display = "block";
  }

  function getKey(provider) {
    const p = providers[provider];
    const el = $(p.keyId);
    return el ? el.value.trim() : "";
  }

  function getSelectedModel(provider) {
    const p = providers[provider];
    const el = $(p.modelId);
    return el ? el.value : p.defaultModel;
  }

  function activeMode() {
    const btn = document.querySelector(".mode-btn.active");
    return btn ? btn.getAttribute("data-mode") : "OTO";
  }

  function activeLang() {
    const el = $("lang-select");
    return el ? el.value : "Turkish";
  }

  function saveSettings() {
    const data = {
      provider: state.provider,
      keys: {},
      models: {}
    };

    Object.keys(providers).forEach(function (provider) {
      const p = providers[provider];
      const keyEl = $(p.keyId);
      const modelEl = $(p.modelId);

      data.keys[provider] = keyEl ? keyEl.value : "";
      data.models[provider] = modelEl ? modelEl.value : p.defaultModel;
    });

    localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
    setStatus("Ayarlar kaydedildi.", "success");
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return;

      const data = JSON.parse(raw);

      if (data.provider && providers[data.provider]) {
        state.provider = data.provider;
      }

      Object.keys(providers).forEach(function (provider) {
        const p = providers[provider];

        if (data.keys && typeof data.keys[provider] === "string") {
          const keyEl = $(p.keyId);
          if (keyEl) keyEl.value = data.keys[provider];
        }
      });
    } catch (e) {
      console.warn("Settings load failed:", e);
    }
  }

  function getCachedModels(provider) {
    try {
      const raw = localStorage.getItem(MODEL_CACHE_KEY);
      if (!raw) return null;

      const cache = JSON.parse(raw);
      const item = cache[provider];

      if (!item || !item.createdAt || !Array.isArray(item.models)) return null;
      if (Date.now() - item.createdAt > MODEL_CACHE_TTL_MS) return null;

      return item.models;
    } catch (e) {
      return null;
    }
  }

  function setCachedModels(provider, models) {
    try {
      const raw = localStorage.getItem(MODEL_CACHE_KEY);
      const cache = raw ? JSON.parse(raw) : {};

      cache[provider] = {
        createdAt: Date.now(),
        models: models
      };

      localStorage.setItem(MODEL_CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
      console.warn("Model cache save failed:", e);
    }
  }

  function normalizeId(id) {
    return String(id || "").replace(/^models\//, "").trim();
  }

  function isBadModelId(id) {
    const s = String(id || "").toLowerCase();

    const banned = [
      "embedding",
      "embed",
      "dall-e",
      "image",
      "gpt-image",
      "tts",
      "whisper",
      "transcribe",
      "transcription",
      "audio",
      "realtime",
      "moderation",
      "sora",
      "video",
      "rerank",
      "search",
      "vision-preview"
    ];

    return banned.some(function (x) {
      return s.includes(x);
    });
  }

  function looksChatCapable(provider, model) {
    const id = normalizeId(model.id).toLowerCase();
    const name = String(model.name || "").toLowerCase();

    if (!id || isBadModelId(id) || isBadModelId(name)) return false;

    if (provider === "openrouter") {
      const arch = model.architecture || {};
      const input = arch.input_modalities || [];
      const output = arch.output_modalities || [];

      if (Array.isArray(input) && input.length && !input.includes("text")) return false;
      if (Array.isArray(output) && output.length && !output.includes("text")) return false;

      return true;
    }

    if (provider === "gemini") {
      const methods = model.supportedGenerationMethods || model.supported_actions || [];
      if (Array.isArray(methods) && methods.length) {
        return methods.includes("generateContent");
      }
      return id.includes("gemini");
    }

    if (provider === "claude") {
      return id.includes("claude");
    }

    if (provider === "openai") {
      return (
        id.startsWith("gpt-") ||
        id.startsWith("o") ||
        id.startsWith("chatgpt-")
      );
    }

    return true;
  }

  function scoreModel(provider, model) {
    const id = normalizeId(model.id).toLowerCase();
    const name = String(model.name || "").toLowerCase();
    const text = id + " " + name;

    let score = 0;

    const topPatterns = [
      ["gpt-5.5-pro", 500],
      ["gpt-5.5", 490],
      ["gpt-5.4-pro", 470],
      ["gpt-5.4-mini", 455],
      ["gpt-5.4", 450],
      ["gpt-5", 430],
      ["gpt-4.1", 390],
      ["gpt-4o", 360],

      ["claude-opus-4.5", 480],
      ["claude-sonnet-4.5", 470],
      ["claude-4", 440],
      ["claude-3-7-sonnet", 395],
      ["claude-3.7-sonnet", 395],
      ["claude-3-5-sonnet", 370],
      ["claude-3.5-sonnet", 370],
      ["claude-3-5-haiku", 310],

      ["gemini-3-pro", 470],
      ["gemini-2.5-pro", 420],
      ["gemini-2.5-flash", 390],
      ["gemini-2.0-flash", 330],
      ["gemini-1.5-pro", 260],

      ["o4-mini", 360],
      ["o3", 345],

      ["mistral-large", 260],
      ["deepseek-v3", 250],
      ["qwen3", 240],
      ["llama-3.3", 220]
    ];

    topPatterns.forEach(function (pair) {
      if (text.includes(pair[0])) score += pair[1];
    });

    if (text.includes("mini")) score += 35;
    if (text.includes("flash")) score += 35;
    if (text.includes("sonnet")) score += 40;
    if (text.includes("pro")) score += 25;

    if (text.includes("instruct")) score += 20;
    if (text.includes("chat")) score += 20;

    if (text.includes("free")) score -= 20;
    if (text.includes("preview")) score -= 15;
    if (text.includes("experimental")) score -= 35;
    if (text.includes("beta")) score -= 25;
    if (text.includes("deprecated")) score -= 150;

    if (provider === "openrouter") {
      const context = Number(
        model.context_length ||
        (model.top_provider && model.top_provider.context_length) ||
        0
      );

      if (context >= 1000000) score += 70;
      else if (context >= 200000) score += 50;
      else if (context >= 128000) score += 35;
      else if (context >= 32000) score += 15;

      const params = model.supported_parameters || [];
      if (Array.isArray(params) && params.includes("temperature")) score += 5;
      if (Array.isArray(params) && params.includes("max_tokens")) score += 5;
    }

    if (model.created) {
      score += Math.min(30, Math.max(0, Number(model.created) / 1000000000));
    }

    return score;
  }

  function sortUsefulModels(provider, models) {
    const seen = {};
    const cleaned = [];

    models.forEach(function (m) {
      const id = normalizeId(m.id);
      if (!id || seen[id]) return;
      seen[id] = true;

      const item = Object.assign({}, m, { id: id });
      if (!looksChatCapable(provider, item)) return;

      item._score = scoreModel(provider, item);
      cleaned.push(item);
    });

    cleaned.sort(function (a, b) {
      if (b._score !== a._score) return b._score - a._score;
      return String(a.id).localeCompare(String(b.id));
    });

    return cleaned;
  }

  function formatContext(n) {
    const val = Number(n || 0);
    if (!val) return "";

    if (val >= 1000000) return Math.round(val / 1000000) + "M ctx";
    if (val >= 1000) return Math.round(val / 1000) + "K ctx";
    return val + " ctx";
  }

  function optionLabel(model, index) {
    const name = model.name || model.id;
    const id = model.id;

    let suffix = "";

    const context =
      model.context_length ||
      (model.top_provider && model.top_provider.context_length) ||
      model.inputTokenLimit ||
      model.input_token_limit;

    if (context) suffix += " · " + formatContext(context);

    if (index < 8) return "⭐ " + name + " — " + id + suffix;
    return name + " — " + id + suffix;
  }

  function fillModelSelect(provider, models, preferredValue) {
    const p = providers[provider];
    const select = $(p.modelId);
    if (!select) return;

    select.innerHTML = "";

    const sorted = sortUsefulModels(provider, models);
    const finalModels = sorted.length ? sorted : p.fallback;

    const recommended = finalModels.slice(0, 12);
    const others = finalModels.slice(12, 120);

    const groupTop = document.createElement("optgroup");
    groupTop.label = "Önerilen / işe yarayan chat modelleri";

    recommended.forEach(function (model, index) {
      const opt = document.createElement("option");
      opt.value = model.id;
      opt.textContent = optionLabel(model, index);
      groupTop.appendChild(opt);
    });

    select.appendChild(groupTop);

    if (others.length) {
      const groupOther = document.createElement("optgroup");
      groupOther.label = "Diğer uygun modeller";

      others.forEach(function (model, index) {
        const opt = document.createElement("option");
        opt.value = model.id;
        opt.textContent = optionLabel(model, index + recommended.length);
        groupOther.appendChild(opt);
      });

      select.appendChild(groupOther);
    }

    const saved = preferredValue || getSavedModel(provider) || p.defaultModel;
    if ([].slice.call(select.options).some(function (o) { return o.value === saved; })) {
      select.value = saved;
    } else if (select.options.length) {
      select.selectedIndex = 0;
    }
  }

  function getSavedModel(provider) {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return "";
      const data = JSON.parse(raw);
      return data.models && data.models[provider] ? data.models[provider] : "";
    } catch (e) {
      return "";
    }
  }

  async function fetchModels(provider) {
    if (provider === "openrouter") return fetchOpenRouterModels();
    if (provider === "openai") return fetchOpenAIModels();
    if (provider === "claude") return fetchClaudeModels();
    if (provider === "gemini") return fetchGeminiModels();

    return providers[provider].fallback;
  }

  async function fetchOpenRouterModels() {
    const key = getKey("openrouter");

    const headers = {};
    if (key) headers.Authorization = "Bearer " + key;

    const res = await fetch("https://openrouter.ai/api/v1/models", {
      method: "GET",
      headers: headers
    });

    if (!res.ok) {
      throw new Error("OpenRouter model listesi alınamadı: HTTP " + res.status);
    }

    const data = await res.json();
    return Array.isArray(data.data) ? data.data : [];
  }

  async function fetchOpenAIModels() {
    const key = getKey("openai");
    if (!key) {
      throw new Error("OpenAI modellerini çekmek için API key gerekli.");
    }

    const res = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        Authorization: "Bearer " + key
      }
    });

    if (!res.ok) {
      throw new Error("OpenAI model listesi alınamadı: HTTP " + res.status);
    }

    const data = await res.json();

    return Array.isArray(data.data)
      ? data.data.map(function (m) {
          return {
            id: m.id,
            name: m.id,
            created: m.created,
            owned_by: m.owned_by
          };
        })
      : [];
  }

  async function fetchClaudeModels() {
    const key = getKey("claude");
    if (!key) {
      throw new Error("Claude modellerini çekmek için API key gerekli.");
    }

    const res = await fetch("https://api.anthropic.com/v1/models?limit=1000", {
      method: "GET",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01"
      }
    });

    if (!res.ok) {
      throw new Error("Claude model listesi alınamadı: HTTP " + res.status);
    }

    const data = await res.json();

    return Array.isArray(data.data)
      ? data.data.map(function (m) {
          return {
            id: m.id,
            name: m.display_name || m.id,
            created_at: m.created_at
          };
        })
      : [];
  }

  async function fetchGeminiModels() {
    const key = getKey("gemini");
    if (!key) {
      throw new Error("Gemini modellerini çekmek için API key gerekli.");
    }

    const url =
      "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&key=" +
      encodeURIComponent(key);

    const res = await fetch(url, {
      method: "GET"
    });

    if (!res.ok) {
      throw new Error("Gemini model listesi alınamadı: HTTP " + res.status);
    }

    const data = await res.json();

    return Array.isArray(data.models)
      ? data.models.map(function (m) {
          return {
            id: normalizeId(m.name),
            name: m.displayName || normalizeId(m.name),
            description: m.description || "",
            supportedGenerationMethods: m.supportedGenerationMethods || [],
            inputTokenLimit: m.inputTokenLimit,
            outputTokenLimit: m.outputTokenLimit
          };
        })
      : [];
  }

  async function refreshModels(provider, force) {
    const p = providers[provider];
    const preferred = getSavedModel(provider);

    if (!force) {
      const cached = getCachedModels(provider);
      if (cached && cached.length) {
        fillModelSelect(provider, cached, preferred);
        setModelStatus(p.label + " modelleri önbellekten yüklendi.", "info");
        return;
      }
    }

    setModelStatus(p.label + " modelleri çekiliyor...", "info");

    try {
      const models = await fetchModels(provider);
      const sorted = sortUsefulModels(provider, models);

      if (!sorted.length) {
        throw new Error("Uygun chat modeli bulunamadı.");
      }

      setCachedModels(provider, sorted);
      fillModelSelect(provider, sorted, preferred);

      setModelStatus(
        p.label + ": " + sorted.length + " uygun model bulundu. En işe yarayanlar üstte.",
        "success"
      );
    } catch (err) {
      console.warn(err);
      fillModelSelect(provider, p.fallback, preferred);

      setModelStatus(
        p.label + " canlı model listesi alınamadı. Güvenli yedek liste kullanılıyor. " + err.message,
        "error"
      );
    }
  }

  function setProvider(provider) {
    if (!providers[provider]) return;

    state.provider = provider;

    document.querySelectorAll(".ptab").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-provider") === provider);
    });

    Object.keys(providers).forEach(function (p) {
      const panel = $("api-" + p);
      if (panel) panel.style.display = p === provider ? "block" : "none";
    });

    refreshModels(provider, false);
  }

  function buildPrompt(mode, lang) {
    let personality = "";

    if (mode === "OTO") {
      personality = "Choose the most suitable rewrite strategy automatically.";
    } else if (mode === "GENEL") {
      personality = "Improve general fluency and naturalness.";
    } else if (mode === "YAPISAL") {
      personality = "Improve structure, flow, transitions, and paragraph logic.";
    } else if (mode === "TON") {
      personality = "Improve tone, rhythm, and human warmth.";
    } else if (mode === "AKADEMIK") {
      personality = "Use an academic but readable tone. Preserve terminology.";
    } else if (mode === "KELIME") {
      personality = "Improve word choice without changing the core meaning.";
    } else if (mode === "KATMANLI") {
      personality = "Add layered nuance while preserving factual accuracy.";
    } else if (mode === "BURST") {
      personality = "Increase sentence variety and natural burstiness.";
    } else if (mode === "CGK_DRAMA") {
      personality = "Use a dramatic, philosophical, vivid style without adding unsupported claims.";
    } else if (mode === "CGK_AKADEMIK") {
      personality = "Use a refined academic style with conceptual depth and clear reasoning.";
    }

    return [
      "You are AGFO AI Humanizer, an expert editorial assistant.",
      "Rewrite the supplied text naturally, fluently, and faithfully.",
      "Preserve meaning, facts, names, terminology, numbers, and document intent.",
      "Do not invent facts. Do not add unsupported claims.",
      "Preserve paragraphing as much as possible.",
      "Return clean plain text suitable for Microsoft Word.",
      "Do not return markdown fences.",
      "Do not explain what you did.",
      "Output language: " + lang + ".",
      "Selected mode: " + mode + ".",
      personality
    ].join("\n");
  }

  async function callAI(systemPrompt, userText) {
    if (state.provider === "openrouter") {
      return callOpenAICompatible({
        provider: "openrouter",
        url: "https://openrouter.ai/api/v1/chat/completions",
        key: getKey("openrouter"),
        model: getSelectedModel("openrouter"),
        useOpenRouterHeaders: true,
        systemPrompt: systemPrompt,
        userText: userText
      });
    }

    if (state.provider === "openai") {
      return callOpenAICompatible({
        provider: "openai",
        url: "https://api.openai.com/v1/chat/completions",
        key: getKey("openai"),
        model: getSelectedModel("openai"),
        useOpenRouterHeaders: false,
        systemPrompt: systemPrompt,
        userText: userText
      });
    }

    if (state.provider === "claude") {
      return callClaude(systemPrompt, userText);
    }

    if (state.provider === "gemini") {
      return callGemini(systemPrompt, userText);
    }

    throw new Error("Bilinmeyen provider: " + state.provider);
  }

  function modelLooksReasoning(model) {
    const s = String(model || "").toLowerCase();
    return (
      s.startsWith("o1") ||
      s.startsWith("o3") ||
      s.startsWith("o4") ||
      s.includes("reasoning")
    );
  }

  async function callOpenAICompatible(opts) {
    if (!opts.key) {
      throw new Error(providers[opts.provider].label + " API key eksik.");
    }

    const body = {
      model: opts.model,
      messages: [
        { role: "system", content: opts.systemPrompt },
        { role: "user", content: opts.userText }
      ]
    };

    if (opts.provider === "openrouter") {
      body.max_tokens = MAX_OUTPUT_TOKENS;
      body.temperature = TEMPERATURE;
    } else {
      body.max_completion_tokens = MAX_OUTPUT_TOKENS;

      if (!modelLooksReasoning(opts.model)) {
        body.temperature = TEMPERATURE;
      }
    }

    const headers = {
      "Content-Type": "application/json",
      Authorization: "Bearer " + opts.key
    };

    if (opts.useOpenRouterHeaders) {
      headers["HTTP-Referer"] = "https://downtownck.github.io/agfo-ai-humanizer/";
      headers["X-Title"] = "AGFO AI Humanizer Word Add-in";
    }

    const res = await fetch(opts.url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(body)
    });

    const data = await res.json().catch(function () {
      return {};
    });

    if (!res.ok) {
      const msg =
        data.error && data.error.message
          ? data.error.message
          : "HTTP " + res.status;
      throw new Error(msg);
    }

    const out =
      data &&
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content;

    if (!out) {
      throw new Error("Model boş yanıt döndürdü.");
    }

    return cleanModelOutput(out);
  }

  async function callClaude(systemPrompt, userText) {
    const key = getKey("claude");
    if (!key) throw new Error("Claude API key eksik.");

    const model = getSelectedModel("claude");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: model,
        system: systemPrompt,
        messages: [
          { role: "user", content: userText }
        ],
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: TEMPERATURE
      })
    });

    const data = await res.json().catch(function () {
      return {};
    });

    if (!res.ok) {
      const msg =
        data.error && data.error.message
          ? data.error.message
          : "HTTP " + res.status;
      throw new Error(msg);
    }

    const out =
      data &&
      data.content &&
      data.content[0] &&
      data.content[0].text;

    if (!out) throw new Error("Claude boş yanıt döndürdü.");

    return cleanModelOutput(out);
  }

  async function callGemini(systemPrompt, userText) {
    const key = getKey("gemini");
    if (!key) throw new Error("Gemini API key eksik.");

    const model = getSelectedModel("gemini");
    const safeModel = normalizeId(model);

    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(safeModel) +
      ":generateContent?key=" +
      encodeURIComponent(key);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: systemPrompt + "\n\nTEXT:\n" + userText
              }
            ]
          }
        ],
        generationConfig: {
          temperature: TEMPERATURE,
          maxOutputTokens: MAX_OUTPUT_TOKENS
        }
      })
    });

    const data = await res.json().catch(function () {
      return {};
    });

    if (!res.ok) {
      const msg =
        data.error && data.error.message
          ? data.error.message
          : "HTTP " + res.status;
      throw new Error(msg);
    }

    const out =
      data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text;

    if (!out) throw new Error("Gemini boş yanıt döndürdü.");

    return cleanModelOutput(out);
  }

  function cleanModelOutput(text) {
    return String(text || "")
      .replace(/^\s*```(?:html|markdown|md|text)?/i, "")
      .replace(/```\s*$/i, "")
      .replace(/\uFEFF/g, "")
      .trim();
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function textToHtml(text) {
    const clean = cleanModelOutput(text);
    const paragraphs = clean
      .split(/\n{2,}/)
      .map(function (p) {
        return p.trim();
      })
      .filter(Boolean);

    if (!paragraphs.length) return "";

    return paragraphs
      .map(function (p) {
        return "<p>" + escapeHtml(p).replace(/\n/g, "<br>") + "</p>";
      })
      .join("");
  }

  async function getSelectionText() {
    try {
      await Word.run(async function (context) {
        const range = context.document.getSelection();
        range.load("text");
        await context.sync();

        $("hc-input").value = range.text || "";
        updateCharCount();
        setStatus("Seçili metin alındı.", "success");
      });
    } catch (err) {
      setStatus("Seçili metin alınamadı: " + err.message, "error");
    }
  }

  async function getAllText() {
    try {
      await Word.run(async function (context) {
        const body = context.document.body;
        body.load("text");
        await context.sync();

        $("hc-input").value = body.text || "";
        updateCharCount();
        setStatus("Tüm belge metni alındı.", "success");
      });
    } catch (err) {
      setStatus("Belge metni alınamadı: " + err.message, "error");
    }
  }

  async function replaceSelection() {
    if (!state.outputText) {
      setStatus("Önce AI çıktısı üretmelisin.", "error");
      return;
    }

    try {
      await Word.run(async function (context) {
        const range = context.document.getSelection();
        range.insertText(state.outputText, "Replace");
        await context.sync();

        setStatus("Seçim AI çıktısıyla değiştirildi.", "success");
      });
    } catch (err) {
      setStatus("Word'e yazılamadı: " + err.message, "error");
    }
  }

  async function appendToEnd() {
    if (!state.outputText) {
      setStatus("Önce AI çıktısı üretmelisin.", "error");
      return;
    }

    try {
      await Word.run(async function (context) {
        context.document.body.insertParagraph(state.outputText, "End");
        await context.sync();

        setStatus("Çıktı belgenin sonuna eklendi.", "success");
      });
    } catch (err) {
      setStatus("Belge sonuna eklenemedi: " + err.message, "error");
    }
  }

  async function copyOutput() {
    if (!state.outputText) {
      setStatus("Kopyalanacak çıktı yok.", "error");
      return;
    }

    try {
      await navigator.clipboard.writeText(state.outputText);
      setStatus("Çıktı kopyalandı.", "success");
    } catch (err) {
      setStatus("Kopyalama başarısız: " + err.message, "error");
    }
  }

  async function runHumanizer() {
    const input = $("hc-input");
    const btn = $("btn-run");

    const text = input ? input.value.trim() : "";
    if (!text) {
      setStatus("Lütfen metin gir veya belgeden metin al.", "error");
      return;
    }

    const provider = state.provider;
    const model = getSelectedModel(provider);
    const lang = activeLang();
    const mode = activeMode();

    saveSettings();

    const oldHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>İşleniyor...';

    setStatus(
      providers[provider].label + " / " + model + " ile metin işleniyor...",
      "info"
    );

    try {
      const prompt = buildPrompt(mode, lang);
      const result = await callAI(prompt, text);

      state.outputText = result;

      const output = $("hc-output");
      const section = $("output-section");

      output.innerHTML = textToHtml(result);
      output.style.display = "block";
      section.style.display = "block";

      $("used-mode").textContent = mode + " · " + providers[provider].label + " · " + model;

      setStatus("Tamamlandı.", "success");
    } catch (err) {
      console.error(err);

      let extra = "";
      if (
        String(err.message || "").toLowerCase().includes("failed to fetch") ||
        String(err.message || "").toLowerCase().includes("cors")
      ) {
        extra =
          " Not: Bazı sağlayıcılar tarayıcı/Office taskpane içinden doğrudan API çağrısını CORS nedeniyle engelleyebilir. Ürünleşmede backend proxy daha sağlıklı olur.";
      }

      setStatus("Hata: " + err.message + extra, "error");
    } finally {
      btn.disabled = false;
      btn.innerHTML = oldHtml;
    }
  }

  function updateCharCount() {
    const input = $("hc-input");
    const count = $("char-count");
    if (input && count) count.textContent = String(input.value.length);
  }

  function bindEvents() {
    document.querySelectorAll(".ptab").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setProvider(btn.getAttribute("data-provider"));
      });
    });

    document.querySelectorAll(".mode-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.querySelectorAll(".mode-btn").forEach(function (b) {
          b.classList.remove("active");
        });
        btn.classList.add("active");
      });
    });

    const input = $("hc-input");
    if (input) input.addEventListener("input", updateCharCount);

    $("btn-save-key").addEventListener("click", function () {
      saveSettings();
      refreshModels(state.provider, true);
    });

    $("btn-refresh-models").addEventListener("click", function () {
      saveSettings();
      refreshModels(state.provider, true);
    });

    $("btn-get-selection").addEventListener("click", getSelectionText);
    $("btn-get-all").addEventListener("click", getAllText);
    $("btn-run").addEventListener("click", runHumanizer);
    $("btn-replace").addEventListener("click", replaceSelection);
    $("btn-append").addEventListener("click", appendToEnd);
    $("btn-copy").addEventListener("click", copyOutput);

    Object.keys(providers).forEach(function (provider) {
      const p = providers[provider];
      const modelEl = $(p.modelId);
      const keyEl = $(p.keyId);

      if (modelEl) {
        modelEl.addEventListener("change", saveSettings);
      }

      if (keyEl) {
        keyEl.addEventListener("change", saveSettings);
      }
    });
  }

  function initFallbackModels() {
    Object.keys(providers).forEach(function (provider) {
      fillModelSelect(provider, providers[provider].fallback, getSavedModel(provider));
    });
  }

  function init() {
    if (state.initialized) return;
    state.initialized = true;

    loadSettings();
    initFallbackModels();
    bindEvents();
    updateCharCount();
    setProvider(state.provider || "openrouter");

    setModelStatus("Model listeleri hazır. OpenRouter önerilir; güncel modeller için Modelleri Yenile.", "info");
  }

  if (window.Office && Office.onReady) {
    Office.onReady(function () {
      init();
    });
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }
})();
