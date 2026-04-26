# AGFO AI Humanizer — MS Word Add-in

**Version:** 4.0.1  
**Author:** AGFOCERT / Cemal Gurkan Kara

---

## Dosyalar

| Dosya | Açıklama |
|---|---|
| `manifest.xml` | Word'e eklentiyi tanıtan XML dosyası |
| `taskpane.html` | Görev bölmesi arayüzü |
| `taskpane.js` | İş mantığı ve API entegrasyonu |

---

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

#### Yöntem A — Geliştirici / Lokal Test:
1. Word'ü açın
2. **Ekle** → **Eklentilerim** → **Özel Eklenti** → **Dosyadan Yükle**
3. `manifest.xml` dosyasını seçin

#### Yöntem B — SharePoint Katalog:
1. SharePoint'te bir App Catalog oluşturun
2. `manifest.xml` dosyasını yükleyin
3. Word'de otomatik görünür

#### Yöntem C — Microsoft AppSource:
- Microsoft Partner Center üzerinden yayınlayın

---

## Kullanım

1. Word'de **Ekle → Eklentilerim → AGFO AI Humanizer** ile paneli açın
2. **API Ayarları** bölümünden provider seçin ve API anahtarınızı girin
3. **Ayarları Kaydet** butonuna tıklayın
4. Belgeden metin seçin veya textarea'ya yapıştırın
5. Mod ve dil seçin
6. **🚀 İnsanlaştır** butonuna tıklayın
7. Sonucu belgeye ekleyin

---

## Desteklenen API Sağlayıcıları

| Sağlayıcı | Modeller |
|---|---|
| **OpenAI** | gpt-4o-mini, gpt-4o, gpt-4-turbo, gpt-3.5-turbo |
| **Google Gemini** | gemini-1.5-flash, gemini-1.5-pro, gemini-2.0-flash |
| **Anthropic Claude** | claude-3-5-sonnet, claude-3-opus, claude-3-haiku |

---

## Desteklenen Modlar

| Mod | Açıklama |
|---|---|
| OTO | Otomatik en iyi yaklaşım |
| GENEL | Genel insanlaştırma |
| YAPISAL | Yapısal iyileştirme |
| TON | Ton ayarı |
| AKADEMİK | Akademik stil |
| KELIME | Kelime zenginleştirme |
| KATMANLI | Çok katmanlı insanlaştırma |
| BURST | Agresif insanlaştırma |
| CGK DRAMA | Dramatik anlatı stili |
| CGK AKADEMİK | Sofistike akademik stil |

---

## Güvenlik Notu

> ⚠️ API anahtarları `sessionStorage`'da tutulur (sayfa kapanınca silinir).  
> Production kullanımı için kendi backend proxy'inizi oluşturmanız önerilir.

---

## CORS Ayarı

Kendi sunucunuzdan servis ediyorsanız şu header'ı ekleyin:

```
Access-Control-Allow-Origin: *
```

GitHub Pages ve Netlify bunu otomatik olarak sağlar.
