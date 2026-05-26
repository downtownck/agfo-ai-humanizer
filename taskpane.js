/* ============================================================
 * AGFO AI Humanizer - Word Office.js
 * Stable clean version
 * Flow: Get Selection / Get All -> Humanize -> Replace / Append / Copy
 * Providers: OpenRouter + OpenAI + Claude + Gemini
 * ============================================================ */

(function () {
  "use strict";

  var SETTINGS_KEY = "agfo_humanizer_settings_stable_v1";
  var MODEL_CACHE_KEY = "agfo_humanizer_model_cache_stable_v1";

  var MAX_OUTPUT_TOKENS = 2500;
  var TEMPERATURE = 0.2;
  var MODEL_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

  var state = {
    provider: "openrouter",
    outputText: "",
    initialized: false
  };

  var providers = {
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


  var SETTINGS_VERSION = "4.3.0";

  var AGFO_ANTI_AI_RULES = [
    "Türkçede yapay zekâ kokan, çeviri tadı veren, şişirilmiş ve klişe anlatımdan kaçın.",
    "Üçlü tekrarları kır: 'X, Y ve Z' listelerini ikiye indir veya böl.",
    "Paragrafı olumsuz yüklemle açma; yokluğu olumlu bir imgeyle göster.",
    "Yapay bağlaçları azalt: üstelik, dahası, nitekim, bilakis, mamafih, keza.",
    "Klişe duygu ifadelerini davranış ve ayrıntıyla değiştir.",
    "Soyut sıçramadan önce somut sahne, duyusal temas veya bağlam kur.",
    "Gereksiz pekiştiricileri sil: çok, gerçekten, oldukça, adeta, sanki.",
    "Bir paragrafta en fazla bir güçlü imge kullan; metafor sahneden doğsun.",
    "Okura güven; gösterilen sahneyi açıklayan sonuç cümlelerini azalt.",
    "Şüphede kaldığında sil; silindiğinde anlam eksilmiyorsa cümle fazladır."
  ].join("\n- ");

  var PRESET_GROUPS = {
    "Türk Edebiyatı": ["istanbul_nostalji", "deniz_hikayesi", "epik_anlati", "felsefi_monolog", "cemal_gurkan_kara"],
    "Dünya Edebiyatı": ["noir_gerilim", "buyulu_gercekcilik", "modern_surrealizm", "trajik_drama"],
    "Ton & Atmosfer": ["dogal_akis", "edebi_uslup", "duygusal", "dramatik", "betimleyici", "diyalog_odakli"],
    "Özel Üsluplar": ["minimalist", "komik", "karamistik", "romantik"],
    "Akademik": ["cemal_gurkan_kara_akademik"]
  };

  var PRESET_LIBRARY = {
    istanbul_nostalji: { icon:"🏛️", name:"İstanbul Nostaljisi", writer:"Orhan Pamuk", anti:true, desc:"Melankolik İstanbul atmosferi", guide:"Melankolik ve nostaljik ton kur. İstanbul atmosferini geçmiş özlemi, sokak ayrıntıları ve içe dönük bakışla taşı; süs için değil hafıza için betimle." },
    deniz_hikayesi: { icon:"🌊", name:"Deniz Hikayesi", writer:"Sait Faik Abasıyanık", anti:true, desc:"Lirik ve sade deniz anlatısı", guide:"Sade ama şiirsel bir dil kullan. Deniz, kıyı, balıkçı, rüzgâr ve gündelik insan ayrıntılarını abartmadan, sıcak bir gözlemle yaz." },
    epik_anlati: { icon:"🏔️", name:"Epik Anlatı", writer:"Yaşar Kemal", anti:true, desc:"Güçlü doğa ve destansı ritim", guide:"Doğayı canlı bir güç gibi hissettir. Epik ritim kur ama metne yeni olay ekleme; mevcut sahnenin büyüklüğünü somut ayrıntılarla yükselt." },
    felsefi_monolog: { icon:"🤔", name:"Felsefi İç Monolog", writer:"Oğuz Atay", anti:true, desc:"Bilinç akışı ve ironik iç ses", guide:"İç sesi canlı tut. Felsefi sorgulamayı karakterin zihninden geçir; açıklayıcı makale tonuna kaçmadan, hafif ironi ve kırık ritim kullan." },
    cemal_gurkan_kara: { icon:"🌀", name:"Cemal Gürkan Kara", writer:"Cemal Gürkan Kara", anti:true, desc:"Katmanlı düşünce ve organik sentez", guide:"Sahne → algı → iç tepki → kavrayış akışını kur. Fiziksel, sosyal ve kavramsal katmanları aynı cümleye yığma; anlam sahneden yükselsin. Süslü değil, doğal, katmanlı ve yönü olan metin üret." },
    noir_gerilim: { icon:"🌑", name:"Noir Gerilim", writer:"Ernest Hemingway", anti:true, desc:"Minimal, karanlık, kontrollü gerilim", guide:"Kısa ve kontrollü cümleler kullan. Karanlık atmosferi fazla açıklamadan, nesne ve hareket üzerinden kur. Duyguyu adlandırma." },
    buyulu_gercekcilik: { icon:"🦋", name:"Büyülü Gerçekçilik", writer:"Gabriel García Márquez", anti:true, desc:"Gündelik ile olağandışının birleşimi", guide:"Olağan dışı ayrıntı varsa onu açıklama; gündelik hayatın doğal parçasıymış gibi taşı. Lirik akışı koru, ama yeni büyülü olay ekleme." },
    modern_surrealizm: { icon:"🐱", name:"Modern Sürrealizm", writer:"Haruki Murakami", anti:true, desc:"Sakin, yalnız ve gizemli atmosfer", guide:"Sakin, berrak ve hafif gizemli bir ton kur. Gündelik ayrıntı ile tuhaf sezgiyi yan yana getir; açıklamayı azalt." },
    trajik_drama: { icon:"💔", name:"Trajik Drama", writer:"Fyodor Dostoyevski", anti:true, desc:"Psikolojik yoğunluk ve ahlaki gerilim", guide:"Karakterin iç çatışmasını güçlendir. Ahlaki gerilimi doğrudan vaazla değil, tereddüt, beden ve küçük kararlar üzerinden göster." },
    dogal_akis: { icon:"💬", name:"Doğal Akış", writer:"Genel", anti:true, desc:"Günlük dile yakın akıcılık", guide:"Günlük konuşma diline yakın, sade ve akıcı yaz. Yapay geçişleri, şablon cümleleri ve çeviri tonunu temizle." },
    edebi_uslup: { icon:"📚", name:"Edebi Üslup", writer:"Genel", anti:true, desc:"Şiirsel ama kontrollü dil", guide:"Dili zenginleştir ama şişirme. Bir paragrafta tek güçlü imge kullan; metafor sahneden doğsun." },
    duygusal: { icon:"❤️", name:"Duygusal", writer:"Genel", anti:true, desc:"İç dünya ve empati", guide:"Duyguyu doğrudan adlandırmak yerine davranış, ritim ve küçük beden ayrıntılarıyla hissettir. Aşırı melodramdan kaçın." },
    dramatik: { icon:"🎭", name:"Dramatik", writer:"Genel", anti:true, desc:"Gerilim ve çatışma", guide:"Gerilim, çatışma ve tempo oluştur. Cümle ritmini çeşitlendir; yeni olay eklemeden mevcut çatışmayı belirginleştir." },
    betimleyici: { icon:"🎨", name:"Betimleyici", writer:"Genel", anti:false, desc:"Duyusal betimleme", guide:"Görsel, işitsel ve dokunsal ayrıntılar ekle. Betimleme metni yavaşlatmasın; sahneye hizmet etsin." },
    diyalog_odakli: { icon:"💭", name:"Diyalog Odaklı", writer:"Genel", anti:true, desc:"Doğal ve karakteristik konuşmalar", guide:"Diyalogları doğal, kısa ve karaktere ait kıl. Her replikten sonra 'dedi/söyledi' zinciri kurma; jest ve boşluk kullan." },
    minimalist: { icon:"⚪", name:"Minimalist", writer:"Hemingway", anti:true, desc:"Az kelime, çok anlam", guide:"Az kelimeyle çok anlam kur. Gereksiz sıfat, metafor ve açıklamayı sil. Cümleleri kısa ama cansız olmayacak şekilde düzenle." },
    komik: { icon:"😄", name:"Komik/Eğlenceli", writer:"Genel", anti:true, desc:"Hafif ve mizahi ton", guide:"Mizahı doğal ritimden çıkar. Espriyi açıklama; hafif, canlı ve okunur bir ton kur." },
    karamistik: { icon:"🌑", name:"Karamistik/Karanlık", writer:"Genel", anti:true, desc:"Gölge, gizem ve karanlık atmosfer", guide:"Karanlık atmosferi gölge, ses ve nesne ayrıntılarıyla taşı. Abartılı gotik klişelerden uzak dur." },
    romantik: { icon:"🌹", name:"Romantik", writer:"Genel", anti:true, desc:"Lirik ve ölçülü romantik ton", guide:"Romantik tonu zarif tut. Aşırı süs, büyük söz ve klişe aşk cümlelerinden kaçın; duyguyu sahnenin içinden ver." },
    cemal_gurkan_kara_akademik: { icon:"📐", name:"Cemal Gürkan Kara — Akademik", writer:"Cemal Gürkan Kara", anti:true, desc:"Doğal akademik Türkçe", guide:"Bilimsel içeriği sade, katmanlı ve doğal bir dille aktar. Veriyi öne çıkar, yorumu verinin içinden üret. Paragrafı olumsuz yüklemle açma, arka arkaya iki paragrafı 'Bu...' ile başlatma, üçlü akademik listeleri böl, yapay akademik kalıpları sadeleştir." }
  };

  function $(id) {
    return document.getElementById(id);
  }

  function wordApiReady() {
    return (
      typeof window !== "undefined" &&
      typeof window.Word !== "undefined" &&
      typeof window.Word.run === "function"
    );
  }

  async function wordRun(callback) {
    if (!wordApiReady()) {
      throw new Error(
        "Word API hazır değil. Bu paneli Word içindeki Add-in panelinden açın. Normal tarayıcıda belge işlemleri çalışmaz."
      );
    }

    return window.Word.run(callback);
  }

  function setStatus(message, type) {
    var el = $("status-msg");
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
    var el = $("model-status");
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
    var p = providers[provider];
    var el = p ? $(p.keyId) : null;
    return el ? el.value.trim() : "";
  }

  function getSelectedModel(provider) {
    var p = providers[provider];
    var el = p ? $(p.modelId) : null;
    return el ? el.value : p.defaultModel;
  }

  function activeMode() {
    var btn = document.querySelector(".mode-btn.active");
    return btn ? btn.getAttribute("data-mode") : "OTO";
  }

  function activeLang() {
    var el = $("lang-select");
    return el ? el.value : "Turkish";
  }

  function saveSettings() {
    var data = {
      provider: state.provider,
      keys: {},
      models: {}
    };

    Object.keys(providers).forEach(function (provider) {
      var p = providers[provider];
      var keyEl = $(p.keyId);
      var modelEl = $(p.modelId);

      data.keys[provider] = keyEl ? keyEl.value : "";
      data.models[provider] = modelEl ? modelEl.value : p.defaultModel;
    });

    localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
    setStatus("Ayarlar kaydedildi.", "success");
  }

  function loadSettings() {
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return;

      var data = JSON.parse(raw);

      if (data.provider && providers[data.provider]) {
        state.provider = data.provider;
      }

      Object.keys(providers).forEach(function (provider) {
        var p = providers[provider];

        if (data.keys && typeof data.keys[provider] === "string") {
          var keyEl = $(p.keyId);
          if (keyEl) keyEl.value = data.keys[provider];
        }
      });
    } catch (e) {
      console.warn("Settings load failed:", e);
    }
  }

  function getSavedModel(provider) {
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return "";

      var data = JSON.parse(raw);
      return data.models && data.models[provider] ? data.models[provider] : "";
    } catch (e) {
      return "";
    }
  }

  function getCachedModels(provider) {
    try {
      var raw = localStorage.getItem(MODEL_CACHE_KEY);
      if (!raw) return null;

      var cache = JSON.parse(raw);
      var item = cache[provider];

      if (!item || !item.createdAt || !Array.isArray(item.models)) return null;
      if (Date.now() - item.createdAt > MODEL_CACHE_TTL_MS) return null;

      return item.models;
    } catch (e) {
      return null;
    }
  }

  function setCachedModels(provider, models) {
    try {
      var raw = localStorage.getItem(MODEL_CACHE_KEY);
      var cache = raw ? JSON.parse(raw) : {};

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
    var s = String(id || "").toLowerCase();

    var banned = [
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
      return s.indexOf(x) !== -1;
    });
  }

  function looksChatCapable(provider, model) {
    var id = normalizeId(model.id).toLowerCase();
    var name = String(model.name || "").toLowerCase();

    if (!id || isBadModelId(id) || isBadModelId(name)) return false;

    if (provider === "openrouter") {
      var arch = model.architecture || {};
      var input = arch.input_modalities || [];
      var output = arch.output_modalities || [];

      if (Array.isArray(input) && input.length && input.indexOf("text") === -1) return false;
      if (Array.isArray(output) && output.length && output.indexOf("text") === -1) return false;

      return true;
    }

    if (provider === "gemini") {
      var methods = model.supportedGenerationMethods || model.supported_actions || [];
      if (Array.isArray(methods) && methods.length) {
        return methods.indexOf("generateContent") !== -1;
      }

      return id.indexOf("gemini") !== -1;
    }

    if (provider === "claude") return id.indexOf("claude") !== -1;

    if (provider === "openai") {
      return id.indexOf("gpt-") === 0 || id.indexOf("o") === 0 || id.indexOf("chatgpt-") === 0;
    }

    return true;
  }

  function scoreModel(provider, model) {
    var id = normalizeId(model.id).toLowerCase();
    var name = String(model.name || "").toLowerCase();
    var text = id + " " + name;
    var score = 0;

    var topPatterns = [
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
      if (text.indexOf(pair[0]) !== -1) score += pair[1];
    });

    if (text.indexOf("mini") !== -1) score += 35;
    if (text.indexOf("flash") !== -1) score += 35;
    if (text.indexOf("sonnet") !== -1) score += 40;
    if (text.indexOf("pro") !== -1) score += 25;
    if (text.indexOf("instruct") !== -1) score += 20;
    if (text.indexOf("chat") !== -1) score += 20;

    if (text.indexOf("free") !== -1) score -= 20;
    if (text.indexOf("preview") !== -1) score -= 15;
    if (text.indexOf("experimental") !== -1) score -= 35;
    if (text.indexOf("beta") !== -1) score -= 25;
    if (text.indexOf("deprecated") !== -1) score -= 150;

    if (provider === "openrouter") {
      var context = Number(
        model.context_length ||
        (model.top_provider && model.top_provider.context_length) ||
        0
      );

      if (context >= 1000000) score += 70;
      else if (context >= 200000) score += 50;
      else if (context >= 128000) score += 35;
      else if (context >= 32000) score += 15;

      var params = model.supported_parameters || [];
      if (Array.isArray(params) && params.indexOf("temperature") !== -1) score += 5;
      if (Array.isArray(params) && params.indexOf("max_tokens") !== -1) score += 5;
    }

    if (model.created) {
      score += Math.min(30, Math.max(0, Number(model.created) / 1000000000));
    }

    return score;
  }

  function sortUsefulModels(provider, models) {
    var seen = {};
    var cleaned = [];

    models.forEach(function (m) {
      var id = normalizeId(m.id);
      if (!id || seen[id]) return;

      seen[id] = true;

      var item = Object.assign({}, m, { id: id });
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
    var val = Number(n || 0);
    if (!val) return "";

    if (val >= 1000000) return Math.round(val / 1000000) + "M ctx";
    if (val >= 1000) return Math.round(val / 1000) + "K ctx";

    return val + " ctx";
  }

  function optionLabel(model, index) {
    var name = model.name || model.id;
    var id = model.id;
    var suffix = "";

    var context =
      model.context_length ||
      (model.top_provider && model.top_provider.context_length) ||
      model.inputTokenLimit ||
      model.input_token_limit;

    if (context) suffix += " · " + formatContext(context);

    if (index < 8) return "⭐ " + name + " — " + id + suffix;

    return name + " — " + id + suffix;
  }

  function fillModelSelect(provider, models, preferredValue) {
    var p = providers[provider];
    var select = $(p.modelId);
    if (!select) return;

    select.innerHTML = "";

    var sorted = sortUsefulModels(provider, models);
    var finalModels = sorted.length ? sorted : p.fallback;

    var recommended = finalModels.slice(0, 12);
    var others = finalModels.slice(12, 120);

    var groupTop = document.createElement("optgroup");
    groupTop.label = "Önerilen / işe yarayan chat modelleri";

    recommended.forEach(function (model, index) {
      var opt = document.createElement("option");
      opt.value = model.id;
      opt.textContent = optionLabel(model, index);
      groupTop.appendChild(opt);
    });

    select.appendChild(groupTop);

    if (others.length) {
      var groupOther = document.createElement("optgroup");
      groupOther.label = "Diğer uygun modeller";

      others.forEach(function (model, index) {
        var opt = document.createElement("option");
        opt.value = model.id;
        opt.textContent = optionLabel(model, index + recommended.length);
        groupOther.appendChild(opt);
      });

      select.appendChild(groupOther);
    }

    var saved = preferredValue || getSavedModel(provider) || p.defaultModel;
    var hasSaved = [].slice.call(select.options).some(function (o) {
      return o.value === saved;
    });

    if (hasSaved) select.value = saved;
    else if (select.options.length) select.selectedIndex = 0;
  }

  async function fetchModels(provider) {
    if (provider === "openrouter") return fetchOpenRouterModels();
    if (provider === "openai") return fetchOpenAIModels();
    if (provider === "claude") return fetchClaudeModels();
    if (provider === "gemini") return fetchGeminiModels();

    return providers[provider].fallback;
  }

  async function fetchOpenRouterModels() {
    var key = getKey("openrouter");
    var headers = {};
    if (key) headers.Authorization = "Bearer " + key;

    var res = await fetch("https://openrouter.ai/api/v1/models", {
      method: "GET",
      headers: headers
    });

    if (!res.ok) throw new Error("OpenRouter model listesi alınamadı: HTTP " + res.status);

    var data = await res.json();
    return Array.isArray(data.data) ? data.data : [];
  }

  async function fetchOpenAIModels() {
    var key = getKey("openai");
    if (!key) throw new Error("OpenAI modellerini çekmek için API key gerekli.");

    var res = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        Authorization: "Bearer " + key
      }
    });

    if (!res.ok) throw new Error("OpenAI model listesi alınamadı: HTTP " + res.status);

    var data = await res.json();

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
    var key = getKey("claude");
    if (!key) throw new Error("Claude modellerini çekmek için API key gerekli.");

    var res = await fetch("https://api.anthropic.com/v1/models?limit=1000", {
      method: "GET",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01"
      }
    });

    if (!res.ok) throw new Error("Claude model listesi alınamadı: HTTP " + res.status);

    var data = await res.json();

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
    var key = getKey("gemini");
    if (!key) throw new Error("Gemini modellerini çekmek için API key gerekli.");

    var url =
      "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&key=" +
      encodeURIComponent(key);

    var res = await fetch(url, { method: "GET" });

    if (!res.ok) throw new Error("Gemini model listesi alınamadı: HTTP " + res.status);

    var data = await res.json();

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
    var p = providers[provider];
    var preferred = getSavedModel(provider);

    if (!force) {
      var cached = getCachedModels(provider);
      if (cached && cached.length) {
        fillModelSelect(provider, cached, preferred);
        setModelStatus(p.label + " modelleri önbellekten yüklendi.", "info");
        return;
      }
    }

    setModelStatus(p.label + " modelleri çekiliyor...", "info");

    try {
      var models = await fetchModels(provider);
      var sorted = sortUsefulModels(provider, models);

      if (!sorted.length) throw new Error("Uygun chat modeli bulunamadı.");

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
      var panel = $("api-" + p);
      if (panel) panel.style.display = p === provider ? "block" : "none";
    });

    refreshModels(provider, false);
  }

  function activeWorkflow() {
    var btn = document.querySelector(".wtab.active");
    return btn ? btn.getAttribute("data-workflow") : "single";
  }

  function selectedPresetKeys() {
    return [].slice.call(document.querySelectorAll(".preset-chip.selected")).map(function (el) {
      return el.getAttribute("data-preset");
    }).filter(function (key) { return !!PRESET_LIBRARY[key]; });
  }

  function presetPromptForKey(key) {
    var preset = PRESET_LIBRARY[key];
    if (!preset) return "";
    var lines = [
      "### " + preset.icon + " " + preset.name + " (" + preset.writer + ")",
      preset.guide
    ];
    if (preset.anti) {
      lines.push("Anti-AI denetimi uygula:\n- " + AGFO_ANTI_AI_RULES);
    }
    return lines.join("\n\n");
  }

  function buildPresetPrompt(lang) {
    var workflow = activeWorkflow();
    var keys = [];
    var title = "";

    if (workflow === "custom") {
      var custom = $("custom-prompt") ? $("custom-prompt").value.trim() : "";
      if (!custom) return "";
      title = "Custom Prompt";
      return [
        "Sen profesyonel bir metin editörüsün.",
        "",
        "## KULLANICI TARAFINDAN TANIMLANAN ÜSLUP",
        custom,
        "",
        "## Anti-AI denetimi",
        "- " + AGFO_ANTI_AI_RULES,
        "",
        "Çıktı dili: " + lang
      ].join("\n");
    }

    if (workflow === "multi") {
      keys = selectedPresetKeys();
      if (!keys.length) return "";
      title = keys.map(function (k) { return PRESET_LIBRARY[k].name; }).join(" + ");
      return [
        "Sen çok katmanlı bir metin editörüsün.",
        "Aşağıdaki üslupları tek metinde organik biçimde harmanla; hiçbirini mekanik biçimde taklit etme.",
        "",
        "## Seçilen Üsluplar: " + title,
        keys.map(presetPromptForKey).join("\n\n---\n\n"),
        "",
        "## Harmanlama kuralı",
        "Metnin anlamını, olay sırasını ve kapsamını koru. Üslupları dışarıdan yapıştırma; mevcut metnin ihtiyacına göre erit.",
        "",
        "Çıktı dili: " + lang
      ].join("\n");
    }

    var select = $("preset-select");
    var key = select ? select.value : "";
    if (!key || !PRESET_LIBRARY[key]) return "";
    var preset = PRESET_LIBRARY[key];
    return [
      "Sen " + preset.writer + " referansını bilen profesyonel bir editörsün.",
      "Metni birebir taklit amacıyla değil, aşağıdaki üslup ilkelerini gözeterek dönüştür.",
      "",
      "## Seçilen Preset: " + preset.icon + " " + preset.name,
      presetPromptForKey(key),
      "",
      "## Son talimat",
      "Metni gerçek bir insan yazmış gibi doğal, akıcı ve özgün hale getir. Anlamı koru, yeni bilgi ekleme.",
      "",
      "Çıktı dili: " + lang
    ].join("\n");
  }

  function buildPrompt(mode, lang) {
    var presetPrompt = buildPresetPrompt(lang);
    var prompt = presetPrompt || agfoGetPrompt(mode, lang);
    var contextEl = $("context-note");
    var extraEl = $("extra-instruction");
    var context = contextEl ? contextEl.value.trim() : "";
    var extra = extraEl ? extraEl.value.trim() : "";

    if (context) prompt += "\n\n## BAĞLAM\n" + context;
    if (extra) prompt += "\n\n## EK TALİMAT\n" + extra;

    prompt += "\n\nWORD ADD-IN UYUMU:\n";
    prompt += "- Çıktı Microsoft Word'e doğrudan yapıştırılabilir temiz düz metin olsun.\n";
    prompt += "- HTML, markdown tablo, kod bloğu veya açıklama üretme.";
    return prompt;
  }

  function buildInstructionPrompt(instruction, lang) {
    return [
      "Sen seçili metin üzerinde kullanıcının talimatını uygulayan profesyonel bir editörsün.",
      "",
      "KULLANICI TALİMATI:",
      instruction,
      "",
      "KURALLAR:",
      "- Yalnızca verilen metni dönüştür.",
      "- Metnin dışına çıkma.",
      "- Yeni olay, karakter, sahne veya bilgi ekleme.",
      "- Talimatı metnin anlamını bozmayacak şekilde uygula.",
      "- Açıklama, not, analiz, giriş veya kapanış yorumu yazma.",
      "- Cevap sadece dönüştürülmüş metinden oluşsun.",
      "- Microsoft Word için temiz düz metin döndür.",
      "- HTML etiketi ve markdown kod bloğu döndürme.",
      "- Çıktı dili: " + lang
    ].join("\n");
  }

  function agfoGetPrompt(mode, lang) {
    var normalizedMode = String(mode || "OTO").toUpperCase();
    var safeLang = String(lang || "Turkish").trim();
    var prompt;

    if (normalizedMode === "CGK_DRAMA") prompt = agfoPromptCgkDrama();
    else if (normalizedMode === "CGK_AKADEMIK") prompt = agfoPromptCgkAkademik();
    else if (normalizedMode === "SIMPLE") prompt = agfoPromptSimple();
    else if (normalizedMode === "KUPKURU") prompt = agfoPromptKupkuru();
    else prompt = agfoPromptDefault();

    prompt = prompt
      .replace(/\{mode\}/g, normalizedMode)
      .replace(/\{lang\}/g, safeLang);

    prompt += "\n\nKESİN ÇIKTI KURALI:\n";
    prompt += "- Yalnızca kullanıcının gönderdiği metni dönüştür.\n";
    prompt += "- Word belgesinin gönderilmeyen bölümlerini dönüştürme, tahmin etme veya ekleme.\n";
    prompt += "- Açıklama, not, önsöz, sonsöz, analiz, gerekçe veya yorum yazma.\n";
    prompt += "- \"İşte düzenlenmiş metin\", \"Aşağıda\", \"Elbette\", \"Tabii\" gibi girişler yazma.\n";
    prompt += "- Cevap sadece dönüştürülmüş metinden oluşsun.\n";
    prompt += "- Microsoft Word için temiz düz metin döndür.\n";
    prompt += "- HTML etiketi ve markdown kod bloğu döndürme.";

    return prompt;
  }

  function agfoPromptDefault() {
    return "Sen bir metin yeniden yazma uzmanısın.\n\n" +
      "MOD: {mode}\n\n" +
      "Görevin, verilen metni gerçek bir insanın yazmış olabileceği şekilde dönüştürmektir.\n\n" +
      "Kurallar:\n" +
      "- Anlamı koru.\n" +
      "- Zaman kipini değiştirme.\n" +
      "- Yeni bilgi ekleme.\n" +
      "- Metnin kapsamını genişletme.\n" +
      "- AI kalıplarını temizle.\n" +
      "- Yapay simetriyi ve mekanik geçişleri azalt.\n" +
      "- Gereksiz üçlü yapıları kır.\n" +
      "- Fazla düzgün, fazla steril, fazla şablonlu cümleleri doğallaştır.\n" +
      "- Açıklama, not veya analiz ekleme.\n" +
      "- Cevap yalnızca dönüştürülmüş metinden oluşsun.\n\n" +
      "MOD YORUMU:\n" +
      "OTO: Metne en uygun stratejiyi kendin seç.\n" +
      "GENEL: Genel akıcılığı ve doğallığı artır.\n" +
      "YAPISAL: Akış, paragraf mantığı ve geçişleri düzelt.\n" +
      "TON: Ton, ritim ve insan sıcaklığını güçlendir.\n" +
      "BURST: Cümle uzunluklarını çeşitlendir, doğal iniş çıkış oluştur.\n" +
      "AKADEMIK: Akademik ama okunabilir bir ton kur.\n" +
      "KELIME: Kelime seçimini iyileştir, anlamı değiştirme.\n" +
      "KATMANLI: Anlamı bozmadan daha katmanlı ve nüanslı yaz.\n\n" +
      "Çıktı dili: {lang}";
  }

  function agfoPromptSimple() {
    return "Sen bir metin sadeleştirme ve insanileştirme editörüsün.\n\n" +
      "Görev:\n" +
      "Verilen metindeki yapay zekâ izlerini temizle.\n\n" +
      "Kurallar:\n" +
      "- Anlamı ve bilgi sırasını koru.\n" +
      "- Metni büyütme.\n" +
      "- Yeni bilgi ekleme.\n" +
      "- Klişe geçişleri temizle.\n" +
      "- Gereksiz pekiştiricileri sil.\n" +
      "- Cümleleri daha doğal Türkçeye çevir.\n" +
      "- Açıklama, not, değerlendirme, giriş veya kapanış cümlesi ekleme.\n" +
      "- Çıktıda yalnızca düzenlenmiş metni ver.\n\n" +
      "Çıktı dili: {lang}";
  }

  function agfoPromptKupkuru() {
    return "Sen sert sadeleştirme yapan profesyonel bir Türkçe editörsün.\n\n" +
      "Görev:\n" +
      "Verilen metni mümkün olan en kısa, en kuru ve en işlevsel hâle getir.\n\n" +
      "Kurallar:\n" +
      "- Ana anlamı koru.\n" +
      "- Olay, iddia ve bilgi sırasını bozma.\n" +
      "- Gereksiz betimlemeleri kaldır.\n" +
      "- Duygu, atmosfer ve dramatik vurguyu azalt.\n" +
      "- Metafor, aforizma ve süs cümlelerini sil.\n" +
      "- Aynı anlamı taşıyan cümleleri birleştir.\n" +
      "- Yorumu azalt; olayı ve sonucu doğrudan ver.\n" +
      "- Yeni bilgi ekleme.\n" +
      "- Açıklama veya not yazma.\n\n" +
      "Çıktı dili: {lang}";
  }

  function agfoPromptCgkAkademik() {
    return "Sen akademik Türkçe metinleri düzenleyen profesyonel bir editörsün.\n\n" +
      "Temel ilke:\n" +
      "Bilimsel içeriği sade, katmanlı ve doğal bir dille aktar. Veriyi öne çıkar. Yorumu verinin içinden üret. Klişeden kaçın.\n\n" +
      "Kurallar:\n" +
      "- Bilimsel anlamı koru.\n" +
      "- Akademik tonu koru ama metni şişirme.\n" +
      "- Her paragraf tek odak taşısın.\n" +
      "- Paragraf açılışında sürekli \"Bu...\" kullanma.\n" +
      "- Olumsuz yüklemle paragraf açmaktan kaçın.\n" +
      "- Aşırı yüklenmiş cümleleri böl.\n" +
      "- Üçlü yapıları azalt.\n" +
      "- Yapay akademik kalıpları sadeleştir.\n" +
      "- \"...olduğu bilinmektedir\" yerine daha doğrudan ifade kullan.\n" +
      "- \"...önem arz etmektedir\" yerine \"...önemlidir\" veya \"...önem taşır\" kullan.\n" +
      "- Gereksiz pekiştiricileri sil.\n" +
      "- Açıklama, not veya analiz ekleme.\n" +
      "- Sadece dönüştürülmüş metni ver.\n\n" +
      "Çıktı dili: {lang}";
  }

  function agfoPromptCgkDrama() {
    return "Türkçe drama tarzında yazan profesyonel bir editörsün.\n\n" +
      "Amaç:\n" +
      "Verilen metni süslü, yapay veya açıklayıcı hâle getirmeden; doğal, katmanlı, duyusal ve kader duygusu taşıyan bir anlatıya dönüştür.\n\n" +
      "Metin yalnızca olay anlatmasın; olayın içinden zaman, aile, tekrar, kayıp, arzu ve kaçınılmazlık sezilsin.\n" +
      "Okur duygu adını değil, duygunun izini görsün.\n\n" +
      "Temel akış:\n" +
      "sahne → duyusal temas → iç tepki → tekrar/kader sezgisi → küçük ama kalıcı kavrayış\n\n" +
      "Kurallar:\n" +
      "- Önce somut durum kur.\n" +
      "- Anlamı sahnenin içinden çıkar.\n" +
      "- Soyutluğu doğrudan verme; nesne, hava, beden, ses, koku veya küçük davranışla sezdir.\n" +
      "- Gerçek ile olağanüstü arasındaki sınırı yumuşak tutabilirsin.\n" +
      "- Olağan dışı bir ayrıntı varsa açıklama; gündelik hayatın doğal bir parçasıymış gibi taşı.\n" +
      "- Kehanet, tekrar, rüya, aile hafızası, unutma, ölüm, koku, yağmur, toprak, ışık ve sessizlik gibi öğeleri dışarıdan süs olarak ekleme; metinde ima varsa güçlendir.\n" +
      "- Büyük duyguları küçük nesneler taşısın.\n" +
      "- Diyalog varsa karakterin yorgunluğuna ve konumuna ait olsun.\n" +
      "- Her replikten sonra \"dedi/söyledi\" zinciri kurma.\n" +
      "- Duyguyu adlandırma; duyguya yol açan ayrıntıyı artır.\n" +
      "- \"İnsan bazen...\", \"Hayat böyledir...\", \"Kader buydu...\" gibi kapanışlar kurma.\n" +
      "- Son cümle somut, küçük, açıklamasız ve yankılı olsun.\n" +
      "- Yeni olay, yeni karakter veya yeni bilgi ekleme.\n" +
      "- Açıklama, not, analiz, başlık, giriş veya kapanış yorumu yazma.\n" +
      "- Sadece yeniden yazılmış metni ver.\n\n" +
      "Dilden kaçın:\n" +
      "- \"Derin bir yalnızlık hissetti\"\n" +
      "- \"İçinde tarif edilemez bir acı vardı\"\n" +
      "- \"Kader ağlarını örüyordu\"\n" +
      "- \"Zaman durmuş gibiydi\"\n" +
      "- \"Her şey anlam kazanmıştı\"\n" +
      "- \"Bu onun için bir dönüm noktasıydı\"\n\n" +
      "Çıktı dili: {lang}";
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
    var s = String(model || "").toLowerCase();

    return (
      s.indexOf("o1") === 0 ||
      s.indexOf("o3") === 0 ||
      s.indexOf("o4") === 0 ||
      s.indexOf("reasoning") !== -1
    );
  }

  async function callOpenAICompatible(opts) {
    if (!opts.key) {
      throw new Error(providers[opts.provider].label + " API key eksik.");
    }

    var body = {
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

    var headers = {
      "Content-Type": "application/json",
      Authorization: "Bearer " + opts.key
    };

    if (opts.useOpenRouterHeaders) {
      headers["HTTP-Referer"] = "https://downtownck.github.io/agfo-ai-humanizer/";
      headers["X-Title"] = "AGFO AI Humanizer Word Add-in";
    }

    var res = await fetch(opts.url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(body)
    });

    var data = await res.json().catch(function () {
      return {};
    });

    if (!res.ok) {
      var msg =
        data.error && data.error.message
          ? data.error.message
          : "HTTP " + res.status;

      throw new Error(msg);
    }

    var out =
      data &&
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content;

    if (!out) throw new Error("Model boş yanıt döndürdü.");

    return cleanModelOutput(out);
  }

  async function callClaude(systemPrompt, userText) {
    var key = getKey("claude");
    if (!key) throw new Error("Claude API key eksik.");

    var model = getSelectedModel("claude");

    var res = await fetch("https://api.anthropic.com/v1/messages", {
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

    var data = await res.json().catch(function () {
      return {};
    });

    if (!res.ok) {
      var msg =
        data.error && data.error.message
          ? data.error.message
          : "HTTP " + res.status;

      throw new Error(msg);
    }

    var out =
      data &&
      data.content &&
      data.content[0] &&
      data.content[0].text;

    if (!out) throw new Error("Claude boş yanıt döndürdü.");

    return cleanModelOutput(out);
  }

  async function callGemini(systemPrompt, userText) {
    var key = getKey("gemini");
    if (!key) throw new Error("Gemini API key eksik.");

    var model = getSelectedModel("gemini");
    var safeModel = normalizeId(model);

    var url =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(safeModel) +
      ":generateContent?key=" +
      encodeURIComponent(key);

    var res = await fetch(url, {
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

    var data = await res.json().catch(function () {
      return {};
    });

    if (!res.ok) {
      var msg =
        data.error && data.error.message
          ? data.error.message
          : "HTTP " + res.status;

      throw new Error(msg);
    }

    var out =
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
      .replace(/^\s*(Elbette|Tabii|İşte|Iste|Aşağıda|Asagida)[^\n]*[:：-]?\s*/i, "")
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
    var clean = cleanModelOutput(text);
    var paragraphs = clean
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
      await wordRun(async function (context) {
        var range = context.document.getSelection();
        range.load("text");
        await context.sync();

        var input = $("hc-input");
        if (input) input.value = range.text || "";

        updateCharCount();
        setStatus("Seçili metin alındı.", "success");
      });
    } catch (err) {
      setStatus("Seçili metin alınamadı: " + err.message, "error");
    }
  }

  async function getAllText() {
    try {
      await wordRun(async function (context) {
        var body = context.document.body;
        body.load("text");
        await context.sync();

        var input = $("hc-input");
        if (input) input.value = body.text || "";

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
      await wordRun(async function (context) {
        var range = context.document.getSelection();
        var inserted = range.insertText(state.outputText, "Replace");
        inserted.font.color = "#166534";
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
      await wordRun(async function (context) {
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
    var input = $("hc-input");
    var btn = $("btn-run");

    var text = input ? input.value.trim() : "";
    if (!text) {
      setStatus("Lütfen metin gir veya belgeden metin al.", "error");
      return;
    }

    var provider = state.provider;
    var model = getSelectedModel(provider);
    var lang = activeLang();
    var mode = activeMode();

    saveSettings();

    var oldHtml = btn ? btn.innerHTML : "";
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>İşleniyor...';
    }

    setStatus(
      providers[provider].label + " / " + model + " ile metin işleniyor...",
      "info"
    );

    try {
      var prompt = buildPrompt(mode, lang);
      var result = await callAI(prompt, text);

      state.outputText = result;

      var output = $("hc-output");
      var section = $("output-section");
      var usedMode = $("used-mode");

      if (output) {
        output.innerHTML = textToHtml(result);
        output.style.display = "block";
      }

      if (section) section.style.display = "block";
      if (usedMode) usedMode.textContent = mode + " · " + providers[provider].label + " · " + model;

      setStatus("Tamamlandı.", "success");
    } catch (err) {
      console.error(err);

      var extra = "";
      var msg = String(err.message || "").toLowerCase();

      if (msg.indexOf("failed to fetch") !== -1 || msg.indexOf("cors") !== -1) {
        extra =
          " Not: Bazı sağlayıcılar Office taskpane içinden doğrudan API çağrısını CORS nedeniyle engelleyebilir. Ürünleşmede backend proxy daha sağlıklı olur.";
      }

      setStatus("Hata: " + err.message + extra, "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = oldHtml;
      }
    }
  }

  async function runCustomInstructionFromInput(btn) {
    var instructionEl = $("custom-instruction");
    var input = $("hc-input");
    var instruction = instructionEl ? instructionEl.value.trim() : "";
    var text = input ? input.value.trim() : "";

    if (!instruction) {
      setStatus("Önce özel talimat yazın.", "error");
      return;
    }

    if (!text) {
      setStatus("Önce Seçili Metni Al ile metni kutuya aktarın veya metni kutuya yazın.", "error");
      return;
    }

    var provider = state.provider;
    var model = getSelectedModel(provider);
    var lang = activeLang();

    saveSettings();

    var oldHtml = btn ? btn.innerHTML : "";
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>Uygulanıyor...';
    }

    setStatus(
      providers[provider].label + " / " + model + " ile özel talimat uygulanıyor...",
      "info"
    );

    try {
      var prompt = buildInstructionPrompt(instruction, lang);
      var result = await callAI(prompt, text);

      state.outputText = result;

      var output = $("hc-output");
      var section = $("output-section");
      var usedMode = $("used-mode");

      if (output) {
        output.innerHTML = textToHtml(result);
        output.style.display = "block";
      }

      if (section) section.style.display = "block";
      if (usedMode) usedMode.textContent = "CUSTOM · " + providers[provider].label + " · " + model;

      setStatus("Özel talimat uygulandı.", "success");
    } catch (err) {
      console.error(err);
      setStatus("Hata: " + err.message, "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = oldHtml;
      }
    }
  }

  function updateCharCount() {
    var input = $("hc-input");
    var count = $("char-count");
    if (input && count) count.textContent = String(input.value.length);
  }


  function populatePresetUI() {
    var select = $("preset-select");
    if (select) {
      select.innerHTML = "";
      Object.keys(PRESET_LIBRARY).forEach(function (key) {
        var p = PRESET_LIBRARY[key];
        var opt = document.createElement("option");
        opt.value = key;
        opt.textContent = p.icon + " " + p.name;
        select.appendChild(opt);
      });
      if (!select.value && select.options.length) select.selectedIndex = 0;
    }

    var lib = $("preset-library");
    if (lib) {
      lib.innerHTML = "";
      Object.keys(PRESET_GROUPS).forEach(function (cat) {
        var wrap = document.createElement("div");
        wrap.className = "preset-cat";
        var title = document.createElement("div");
        title.className = "preset-cat-title";
        title.textContent = cat;
        var row = document.createElement("div");
        row.className = "chip-row";
        PRESET_GROUPS[cat].forEach(function (key) {
          var p = PRESET_LIBRARY[key];
          if (!p) return;
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "preset-chip";
          btn.setAttribute("data-preset", key);
          btn.textContent = p.icon + " " + p.name;
          row.appendChild(btn);
        });
        wrap.appendChild(title);
        wrap.appendChild(row);
        lib.appendChild(wrap);
      });
    }
    updatePresetDescription();
    updateSelectedPresetSummary();
  }

  function updatePresetDescription() {
    var select = $("preset-select");
    var desc = $("preset-desc");
    if (!select || !desc) return;
    var p = PRESET_LIBRARY[select.value];
    desc.textContent = p ? p.desc + " · " + p.writer : "";
  }

  function updateSelectedPresetSummary() {
    var el = $("selected-presets");
    if (!el) return;
    var keys = selectedPresetKeys();
    if (!keys.length) {
      el.textContent = "Henüz preset seçilmedi.";
      return;
    }
    el.textContent = keys.map(function (k) { return PRESET_LIBRARY[k].icon + " " + PRESET_LIBRARY[k].name; }).join(" + ");
  }

  function setWorkflow(workflow) {
    document.querySelectorAll(".wtab").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-workflow") === workflow);
    });
    document.querySelectorAll(".workflow-panel").forEach(function (panel) {
      panel.classList.toggle("active", panel.id === "workflow-" + workflow);
    });
    setStatus("Akış seçildi: " + workflow, "info");
  }

  function buildFullPromptPreview() {
    var text = $("hc-input") ? $("hc-input").value.trim() : "";
    var lang = activeLang();
    var mode = activeMode();
    var prompt = buildPrompt(mode, lang);
    return [
      "# AGFO AI HUMANIZER WORD ADD-IN PROMPT",
      "",
      "## SYSTEM PROMPT",
      prompt,
      "",
      "## İŞLENECEK METİN",
      text || "[Metin henüz girilmedi]"
    ].join("\n");
  }

  function showPromptPreview() {
    var box = $("prompt-preview");
    if (!box) return;
    box.value = buildFullPromptPreview();
    box.style.display = box.style.display === "none" ? "block" : "none";
  }

  async function copyPromptPreview() {
    var prompt = buildFullPromptPreview();
    try {
      await navigator.clipboard.writeText(prompt);
      var box = $("prompt-preview");
      if (box) {
        box.value = prompt;
        box.style.display = "block";
      }
      setStatus("Prompt kopyalandı.", "success");
    } catch (err) {
      setStatus("Prompt kopyalanamadı: " + err.message, "error");
    }
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
        setStatus("Mod seçildi: " + (btn.getAttribute("data-mode") || "OTO"), "info");
      });
    });


    document.querySelectorAll(".wtab").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setWorkflow(btn.getAttribute("data-workflow") || "single");
      });
    });

    var presetSelect = $("preset-select");
    if (presetSelect) presetSelect.addEventListener("change", updatePresetDescription);

    document.querySelectorAll(".preset-chip").forEach(function (btn) {
      btn.addEventListener("click", function () {
        btn.classList.toggle("selected");
        updateSelectedPresetSummary();
      });
    });

    var toggleContext = $("toggle-context");
    if (toggleContext) {
      toggleContext.addEventListener("click", function () {
        var area = $("context-area");
        if (!area) return;
        var open = area.style.display === "block";
        area.style.display = open ? "none" : "block";
        toggleContext.textContent = (open ? "+" : "−") + " Bağlam ve ek talimat";
      });
    }

    var btnPromptPreview = $("btn-prompt-preview");
    if (btnPromptPreview) btnPromptPreview.addEventListener("click", showPromptPreview);

    var btnCopyPrompt = $("btn-copy-prompt");
    if (btnCopyPrompt) btnCopyPrompt.addEventListener("click", copyPromptPreview);

    var input = $("hc-input");
    if (input) input.addEventListener("input", updateCharCount);

    var btnSave = $("btn-save-key");
    if (btnSave) {
      btnSave.addEventListener("click", function () {
        saveSettings();
        refreshModels(state.provider, true);
      });
    }

    var btnRefresh = $("btn-refresh-models");
    if (btnRefresh) {
      btnRefresh.addEventListener("click", function () {
        saveSettings();
        refreshModels(state.provider, true);
      });
    }

    var btnGetSelection = $("btn-get-selection");
    if (btnGetSelection) btnGetSelection.addEventListener("click", getSelectionText);

    var btnGetAll = $("btn-get-all");
    if (btnGetAll) btnGetAll.addEventListener("click", getAllText);

    var btnRun = $("btn-run");
    if (btnRun) btnRun.addEventListener("click", runHumanizer);

    var btnReplace = $("btn-replace");
    if (btnReplace) btnReplace.addEventListener("click", replaceSelection);

    var btnAppend = $("btn-append");
    if (btnAppend) btnAppend.addEventListener("click", appendToEnd);

    var btnCopy = $("btn-copy");
    if (btnCopy) btnCopy.addEventListener("click", copyOutput);

    var btnInstruction = $("btn-apply-instruction");
    if (btnInstruction) {
      btnInstruction.addEventListener("click", function () {
        runCustomInstructionFromInput(btnInstruction);
      });
    }

    Object.keys(providers).forEach(function (provider) {
      var p = providers[provider];
      var modelEl = $(p.modelId);
      var keyEl = $(p.keyId);

      if (modelEl) modelEl.addEventListener("change", saveSettings);
      if (keyEl) keyEl.addEventListener("change", saveSettings);
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
    populatePresetUI();
    bindEvents();
    updateCharCount();
    setProvider(state.provider || "openrouter");

    setModelStatus("Model listeleri hazır. OpenRouter önerilir; güncel modeller için Modelleri Yenile.", "info");
  }

  if (window.Office && window.Office.onReady) {
    window.Office.onReady(function () {
      init();
    });
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }
})();
