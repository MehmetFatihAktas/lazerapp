# Bambu Suite İkinci Uygulama İçi Denetim Raporu

Tarih: 15 Temmuz 2026  
Denetlenen sürüm: `01.03.00.00`  
Çalıştırılan uygulama: `C:\Program Files\Bambu Suite\BambuSuite.exe`  
Ana yol haritası: [Bambu Suite Eşdeğerlik Denetimi ve Ürün Yol Haritası](BAMBU_SUITE_ESDEGERLIK_YOL_HARITASI.md)

## 1. Denetim yöntemi

Bu ikinci turda önceki özellik listesi tekrar kabul edilmedi. Kurulu Bambu Suite temiz ve kaydedilmeyecek bir test projesiyle açıldı; görünen menüler, araç çubukları, kısayollar, modal pencereler, tercihler, Prepare, Preview ve cihaz bağlantısı yeniden kullanıldı. Uygulamanın yerel yapılandırma ve kurtarma klasörleri de salt okunur biçimde incelendi.

Bir işlev üç kanıt seviyesinden biriyle kaydedildi:

- **Uygulandı:** Araç açıldı, nesne veya proje durumu üzerinde sonucu gözlendi.
- **Arayüz doğrulandı:** Ekran, parametreler ve ön koşul davranışı görüldü; bağlı donanım olmadığı için fiziksel sonuç üretilemedi.
- **Dosya yapısı doğrulandı:** Uygulamanın oluşturduğu yerel config, autosave veya paket içeriği incelendi.

## 2. Uygulama içinde doğrulanan işlevler

### Proje, dosya ve kurtarma

- Yeni, aç, kaydet, farklı kaydet, kapat, son projeler ve çoklu proje sekmeleri görüldü.
- Görsel, proje, ayar ve malzeme içe aktarma; SVG, G-code, `.gcode.lac`, ayar ve malzeme dışa aktarma yolları açıldı.
- Proje Bilgisi ekranında proje adı, en fazla 16 görsel, zengin açıklama, aksesuar, BOM, montaj kılavuzu, diğer dosyalar, profil adı, profil görselleri ve profil açıklaması görüldü.
- `C:\Users\mehme\AppData\Local\Bambu Suite\projects` altında `.lac`, `.lock`, `2D/Objects` ve `Metadata2D` içeren kurtarma yapısı oluştu.
- `.lac` paketinde `2D/entry.json`, `2D/2dmodel.json`, `Metadata2D/project_settings.json`, makine ve malzeme/işlem config snapshot'ları bulundu.
- Uygulama yeniden açıldığında kaydedilmemiş test projesini kurtardı. Bu davranış dosya yapısıyla birlikte doğrulandı.

### Editör ve CAD araçları

- Çoklu seçim, Group/Ungroup, Attach/Detach, enable/disable, z-sırası, Mirror, Align ve Order araçları açıldı.
- Union, Subtract, Intersect, Difference ve Merge Boolean komutları görüldü.
- Offset'te join/end stilleri ve yalnız dış kontur seçeneği; grid/circular array; Sticker; Tab; Path ve Simplify araçları görüldü.
- Rectangle, Ellipse, Pen, Pencil, üç noktalı yay, merkez noktalı yay, Text, QR ve Barcode araçları kısayol veya araç düğmesiyle doğrulandı.
- Shear komutu, sayısal transform alanları ve nesne ağacı davranışları kontrol edildi.
- Lazer boyutu, kesim boyutu, A4 boyutu, çizim boyutu, arka plaka ve yakalanan görüntü referans katmanı kısayolları görüldü.

### Görsel ve vektör işleme

- Parlaklık, kontrast, gamma, keskinlik ve filtre kontrolleri açıldı.
- Crop, arka plan silme, mask, görsel değiştirme ve düzenleme akışları görüldü.
- Monochrome ve layered trace seçenekleri ayrı ayrı doğrulandı.
- Raster nesnede Print Then Cut; frame, fill, hole, cut-through ve ek frame seçenekleri açıldı.

### İşlem, malzeme ve kalibrasyon

- Basic Cut, Drawing Line, Drawing Fill ve raster işleme seçenekleri görüldü.
- Drawing Fill için kalem çapı; işlem için hız, basınç ve pass alanları doğrulandı.
- Material Batch oluşturma, iki bağımsız batch kullanma, malzeme arama/filtreleme ve yeni malzeme ekleme açıldı.
- Kalibrasyon ekranında şablon, malzeme, X/Y adet ve min/max değerleri, basınç ve A2L basınç telafisi görüldü.
- Aktif malzeme parametrelerinde kalınlık, referans preset ve grid testini başlatma davranışı doğrulandı.

### Prepare ve yerleşim

- Design konumunu koruma ve Auto Arrange davranışları kontrol edildi; nesnelerin birden fazla plate'e ayrılabildiği görüldü.
- Capture Image komutu ve isteğe bağlı Fine Contour Extraction açıklaması görüldü.
- Auto Arrange komutunun işleme alanı veya yakalanan malzeme şekline göre yerleşim hedeflediği doğrulandı.
- Batch Engrave komutunun önce yakalanmış görüntü gerektirdiği hata mesajıyla doğrulandı.
- Prepare Mirror seçeneğinin, yüzü aşağı yerleştirilen ısı transfer malzemeleri için olduğu doğrulandı.

### Preview

- İş alanı, processing ve travel yolları, traversal görünürlüğü, zaman çizelgesi, play/pause/scrub ve hız seçimi açıldı.
- `0.1x`, `0.2x`, `0.5x`, `1x`, `2x`, `5x` ve `10x` oynatma hızları görüldü.
- Anlık X/Y/Z ile toplam süre; processing/rapid süre ve mesafe ayrımları doğrulandı.
- Preview içindeki Make komutu ve üretime geçiş noktası görüldü.

### Cihaz bağlantısı

- Yerel ağda cihaz keşfi, “Can't find your printer?” ve access-code ile bağlanma akışları açıldı.
- LAN-only akışında aynı yerel ağ, cihaz IP adresi ve access code gereksinimleri görüldü.
- LAN-only modun cloud/Bambu Handy bağlantısını devre dışı bıraktığı açıklaması doğrulandı.
- Gerçek Bambu cihazı bağlı olmadığı için upload, kamera akışı, telemetry ve fiziksel üretim çalıştırılmadı.

### Tercihler ve yardım

- General: dil, bölge, Simple/Advanced, tema, Expert mode, preset senkronizasyonu, AI model güncellemesi, mm/inch ve büyük görsel içe aktarma politikası.
- Project: son proje sayısı, 5 saniye autosave, Auto Arrange aralık/minimum alan/rotasyon ve Prepare giriş stratejisi.
- Canvas: mutlak konum, sürekli çizim, snap mesafesi, seçim ağacı, renk grubu numaraları, cetvel ve grid.
- Processing: gri ton kalibrasyonu tabanlı preview, uç-ofset optimizasyonu, yüksek hassasiyet kesim, çizim matı, rotary çap katsayısı ve canvas expand.
- Klavye kısayolları, config klasörünü açma, güncelleme, hata raporu, gizlilik, kullanım koşulları ve lisans bilgileri açıldı.

## 3. İkinci turda yol haritasına eklenen açıklar

| Bulgu | Yol haritası karşılığı |
|---|---|
| Atomik `.lac` proje paketi ve kilitli kurtarma | `P1-022`, `T-029` |
| Ayrıntılı proje/profil bilgisi | `P1-023` |
| Tam tercih şeması ve kapsam ayrımı | `P1-024`, `T-034` |
| Barcode üretimi | `P2-047`, `T-028` |
| Pencil/freehand iş akışı | `P2-048`, `T-028` |
| İki ayrı yay aracı | `P2-049`, `T-028` |
| Shear/eğme | `P2-050`, `T-028` |
| Enable/disable durum modeli | `P2-051` |
| Canvas referans katmanları | `P2-052`, `T-031` |
| Drawing Line/Fill kalem semantiği | `P4-034`, `T-030` |
| Prepare seviyesinde ısı transferi aynalama | `P6-026` |
| Auto Arrange tercihleri ve skor görünürlüğü | `P6-027` |
| LAN-only IP/access-code eşleştirme | `P8-025`, `T-033` |
| Capture Image ve Fine Contour Extraction | `P9-030`, `T-032` |
| Batch Engrave | `P9-031`, `T-032` |
| Kamera malzeme polygonuna Auto Arrange | `P9-032`, `T-032` |

## 4. Uçtan uca doğrulanamayanlar

Aşağıdaki işlevlerin arayüzü ve ön koşul davranışı doğrulandı ancak gerekli Bambu donanımı bağlı olmadığı için fiziksel çıktı kanıtı yoktur:

- Kamera görüntüsü alma ve Fine Contour Extraction doğruluğu.
- Batch Engrave parça tespiti ve gerçek tabla hizalama hassasiyeti.
- Kamera şekline göre Auto Arrange sonucunun fiziksel malzemeyle eşleşmesi.
- Bambu cihazına iş yükleme, başlatma, duraklatma ve telemetry.
- Rotary, curved surface, blade, pen, çizim matı ve cihaz sensörleriyle gerçek iş.

Bu maddeler tamamlanmış sayılmamalıdır. Yol haritasında capability-gated tutulmalı ve kayıtlı kamera fixture'ları, fake cihaz adaptörü ve en az bir gerçek cihaz kabul testiyle kapatılmalıdır.

## 5. Sonuç

İkinci uygulama içi denetim, ilk yol haritasının ana mimari yönünü değiştirmedi. Yeni bulgular daha çok gizli editör komutları, proje paketleme/kurtarma ayrıntıları, Prepare kamera akışları ve LAN-only eşleştirmeydi. Bunlar artık ayrı görev kimliği ve test karşılığıyla ana yol haritasında yer alıyor.

Görülebilen ve etkileşime açılabilen Bambu Suite işlev sınıfları yeniden tarandı. Donanım olmadan yalnız arayüz seviyesinde kalan maddeler özellikle “doğrulandı” diye kapatılmadı.
