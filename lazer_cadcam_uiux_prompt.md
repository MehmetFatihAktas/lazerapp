# Lazer CAD/CAM Arayüzü UI/UX ve Renk Paleti Tasarım Dokümanı

Bu doküman, `laser_editor/` arayüzünün üretim odaklı CAD/CAM ekranı olarak görünmesi ve çalışması için kullanılacak görsel yönü, renk paletini, CSS tokenlarını, bileşen stillerini, UX davranış kurallarını ve kabul checklistini tanımlar.

## Kısa Tasarım Yönü Özeti

Arayüzün görsel dili **teknik üretim paneli + CAD çalışma alanı** gibi olmalı: düşük doygunluklu nötr zeminler, net kontrast, sınırlı vurgu renkleri, durumlara göre tutarlı uyarılar ve gerçek ölçü hissi veren canvas.

Ana prensip:

- Nötr arayüz
- Ölçü güvenliği
- Üretim durumu renkleri
- Kesim/kazıma katman ayrımı
- G-code öncesi zorunlu kontrol

Kullanıcı tek bakışta şunları görmeli:

- **Kırmızı:** Kesilecek
- **Mavi:** Çizgi kazıma
- **Siyah / tarama:** Dolgu kazıma
- **Gri:** Yok sayılan veya pasif
- **Turuncu:** Dikkat
- **Kırmızı uyarı:** G-code engeli
- **Yeşil:** Üretime hazır

## 1. Açık Tema Renk Paleti

### Genel Arayüz

| Amaç | Renk | Kullanım |
|---|---:|---|
| Ana arka plan | `#F4F6F8` | Uygulama dış zemin |
| Panel zemini | `#FFFFFF` | Sol/sağ panel, kartlar |
| Panel ikincil zemin | `#F8FAFC` | İç bölümler, accordion gövdesi |
| Üst bar | `#FFFFFF` | Navbar / toolbar |
| Alt durum barı | `#FFFFFF` | Sayaç ve koordinat alanı |
| Border | `#D8DEE8` | Panel/kart/input kenarları |
| Border güçlü | `#B8C2D1` | Tabla sınırı, önemli ayırıcı |
| Ana yazı | `#172033` | Başlıklar, ana metin |
| İkincil yazı | `#5D6B82` | Açıklama, meta bilgi |
| Pasif yazı | `#98A2B3` | Disabled, yok sayılan içerik |

### Canvas / Tabla

| Amaç | Renk | Kullanım |
|---|---:|---|
| Canvas arka planı | `#E9EDF3` | Tabla çevresi |
| Aktif tabla alanı | `#FBFCFE` | Kullanılabilir kesim alanı |
| Tabla dışı alan | `#DDE3EC` | Aktif alan dışı |
| Tabla sınırı | `#4B5565` | Dış tabla çizgisi |
| Grid küçük | `#E1E6EE` | 1/5/10 mm küçük grid |
| Grid büyük | `#C5CDD9` | 10/50/100 mm ana grid |
| Ruler yazısı | `#667085` | Cetvel değerleri |
| Kenar payı çizgisi | `#7C8BA1` | Kesik çizgi |
| Makine sıfırı | `#111827` | Origin işareti |
| Seçim rengi | `#2563EB` | Seçili nesne bbox |
| Seçim arka planı | `rgba(37, 99, 235, 0.08)` | Seçim dolgu overlay |

### Üretim Operasyon Renkleri

| Operasyon | Renk | Görsel stil |
|---|---:|---|
| Kesim | `#E11D48` | Düz kırmızı çizgi |
| Kesim hover/seçili | `#BE123C` | Daha koyu kırmızı |
| Kazıma çizgi | `#2563EB` | Mavi ince/düz çizgi |
| Kazıma çizgi hover | `#1D4ED8` | Daha koyu mavi |
| Kazıma dolgu | `#1F2937` | Koyu gri/siyah + hatch |
| Kazıma dolgu hatch | `#6B7280` | İnce tarama çizgisi |
| Yok sayılan nesne | `#98A2B3` | Gri, kesik, düşük opaklık |
| Travel hareketleri | `#A855F7` | Mor kesik çizgi, opsiyonel |
| Dışta kalan parça | `#F97316` | Turuncu bbox + düşük opaklık |

### Durum Renkleri

| Durum | Renk | Kullanım |
|---|---:|---|
| Kritik hata | `#D92D20` | G-code engeli |
| Kritik hata zemin | `#FEF3F2` | Uyarı kartı zemini |
| Kritik hata border | `#FDA29B` | Kart/badge kenarı |
| Dikkat | `#D97706` | Riskli ama üretilebilir durum |
| Dikkat zemin | `#FFFAEB` | Warning kart |
| Dikkat border | `#FEDF89` | Warning border |
| Bilgi | `#2563EB` | Açıklama, yönlendirme |
| Bilgi zemin | `#EFF6FF` | Info kart |
| Başarılı | `#14965F` | Hazır / tamam |
| Başarılı zemin | `#ECFDF3` | Success kart |
| Pasif | `#98A2B3` | Disabled durum |

## 2. Koyu Tema Renk Paleti

Koyu tema çok kontrastlı siyah olmamalı. CAD/CAM hissi için koyu lacivert-gri taban daha iyi çalışır.

### Genel Arayüz

| Amaç | Renk |
|---|---:|
| Ana arka plan | `#111827` |
| Panel zemini | `#182230` |
| Panel ikincil zemin | `#202B3A` |
| Üst bar | `#182230` |
| Alt durum barı | `#182230` |
| Border | `#344054` |
| Border güçlü | `#475467` |
| Ana yazı | `#F2F4F7` |
| İkincil yazı | `#CBD5E1` |
| Pasif yazı | `#8A95A6` |

### Canvas / Tabla

| Amaç | Renk |
|---|---:|
| Canvas arka planı | `#0F172A` |
| Aktif tabla alanı | `#1E293B` |
| Tabla dışı alan | `#111827` |
| Tabla sınırı | `#94A3B8` |
| Grid küçük | `#273449` |
| Grid büyük | `#3A4A63` |
| Ruler yazısı | `#94A3B8` |
| Kenar payı çizgisi | `#A3B2C7` |
| Makine sıfırı | `#F8FAFC` |
| Seçim rengi | `#60A5FA` |
| Seçim arka planı | `rgba(96, 165, 250, 0.14)` |

### Üretim Operasyon Renkleri

| Operasyon | Renk | Görsel stil |
|---|---:|---|
| Kesim | `#FB7185` | Kırmızı/pembe düz çizgi |
| Kesim hover/seçili | `#F43F5E` | Daha güçlü |
| Kazıma çizgi | `#60A5FA` | Mavi çizgi |
| Kazıma çizgi hover | `#3B82F6` | Daha güçlü |
| Kazıma dolgu | `#E5E7EB` | Açık gri dolgu/hatch |
| Kazıma dolgu hatch | `#94A3B8` | Tarama |
| Yok sayılan nesne | `#64748B` | Gri, düşük opaklık |
| Travel hareketleri | `#C084FC` | Mor kesik çizgi |
| Dışta kalan parça | `#FDBA74` | Turuncu bbox |

### Durum Renkleri

| Durum | Renk |
|---|---:|
| Kritik hata | `#F97066` |
| Kritik hata zemin | `rgba(217, 45, 32, 0.16)` |
| Kritik hata border | `rgba(249, 112, 102, 0.45)` |
| Dikkat | `#FDB022` |
| Dikkat zemin | `rgba(217, 119, 6, 0.16)` |
| Dikkat border | `rgba(253, 176, 34, 0.45)` |
| Bilgi | `#60A5FA` |
| Bilgi zemin | `rgba(37, 99, 235, 0.16)` |
| Başarılı | `#32D583` |
| Başarılı zemin | `rgba(20, 150, 95, 0.16)` |

## 3. CSS Değişkenleri

Aşağıdaki yapı doğrudan UI kit başlangıcı olarak kullanılabilir.

```css
:root {
  /* Base */
  --bg: #F4F6F8;
  --panel: #FFFFFF;
  --panel-soft: #F8FAFC;
  --toolbar: #FFFFFF;
  --statusbar: #FFFFFF;

  --text: #172033;
  --text-muted: #5D6B82;
  --text-soft: #98A2B3;
  --text-inverse: #FFFFFF;

  --border: #D8DEE8;
  --border-strong: #B8C2D1;

  /* Canvas */
  --canvas: #E9EDF3;
  --bed: #FBFCFE;
  --bed-outside: #DDE3EC;
  --bed-border: #4B5565;

  --grid-small: #E1E6EE;
  --grid-large: #C5CDD9;
  --ruler-text: #667085;
  --margin-line: #7C8BA1;
  --origin: #111827;

  /* Selection */
  --selection: #2563EB;
  --selection-bg: rgba(37, 99, 235, 0.08);
  --focus-ring: rgba(37, 99, 235, 0.28);

  /* Operations */
  --cut: #E11D48;
  --cut-strong: #BE123C;
  --engrave-line: #2563EB;
  --engrave-line-strong: #1D4ED8;
  --engrave-fill: #1F2937;
  --engrave-hatch: #6B7280;
  --ignored: #98A2B3;
  --travel: #A855F7;
  --outside-object: #F97316;

  /* Status */
  --danger: #D92D20;
  --danger-bg: #FEF3F2;
  --danger-border: #FDA29B;

  --warning: #D97706;
  --warning-bg: #FFFAEB;
  --warning-border: #FEDF89;

  --info: #2563EB;
  --info-bg: #EFF6FF;
  --info-border: #BFDBFE;

  --success: #14965F;
  --success-bg: #ECFDF3;
  --success-border: #ABEFC6;

  /* Components */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 18px;

  --shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.06);
  --shadow-md: 0 8px 24px rgba(15, 23, 42, 0.10);

  --topbar-height: 60px;
  --statusbar-height: 36px;
  --left-panel-width: 320px;
  --right-panel-width: 360px;

  --font-ui: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
}

[data-theme="dark"] {
  --bg: #111827;
  --panel: #182230;
  --panel-soft: #202B3A;
  --toolbar: #182230;
  --statusbar: #182230;

  --text: #F2F4F7;
  --text-muted: #CBD5E1;
  --text-soft: #8A95A6;
  --text-inverse: #111827;

  --border: #344054;
  --border-strong: #475467;

  --canvas: #0F172A;
  --bed: #1E293B;
  --bed-outside: #111827;
  --bed-border: #94A3B8;

  --grid-small: #273449;
  --grid-large: #3A4A63;
  --ruler-text: #94A3B8;
  --margin-line: #A3B2C7;
  --origin: #F8FAFC;

  --selection: #60A5FA;
  --selection-bg: rgba(96, 165, 250, 0.14);
  --focus-ring: rgba(96, 165, 250, 0.30);

  --cut: #FB7185;
  --cut-strong: #F43F5E;
  --engrave-line: #60A5FA;
  --engrave-line-strong: #3B82F6;
  --engrave-fill: #E5E7EB;
  --engrave-hatch: #94A3B8;
  --ignored: #64748B;
  --travel: #C084FC;
  --outside-object: #FDBA74;

  --danger: #F97066;
  --danger-bg: rgba(217, 45, 32, 0.16);
  --danger-border: rgba(249, 112, 102, 0.45);

  --warning: #FDB022;
  --warning-bg: rgba(217, 119, 6, 0.16);
  --warning-border: rgba(253, 176, 34, 0.45);

  --info: #60A5FA;
  --info-bg: rgba(37, 99, 235, 0.16);
  --info-border: rgba(96, 165, 250, 0.38);

  --success: #32D583;
  --success-bg: rgba(20, 150, 95, 0.16);
  --success-border: rgba(50, 213, 131, 0.38);

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.24);
  --shadow-md: 0 12px 32px rgba(0, 0, 0, 0.34);
}
```

## 4. Temel Layout CSS'i

```css
.app-shell {
  height: 100vh;
  display: grid;
  grid-template-rows: var(--topbar-height) 1fr var(--statusbar-height);
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-ui);
  overflow: hidden;
}

.topbar {
  height: var(--topbar-height);
  background: var(--toolbar);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
}

.workspace {
  display: grid;
  grid-template-columns: var(--left-panel-width) 1fr var(--right-panel-width);
  min-height: 0;
}

.left-panel,
.right-panel {
  background: var(--panel);
  border-color: var(--border);
  overflow: auto;
}

.left-panel {
  border-right: 1px solid var(--border);
}

.right-panel {
  border-left: 1px solid var(--border);
}

.canvas-area {
  min-width: 0;
  min-height: 0;
  background: var(--canvas);
  position: relative;
  overflow: hidden;
}

.statusbar {
  height: var(--statusbar-height);
  background: var(--statusbar);
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 0 14px;
  color: var(--text-muted);
  font-size: 12px;
}
```

## 5. Bileşen Tasarım Kuralları

### 5.1 Buton Hiyerarşisi

**Primary**

- G-code Oluştur
- Otomatik Yerleştir
- Ön Kontrol içinde "G-code üret"

**Secondary**

- DXF Ekle
- Desen Ekle
- Foto -> Vektör
- Tabla'ya sığdır

**Ghost / Toolbar**

- Seç
- Taşı
- Döndür
- Aynala
- Kopyala

**Danger**

- Sil
- Dıştakileri yok say
- Yerleşimi sıfırla

**Disabled**

- Kritik hata varken G-code Oluştur

```css
.btn {
  height: 36px;
  padding: 0 14px;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  user-select: none;
  transition:
    background 120ms ease,
    border-color 120ms ease,
    color 120ms ease,
    box-shadow 120ms ease,
    transform 80ms ease;
}

.btn:active {
  transform: translateY(1px);
}

.btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 4px var(--focus-ring);
}

.btn-primary {
  background: var(--selection);
  color: #FFFFFF;
  border-color: var(--selection);
}

.btn-primary:hover {
  background: var(--engrave-line-strong);
  border-color: var(--engrave-line-strong);
}

.btn-secondary {
  background: var(--panel);
  color: var(--text);
  border-color: var(--border);
}

.btn-secondary:hover {
  background: var(--panel-soft);
  border-color: var(--border-strong);
}

.btn-ghost {
  background: transparent;
  color: var(--text-muted);
  border-color: transparent;
}

.btn-ghost:hover {
  background: var(--panel-soft);
  color: var(--text);
}

.btn-danger {
  background: var(--danger);
  color: #FFFFFF;
  border-color: var(--danger);
}

.btn-danger:hover {
  filter: brightness(0.96);
}

.btn-gcode {
  background: var(--success);
  color: #FFFFFF;
  border-color: var(--success);
  font-weight: 700;
}

.btn-gcode.is-blocked,
.btn:disabled {
  background: var(--panel-soft);
  color: var(--text-soft);
  border-color: var(--border);
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}
```

**G-code butonu davranışı**

| Durum | Görsel | Metin |
|---|---|---|
| Kritik hata yok | Yeşil, aktif | `G-code Oluştur` |
| Kritik hata var | Pasif | `G-code Oluşturulamaz` |
| Ön kontrol yapılmadı | Önce modal açılır | `Ön Kontrol` veya `G-code Oluştur` |

Kritik hata tooltip örneği: `2 parça tabla dışında, 1 açık kesim path'i var`.

### 5.2 Status Chip

Status chip'ler üst bar ve alt durum çubuğunda kısa, tek satır bilgi vermeli.

Örnekler:

- `Birim: mm kilitli`
- `Tabla: 600 x 400 mm`
- `Yerleşim güncel`
- `Manuel düzenleme var`
- `3 parça dışta`
- `G-code hazır değil`

```css
.chip {
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--panel-soft);
  color: var(--text-muted);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.chip-success {
  color: var(--success);
  background: var(--success-bg);
  border-color: var(--success-border);
}

.chip-warning {
  color: var(--warning);
  background: var(--warning-bg);
  border-color: var(--warning-border);
}

.chip-danger {
  color: var(--danger);
  background: var(--danger-bg);
  border-color: var(--danger-border);
}

.chip-info {
  color: var(--info);
  background: var(--info-bg);
  border-color: var(--info-border);
}

.chip-mm {
  color: var(--text);
  background: var(--panel);
  border-color: var(--border-strong);
  font-family: var(--font-mono);
}
```

### 5.3 İş Özeti Sayaç Kartı

Sayaçlar anlık ve tıklanabilir olmalı. Kritik sayaçlar görsel olarak ayrılmalı.

Örnek:

```text
DXF       12
Yerleşen  10/12
Dışta     2
Uyarı     4
```

```css
.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.summary-card {
  border: 1px solid var(--border);
  background: var(--panel-soft);
  border-radius: var(--radius-md);
  padding: 10px;
  min-height: 68px;
  cursor: pointer;
}

.summary-card:hover {
  border-color: var(--border-strong);
  background: var(--panel);
}

.summary-label {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 6px;
}

.summary-value {
  color: var(--text);
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.summary-card.is-danger {
  background: var(--danger-bg);
  border-color: var(--danger-border);
}

.summary-card.is-danger .summary-value {
  color: var(--danger);
}

.summary-card.is-warning {
  background: var(--warning-bg);
  border-color: var(--warning-border);
}

.summary-card.is-warning .summary-value {
  color: var(--warning);
}

.summary-card.is-success {
  background: var(--success-bg);
  border-color: var(--success-border);
}

.summary-card.is-success .summary-value {
  color: var(--success);
}
```

### 5.4 Uyarı Kartı

Uyarı kartı sadece problem söylememeli, çözüm butonları da vermeli.

İçerik yapısı:

1. Başlık
2. Kısa açıklama
3. Eylemler

Örnek metin:

```text
2 parça tabla dışında

Bu parçalar aktif kesim alanının dışında kalıyor.
G-code oluşturulamaz.

[Parçaları göster] [Otomatik yerleştir]
```

```css
.warning-card {
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: var(--panel);
  padding: 12px;
  display: grid;
  gap: 8px;
}

.warning-card.is-critical {
  background: var(--danger-bg);
  border-color: var(--danger-border);
}

.warning-card.is-warning {
  background: var(--warning-bg);
  border-color: var(--warning-border);
}

.warning-card.is-info {
  background: var(--info-bg);
  border-color: var(--info-border);
}

.warning-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text);
  font-size: 13px;
  font-weight: 800;
}

.warning-card.is-critical .warning-title {
  color: var(--danger);
}

.warning-card.is-warning .warning-title {
  color: var(--warning);
}

.warning-card.is-info .warning-title {
  color: var(--info);
}

.warning-message {
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.45;
}

.warning-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
```

### 5.5 Accordion Section

Sol ve sağ panellerde uzun içeriği yönetmek için kullanılmalı.

```css
.section {
  border-bottom: 1px solid var(--border);
}

.section-header {
  height: 42px;
  padding: 0 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  color: var(--text);
  font-size: 13px;
  font-weight: 800;
}

.section-header:hover {
  background: var(--panel-soft);
}

.section-body {
  padding: 12px 14px 16px;
  display: grid;
  gap: 12px;
}

.section-meta {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
}
```

### 5.6 Unit Input: mm Güvenli Input

Bu uygulamada standart input değil, özel unit input kullanılmalı.

UX kuralı:

- Label'da mm yazmak yetmez.
- Input'un içinde veya sağında sabit `mm` suffix görünmeli.

Örnek:

```text
Tabla genişliği       [ 600     mm ]
Tabla yüksekliği      [ 400     mm ]
Kenar payı            [ 5       mm ]
```

```css
.field {
  display: grid;
  gap: 6px;
}

.field-label {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
}

.unit-input {
  height: 38px;
  border: 1px solid var(--border);
  background: var(--panel);
  border-radius: var(--radius-md);
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  overflow: hidden;
}

.unit-input:focus-within {
  border-color: var(--selection);
  box-shadow: 0 0 0 4px var(--focus-ring);
}

.unit-input input {
  width: 100%;
  height: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text);
  padding: 0 10px;
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-mono);
}

.unit-suffix {
  height: 100%;
  min-width: 42px;
  padding: 0 10px;
  border-left: 1px solid var(--border);
  background: var(--panel-soft);
  color: var(--text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
}
```

**cm/mm şüphesi uyarısı**

```css
.unit-warning {
  border-radius: var(--radius-md);
  border: 1px solid var(--warning-border);
  background: var(--warning-bg);
  color: var(--warning);
  padding: 10px;
  font-size: 12px;
  line-height: 1.45;
}

.unit-warning strong {
  display: block;
  font-size: 13px;
  margin-bottom: 4px;
}
```

Örnek metin:

```text
Tabla ölçüsü küçük görünüyor

60 x 40 mm girdiniz.
60 x 40 cm demek istiyorsanız 600 x 400 mm kullanın.

[600 x 400 mm yap] [Bu ölçü doğru]
```

### 5.7 Canvas Legend

Canvas legend her zaman görünür ama küçük olmalı.

```css
.canvas-legend {
  position: absolute;
  left: 16px;
  bottom: 16px;
  background: color-mix(in srgb, var(--panel) 92%, transparent);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: 10px;
  display: grid;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
  backdrop-filter: blur(8px);
}

.legend-item {
  display: grid;
  grid-template-columns: 24px 1fr;
  align-items: center;
  gap: 8px;
}

.legend-line {
  height: 0;
  border-top: 3px solid currentColor;
}

.legend-cut {
  color: var(--cut);
}

.legend-engrave {
  color: var(--engrave-line);
}

.legend-fill {
  color: var(--engrave-fill);
}

.legend-fill .legend-line {
  height: 12px;
  border: 1px solid var(--engrave-hatch);
  background:
    repeating-linear-gradient(
      45deg,
      transparent,
      transparent 3px,
      var(--engrave-hatch) 3px,
      var(--engrave-hatch) 4px
    );
}

.legend-ignore {
  color: var(--ignored);
}

.legend-ignore .legend-line {
  border-top-style: dashed;
}
```

### 5.8 Seçili Nesne Paneli

Seçili nesne paneli, nesnenin türüne göre değişmeli.

**DXF seçili**

- Konum
- Ölçü
- Rotasyon
- İşlem: Kesim / Kazıma / Yok say
- Nesting davranışı
- Kesim profili

**Desen seçili**

- Konum
- Kırpma
- Bağlı DXF parça
- İşlem: Kazıma çizgi / Dolgu / Kesim

**Foto-vektör seçili**

- Vektör modu
- Path sayısı
- Temizlik uyarıları
- Kazıma dolgu ayarları

```css
.inspector {
  display: grid;
  gap: 14px;
  padding: 14px;
}

.inspector-title {
  display: grid;
  gap: 4px;
}

.inspector-title h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 850;
  color: var(--text);
}

.inspector-title span {
  color: var(--text-muted);
  font-size: 12px;
}

.property-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.operation-picker {
  display: grid;
  gap: 8px;
}

.operation-option {
  min-height: 42px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--panel);
  padding: 9px 10px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 9px;
  cursor: pointer;
}

.operation-option:hover {
  background: var(--panel-soft);
}

.operation-option.is-active {
  border-color: var(--selection);
  box-shadow: 0 0 0 3px var(--focus-ring);
}

.operation-swatch {
  width: 18px;
  height: 18px;
  border-radius: 5px;
}

.operation-swatch.cut {
  background: var(--cut);
}

.operation-swatch.engrave-line {
  background: var(--engrave-line);
}

.operation-swatch.engrave-fill {
  background:
    repeating-linear-gradient(
      45deg,
      var(--engrave-fill),
      var(--engrave-fill) 2px,
      transparent 2px,
      transparent 5px
    );
  border: 1px solid var(--engrave-hatch);
}

.operation-swatch.ignore {
  background: var(--ignored);
}
```

### 5.9 Preflight Panel

Ön kontrol ekranı sade, üretim özeti gibi olmalı.

```css
.preflight {
  width: min(920px, calc(100vw - 40px));
  max-height: min(780px, calc(100vh - 40px));
  background: var(--panel);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-md);
  display: grid;
  grid-template-rows: auto 1fr auto;
  overflow: hidden;
}

.preflight-header {
  padding: 18px 20px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.preflight-title {
  display: grid;
  gap: 4px;
}

.preflight-title h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 850;
}

.preflight-title p {
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
}

.preflight-body {
  padding: 18px 20px;
  overflow: auto;
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 18px;
}

.preflight-card {
  border: 1px solid var(--border);
  background: var(--panel-soft);
  border-radius: var(--radius-lg);
  padding: 14px;
  display: grid;
  gap: 10px;
}

.preflight-card h4 {
  margin: 0;
  font-size: 13px;
  font-weight: 850;
}

.preflight-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--text-muted);
  font-size: 13px;
}

.preflight-row strong {
  color: var(--text);
  font-family: var(--font-mono);
}

.preflight-footer {
  padding: 14px 20px;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
```

## 6. UX Davranış Kuralları

### 6.1 mm Güvenliği

Kural:

- Uygulama içinde tüm ölçüler `mm`.
- Kullanıcıya bunu her kritik noktada görünür yap.

Uygulama:

- Input suffix: `mm`
- Üst bar chip: `Birim: mm kilitli`
- Ölçü aracı: `mm` gösterir
- Canvas koordinatı: `X/Y mm`
- G-code özeti: `mm/dk`, `mm`, geçiş

Şüpheli değer algılama:

- Tabla genişliği `< 100` veya yükseklik `< 100` ise cm/mm uyarısı göster.
- DXF parçası çok küçükse "Dosya cm veya inch olabilir mi?" uyarısı göster.
- Kullanıcı `60` ve `40` girerse: `60 x 40 mm girdiniz. 600 x 400 mm yapmak ister misiniz?`

### 6.2 Tabla Ölçüsü Değişince Sessiz Yeniden Yerleşim Yapılmamalı

Yanlış davranış:

1. Kullanıcı tabla ölçüsünü değiştirir.
2. Sistem parçaları otomatik yeniden dizer.
3. Kullanıcı neden değiştiğini anlamaz.

Doğru davranış:

1. Kullanıcı tabla ölçüsünü değiştirir.
2. Yerleşim durumu `Ayarlar değişti` olur.
3. Banner gösterilir.

Banner metni:

```text
Tabla ölçüsü değişti. Mevcut yerleşim eski ölçüye göre olabilir.

[Yerleşimi yeniden hesapla] [Konumları koru] [Geri al]
```

### 6.3 Manuel Düzen Otomatik Yerleşim Tarafından Bozulmamalı

Durum modeli:

```text
placementStatus:
  not_started
  auto_current
  manual_modified
  settings_changed
  invalid
```

UI metinleri:

- `Otomatik yerleşim güncel`
- `Manuel düzenleme var`
- `Yerleşim ayarları değişti`
- `Parça tabla dışında`

Otomatik yerleştir butonuna basınca:

```text
Manuel taşıdığınız parçalar var.
Otomatik yerleştirme bu konumları değiştirebilir.

[Devam et] [Konumları kilitle] [Vazgeç]
```

Nesne düzeyi:

- `[x] Otomatik yerleşime dahil`
- `[ ] Konumu kilitle`

### 6.4 Tabla Dışında Parça Varken G-code Engellenmeli

Kural:

- Tabla dışında parça varsa G-code oluşturulamaz.
- İstisna gerekiyorsa kullanıcı açıkça `Dıştakileri yok say` seçmelidir.
- Bu eylem danger veya warning aksiyon olmalıdır.

G-code butonu durumu:

| Kritik hata | Buton metni | Tooltip |
|---:|---|---|
| `0` | `G-code Oluştur` | Yok |
| `1+` | `G-code Oluşturulamaz` | Örn. `2 parça tabla dışında` |

### 6.5 Kesim ve Kazıma Sadece Renkle Ayrılmamalı

Renk + stil birlikte kullanılmalı:

| Operasyon | Renk | Stil |
|---|---|---|
| Kesim | Kırmızı | Düz çizgi, daha kalın outline |
| Kazıma çizgi | Mavi | İnce çizgi, yuvarlak uç preview |
| Kazıma dolgu | Koyu gri/siyah | Hatch/tarama overlay |
| Yok say | Gri | Kesik çizgi, yüzde 35 opaklık |
| Tabla dışı | Turuncu/kırmızı | Soluk nesne, kesik bbox, uyarı etiketi |

## 7. Canvas Görsel Dili

Canvas'ın amacı çizimden çok üretim doğrulaması olmalı.

Canvas katmanları:

1. Canvas arka planı
2. Grid küçük
3. Grid büyük
4. Ruler
5. Tabla dışı alan
6. Aktif tabla
7. Kenar payı
8. DXF kesim parçaları
9. Desen / kazıma yolları
10. Dolgu kazıma hatch
11. Seçim bbox
12. Uyarı overlay
13. Tabla dışında kalanlar rafı

### Tabla Görünümü

```css
.bed {
  position: absolute;
  background: var(--bed);
  border: 2px solid var(--bed-border);
  box-shadow: var(--shadow-md);
}

.bed-margin {
  position: absolute;
  border: 1.5px dashed var(--margin-line);
  pointer-events: none;
}

.canvas-grid {
  background-color: var(--canvas);
  background-image:
    linear-gradient(var(--grid-small) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-small) 1px, transparent 1px),
    linear-gradient(var(--grid-large) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-large) 1px, transparent 1px);
  background-size:
    10px 10px,
    10px 10px,
    50px 50px,
    50px 50px;
}
```

### Kesim / Kazıma Path Stilleri

SVG içinde kullanılabilecek class mantığı:

```css
.path-cut {
  fill: none;
  stroke: var(--cut);
  stroke-width: 1.8;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.path-engrave-line {
  fill: none;
  stroke: var(--engrave-line);
  stroke-width: 1.2;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.path-engrave-fill {
  fill: var(--engrave-fill);
  fill-opacity: 0.18;
  stroke: var(--engrave-fill);
  stroke-width: 1;
}

.path-ignore {
  fill: none;
  stroke: var(--ignored);
  stroke-width: 1.2;
  stroke-dasharray: 6 4;
  opacity: 0.45;
}

.path-outside {
  opacity: 0.35;
}

.path-selected {
  filter: drop-shadow(0 0 0.5px var(--selection));
}
```

### Tabla Dışında Kalanlar Rafı

Canvas altında veya sağ kenarda net ayrılmış bir bölge:

```text
Tabla dışında kalanlar
G-code oluşturulamaz
```

```css
.outside-rack {
  position: absolute;
  left: 24px;
  right: 24px;
  bottom: 24px;
  min-height: 96px;
  border: 1px dashed var(--warning-border);
  background: var(--warning-bg);
  border-radius: var(--radius-lg);
  padding: 12px;
}

.outside-rack-title {
  color: var(--warning);
  font-size: 12px;
  font-weight: 850;
  margin-bottom: 8px;
}

.outside-object {
  opacity: 0.45;
  outline: 2px dashed var(--outside-object);
  background: color-mix(in srgb, var(--outside-object) 10%, transparent);
}
```

Önerilen metin:

```text
Tabla dışında kalanlar - G-code oluşturulamaz
```

Alternatif güvenli mod:

```text
Tabla dışında kalanlar - G-code'a dahil edilmeyecek
```

Üretim güvenliği için ilk seçenek daha iyi.

## 8. Ön Kontrol ve Hata Mesajı Tasarımı

### Ön Kontrol Neden Gerekli?

G-code üretmeden önce kullanıcı şu özeti görmeli:

- Tabla doğru mu?
- Dışta parça var mı?
- Kesilecek/kazınacak nesneler doğru mu?
- Kritik hata var mı?
- Güç/hız ayarları dolu mu?
- Açık kesim path'i var mı?

### Ön Kontrol Ekran Yapısı

```text
G-code Ön Kontrol

Durum:
Hazır / Hazır değil

Tabla:
600 x 400 mm
Kenar payı: 5 mm
Makine sıfırı: Sol alt

Yerleşim:
DXF parça: 12
Yerleşen: 12 / 12
Dışta: 0
Çakışma: 0

İşlemler:
Kesim: 48 path, 85%, 450 mm/dk
Kazıma çizgi: 16 path, 25%, 1800 mm/dk
Kazıma dolgu: 3 alan, 18%, 2200 mm/dk

Uyarılar:
0 kritik
2 dikkat

[Canvas'ta göster] [G-code oluştur]
```

### Kritik Hata Örneği

```text
G-code oluşturulamaz

2 kritik sorun var:
- 2 parça tabla dışında
- 1 kesim path'i açık

Bu sorunlar çözülmeden G-code üretimi yapılmaz.

[İlk sorunu göster] [Kapat]
```

### Uyarı Mesajı Şablonu

Her hata şu üç soruya cevap vermeli:

1. Ne oldu?
2. Neden önemli?
3. Ne yapabilirim?

**Örnek 1: Tabla dışında parça**

```text
2 parça tabla dışında

Bu parçalar aktif kesim alanının dışında kalıyor.
G-code oluşturulamaz.

[Parçaları göster] [Otomatik yerleştir] [Dıştakileri yok say]
```

**Örnek 2: mm karışıklığı**

```text
Tabla ölçüsü küçük görünüyor

60 x 40 mm girdiniz. 60 x 40 cm demek istiyorsanız
600 x 400 mm kullanmalısınız.

[600 x 400 mm yap] [Bu ölçü doğru]
```

**Örnek 3: Manuel yerleşim**

```text
Manuel düzenleme var

Bazı parçalar elle taşındı. Otomatik yerleştirme tekrar çalıştırılırsa
bu konumlar değişebilir.

[Devam et] [Konumları kilitle] [Vazgeç]
```

**Örnek 4: Açık kesim path'i**

```text
Kesim path'i açık

Kesim olarak işaretli 1 path kapalı değil.
Açık path kesimde kapalı parça oluşturmaz.

[Path'i seç] [Kazıma yap] [Uçları birleştir]
```

## 9. Responsive Davranış

Bu uygulama üretim aracı olduğu için ideal deneyim masaüstüdür. Yine de web tabanlı kullanımda ekran boyutlarına göre güvenli davranmalı.

**Geniş ekran**

- Sol panel + canvas + sağ panel
- Tüm sayaçlar görünür
- Canvas geniş

**Orta ekran**

- Sol panel 280 px
- Sağ panel drawer'a dönüşebilir
- Canvas öncelikli

**Dar ekran / tablet**

- Sol panel kapatılabilir drawer
- Sağ panel alt drawer
- Alt durum çubuğu kısaltılmış
- G-code butonu sabit üst sağ

```css
@media (max-width: 1280px) {
  :root {
    --left-panel-width: 280px;
    --right-panel-width: 320px;
  }
}

@media (max-width: 1024px) {
  .workspace {
    grid-template-columns: 280px 1fr;
  }

  .right-panel {
    position: absolute;
    right: 12px;
    top: calc(var(--topbar-height) + 12px);
    bottom: calc(var(--statusbar-height) + 12px);
    width: 340px;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
    z-index: 20;
  }
}

@media (max-width: 760px) {
  .workspace {
    grid-template-columns: 1fr;
  }

  .left-panel {
    position: absolute;
    left: 12px;
    top: calc(var(--topbar-height) + 12px);
    bottom: calc(var(--statusbar-height) + 12px);
    width: 320px;
    z-index: 30;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
  }

  .topbar {
    overflow-x: auto;
  }

  .statusbar {
    gap: 10px;
    overflow-x: auto;
  }
}
```

## 10. Üst Bar / Navbar Önerisi

Üst bar üretim aksiyonlarını taşımalı. Karmaşık menü bar gibi değil, iş sırasına göre dizilmeli.

```text
[Proje]
[DXF Ekle] [Desen Ekle] [Foto -> Vektör]
[Otomatik Yerleştir]
[Seç] [Taşı] [Döndür] [Aynala]
[Birim: mm kilitli] [Tabla: 600 x 400 mm] [Manuel düzenleme var]
[Ön Kontrol] [G-code Oluştur]
```

```css
.topbar-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.topbar-separator {
  width: 1px;
  height: 28px;
  background: var(--border);
  margin: 0 4px;
}

.project-name {
  min-width: 180px;
  font-weight: 850;
  color: var(--text);
  white-space: nowrap;
}
```

## 11. İşlem Katmanları UI

Sağ panelde kesim/kazıma ayarlarını ayrı katmanlar olarak gösterin.

```text
İşlem Katmanları

Kesim
Renk: kırmızı
48 path
Güç 85%
Hız 450 mm/dk

Kazıma çizgi
Renk: mavi
16 path
Güç 25%
Hız 1800 mm/dk

Kazıma dolgu
Tarama
3 alan
Güç 18%
Hız 2200 mm/dk
Dolgu aralığı 0.12 mm
```

```css
.layer-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--panel-soft);
  padding: 12px;
  display: grid;
  gap: 10px;
}

.layer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.layer-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 850;
}

.layer-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
}

.layer-dot.cut {
  background: var(--cut);
}

.layer-dot.engrave {
  background: var(--engrave-line);
}

.layer-dot.fill {
  background: var(--engrave-fill);
}

.layer-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.layer-stat {
  font-size: 11px;
  color: var(--text-muted);
}

.layer-stat strong {
  display: block;
  margin-top: 3px;
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 12px;
}
```

## 12. Uygulanabilir Kısa Tasarım Checklist'i

### Görsel Sistem

- [ ] Açık ve koyu tema CSS değişkenleri tanımlandı.
- [ ] Kesim, kazıma çizgi, kazıma dolgu, yok say renkleri ayrı.
- [ ] Kesim/kazıma sadece renkle değil çizgi stiliyle de ayrıldı.
- [ ] Canvas grid küçük/büyük çizgileri gerçek ölçü hissi veriyor.
- [ ] Tabla dışı alan aktif tabladan net ayrılıyor.
- [ ] Kenar payı kesik çizgiyle gösteriliyor.

### Ölçü Güvenliği

- [ ] Tüm inputlarda `mm` suffix var.
- [ ] Üst barda `Birim: mm` çipi var.
- [ ] `60 x 40` gibi küçük tabla değerlerinde cm/mm uyarısı var.
- [ ] DXF ölçeği şüpheliyse kullanıcıya `10x` / `25.4x` önerisi var.
- [ ] İmleç koordinatı `X/Y mm` olarak gösteriliyor.

### Yerleşim Güvenliği

- [ ] Otomatik yerleşim ve manuel düzenleme ayrı durumlar.
- [ ] Tabla ölçüsü değişince sessiz yeniden yerleşim yapılmıyor.
- [ ] `Yerleşimi yeniden hesapla / Konumları koru` seçeneği var.
- [ ] Konumu kilitle seçeneği var.
- [ ] Dışta kalan parçalar görünür bir rafta gösteriliyor.

### G-code Güvenliği

- [ ] Tabla dışında parça varken G-code butonu pasif.
- [ ] Açık kesim path'i kritik hata.
- [ ] Ön kontrol ekranı zorunlu.
- [ ] Ön kontrol kesim/kazıma ayarlarını net özetliyor.
- [ ] Kritik hatalarda `sorunu göster` aksiyonu var.

### Paneller

- [ ] Sol panel: İş Özeti, Tabla, Yerleşim, Parçalar, Desenler, Uyarılar.
- [ ] Sağ panel seçili nesneye göre değişiyor.
- [ ] İşlem katmanları ayrı kartlarda gösteriliyor.
- [ ] Sayaçlar tek veri kaynağından güncelleniyor.
- [ ] Uyarı kartları problem + açıklama + aksiyon içeriyor.

### Canvas

- [ ] Legend sürekli görünür.
- [ ] Kesim kırmızı düz çizgi.
- [ ] Kazıma çizgi mavi ince çizgi.
- [ ] Kazıma dolgu hatch/tarama.
- [ ] Yok sayılan nesne gri kesik ve soluk.
- [ ] Tabla dışı parça düşük opaklık + uyarı bbox.
- [ ] Grid zoom seviyesine göre ölçekleniyor.

## Son Tasarım Kararı

Bu ürün için en güvenli UI dili şu olmalı:

- Nötr CAD zemini
- mm kilitli ölçü sistemi
- Üretim operasyon renkleri
- Durum çipleri
- Görünür uyarılar
- Zorunlu ön kontrol

Arayüzün amacı güzel görünmekten önce şunu garanti etmeli:

Kullanıcı G-code oluşturmadan önce **neyin kesileceğini**, **neyin kazınacağını**, **neyin dışarıda kaldığını** ve **hangi hataların üretimi engellediğini** kaçırmamalı.
