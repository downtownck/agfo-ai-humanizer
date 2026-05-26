# AGFO AI Humanizer — MS Word Add-in

**Version:** 4.3.0  
**Author:** AGFOCERT / Cemal Gurkan Kara

AGFO AI Humanizer, Microsoft Word içinde çalışan Office.js tabanlı bir metin insanlaştırma eklentisidir. Bu repo WordPress eklentisi değildir. v4.3.0 revizyonunda AGFO Novel Humanizer WordPress örneğindeki preset/prompt deneyimi Word add-in mimarisine uyarlanmıştır; add-in içindeki bağımsız AI Manager yapısına dokunulmamıştır.

## Dosyalar

| Dosya | Açıklama |
|---|---|
| `manifest.xml` | Word'e eklentiyi tanıtan XML dosyası |
| `taskpane.html` | Görev bölmesi arayüzü |
| `taskpane.js` | İş mantığı, provider çağrıları, preset sistemi ve Word API işlemleri |
| `commands.html` | Office komut dosyası taşıyıcısı |
| `revision.txt` | Revizyon geçmişi |

## v4.3.0 ile Gelenler

- WP örneğindeki preset mimarisi Word add-in paneline uyarlandı.
- Tek Preset, Çoklu Preset ve Custom Prompt akışları eklendi.
- Türk Edebiyatı, Dünya Edebiyatı, Ton & Atmosfer, Özel Üsluplar ve Akademik preset grupları eklendi.
- Bağlam ve ek talimat alanı eklendi.
- Prompt önizleme ve prompt kopyalama eklendi.
- Seçili metin / tüm belge alma, çıktı üretme, seçimi değiştirme, sona ekleme ve kopyalama akışı daha görünür hale getirildi.
- OpenRouter, OpenAI, Claude ve Gemini provider yönetimi korunmuştur.
- Word add-in’in kendi API key/model/endpoint yönetimi korunmuştur; WordPress `agfo_get_priority_api_key()` bağımlılığı eklenmemiştir.

## Kurulum Adımları

### 1. Dosyaları HTTPS Sunucuya Yükle

Tüm dosyaları bir HTTPS sunucuya yükleyin:

- GitHub Pages
- Netlify
- Vercel
- Kendi sunucunuz (HTTPS zorunlu)

### 2. manifest.xml İçindeki URL'yi Güncelle

```xml
<SourceLocation DefaultValue="https://SENIN-SUNUCUN/word-addin/taskpane.html"/>
```

Bu satırdaki URL'yi kendi sunucunuzun adresiyle değiştirin.

### 3. Word'e Yükle

Geliştirici / lokal test için Word'ü açın, **Ekle → Eklentilerim → Özel Eklenti → Dosyadan Yükle** yoluyla `manifest.xml` dosyasını seçin.

## Kullanım

1. Word'de **Ekle → Eklentilerim → AGFO AI Humanizer** ile paneli açın.
2. API Ayarları bölümünden provider seçin, API anahtarınızı girin ve modeli seçin.
3. Word belgesinde metin seçip **Seçili Metni Al** butonuna basın veya metni kutuya yapıştırın.
4. Tek Preset, Çoklu veya Custom akışlarından birini seçin.
5. Gerekirse bağlam ve ek talimat girin.
6. **İnsanlaştır / Yeniden Yaz** butonuna basın.
7. Çıktıyı kontrol edip **Seçimi Değiştir**, **Sona Ekle** veya **Kopyala** seçeneklerinden birini kullanın.

## Desteklenen API Sağlayıcıları

| Sağlayıcı | Not |
|---|---|
| OpenRouter | Varsayılan önerilen provider; model listesi canlı çekilebilir |
| OpenAI | Chat completions uyumlu modeller |
| Claude | Anthropic Messages API |
| Gemini | Google generateContent API |

## Güvenlik Notu

API anahtarları kullanıcı tarayıcısındaki localStorage içinde saklanır. Ürünleşmiş kurulumlarda şirket politikalarına göre backend proxy veya güvenli secret yönetimi tercih edilebilir.

## CORS Notu

Bazı providerlar Office taskpane içinden doğrudan API çağrılarını CORS nedeniyle engelleyebilir. Bu durumda backend proxy mimarisi gerekir.
