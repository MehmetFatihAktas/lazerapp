# Bambu Suite Eşdeğerlik Denetimi ve Ürün Yol Haritası

Tarih: 15 Temmuz 2026  
Denetlenen Bambu Suite sürümü: `01.03.00.00`  
Hedef uygulama: Laser Editor (`laser_editor` + `laser_editor_core.py` + `laser_grbl.py`)

## 1. Amaç ve kapsam

Bu belge, Bambu Suite'in bilgisayarda kurulu sürümü uygulama üzerinde kullanılarak; resmi Bambu kaynakları, yerel cihaz/malzeme profilleri ve mevcut Laser Editor kodu ile karşılaştırılarak hazırlanmıştır.

Hedef, Bambu Suite'in ekranını birebir kopyalamak değildir. Hedef, lazer işi hazırlama ve makineye gönderme sürecinde aynı işi yapan hiçbir temel kabiliyetin eksik kalmaması; mevcut GRBL ve hassas geometri kabiliyetlerimizin korunmasıdır.

Eşdeğerlik iki seviyede ele alınır:

- **Çekirdek eşdeğerlik:** DXF/SVG/görsel hazırlama, düzenleme, yerleştirme, malzeme/işlem ayarı, G-code önizleme ve GRBL makine kontrolü. Mevcut donanımla tamamlanabilir.
- **Donanım destekli eşdeğerlik:** Kamera ile hizalama, otomatik parça tanıma, eğri yüzey yüksekliği, rotary, kapı/alev sensörü, otomatik hava desteği, bıçak ve kalem araçları. İlgili donanım ve güvenilir cihaz API'si varsa etkinleşir.

## 2. Denetim yöntemi

İnceleme aşağıdaki kaynaklarla yapıldı:

- Bambu Suite ana editörü, görsel araçları, `Prepare`, `Preview`, malzeme ve kalibrasyon ekranları uygulama içinde kullanıldı.
- İkinci uygulama içi denetimde tüm üst menüler, araç kısayolları, modal pencereler, tercihler, proje kurtarma yapısı ve cihaz eşleştirme akışı yeniden kontrol edildi.
- Bambu Suite'in yerel `preset2d` veritabanındaki 554 profil ve 36 malzeme ailesi incelendi.
- Laser Editor arayüzü, sunucu uçları, geometri/G-code çekirdeği, paketleme algoritması, proje formatı ve GRBL katmanı kod üzerinden tarandı.
- Mevcut Python ve JavaScript testleri özellik envanterine dahil edildi.
- Bambu'nun resmi Suite, destek ve cihaz özellik sayfalarıyla donanım özellikleri doğrulandı.

Resmi kaynaklar:

- [Bambu Suite resmi indirme ve özellik sayfası](https://bambulab.com/en-us/download/suite)
- [Bambu Suite hızlı başlangıç kılavuzu](https://wiki.bambulab.com/en/software/bambu-suite/manual/quick-start-guide)
- [Bambu Suite 2D işlem türleri](https://wiki.bambulab.com/en/software/bambu-suite/manual/2d-processing-type-intro)
- [Bambu Suite işlem parametreleri kılavuzu](https://wiki.bambulab.com/en/h2/software/bambu-suite/manual/processing-parameters-guide)
- [Bambu H2S resmi ürün sayfası](https://eu.store.bambulab.com/en/products/h2s?from=home_page_3dprinter)

Yerel kanıt ve kapsam sınırları için [ikinci uygulama içi denetim raporuna](BAMBU_SUITE_IKINCI_UYGULAMA_DENETIMI.md) bakın.

### Yerel uygulama keşif kaydı

Kurulu uygulamanın `About Bambu Suite` ekranında sürüm `01.03.00.00` olarak doğrulandı. İnceleme yalnız ekran adlarına bakılarak yapılmadı; aşağıdaki akışlar uygulama üzerinde açılıp davranış seviyesinde karşılaştırıldı:

- `Design` alanında proje sekmeleri, işlem türü seçimi, Mirror/Align/Order/Offset/Array/Sticker/Tab/Path araçları, sayısal transform alanları, Objects/Material Batch panelleri ve cihaz kartı incelendi.
- Menü ve kısayol denetiminde Pencil, Pen, üç noktalı yay, merkez noktalı yay, shear, enable/disable, Attach/Detach, Barcode ve canvas referans katmanları ayrıca doğrulandı.
- Dosya menüsünde yeni/aç/kaydet/farklı kaydet, son projeler, görsel/ayar/malzeme içe aktarma; SVG, G-code, `.gcode.lac`, ayar ve malzeme dışa aktarma akışları doğrulandı.
- Yardım menüsünde başlangıç eğitimi, klavye kısayolları, yapılandırma klasörü, güncelleme, hata raporu ve lisans ekranları doğrulandı.
- `Preferences` altında `General`, `Project`, `Canvas`, `Processing` kapsamları ayrı ayrı açıldı. Basit/uzman mod, tema/dil/birim, büyük görsel davranışı, autosave aralığı, Prepare stratejisi, snap/cetvel/grid, gri ton kalibrasyon önizlemesi, uç-ofset optimizasyonu, yüksek hassas kesim, çizim matı ve rotary seçenekleri kaydedildi.
- `Prepare` alanında iki Material Batch ve iki Plate ile nesne-plaka üyeliği, düzlem işleme modu, malzeme/kalınlık, referans preset, grid testi, hız/basınç/pass ve plate bazlı parametre akışı gözlendi.
- `Prepare` araçlarında Capture Image, isteğe bağlı Fine Contour Extraction, kamera şekline göre Auto Arrange, Batch Engrave ve ısı transferi için plate bazlı Mirror davranışı açıldı.
- `Preview` alanında play/pause/scrub, hız çarpanı, anlık XYZ, işlem/rapid mesafe ve süre ayrımı ile traversal görünürlüğü doğrulandı.
- Cihaz penceresinde yerel ağ keşfi ile LAN-only IP/access-code eşleştirme yolu; proje klasöründe ise `.lac`, `.lock`, `2D/Objects` ve `Metadata2D` tabanlı autosave/kurtarma paketi doğrulandı.

Bu kayıt, tek seferlik bir ekran listesi değildir. `P0-021` ile sürüm bazlı parite envanterine, `T-024` ile otomatik doğrulama kapısına dönüştürülecektir.

## 3. Durum özeti

Durum işaretleri:

- **VAR:** Güncel uygulamada çalışır durumda.
- **KISMİ:** Temel karşılığı var fakat Bambu seviyesinde tamamlanmamış veya kullanıcı akışı eksik.
- **EKSİK:** Ürün içinde henüz yok.
- **DONANIM:** Yazılıma ek olarak uygun makine, kamera, sensör veya cihaz protokolü gerekir.

Laser Editor'ın bugün Bambu Suite'e göre güçlü olduğu alanlar:

- **VAR:** Genel GRBL cihazlarına doğrudan seri bağlantı, durum ve alarm takibi, jog, çerçeve dolaşma, iş akışı ve override kontrolü.
- **VAR:** DXF sınırına göre SVG/desen kırpma ve kullanıcı tarafından ayarlanabilen iç kenar payı.
- **VAR:** Kesim sırasında lazer açık hareketlerin tabla ve malzeme sınırında son kez doğrulanması.
- **VAR:** İç geometrileri önce, dış konturları sonra kesme; kerf, overcut, geçiş, pass ve mikro köprü desteği.
- **VAR/KISMİ:** Fotoğrafı çizgi/dolgu vektörüne dönüştürmek için ayrıntılı OpenCV, Potrace ve VTracer hattı.
- **VAR:** Vektör topolojisi, semantik yol önerileri ve kapı/bağlantı gibi bu projeye özel ileri düzenleme araçları.

En büyük eşdeğerlik açıkları:

- Proje güvenliği: otomatik kayıt, çökme kurtarma, kirli proje göstergesi ve son projeler.
- Standart CAD düzenleme: nesne ağacı, gruplama, z-sırası, hizalama/dağıtma, offset, array, Boolean ve genel node editörü.
- Üretim modeli: malzeme partileri, plakalar, cihaz/watt/kalınlık bazlı malzeme profilleri ve kalibrasyon geçmişi.
- Hazırlama: şekle duyarlı gerçek nesting, çoklu plaka ve ayrı `Prepare` aşaması.
- Önizleme: zaman çizelgeli iş simülasyonu, katman/seyahat görünürlüğü ve ayrıntılı süre/mesafe raporu.
- Uzun işlemlerde kullanıcı deneyimi: arka plan worker, ilerleme, iptal ve hatadan geri dönüş.
- Donanım bağlı gelişmiş akışlar: kamera, batch vision, curved-surface, rotary ve güvenlik sensörleri.

## 4. Özellik eşdeğerlik matrisi

| Alan | Bambu Suite | Laser Editor | Durum | Yapılacak |
|---|---|---|---|---|
| Yerel proje dosyası | `.lac` | `.laserjob.json` v2 | KISMİ | Şema v3, migration, kaynak kimliği ve doğrulama |
| Otomatik kayıt/kurtarma | Var | Yok | EKSİK | Atomik autosave, crash recovery, sürüm geçmişi |
| Son projeler/ana ekran | Var | Yok | EKSİK | Son dosyalar, küçük önizleme, sabitleme |
| Undo/redo | Var | 50 adımlı snapshot | VAR | Büyük projede delta/command tabanlı hale getirme |
| Çoklu seçim | Var | SVG ve DXF için var | VAR/KISMİ | Tek seçim modeli, grup içi seçim, tüm nesne türleri |
| Kopyala/yapıştır | Var | SVG ve DXF için var | VAR/KISMİ | Stil, grup, katman, dış uygulama SVG clipboard |
| Nesne ağacı | Var | Basit listeler | KISMİ | Hiyerarşi, ad, grup, kilit, gizle, arama |
| Z-sırası | Var | Sınırlı | KISMİ | Öne/arkaya/ileri/geri, tree drag/drop |
| Hizalama/dağıtma | Var | Sınırlı tabla hizası | EKSİK | Nesne ve seçim bazlı 8 hizalama/dağıtma işlemi |
| Sayısal transform | Var | Kısmi | KISMİ | X/Y/W/H, oran kilidi, açı, anchor ve ortak pivot |
| Cetvel/ızgara/snap | Var | Izgara ve merkez çizgileri var | KISMİ | Dinamik ölçek, nesne/nokta/kenar snap, kılavuz |
| Canvas referans katmanları | Lazer/kesim/A4/çizim boyutu, arka plaka, yakalanan görüntü | Tabla ve merkez çizgileri | KISMİ | Ayrı görünürlük, opacity, kalıcı tercih ve export dışı yardımcı katman |
| Mirror | Var | Kopyasını aynalama var | VAR | Ortak pivot ve çoklu seçim önizlemesi |
| Offset | Gelişmiş | Vektör yumuşatma/kenar araçları | EKSİK | İç/dış offset, join/end style, canlı önizleme |
| Grid array | Var | Yok | EKSİK | Satır/sütun, aralık/toplam boyut, canlı önizleme |
| Circular array | Var | Yok | EKSİK | Adet, açı, merkez, kopyayı döndürme |
| Boolean | 5 işlem | Topolojiye özel kısmi işlemler | KISMİ | Union/subtract/intersect/xor/merge |
| Mikro köprü/tab | Var | Vektör kesimde var | VAR/KISMİ | Otomatik dağıtım, manuel sürükleme, tüm konturlar |
| Node/path editörü | Var | Vektör düzenleyicide özel araçlar | KISMİ | Genel node, Bezier kolu, trim, join, break, close |
| Simplify | Canlı ve nokta sayılı | Yumuşatma var | KISMİ | Önce/sonra nokta sayısı ve köşe koruma |
| Temel şekiller | Var | Dikdörtgen/daire/poligon/test | VAR/KISMİ | Yuvarlatma, yıldız, çizgi, yay ve şekil birleştirme |
| Pen | Var | Serbest çizim var | VAR/KISMİ | Bezier pen, kapatma, node düzeltme |
| Pencil ve yay araçları | Pencil, üç noktalı yay, merkez noktalı yay | Tek serbest çizim ve genel yay karşılığı | KISMİ | Araçları ve sayısal kısıtlarını ayrı komut yap |
| Shear/eğme | Var | Yok | EKSİK | X/Y ekseni, açı, pivot ve canlı önizleme |
| Metin | Gelişmiş | Font yükleme ve lazer fontu var | VAR/KISMİ | Hizalama, satır aralığı, weld ve text-on-path |
| QR kod | Var | Yok | EKSİK | Metin/Wi-Fi/kişi, ECC, gerçek boyut testi |
| Barcode | Var | Yok | EKSİK | Barkod türü, doğrulama, minimum çizgi/boşluk ve tarama testi |
| Hazır kütüphane | Var | Kaldırılan/özel öğeler | EKSİK | Aranabilir yerel varlık kütüphanesi ve favoriler |
| Görsel filtreleri | Var | Parlaklık/kontrast/keskinlik vb. | VAR/KISMİ | Non-destructive filter stack ve preset |
| Arka plan silme | Oto + fırça | Renk köşesi/maske araçları | KISMİ | Oto, sil, geri yükle, brush undo/redo |
| Crop | Oranlı/serbest | Kısmi | KISMİ | Serbest ve hazır oranlar, döndürmeden bağımsız crop |
| Mask | 33 hazır şekil | Kısmi | EKSİK | Hazır şekiller ve özel vektörü maske yapma |
| Monochrome trace | Var | Güçlü çok motorlu hat | VAR | Otomatik kalite metriği ve daha anlaşılır kontrol |
| Layered color trace | Var | Yok | EKSİK | Renk katmanı sayısı ve katman başına işlem |
| Replace image | Var | Kaynak yeniden eklenebiliyor | KISMİ | Transform/ayarları koruyan gerçek Replace |
| Print Then Cut/sticker | Var | Yok | EKSİK | Çerçeve, iç delik, ek frame, registration |
| İşlem türleri | Cut/draw/engrave/print | Cut/line/fill/ignore | VAR/KISMİ | Tipli ve cihaz kabiliyetli işlem modeli |
| Nesne başına hız/güç | Var | Var | VAR | Malzeme preset bağı ve güç birimi açıklığı |
| Raster/fill engraving | Var | Var | VAR/KISMİ | Overscan, açı, bidirectional ve hatch seçenekleri |
| İşlem sırası | UI + batch | Backend otomatik | KISMİ | Kullanıcı sırası, bağımlılık ve çakışma uyarısı |
| Malzeme kataloğu | Geniş katalog | Basit özel profiller | KISMİ | Kalınlık/cihaz/watt/process hiyerarşisi |
| Malzeme partileri | Var | Yok | EKSİK | Nesne atamalı çoklu batch |
| Çoklu plaka | Var | Tek tabla | EKSİK | Plate modeli, taşıma, çoğaltma, çıktı grubu |
| Kalibrasyon matrisi | Var | Manuel ayar | EKSİK | Güç/hız/interval/pass test matrisi ve geçmiş |
| Auto arrange | Var | Dikdörtgen MaxRects benzeri | KISMİ | Polygon/NFP nesting, delik içine yerleştirme |
| Isı transferi aynalama | Prepare seviyesinde var | Editörde kopya aynalama var | KISMİ | Kaynağı bozmayan plate/job mirror bayrağı |
| Keep design layout | Var | Manuel yerleşim | KISMİ | Açık strateji ve stabil transform |
| Kalan malzeme alanı | Var/kamera destekli | Özel kullanılabilir polygon var | VAR/KISMİ | Kalıntı stok kütüphanesi ve nesting entegrasyonu |
| Prepare aşaması | Var | Editör içinde dağınık | EKSİK | Ayrı üretim sahnesi ve plate/batch özeti |
| Animasyonlu preview | Var | Makine ve canvas önizlemesi | KISMİ | Timeline, process/travel filtreleri, XYZ ve hız |
| Süre/mesafe raporu | Var | Analiz katmanında kısmi | KISMİ | Process/travel ayrı ve UI raporu |
| Preflight | Var | Güçlü doğrulamalar var | VAR/KISMİ | Tek merkez, önem seviyesi ve çözüm bağlantıları |
| G-code dışa aktarma | Var | Var | VAR | Sürüm/cihaz metadata ve tekrar açılabilir job bundle |
| SVG dışa aktarma | Var | Var | VAR/KISMİ | Tüm seçili/tüm belge ve operation metadata |
| Doğrudan cihaz bağlantısı | Bambu cihazları | GRBL seri bağlantı | VAR | Üretim konsolu sertleştirme ve job queue |
| LAN-only eşleştirme | Keşif veya IP + access code | Seri port profili | EKSİK | Güvenli yerel ağ adaptörü ve kimlik bilgisi saklama |
| Kamera hizalama | Var | Yok | DONANIM | Kamera kalibrasyonu ve canvas dönüşümü |
| Capture Image/Fine Contour | Prepare içinde var | Yok | DONANIM | Yakalama işi, hassas kontur seçeneği, kalite ve iptal durumu |
| Görsel batch engraving | Var | Yok | DONANIM | Parça tespiti, poz eşleme, doğrulama |
| Curved surface | Var | Yok | DONANIM | Height map ve Z kompanzasyonu |
| Rotary | Var | Yok | DONANIM | Çap/dönüşüm profili ve eksen sarmalama |
| Blade/pen | Var | G-code işlemleri lazer odaklı | DONANIM | Tool modeli, basınç ve tool-change akışı |
| Kapı/alev/egzoz durumu | Var | Standart GRBL'de yok | DONANIM | Capability plugin ve fail-safe durumları |
| Proje bilgisi/BOM | Var | Yok | EKSİK | Fotoğraf, açıklama, dosya ve montaj eki |
| Tercihler | Var | Form alanlarına dağılmış | KISMİ | Kalıcı genel/proje/canvas/işleme ayarları |
| Basit/uzman modu | Var | Yok | EKSİK | Rol bazlı kontrol yoğunluğu |
| Dil/tema | Var | Türkçe, sabit tema | KISMİ | i18n ve açık/koyu/sistem teması |
| İş ilerleme/iptal | Var | Ağır işler senkron | EKSİK | Worker queue, progress, cancel, retry |

## 5. Uygulama ilkeleri

- Mevcut çalışan sistemi baştan yazma. Özellikleri yeni servis ve modüllere taşıyarak kademeli ayrıştır.
- Geometri, belge durumu, üretim ayarları ve makine durumu aynı JavaScript nesnesinde karışmamalı.
- Canvas yalnızca görünüm olmalı; gerçek ölçü ve geometrinin tek kaynağı belge modeli olmalı.
- Sayaçlar ayrı mutable değer olarak tutulmamalı; her zaman belge modelinden türetilmeli.
- Aynı dosya tekrar içe aktarıldığında diskteki kaynaktan yeni kimlikle yüklenmeli; önceki düzenlenmiş nesnenin bellekteki kopyası kullanılmamalı.
- Her ağır işlem iptal edilebilir olmalı ve UI ana thread'ini bloke etmemeli.
- G-code, canvas çiziminden değil normalize edilmiş üretim modelinden üretilmeli.
- Donanım özelliği görünürlükle değil capability modeliyle açılıp kapanmalı.
- Makine ayarlarını otomatik değiştirmek varsayılan davranış olmamalı; önce oku, farkı göster, açık onayla yaz.
- Güvenlik doğrulamaları UI'da geçilmiş olsa bile G-code yazılmadan hemen önce çekirdekte tekrar çalışmalı.

## 6. Aşama 0 - Mevcut sistemi sabitleme ve veri güvenliği (P0)

Bu aşama bitmeden büyük editör özelliklerine başlanmamalı.

- [ ] `P0-001` Mevcut çalışan durum için Git etiketi ve geri dönüş noktası oluştur.
- [ ] `P0-002` DXF, SVG, JPG, proje ve G-code regression fixture klasörü oluştur.
- [ ] `P0-003` Kullanıcının üretimde doğruladığı G-code dosyalarını golden test olarak sakla.
- [ ] `P0-004` Tüm koordinatlar için tek sözleşme tanımla: belge mm, canvas dönüşümü, makine/work offset.
- [ ] `P0-005` DXF birim tespitini kaynak metadata ile sakla; sessiz ölçek düzeltmesini kaldır.
- [ ] `P0-006` Import edilen her nesneye kalıcı `sourceId`, yeni `instanceId` ve içerik hash'i ver.
- [ ] `P0-007` Tekrar import sırasında yalnızca disk içeriğini parse et; açık projedeki instance'ı klonlama.
- [ ] `P0-008` Nesne/adet/sayfa sayaçlarını modelden türetilen selector haline getir.
- [ ] `P0-009` Tabla ölçüsü değişince görünüm ile geometri dönüşümünü birbirinden ayır.
- [ ] `P0-010` `fit-to-view`, grid ve tabla polygon çizimini tek viewport servisine bağla.
- [ ] `P0-011` Her state değişikliği için tek command dispatcher kullan; doğrudan DOM/state mutasyonlarını işaretle.
- [ ] `P0-012` UI hatalarını yakalayan global error boundary ve ayrıntılı yerel log ekle.
- [ ] `P0-013` Sunucu işlerinde correlation/job ID kullan.
- [ ] `P0-014` Vectorize, nesting ve G-code üretimini background worker/job queue'ya taşı.
- [ ] `P0-015` Ağır işlerde yüzde, aşama adı, iptal ve yeniden dene sun.
- [ ] `P0-016` İş iptal edilince geçici dosya ve yarım state temizliğini garanti et.
- [ ] `P0-017` Önizleme sonucunu yalnızca aynı job ID hâlâ güncelse uygula; eski response yeni state'i ezmesin.
- [ ] `P0-018` Kaydetme işlemlerini temp dosya + atomic rename ile yap.
- [ ] `P0-019` Proje şeması için JSON Schema ve açılış doğrulaması ekle.
- [ ] `P0-020` Üretimden önce tek `PreflightService` çalıştır; UI ve backend aynı sonucu kullansın.
- [ ] `P0-021` Sürüm bazlı parite envanteri tut: Bambu ekran/komut kimliği, bizim karşılığı, capability, durum, kabul testi ve kanıt bağlantısı.
- [ ] `P0-022` Dosya seçici, kaydetme, üretim ve gönderim komutlarını single-flight/idempotent yap; açık işlem varken ikinci tıklama yeni pencere veya ikinci iş başlatmasın.

Kabul kriterleri:

- Tabla boyutu art arda 50 kez değiştirilse nesnelerin mm ölçüsü değişmez.
- Aynı DXF iki kez import edilince iki bağımsız instance oluşur ve ikincisi diskteki özgün dosyadır.
- 100 nesnede silme/kopyalama sonrası tüm sayaçlar aynı render döngüsünde doğrudur.
- 60 saniyelik vectorize sırasında arayüz hareket eder, işlem iptal edilebilir ve eski sonuç belgeyi ezmez.
- Beklenmeyen istisna proje içeriğini kaybettirmez ve logda hangi command sırasında olduğu görünür.

## 7. Aşama 1 - Proje kabuğu ve kurtarma (P0/P1)

- [ ] `P1-001` Yeni proje, aç, kaydet, farklı kaydet ve kapat akışlarını tek proje servisine taşı.
- [ ] `P1-002` Başlıkta proje adı ve kaydedilmemiş değişiklik göstergesi göster.
- [ ] `P1-003` Yapılandırılabilir otomatik kayıt aralığı ekle; varsayılan 5 saniye.
- [ ] `P1-004` Autosave dosyasını ana proje dosyasından ayrı ve atomik tut.
- [ ] `P1-005` Uygulama çökmesi/kill sonrası açılışta kurtarma ekranı göster.
- [ ] `P1-006` Son projeler ekranı, küçük önizleme, tarih ve dosya konumu ekle.
- [ ] `P1-007` Eksik kaynak dosyaları için locate/replace/skip akışı ekle.
- [ ] `P1-008` Proje şeması v2 -> v3 migration yaz ve migration yedeği al.
- [ ] `P1-009` Gömülü ve bağlantılı asset seçeneklerini açıkça ayır.
- [ ] `P1-010` Proje paketine kullanılan font, SVG, raster ve malzeme preset snapshot'ı ekle.
- [ ] `P1-011` Proje açıklaması, fotoğraflar, aksesuar, BOM ve montaj dosyaları bölümü ekle.
- [ ] `P1-012` Kalıcı tercihler ekranı oluştur: genel, proje, canvas, işleme, makine.
- [ ] `P1-013` Basit/uzman modu ekle; aynı veri modelini kullansın.
- [ ] `P1-014` Klavye kısayolları penceresi ve çakışma kontrolü ekle.
- [ ] `P1-015` Türkçe metinleri i18n anahtarlarına taşı; İngilizce ikinci dil olsun.
- [ ] `P1-016` Açık/koyu/sistem tema desteği ekle.
- [ ] `P1-017` Hata raporu paketine log, anonim sistem bilgisi ve proje tanılama özeti ekle.
- [ ] `P1-018` Tabla dışından büyük kaynaklarda sor/ölçekle/orijinal bırak içe aktarma tercihi ekle.
- [ ] `P1-019` Çoklu proje sekmeleri ekle; her sekmenin dirty, undo/redo, autosave, seçim ve arka plan işi birbirinden yalıtılmış olsun.
- [ ] `P1-020` `.gcode.lac` eşdeğeri bütünlüklü üretim paketi oluştur: değişmez G-code, proje/generator hash'i, cihaz-malzeme-preset snapshot'ı, önizleme ve doğrulama raporu.
- [ ] `P1-021` G-code üretmeden önce çıktı adı/konumu seçimini açık bir adım yap; mevcut dosyanın üstüne yazmayı ayrı onaya bağla ve son seçimi proje bazında hatırla.
- [ ] `P1-022` `.lac` eşdeğeri atomik proje paketi oluştur: belge modeli, gömülü nesneler, makine/malzeme/işlem snapshot'ları, ilişki manifesti ve kurtarma kilidi birlikte doğrulansın.
- [ ] `P1-023` Proje bilgisine profil adı/görselleri/açıklaması, zengin metin ve ek dosya doğrulaması ekle; kaynak sınırlarını ve paket boyutunu kullanıcıya göster.
- [ ] `P1-024` Tercih şemasına kullanıcı seviyesi, tema, birim, büyük görsel politikası, preset senkronizasyonu, model güncellemesi, Prepare giriş stratejisi, snap mesafesi ve görünüm katmanlarını ekle.

Kabul kriterleri:

- Zorla kapatılan uygulama son autosave'i açılışta bulur ve kullanıcı seçmeden ana dosyanın üstüne yazmaz.
- Kaydet-aç round-trip sonrasında nesne sayısı, transform, işlem, hız/güç, kaynak ve yerleşim birebir aynıdır.
- Eski v2 projeler veri kaybetmeden açılır; migration testi golden JSON ile doğrulanır.
- Autosave klasöründen açılan paket, kaynak proje bozuk olsa bile son tutarlı manifesti bulur; `.lock` ve yarım yazılmış arşiv ana projeyi ezmez.
- Tercihler yeniden başlatma sonrasında korunur; proje bazlı tercihler ile uygulama geneli tercihler birbirini sessizce ezmez.

## 8. Aşama 2 - Editör ve CAD eşdeğerliği (P1)

### Belge ve seçim modeli

- [ ] `P2-001` Tüm DXF, SVG, raster, metin, şekil ve grup nesnelerini ortak `DocumentObject` modeline taşı.
- [ ] `P2-002` Nesne ağacı ekle: ad değiştir, ara, gizle, kilitle, çoğalt, sil.
- [ ] `P2-003` Grup/ungroup ve iç içe grup desteği ekle.
- [ ] `P2-004` Tree drag/drop ile z-sırası ve grup taşıma ekle.
- [ ] `P2-005` Öne getir, arkaya gönder, bir öne, bir arkaya komutlarını ekle.
- [ ] `P2-006` İşleme göre, renge göre ve türe göre seçim ekle.
- [ ] `P2-007` Marquee seçimin soldan-sağa ve sağdan-sola davranışını tanımla.
- [ ] `P2-008` Ctrl+C/V/X, duplicate ve dış clipboard SVG alışverişini tamamla.
- [ ] `P2-009` Çoklu seçimde ortak bounding box, pivot ve transform uygula.
- [ ] `P2-010` Kilitli/gizli nesnelerin seçim, export ve G-code kurallarını açıkça tanımla.

### Transform, hizalama ve snap

- [ ] `P2-011` X/Y/W/H/açı sayısal paneli, oran kilidi ve anchor seçimi ekle.
- [ ] `P2-012` Sol, sağ, üst, alt, yatay merkez ve dikey merkez hizalama ekle.
- [ ] `P2-013` Yatay ve dikey eşit dağıtma ekle.
- [ ] `P2-014` Son seçilen, seçim kutusu, tabla ve malzeme alanına göre hizalama hedefi ekle.
- [ ] `P2-015` X/Y eksenine göre aynalama; özgünü koru/kopya üret seçeneği ekle.
- [ ] `P2-016` Dinamik cetvel, mm grid ve zoom seviyesine göre grid aralığı ekle.
- [ ] `P2-017` Grid, kılavuz, merkez, node, kenar, kesişim ve bounding box snap ekle.
- [ ] `P2-018` Kullanıcı kılavuz çizgileri ve snap mesafesi tercihi ekle.
- [ ] `P2-019` Ok tuşu nudge ve Shift/Alt ile hassas/kaba adım desteği ekle.

### Geometri araçları

- [ ] `P2-020` Offset aracı ekle: iç/dış, mesafe, yalnız dış, canlı önizleme.
- [ ] `P2-021` Offset join stilleri ekle: round, miter, bevel; miter limit.
- [ ] `P2-022` Açık yollar için butt/round/square end style ekle.
- [ ] `P2-023` Grid array ekle: satır, sütun, toplam ölçü, parça arası, merkez arası.
- [ ] `P2-024` Circular array ekle: adet, başlangıç/bitiş/adım açı, merkez X/Y, rotate copies.
- [ ] `P2-025` Union, subtract, intersect, difference/xor ve merge Boolean işlemlerini ekle.
- [ ] `P2-026` Boolean öncesi açık yol/self-intersection tanılaması ekle.
- [ ] `P2-027` Genel node editörü ekle: seç, taşı, ekle, sil, break, join, close.
- [ ] `P2-028` Line/quadratic/cubic segment dönüşümü ve Bezier kolları ekle.
- [ ] `P2-029` Trim at intersection ve makas aracı ekle.
- [ ] `P2-030` Simplify aracı ekle: tolerans, köşe koruma, önce/sonra nokta sayısı.
- [ ] `P2-031` Spike, kısa çıkıntı, duplicate segment ve zero-length otomatik onarımını komutlaştır.
- [ ] `P2-032` Tab/mikro köprü aracını tüm kapalı kesimlere uygula; otomatik/manual mod ekle.
- [ ] `P2-033` Tab adet, mesafe, boyut ve güç katsayısını canlı önizle.

### İçerik üretimi

- [ ] `P2-034` Dikdörtgen, yuvarlatılmış dikdörtgen, daire, elips, çizgi, yay, yıldız ve çokgen ekle.
- [ ] `P2-035` Pen aracını gerçek Bezier çizimine dönüştür; çift tıkla bitir ve kapat.
- [ ] `P2-036` Metin hizalama, satır yüksekliği, tracking, bold/italic ve weld ekle.
- [ ] `P2-037` Text-on-path ve path'e dönüştürme ekle.
- [ ] `P2-038` QR kod aracı ekle: metin, URL, Wi-Fi, kişi ve hata düzeltme seviyesi.
- [ ] `P2-039` QR için minimum modül boyutu ve lazerde okunabilirlik uyarısı ekle.
- [ ] `P2-040` Hazır vektör kütüphanesi ekle: kategori, arama, favori, son kullanılanlar.
- [ ] `P2-041` Kullanıcının kendi varlık klasörlerini kütüphaneye eklemesini sağla.
- [ ] `P2-042` Print Then Cut/sticker aracı ekle: dış frame, iç delikler, ek frame ve cut-through.
- [ ] `P2-043` Geometriyi birleştirmeden birlikte üretmek için `Attach/Detach` ilişkisi ekle.
- [ ] `P2-044` Seçim ağacı numaraları ve canvas nesne etiketlerini tercihle aç/kapat.
- [ ] `P2-045` Çoklu seçim özellik panelinde ortak ve karma değerleri ayır; yalnız değiştirilen alanı seçimin tamamına uygula.
- [ ] `P2-046` Nesne ağacında uyarı rozeti ve `soruna git` eylemi ekle; Design/Prepare/Preview geçişinde aynı nesne kimliğine odaklan.
- [ ] `P2-047` Barcode aracı ekle: desteklenen sembolojiler, içerik doğrulama, checksum ve gerçek mm boyutunda okunabilirlik uyarısı sun.
- [ ] `P2-048` Pencil aracını Pen'den ayır; örnekleme aralığı, basınç yoksa hızdan bağımsız yumuşatma, otomatik simplify ve açık yol semantiği uygula.
- [ ] `P2-049` Üç noktalı yay ve merkez noktalı yay araçlarını ayrı komutlar yap; yarıçap/açı/yön kısıtlarını sayısal düzenlenebilir tut.
- [ ] `P2-050` Shear/eğme dönüşümü ekle: X/Y ekseni, açı, pivot, çoklu seçim ve canlı önizleme; tek undo adımı üret.
- [ ] `P2-051` İşleme etkin/devre dışı durumunu görünürlük, kilit ve `ignore` işleminden ayır; export, Prepare ve sayaç davranışını tek sözleşmeyle tanımla.
- [ ] `P2-052` Lazer boyutu, kesim boyutu, A4, çizim boyutu, arka plaka ve yakalanan görüntü referans katmanlarını bağımsız aç/kapat; bunları üretim geometrisine dahil etme.

Kabul kriterleri:

- 1000 nesneli belgede seçim, taşıma ve undo gözle görülür takılma yapmaz.
- Boolean ve offset sonuçlarında açık kontur, self-intersection veya sıfır uzunluklu segment kalmaz.
- Çoklu seçim kopyala/yapıştır tüm işlem ayarlarını ve grup ilişkisini korur.
- Align/distribute sonucu mm hassasiyetinde ve undo ile tek adımda geri alınır.
- Pencil, iki yay türü ve shear hem fare hem kısayol üzerinden aynı command yolunu kullanır; kaydet-aç sonrasında geometri değişmez.
- Referans katmanları görünürlük değiştirince document bounds, sayaç, nesting veya G-code değişmez.

## 9. Aşama 3 - Görsel ve vektör işleme eşdeğerliği (P1/P2)

- [ ] `P3-001` Görsel düzenlemeyi non-destructive filter stack olarak modelle.
- [ ] `P3-002` Orijinal görseli değişmez tut; her adım parametre olarak kaydedilsin.
- [ ] `P3-003` Filtre presetleri, keskinlik, parlaklık, kontrast, gamma ve negative ekle/tamamla.
- [ ] `P3-004` Arka plan silmede auto tolerance, manuel silgi ve restore fırçası ekle.
- [ ] `P3-005` Maske fırçası için undo/redo ve brush size/hardness ekle.
- [ ] `P3-006` Serbest crop ve `1:1`, `4:3`, `3:2`, `16:9` oranlarını ekle.
- [ ] `P3-007` Hazır maske şekilleri ve özel SVG'yi maske olarak kullanma ekle.
- [ ] `P3-008` Replace image komutunda transform, crop, mask, işlem ve filtreleri koru.
- [ ] `P3-009` Otomatik trace seçiminde line-art, logo, siluet ve fotoğraf sınıflandırmasını metriklerle yap.
- [ ] `P3-010` Monochrome trace için kullanıcı dilinde dört ana kontrol bırak: detay, yumuşaklık, gürültü, kopuk çizgi onarımı.
- [ ] `P3-011` Uzman modunda threshold/morphology/Potrace/VTracer ayrıntılarını göster.
- [ ] `P3-012` Layered color trace ekle; renk sayısı ve palette preview sun.
- [ ] `P3-013` Her renk katmanını bağımsız belge nesnesi ve işlem olarak üret.
- [ ] `P3-014` Centerline'ı yalnız tek çizgi kazıma seçeneği olarak koru; varsayılan line-art sonucu filled outline olsun.
- [ ] `P3-015` Vektör önizlemede fill/stroke semantiğini gerçek G-code davranışıyla aynı göster.
- [ ] `P3-016` Trace kalite raporu ekle: path/node, açık yol, küçük ada, self-intersection, foreground ratio.
- [ ] `P3-017` Otomatik spike/kırık/çift yol temizliğini kayıpsız ve geri alınabilir komut yap.
- [ ] `P3-018` Vektörleştirme işlerinde aşama önizlemeleri ve iptal ekle.
- [ ] `P3-019` Büyük rasterı tile ederek işle; bellek ve maksimum çözünürlük sınırı bildir.
- [ ] `P3-020` JPG/PNG/BMP/WebP/TIFF ve SVG import davranışını tek normalize hattında test et.
- [ ] `P3-021` Yerel AI/trace model sürümü, bütünlük kontrolü ve isteğe bağlı güncelleme yöneticisi ekle.

Kabul kriterleri:

- Beyaz zemin SVG'ye path olarak yazılmaz.
- Line-art varsayılanı kapalı `fill=black`, `stroke=none`, `fill-rule=evenodd` semantiğini korur.
- Aynı ayar ve kaynak aynı işletim ortamında deterministik sonuç üretir.
- 20 MP görsel arayüzü dondurmadan işlenir veya güvenli çözünürlük önerisiyle durur.
- Regression örneği `indir (6).jpg` üzerindeki eğrilerde merdiven, spike ve anlamsız köprü metriği eşik altında kalır.

## 10. Aşama 4 - İşlem, takım yolu ve G-code modeli (P0/P1)

### Ortak işlem modeli

- [ ] `P4-001` İşlemleri tipli modele taşı: `cut`, `draw_line`, `draw_fill`, `engrave_line`, `engrave_fill`, `engrave_image`, `print_then_cut`, `ignore`.
- [ ] `P4-002` Her nesnenin bir işlem kimliğine, işlemin bir material batch'e bağlanmasını sağla.
- [ ] `P4-003` İşlem renklerini yalnız görünüm değil kimlik/metadata olarak sakla.
- [ ] `P4-004` İşlem sırası paneli ekle; drag/drop ve otomatik güvenli sıra seçenekleri sun.
- [ ] `P4-005` İç delik -> iç kontur -> dış kontur bağımlılığını DAG olarak modelle.
- [ ] `P4-006` Kesim ve kazıma çakışmasında kazımanın önce yapılmasını garanti et.

### Lazer kesim

- [ ] `P4-007` Hız, güç, pass, kerf, overcut, pierce, lead-in/out ve ramp parametrelerini işlem presetine taşı.
- [ ] `P4-008` Gücü yüzde ve GRBL `S` değeri olarak çift göster; cihazın `$30` değeriyle dönüştür.
- [ ] `P4-009` `S` değerini cihaz maksimumuna clamp et; sessiz clamp yerine uyarı göster.
- [ ] `P4-010` M3/M4 farkını cihaz capability ve `$32` durumuyla doğrula.
- [ ] `P4-011` Her rapid harekette lazerin kapalı olduğunu üretim sonrası analiz et.
- [ ] `P4-012` Kesim yönü (climb/conventional) ve başlangıç noktası optimizasyonu ekle.
- [ ] `P4-013` Ortak kenar kesimi seçeneği ve risk uyarısı ekle.
- [ ] `P4-014` Küçük parça düşme, tab önerisi ve kesim sırası risk analizi ekle.
- [ ] `P4-015` Air assist komutunu işlem bazlı ve capability-gated yap.

### Kazıma

- [ ] `P4-016` Line engraving, hatch fill ve raster engraving'i ayrı generator olarak tut.
- [ ] `P4-017` Hatch açısı, cross-hatch, scan interval ve inset seçenekleri ekle.
- [ ] `P4-018` Raster için bidirectional/unidirectional, overscan ve dönüş gecikmesi ekle.
- [ ] `P4-019` Grayscale, threshold, gamma, min/max power ve dithering seçenekleri ekle.
- [ ] `P4-020` Kısa yatay hatch parçalarını preview'da fill olarak özet gösterme seçeneği ekle; gerçek toolpath görünümü ayrıca açık kalsın.
- [ ] `P4-021` İnce filled line-art için kullanıcıya `outline`, `centerline` ve `filled hatch` sonucunu süre/kaliteyle karşılaştır.

### G-code güvenliği

- [ ] `P4-022` Header'da açıkça `G21`, `G90`, `G94` yaz.
- [ ] `P4-023` İş başlangıcında ve sonunda `S0`/laser-off güvenlik durumunu doğrula.
- [ ] `P4-024` Her `G0` sırasında efektif güç sıfır invariant'ını kontrol et.
- [ ] `P4-025` Güçlü hareket segmentlerinin tamamını kullanılabilir tabla ve malzeme polygonuna karşı doğrula.
- [ ] `P4-026` NaN, sonsuz, aşırı koordinat, sıfır/negatif hız ve unsupported komutları reddet.
- [ ] `P4-027` G-code'a generator sürümü, proje hash'i, cihaz profili ve tahmini süre metadata'sı yaz.
- [ ] `P4-028` Export öncesi geometri/toolpath fark görünümü sun.
- [ ] `P4-029` G-code import/analyze ile yeniden önizleme ve sınır karşılaştırması ekle.
- [ ] `P4-030` Küçük detaylarda daha sıkı tolerans kullanan yüksek hassasiyet toolpath modu ekle.
- [ ] `P4-031` Nesne türü x işlem türü x araç x cihaz için açık uyumluluk matrisi tanımla; geçersiz seçenekleri neden metniyle devre dışı bırak.
- [ ] `P4-032` İşlem dönüşümlerini kayıpsız ve geri alınabilir yap; uyumsuz parametre sıfırlanacaksa önce farkı göster ve onay al.
- [ ] `P4-033` Lazer gücü, blade basıncı ve pen servo/basınç parametrelerini ayrı tipli şemalara ve post-processor'lara bağla; ilgisiz kontrolü gizle.
- [ ] `P4-034` `Drawing Line` ve `Drawing Fill` için kalem çapı, renk, basınç, hız ve pass parametrelerini tipli preset yap; çizgi genişliği ile dolgu aralığını Preview ve çıktıda aynı kullan.

Kabul kriterleri:

- Güç açık hiçbir segment malzeme/tabla güvenli alanı dışında kalamaz.
- `G0` satırlarında veya rapid modal durumunda lazer açılamaz.
- Dış kontur, bağlı tüm iç kazıma ve kesimler bitmeden çalıştırılamaz.
- `M4` seçildiğinde `$32=1` değilse gönderim engellenir veya kullanıcı açıkça güvenli alternatifi seçer.
- G-code parser ile generator aynı bounds ve modal state sonucunu verir.

## 11. Aşama 5 - Malzeme, profil ve kalibrasyon sistemi (P1)

Bambu Suite yerel profilleri şu ayrımı yapıyor: malzeme -> kalınlık -> işlem türü -> cihaz/lazer watt profili. Bizim profil modelimiz de bu ayrımı açıkça taşımalı.

- [ ] `P5-001` `Material`, `MaterialVariant`, `ProcessPreset`, `DeviceOverride` şemalarını tanımla.
- [ ] `P5-002` Malzeme adı, tür, kalınlık, renk, tedarikçi, lot ve not alanlarını ekle.
- [ ] `P5-003` İşlem presetlerini kesim, çizgi kazıma, dolgu kazıma ve görüntü kazıma olarak ayır.
- [ ] `P5-004` Cihaz/lazer watt başına hız, güç, pass, air assist ve scan interval override ekle.
- [ ] `P5-005` Varsayılan katalog ile kullanıcı kataloğunu ayrı dosyalarda tut.
- [ ] `P5-006` Arama, filtre, favori, son kullanılan ve yalnız uyumlu malzeme görünümü ekle.
- [ ] `P5-007` Profil kopyala, düzenle, karşılaştır, içe/dışa aktar ve sıfırla ekle.
- [ ] `P5-008` Kullanıcı presetlerini proje içine snapshot olarak göm.
- [ ] `P5-009` Aynı projede birden çok `Material Batch` oluştur.
- [ ] `P5-010` Nesneleri batch'e toplu veya seçim bazlı ata.
- [ ] `P5-011` Her batch için malzeme, kalınlık, işlem ve cihaz uyumluluğunu doğrula.
- [ ] `P5-012` Güç/hız kalibrasyon matrisi üret: X/Y adet, min/max ve sabit parametreler.
- [ ] `P5-013` Line cut, line engrave, fill engrave ve image engrave için ayrı kalibrasyon şablonu ekle.
- [ ] `P5-014` Kalibrasyon sonucuna fotoğraf, seçilen hücre, tarih, cihaz ve malzeme lotu kaydet.
- [ ] `P5-015` Kalibrasyon geçmişini karşılaştır ve preset olarak uygula.
- [ ] `P5-016` Kerf test şablonu ve ölçülen gerçek değerden otomatik kerf hesabı ekle.
- [ ] `P5-017` X/Y steps-per-mm kalibrasyon sihirbazı ekle; mevcut/önerilen değeri göster.
- [ ] `P5-018` Steps/mm yazmadan önce cihaz ayar yedeği al ve geri alma komutu üret.
- [ ] `P5-019` Homing/pull-off/switch ayarlarını kalibrasyondan ayır; motoru sınıra sürmeyi engelle.
- [ ] `P5-020` Gri ton kalibrasyon verisini malzeme-cihaz-preset sürümüyle sakla; canvas önizlemesi ve üretilen güç eğrisi aynı LUT'u kullansın.
- [ ] `P5-021` Aktif Material Batch içinden grid test başlat, seçilen hücreyi ölçüm/notla kaydet ve preset'e izlenebilir biçimde uygula.
- [ ] `P5-022` Kullanıcı preset senkronizasyonunu isteğe bağlı ve local-first yap; sürüm/çakışma çözümü göster, yerel profili sessizce ezme.

Kabul kriterleri:

- Bir malzeme presetinin hangi cihaz ve lazer gücü için olduğu her zaman görünür.
- Yüzde güç ile GRBL `S` değeri yanlış yorumlanamaz.
- Kalibrasyon sonucu seçilmeden ana preset değişmez.
- Cihaz ayarı yazma işleminde eski ve yeni değerler loglanır, yedek olmadan yazılamaz.

## 12. Aşama 6 - Prepare, nesting ve plaka yönetimi (P0/P1)

Mevcut `packing.js` 0/90 derece döndürülen bounding-box paketleme yapıyor. Bu, para kaybettiren boşluklar ve düzensiz yerleşim için yeterli değildir. Hedef gerçek polygon nesting olmalıdır.

- [ ] `P6-001` Editör ile üretim hazırlığını ayrı `Design` ve `Prepare` çalışma alanlarına ayır.
- [ ] `P6-002` `Plate` modelini ekle: ölçü, kullanılabilir polygon, margin, malzeme batch ve koordinat sistemi.
- [ ] `P6-003` Çoklu plaka oluştur, adlandır, çoğalt, sil ve nesne taşıma ekle.
- [ ] `P6-004` `Auto Arrange` ve `Keep Design Layout` stratejilerini açık seçim yap.
- [ ] `P6-005` Mevcut rectangle packer'ı hızlı taslak modu olarak koru.
- [ ] `P6-006` Polygon/NFP tabanlı gerçek nesting worker ekle.
- [ ] `P6-007` Concave contour, holes, islands ve çoklu body için normalize polygon üret.
- [ ] `P6-008` Parça aralığı, tabla kenar payı ve kerf güvenliğini gerçek polygon offset ile uygula.
- [ ] `P6-009` İzin verilen rotasyon setini kullanıcı ve malzeme damar yönüne göre sınırla.
- [ ] `P6-010` Küçük parçaları uygun büyük parça deliklerinin içine yerleştirme seçeneği ekle.
- [ ] `P6-011` Common-line adaylarını hesapla fakat kullanıcı onayı olmadan birleştirme.
- [ ] `P6-012` Kalan malzeme polygonlarını isimle ve stok kütüphanesine kaydet.
- [ ] `P6-013` Kalan stok üzerinde nesting ve kullanılan alan hesabı ekle.
- [ ] `P6-014` Birden çok başlangıç sırası/rotasyonla çözüm ara ve en iyi skoru seç.
- [ ] `P6-015` Nesting sonucunu seed ile deterministik ve tekrar üretilebilir yap.
- [ ] `P6-016` Kullanım yüzdesi, atık alan, kesim uzunluğu, tahmini süre ve maliyet göster.
- [ ] `P6-017` Yerleşmeyen parçaları açık listede sebebiyle göster.
- [ ] `P6-018` Kullanıcı bir nesneyi kilitlediğinde nesting sırasında yerini koru.
- [ ] `P6-019` Geçersiz/çakışan yerleşimi kırmızı ve ölçülü göster.
- [ ] `P6-020` Nesting çalışırken canlı en-iyi-sonuç önizlemesi ve iptal ekle.
- [ ] `P6-021` Çoklu adetlerde instance kimliğini ve parçanın hangi plakada olduğunu raporla.
- [ ] `P6-022` Prepare'a giriş politikasını `Her seferinde sor`, `Otomatik yerleştir`, `Tasarım konumlarını koru` olarak kalıcı tercih yap; sessiz konum değişikliğini yasakla.
- [ ] `P6-023` Material Batch/Plate küçük önizlemeleri, adetleri, sıralaması ve nesneyi plakalar arasında taşıma akışı ekle.
- [ ] `P6-024` Her plate için `plane`, `rotary`, `curved` işleme modu sakla; yalnız cihaz capability'si ve uygun geometri varsa seçilebilir yap.
- [ ] `P6-025` Design -> Prepare -> Return turunda kaynak geometriyi değiştirme; plate instance transformlarını açık ve geri alınabilir ayrı katmanda tut.
- [ ] `P6-026` Isı transferi için plate/job seviyesinde Mirror ekle; kaynak Design geometrisini değiştirmeden Prepare ve Preview'da gerçek yönü göster.
- [ ] `P6-027` Auto Arrange tercihlerini kalıcı yap: aralık, minimum kullanılan alan, rotasyona izin ve malzeme şekline uyma; çözüm skorunu kullanıcıya göster.

Kabul kriterleri:

- Hiçbir polygon malzeme sınırını aşmaz ve parçalar gerçek geometri üzerinden çakışmaz.
- Aynı input, ayar ve seed aynı yerleşimi üretir.
- Rectangle taslak modundan daha kötü çözüm otomatik olarak seçilmez.
- Kullanım oranı yalnız bounding box değil gerçek kullanılabilir alan üzerinden hesaplanır.
- Yerleşmeyen parça için ölçü, gerekli alan ve başarısızlık nedeni gösterilir.

## 13. Aşama 7 - Toolpath preview ve üretim doğrulaması (P0/P1)

- [ ] `P7-001` Prepare sonrası ayrı `Preview` ekranı ekle.
- [ ] `P7-002` Travel, cut, line engrave, fill engrave ve rapid hareketleri farklı renklerle göster.
- [ ] `P7-003` İşlem ve material batch görünürlüğünü aç/kapat.
- [ ] `P7-004` Animasyonlu zaman çizelgesi, play/pause/scrub ve hız seçimi ekle.
- [ ] `P7-005` Anlık X/Y/Z, feed, power, pass ve aktif nesneyi göster.
- [ ] `P7-006` Toplam, işlem, rapid ve bekleme süresini ayrı hesapla.
- [ ] `P7-007` İşlem ve rapid mesafelerini ayrı raporla.
- [ ] `P7-008` Başlangıç noktası, parça sırası ve kontur yönü görünümü ekle.
- [ ] `P7-009` G-code modal state simülatörü ile satır bazlı preview üret.
- [ ] `P7-010` Soft-limit, tabla dışı, iş orijini ve homing durumu uyarılarını preview'da göster.
- [ ] `P7-011` Çoklu pass ve air assist/tool-change olaylarını timeline'a ekle.
- [ ] `P7-012` Tahmini süreyi gerçek iş loglarıyla kalibre eden cihaz katsayısı ekle.
- [ ] `P7-013` Preview bitmeden `Makineye Gönder` komutunu güvenlik tercihine göre sınırla.
- [ ] `P7-014` Büyük G-code preview'ını chunk/LOD ile arka planda yükle; ilerleme, iptal ve bellek sınırı sun.
- [ ] `P7-015` Preview uyarısını exact plate/nesne/segment kimliğine bağla; tek eylemle ilgili Design veya Prepare konumuna dön.

Kabul kriterleri:

- Timeline'da görülen sıra, dışa aktarılan ve makineye gönderilen sıra ile aynıdır.
- G-code analizi ile preview bounds farkı toleransın altında olur.
- Tahmini süre, doğrulanmış işler üzerinde cihaz profili başına hedeflenen hata sınırında kalır.

## 14. Aşama 8 - Doğrudan makine bağlantısı ve üretim konsolu (P0/P1)

Bu alanın temeli `laser_grbl.py` içinde mevcut. Yeniden yazmak yerine güvenli üretim konsoluna dönüştürülmelidir.

- [ ] `P8-001` Port keşfi, skor ve bağlantı sonucunu kullanıcıya anlaşılır cihaz kartı olarak göster.
- [ ] `P8-002` Bağlantı profilinde port, baud, firmware, `$30`, `$32`, tabla ve homing capability sakla.
- [ ] `P8-003` Bağlan, ayır, unlock, home, hold, resume, reset ve abort durum makinesini tekleştir.
- [ ] `P8-004` Alarm kodlarını Türkçe açıklama ve güvenli çözüm adımıyla göster.
- [ ] `P8-005` Jog sırasında basılı tutma, adımlı hareket ve soft-limit kontrolü ekle.
- [ ] `P8-006` Work origin, machine origin ve current position değerlerini ayrı göster.
- [ ] `P8-007` Frame komutunu lazer kapalı varsayılan yap; düşük güç seçimi açık onay gerektirsin.
- [ ] `P8-008` Focus pulse için süre ve güç üst sınırı, dead-man davranışı ve otomatik S0 ekle.
- [ ] `P8-009` G-code streaming'i satır numarası, ack, buffer ve retry ile görünür yap.
- [ ] `P8-010` Pause/resume sırasında modal state ve konumu doğrula.
- [ ] `P8-011` Emergency stop sonrasında otomatik devamı engelle; yeniden preflight iste.
- [ ] `P8-012` Feed/power override değerlerini hem gerçek cihaz hem UI'da senkron göster.
- [ ] `P8-013` İş kuyruğu, sıradaki iş, tekrar çalıştır ve tamamlanan iş geçmişi ekle.
- [ ] `P8-014` İş loguna proje hash'i, G-code hash'i, başlangıç/bitiş, alarm ve override kaydet.
- [ ] `P8-015` Bağlantı kopmasında güvenli duruş ve yalnız firmware destekliyorsa kontrollü recovery ekle.
- [ ] `P8-016` Gönderim öncesi `$32`, `$30`, units, distance mode ve feed mode kontrol et.
- [ ] `P8-017` Makine ayarlarını oku/yedekle/karşılaştır ekranı ekle.
- [ ] `P8-018` Homing testini lazer kapalı, düşük hız ve kullanıcı gözetimli sihirbaz yap.
- [ ] `P8-019` Limit switch'e dayandıktan sonra motor zorlamasını süre aşımıyla kes.
- [ ] `P8-020` Makine sınırına temas ile homing pull-off mesafesini karıştırmayan açıklama ve tanılama ekle.
- [ ] `P8-021` Simulator/fake GRBL ile fiziksel makine olmadan tüm konsolu test et.
- [ ] `P8-022` Seri GRBL yanında ağ/HTTP/MQTT cihazları için ortak ve sandbox'lı device-adapter arayüzü ekle.
- [ ] `P8-023` `Make/Gönder` komutunda değişmez job snapshot ve idempotency key kullan; çift tıklama aynı işi ikinci kez kuyruğa almasın.
- [ ] `P8-024` Stop/abort için ara `stopping` durumu ekle; cihaz güvenli durumu onaylayana kadar çakışan jog/send/reset komutlarını kilitle.
- [ ] `P8-025` Ağ cihazları için yerel keşif ve LAN-only IP/access-code eşleştirme akışı ekle; access code'u işletim sistemi güvenli kasasında sakla ve cloud zorunluluğu olmadan yeniden bağlan.

Kabul kriterleri:

- Alarm, E-stop veya bağlantı kaybında lazer komutu güvenli kapalı duruma gider.
- Homing sesi/limit sorunu olduğunda uygulama ayarı körlemesine değiştirmez; switch, yön, pull-off ve timeout tanısını ayrı verir.
- Stream edilen satır ile UI ilerlemesi buffer gerçeğiyle uyumludur.
- Aynı işin hangi proje ve G-code sürümüyle kesildiği sonradan doğrulanabilir.

## 15. Aşama 9 - Donanım destekli Bambu özellikleri (P2/P3)

Bu özelliklerin UI'sı yalnız cihaz capability bildiriyorsa görünmelidir.

### Kamera ve görsel hizalama

- [ ] `P9-001` Kamera kaynağı/çözünürlüğü ve canlı önizleme altyapısı ekle.
- [ ] `P9-002` Kamera lens distorsiyonu kalibrasyonu ekle.
- [ ] `P9-003` Kamera pixel -> tabla mm homography kalibrasyonu ekle.
- [ ] `P9-004` Fiducial/marker ile periyodik drift doğrulaması ekle.
- [ ] `P9-005` Canlı tabla görüntüsünü canvas altında doğru ölçek ve pozla göster.
- [ ] `P9-006` Görsel üzerinden seçilen nesneyi gerçek tabla pozuna hizala.
- [ ] `P9-007` Kamera doğruluk tahmini ve kalibrasyon eskidi uyarısı göster.

### Batch vision ve kalan malzeme

- [ ] `P9-008` Kamera görüntüsünden bağımsız parça/boş alan segmentasyonu ekle.
- [ ] `P9-009` Tespit edilen benzer parçalara desen kopyalama ve pose eşleme ekle.
- [ ] `P9-010` Bilgisayarlı görü sonucunu kullanıcı onayından önce G-code'a katma.
- [ ] `P9-011` Kalan malzeme sınırını kameradan öner; kullanıcı düzenleyebilsin.

### Eğri yüzey ve rotary

- [ ] `P9-012` Height map/3D point cloud import ve ölçüm arayüzü ekle.
- [ ] `P9-013` XY toolpath üzerine kontrollü Z kompanzasyonu uygula.
- [ ] `P9-014` Z hareket/ivme/sınırlarını cihaz profiliyle doğrula.
- [ ] `P9-015` Rotary cihaz profili, çap ve çevre dönüşümü ekle.
- [ ] `P9-016` Rotary wrap preview ve seam konumu ayarı ekle.
- [ ] `P9-017` Çap kalibrasyonu ve gerçek ölçüm düzeltmesi ekle.

### Çoklu araç ve güvenlik donanımı

- [ ] `P9-018` Laser/blade/pen için ortak `ToolCapability` modeli ekle.
- [ ] `P9-019` Blade basınç, hız, pass ve bıçak ofseti desteği ekle.
- [ ] `P9-020` Pen çizim basıncı/servo ve fill pattern desteği ekle.
- [ ] `P9-021` Çoklu işlemde pause + tool-change yönergesi ve yeniden hizalama ekle.
- [ ] `P9-022` Air assist, exhaust, door, flame ve emergency sensor plugin arayüzü ekle.
- [ ] `P9-023` Kapı/alev alarmını bypass edilemeyen safety interlock olarak modelle.
- [ ] `P9-024` Cihaz/tabla/material tanımını QR/CodeSync benzeri yerel kodla yükleme ekle.
- [ ] `P9-025` Çizim matı kalibrasyonu ve blade/pen uç-ofset optimizasyon sihirbazı ekle.
- [ ] `P9-026` Blade uç-ofset optimizasyonunu cihaz/bıçak profiline bağla; köşe telafisini Preview'da gerçek takım yolu olarak göster.
- [ ] `P9-027` Rotary canvas genişletme ve çap düzeltme katsayısını proje/profilde sakla; unwrap ölçüsü ile fiziksel çevre farkını uyar.
- [ ] `P9-028` Rotary için canlı açı izleme, yataylama ve kamera tabanlı WYSIWYG hizalama ekranı ekle.
- [ ] `P9-029` BirdsEye kamera initialization/readiness durumunu göster; fotoğraf çekme ve tespit edilen kullanılabilir alana otomatik yerleştirmeyi ayrı onayla uygula.
- [ ] `P9-030` Prepare içinde `Capture Image` işi oluştur; normal ve `Fine Contour Extraction` yollarında ilerleme, iptal, kalite skoru ve kalibrasyon geçerliliğini göster.
- [ ] `P9-031` `Batch Engrave` akışını tamamla: yakalanmış görüntüdeki parçaları seç, tek deseni her parçanın pozuna eşle, çakışmayı göster ve kullanıcı onayından sonra plate instance üret.
- [ ] `P9-032` Kamera ile bulunan gerçek malzeme polygonunu Auto Arrange sınırı olarak kullan; güven düşükse dikdörtgen tabla sınırına sessizce düşme, manuel düzeltme iste.

Kabul kriterleri:

- Kamera kalibrasyonu olmadan görüntüye göre otomatik G-code üretilemez.
- Vision tespiti her zaman kullanıcıya düzenlenebilir geometri olarak gösterilir.
- Curved/rotary/tool özellikleri desteklemeyen GRBL profillerinde görünmez ve G-code'a sızmaz.
- Donanım güvenlik alarmı yazılım override'ı ile geçilemez.

## 16. Aşama 10 - Kütüphane, paylaşım ve ürün deneyimi (P2)

- [ ] `P10-001` Yeni proje ana ekranına son projeler, şablonlar ve cihaz durumu ekle.
- [ ] `P10-002` Şekil, desen, çerçeve, font ve örnek proje kütüphanesi ekle.
- [ ] `P10-003` Varlık etiketi, kategori, arama, favori ve lisans metadata'sı ekle.
- [ ] `P10-004` Kullanıcı kütüphanesini proje dosyalarından bağımsız yönet.
- [ ] `P10-005` Malzeme, işlem, cihaz ve uygulama ayarlarını ayrı import/export et.
- [ ] `P10-006` Proje paketini kaynaklar, profil snapshotları ve önizlemeyle tek arşiv olarak paylaş.
- [ ] `P10-007` İlk kullanım turu ve bağlama duyarlı kısa yardım ekle.
- [ ] `P10-008` Her kontrol için tooltip; teknik terimler için kısa açıklama ekle.
- [ ] `P10-009` Güncelleme kontrolü ve sürüm notları ekle.
- [ ] `P10-010` Tanılama paketi oluştur; kişisel dosyaları dahil etmeden önce listele.
- [ ] `P10-011` Klavye, yüksek DPI, farklı pencere boyutları ve erişilebilir kontrast desteği ekle.
- [ ] `P10-012` UI'da ana akışı sade tut: Ekle -> Düzenle -> İşlem -> Yerleştir -> Önizle -> Üret.
- [ ] `P10-013` Kalıcı bildirim merkezi ekle; hata/uyarı/iş tamamlandı kayıtları, zaman, ilgili nesne ve çözüm eylemi taşısın.
- [ ] `P10-014` Destek merkezine log/yapılandırma klasörünü aç, sürüm/lisans/gizlilik bilgisi, güncelleme durumu ve güvenli tanılama export'u ekle.
- [ ] `P10-015` İlk çalıştırma sihirbazında dil, birim, basit/uzman mod, cihaz profili, tabla ve zorunlu lazer güvenlik kontrolünü tamamlat.

## 17. Önerilen teknik mimari

Mevcut teknoloji korunmalı; yalnız sorumluluklar ayrılmalıdır.

### İstemci katmanları

- `document/`: Proje, nesne, grup, seçim ve command/undo modeli.
- `canvas/`: Render, viewport, grid, ruler, snap, hit-test ve transform gizmosu.
- `tools/`: Select, shape, pen, text, QR, node, offset, Boolean, array ve tab araçları.
- `operations/`: Kesim/kazıma işlemleri, preset bağları ve işlem sırası.
- `prepare/`: Plate, batch, nesting, kullanılabilir alan ve maliyet özeti.
- `preview/`: Toolpath parser, timeline, filtreler ve animasyon.
- `machine/`: GRBL durum makinesi ve güvenli üretim konsolu.
- `project/`: Save/open/autosave/recovery/migration/recent projects.
- `ui/`: Paneller, dialoglar, command palette, toast ve preferences.

### Sunucu/çekirdek katmanları

- `geometry_service`: DXF/SVG parse, normalize, polygon repair, offset ve Boolean.
- `vectorize_service`: OpenCV/Potrace/VTracer işleri ve kalite raporu.
- `nesting_service`: Rectangle hızlı çözüm + polygon/NFP kaliteli çözüm.
- `toolpath_service`: İşlem grafiği, sıra, compensation ve optimizer.
- `gcode_service`: Cihaz post-processor, modal state ve final validator.
- `material_service`: Katalog, preset, calibration ve migration.
- `job_service`: Background iş, progress, cancel, cache ve tanılama.
- `device_service`: GRBL bağlantısı, stream, capability ve iş geçmişi.

### Kütüphane yaklaşımı

- DXF: mevcut `ezdxf` tabanı korunmalı.
- Raster/vision: OpenCV ve NumPy korunmalı.
- Trace: Potrace/VTracer temiz binary maske sonrasında motor olarak kullanılmalı.
- Polygon işlemleri: GEOS/Shapely ve gerektiğinde integer Clipper2/pyclipper ile sağlamlaştırılmalı.
- SVG path parse/curve: mevcut parser eksikleri ölçülüp `svgpathtools` benzeri olgun bir katmanla tamamlanmalı.
- Font: `fontTools`; QR: standart uyumlu `qrcode`/ZXing doğrulaması.
- Seri cihaz: mevcut `pyserial` katmanı korunmalı; tek durum makinesinden yönetilmeli.
- Nesting: gerçek polygon No-Fit-Polygon motoru ayrı worker olmalı; algoritma uygulama ana thread'inde çalışmamalı.

Not: Kütüphane seçimi test fixture'ları üzerinden yapılmalı. Bir kütüphane eklemek tek başına özellik tamamlandı anlamına gelmez.

## 18. Hedef veri modeli

### Project

- `schemaVersion`, `projectId`, `name`, `createdAt`, `updatedAt`
- `document`, `operations`, `materials`, `batches`, `plates`
- `deviceProfileRef`, `assets`, `preferences`, `projectInfo`
- `generatorVersion`, `sourceHashes`, `previewThumbnail`

### DocumentObject

- `id`, `sourceId`, `type`, `name`, `parentId`, `children`
- `transform`, `geometryRef`, `style`, `operationId`
- `visible`, `locked`, `zIndex`, `metadata`

### Operation

- `id`, `type`, `name`, `color`, `enabled`, `order`
- `presetRef`, `parameters`, `tool`, `batchId`
- `constraints`, `dependencies`, `deviceOverrides`

### Plate

- `id`, `name`, `widthMm`, `heightMm`, `usablePolygon`
- `marginMm`, `materialBatchId`, `instances`, `lockedInstances`
- `layoutStrategy`, `nestingSeed`, `statistics`

### DeviceProfile

- `protocol`, `firmware`, `bed`, `axes`, `units`
- `maxPowerS`, `laserMode`, `homing`, `softLimits`
- `tools`, `camera`, `rotary`, `airAssist`, `safetySensors`
- `postProcessor`, `streamingCapabilities`

## 19. Test stratejisi

### Birim ve özellik tabanlı testler

- [ ] `T-001` DXF/SVG import birim ve bounds testlerini genişlet.
- [ ] `T-002` Transform compose/inverse için property-based test ekle.
- [ ] `T-003` Polygon offset/Boolean/nesting için rastgele geometri testleri ekle.
- [ ] `T-004` Açık/kırık/self-intersecting SVG/DXF fuzz corpus oluştur.
- [ ] `T-005` G-code modal state ve güvenlik invariant testlerini property-based yap.
- [ ] `T-006` Project v2/v3 migration ve round-trip testleri ekle.
- [ ] `T-007` Autosave crash recovery integration testi ekle.
- [ ] `T-008` Background job cancel/race/stale-result testleri ekle.
- [ ] `T-009` Material/device override çözümleme testleri ekle.
- [ ] `T-010` GRBL alarm, disconnect, E-stop ve buffer simülasyonlarını genişlet.

### Görsel ve uçtan uca testler

- [ ] `T-011` Playwright ile ana kullanıcı akışlarını otomatikleştir.
- [ ] `T-012` 1366x768, 1920x1080 ve yüksek DPI ekranlarda screenshot regression ekle.
- [ ] `T-013` Grid/tabla/nesne ölçü renderını pixel + geometri birlikte doğrula.
- [ ] `T-014` Import -> edit -> nest -> preview -> G-code uçtan uca testi ekle.
- [ ] `T-015` Altı parçalı kutu ve çok adetli yerleşim gerçek proje fixture'ı ekle.
- [ ] `T-016` Photo -> vector -> engrave ve SVG -> cut akışlarını ayrı test et.
- [ ] `T-017` Forced server kill ve browser refresh sonrası recovery testi ekle.

### Makine üstü doğrulama

- [ ] `T-018` Lazer kapalı dry-run protokolü tanımla.
- [ ] `T-019` 10/50/100/200 mm X/Y ölçü kalibrasyon test plakası oluştur.
- [ ] `T-020` Kerf, karelik, daire, backlash ve tekrarlanabilirlik test plakası oluştur.
- [ ] `T-021` Homing/limit testi için mekanik gözetim checklist'i oluştur.
- [ ] `T-022` Her firmware/cihaz profili için onaylı ayar yedeği tut.
- [ ] `T-023` Güçlü hareket bounds raporunu kesim öncesi operatöre göster.
- [ ] `T-024` Parite envanterindeki her Bambu komutu için karşılık/capability/test/kanıt alanlarının dolu ve görev kimliklerinin benzersiz olduğunu CI'da doğrula.
- [ ] `T-025` Çoklu proje autosave/undo/worker yalıtımı ile dosya seçici ve üretim komutlarının çift tıklama idempotency testlerini ekle.
- [ ] `T-026` Nesne-işlem-araç uyumluluk, işlem dönüşümü ve bütünlüklü üretim paketi round-trip/tamper testlerini ekle.
- [ ] `T-027` Prepare giriş stratejileri, Design round-trip, kalibre gri ton LUT'u ve rotary/blade capability gating için uçtan uca fixture ekle.
- [ ] `T-028` Barcode, Pencil, üç noktalı yay, merkez noktalı yay ve shear için kısayol/fare/save-open/undo round-trip testleri ekle.
- [ ] `T-029` `.lac` eşdeğeri proje paketi için yarım yazma, bozuk manifest, eksik asset, kilit ve crash-recovery testleri ekle.
- [ ] `T-030` Drawing Line/Fill kalem çapı-basınç-dolgu aralığı Preview ve post-processor eşitlik testleri ekle.
- [ ] `T-031` Referans katmanlarının bounds, nesting, sayaç, export ve G-code'u değiştirmediğini test et.
- [ ] `T-032` Capture Image, Fine Contour, kamera Auto Arrange ve Batch Engrave için kayıtlı kamera fixture'larıyla donanımsız entegrasyon testi ekle.
- [ ] `T-033` LAN keşfi, yanlış access code, bağlantı kaybı, credential storage ve yeniden eşleştirme durumlarını fake ağ cihazıyla test et.
- [ ] `T-034` Tercihlerin uygulama/proje kapsamı, yeniden başlatma round-trip'i ve eski sürüm migration'ı için otomatik test ekle.

## 20. Performans hedefleri

- Belge açılışı: tipik projede 2 saniyenin altında.
- Pointer/drag render: hedef 60 FPS, ağır belgede 30 FPS altına düşmemeli.
- UI ana thread bloklama: tek görevde 100 ms üzerinde olmamalı.
- Undo/redo: tipik komutta 100 ms altında.
- Autosave: kullanıcı etkileşimini durdurmamalı.
- 1000 nesneli seçim ve görünürlük değişimi: 250 ms altında.
- Nesting: ilk geçerli çözümü hızlı gösterip kaliteli aramayı arka planda sürdürmeli.
- Preview: milyon satırlı G-code'u chunk/level-of-detail ile açabilmeli.

## 21. İlk uygulanacak 25 iş

Bu sıra, yeni özellik eklerken mevcut iyi noktayı bozmamak için önerilen başlangıçtır:

1. `P0-001` Çalışan sürüm checkpoint/tag.
2. `P0-002` Regression fixture seti.
3. `P0-004` Tek mm/koordinat sözleşmesi.
4. `P0-006` Kaynak ve instance kimliği.
5. `P0-008` Türetilmiş sayaçlar.
6. `P0-009` Tabla/viewport ayrımı.
7. `P0-014` Background job sistemi.
8. `P0-017` Stale response koruması.
9. `P0-020` Merkezi preflight.
10. `P1-002` Dirty state göstergesi.
11. `P1-003` Autosave.
12. `P1-005` Crash recovery.
13. `P1-008` Proje şeması v3.
14. `P2-001` Ortak belge nesnesi.
15. `P2-002` Nesne ağacı.
16. `P2-011` Sayısal transform.
17. `P2-012` Hizalama.
18. `P2-017` Snap sistemi.
19. `P4-001` Tipli işlem modeli.
20. `P5-001` Malzeme/preset şeması.
21. `P6-001` Design/Prepare ayrımı.
22. `P6-002` Plate modeli.
23. `P6-006` Polygon nesting worker.
24. `P7-001` Ayrı Preview ekranı.
25. `P8-021` Fake GRBL simulator.

## 22. Sürüm kapıları

### Kapı A - Güvenilir temel

- P0 ve proje kurtarma tamamlanmış olmalı.
- Bilinen tabla/ölçek/sayaç/stale response bugları regression testine dönüşmüş olmalı.
- G-code güvenlik invariantları kesintisiz geçmeli.

### Kapı B - Editör eşdeğerliği

- Nesne ağacı, gruplama, hizalama, offset, array, Boolean ve node editörü tamamlanmış olmalı.
- Görsel işlem non-destructive ve iptal edilebilir olmalı.
- Tüm temel editör işlemleri undo/redo desteklemeli.

### Kapı C - Üretim eşdeğerliği

- Malzeme/batch/plate modeli, polygon nesting, Prepare ve timeline Preview tamamlanmış olmalı.
- Aynı proje birden fazla malzeme ve plaka ile güvenli üretilebilmeli.
- Tahmini süre, sınır ve işlem sırası dışa aktarılan G-code ile eşleşmeli.

### Kapı D - Makine ürünü

- GRBL konsolu fake cihaz ve gerçek cihaz testlerinden geçmeli.
- Alarm/E-stop/disconnect senaryoları güvenli kapanmalı.
- İş geçmişi, proje ve G-code hash'iyle izlenebilir olmalı.

### Kapı E - Donanım destekli eşdeğerlik

- Kamera, rotary, curved surface, blade/pen ve güvenlik sensörleri capability plugin olarak tamamlanmalı.
- Desteklenmeyen donanım özelliği standart GRBL akışını etkilememeli.

## 23. Tamamlanmış sayılma tanımı

Uygulama, aşağıdaki koşulların tamamı sağlanmadan “Bambu Suite eşdeğeri” sayılmamalıdır:

- Kullanıcı bir kaynağı içe aktarıp düzenleyebilir, işlem atayabilir, malzemeye yerleştirebilir, önizleyebilir ve makineye güvenle gönderebilir.
- Kaydetme, yeniden açma, çökme ve güncelleme durumlarında geometri veya ayar kaybı olmaz.
- Her nesne, işlem, batch ve plakanın ilişkisi UI'da açıkça görülebilir.
- Uzun işlemler arayüzü dondurmaz ve iptal edilebilir.
- Yerleşim gerçek polygon üzerinden yapılır ve alan kullanımını doğru raporlar.
- Preview ile gönderilen G-code aynı hareket, güç, sıra ve sınırları temsil eder.
- Makine alarmı, E-stop, bağlantı kaybı ve limit durumlarında lazer güvenli kapanır.
- Donanım destekli özellikler capability ile yönetilir; varmış gibi taklit edilmez.
- Tüm çekirdek özellikler otomatik test, golden fixture ve en az bir gerçek makine dry-run kanıtına sahiptir.

## 24. Sonuç

Mevcut uygulama sıfırdan başlanacak bir prototip değildir. Güçlü bir DXF/SVG işleme çekirdeği, gelişmiş vektör hattı, güvenlik kontrolleri ve doğrudan GRBL bağlantısı vardır. Bambu Suite seviyesine ulaşmak için en kritik çalışma yeni bir tracer eklemek değil; belge/proje mimarisini güvenilir hale getirmek, standart editör araçlarını tamamlamak, üretim modelini material-batch-plate yapısına taşımak ve polygon nesting + Prepare + Preview zincirini kurmaktır.

Bu yol haritasında ikinci uygulama içi denetimde görülen işlevler dahil hiçbir Bambu Suite işlev sınıfı bilerek dışarıda bırakılmamıştır. Donanım gerektirenler, mevcut GRBL makinesinin güvenli akışını bozmadan capability-gated faza ayrılmıştır. Kamera yakalama, Batch Engrave ve gerçek Bambu cihazına gönderim bağlı donanım olmadan uçtan uca çalıştırılmış sayılmaz; bu sınır denetim raporunda ayrıca kayıtlıdır.
