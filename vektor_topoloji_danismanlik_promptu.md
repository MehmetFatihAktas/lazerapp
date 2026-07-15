# Lazer CAD/CAM Fotoğraf → Vektör ve Semantik Topoloji Denetimi

## Rolün

Kıdemli bir **hesaplamalı geometri, görüntü işleme, CAD/CAM, vektör editörü ve lazer takım yolu** mühendisi olarak davran. Bu projeyi yalnız ekran görüntülerine bakarak yorumlama. Depodaki güncel çalışma ağacını, commit edilmemiş değişiklikleri, veri modellerini, Python vektörleştirme hattını, Canvas çizimini, düzenleme araçlarını ve G-code üretim yolunu birlikte incele.

Bu aşamada doğrudan geniş çaplı kod değişikliği yapma. Önce kanıta dayalı teknik denetim, kök neden analizi ve uygulanabilir mimari öneri hazırla. Bir önerinin işe yaradığını yalnız tek görsel üzerinde güzel göründüğü için kabul etme; farklı çizim sınıflarında genellenebilirliğini ve lazer çıktısı güvenliğini açıklamak zorundasın.

## Proje Konumu

```text
C:\Users\mehme\Documents\Laser kesim
```

Git deposu:

```text
https://github.com/MehmetFatihAktas/lazerapp.git
```

Önce şu komutlarla güncel durumu denetle:

```powershell
git status -sb
git diff --stat
git diff --check
git log --oneline -15
```

Çalışma ağacında commit edilmemiş geliştirmeler olabilir. Kullanıcının değişikliklerini geri alma, üzerine körlemesine yazma veya `git reset --hard` kullanma.

## Ürünün Genel Amacı

Uygulama, üretim odaklı bir lazer CAD/CAM editörüdür. Temel akış:

1. DXF parçası veya raster/SVG desen ekleme.
2. Raster görseli lazer için vektörleştirme.
3. Vektör konturlarını seçme, silme, taşıma, ölçekleme, deformasyon ve operasyon atama.
4. DXF sınırı, kenar payı ve özel tabla alanına göre kırpma/yerleştirme.
5. `cut`, `engrave_line`, `engrave_fill`, `ignore` operasyonlarıyla G-code üretme.
6. GRBL cihazına seri port üzerinden çerçeve, iş sıfırı, jog ve güvenli G-code gönderme.

Bu denetimin ana konusu fotoğraf → vektör hattı ile **semantik nesne/topoloji ayrımıdır**. Ancak önerilen çözüm; editör, proje dosyası ve G-code veri akışıyla uyumlu olmalıdır.

## Teknoloji ve Ana Dosyalar

Frontend vanilla HTML/CSS/JavaScript ve Canvas 2D kullanır:

```text
laser_editor/index.html
laser_editor/style.css
laser_editor/app.js
laser_editor/geometry.js
laser_editor/packing.js
laser_editor/vector_edit.js
```

Backend Python HTTP sunucusu ve geometri motorudur:

```text
laser_editor_server.py
laser_editor_core.py
dxf_to_laser_gcode.py
laser_grbl.py
```

Başlıca testler:

```text
test_vectorize_pipeline.py
test_vector_edit.js
test_packing.js
test_laser_grbl.py
```

Çalıştırma:

```powershell
node --check laser_editor/app.js
node test_vector_edit.js
node test_packing.js
python test_vectorize_pipeline.py
python test_laser_grbl.py
```

Yerel sunucu normalde:

```text
http://127.0.0.1:8766/
```

## Mevcut Fotoğraf → Vektör Modları

Frontend `laser_editor/app.js` içinde profesyonel modlar bulunur:

- `cad-line-art`: CAD tek çizgi ve dış/iç operasyon sınıflandırması.
- `cut-stencil`: Kesim şablonu.
- `line-engrave`: Çizgi kazıma.
- `filled-ornament`: Dolgu motif.
- `photo-engrave`: Raster gri ton gravür.

Sunucu `laser_editor_server.py` içinde ürün modunu motor moduna çevirir:

- `cad_line_art` → `cad_centerline`
- `cut_template` → `auto`
- `line_engrave` → `centerline`
- `fill_motif` → `potrace`
- `photo_engrave` → raster gravür yolu

Ana Python giriş noktası:

```python
laser_editor_core.vectorize_image(...)
```

CAD tek çizgi hattında şu işlemler bulunmaktadır veya son geliştirmelerde denenmiştir:

1. Görsel açma ve yüksek çözünürlüklü izleme.
2. Otsu/manual/adaptive threshold ve binary maske.
3. Arka plan, gürültü, morfolojik kapatma/açma seçenekleri.
4. Temiz çizim profili tespiti.
5. CAD çizimlerinde en fazla yaklaşık `4×`, `4800 px` izleme.
6. `thin_binary()` ile iskelet çıkarma.
7. İskeleti düğüm/kenar grafiği olarak açık ve kapalı polyline'lara çevirme.
8. Gerçek kavşak noktalarını smoothing sırasında koruma.
9. Nokta/göz gibi küçük dolu ayrıntıları koruma.
10. Uzun düz çizgileri düzleştirme ve eğrileri yumuşatma.
11. Açık uç boşluğu kapatma, stitch/snap ve çeşitli yakınlık birleştirme deneyleri.
12. Dış/iç bölge sınıflandırması ve operasyon ataması.

İncelenecek kritik fonksiyonlar arasında şunlar vardır:

```text
thin_binary
_skeleton_neighbors
prune_skeleton_spurs
trace_skeleton_vectors
stitch_raw_point_paths
stitch_open_vector_paths
snap_open_vector_endpoints_to_paths
weld_open_endpoints
merge_coincident_open_paths
fill_centerline_micro_holes
centerline_dense_junction_holes
preserve_centerline_dot_components
straighten_centerline_paths
flatten_axis_aligned_centerline_runs
polish_centerline_curves
classify_vector_region_boundaries
```

Fonksiyon adlarının mevcut olması, hepsinin üretim hattında aktif veya doğru olduğu anlamına gelmez. Çağrı zincirini doğrula.

## Mevcut Vektör Veri Modeli

Rasterdan çıkan desen yaklaşık olarak şu yapıda tutulur:

```json
{
  "kind": "vector",
  "sourcePath": "...",
  "sourceWidth": 1254,
  "sourceHeight": 1254,
  "vectorPaths": [
    {
      "id": "v42",
      "points": [[10.2, 20.1], [11.0, 21.4]],
      "closed": false,
      "removed": false,
      "length": 42.5,
      "area": 0,
      "sourceComponentId": 123,
      "operation": "engrave_line",
      "warnings": []
    }
  ],
  "settings": {},
  "stats": {}
}
```

Editörde konturlar ayrı ayrı seçilebilir. Bazı konturlar:

- `cut`, `engrave_line`, `engrave_fill` veya `ignore` yapılabilir.
- Silinebilir veya geri getirilebilir.
- Kilitlenebilir.
- Deformasyona açık/kapalı yapılabilir.
- Yerel olarak düzeltilebilir veya yeniden çizilebilir.
- mm cinsinden taşınabilir.

Ancak `vectorPaths` bugün çoğunlukla **iskelet grafiğinin teknik parçalarıdır**. Bir kullanıcının algıladığı “çiçek”, “dal”, “kuş”, “kalp” veya “yazı” gibi semantik nesneleri temsil etmez.

Bu fark, denetimin merkezindeki problemdir.

## Ana Problem 1: Kuş Ayaklarında Yanlış Topoloji

Referans kaynak:

```text
C:\Users\mehme\Downloads\deaddf14-fadb-4a14-b779-aebd3de433c0.png
```

Yakın plan hata ekranları:

```text
C:\Users\mehme\AppData\Local\Temp\codex-clipboard-dacdeb43-05d7-4a03-a7ac-80364dc1f422.png
C:\Users\mehme\AppData\Local\Temp\codex-clipboard-5f5dbdff-95ca-4518-81d8-5a6339bf30c0.png
C:\Users\mehme\AppData\Local\Temp\codex-clipboard-504502c3-5b9b-498a-b670-a9e1ff472464.png
C:\Users\mehme\AppData\Local\Temp\codex-clipboard-dbedfd3b-0fe8-4fc8-878e-9e9ffab36c3b.png
```

Gözlenen sorunlar:

- Yakın iki çizgi yanlışlıkla aynı kavşakta birleştiriliyor.
- Ayak/parmak gibi mikro ayrıntılarda açık yollar başka bir yola snap ediliyor.
- Genel endpoint weld/stitch kuralları semantik olarak ayrı çizgileri birleştirebiliyor.
- Global simplify ayrıntıyı bozuyor; yalnız çözünürlük artırmak da semantik hatayı çözmüyor.
- Kaynak raster önizlemesi ile gerçek vektörün Canvas'ta karışması teşhisi zorlaştırabiliyor.
- Tek örneğe göre eşik değiştirmek başka dosyada gerçek bağlantıları koparabilir.

Son denemelerde CAD izleme `4800 px / yaklaşık 4×` seviyesine çıkarılmış, zoom sırasında gerçek vektör önizlemesi iyileştirilmiş ve kısa mikro yollarda yakınlık kaynaklaması kısıtlanmıştır. Bunların yeterli olduğunu varsayma; gerçek dosyada ölçerek doğrula.

## Ana Problem 2: Dalın Çiçeğin İçine Devam Etmesi

Kullanıcı açısından ayrı iki nesne vardır:

1. Dal/gövde.
2. Dalın üzerinde duran çiçek.

Raster çizimde dal çizgisi çiçeğe temas eder veya çiçeğin merkezine kadar devam eder. İskelet çıkarıldığında bunlar tek bağlı grafik hâline gelir. Sonuç olarak:

- Dal kenarı veya merkez çizgisi çiçeğin içine kadar uzar.
- Bir veya birkaç `vectorPath` hem dala hem çiçeğe ait noktalar taşır.
- Çiçeği tek başına seçmek mümkün olmaz.
- Çiçek bağımsız büyütülüp küçültülemez.
- Çiçek taşındığında dalın bir kısmı da hareket eder veya çiçekten dal parçası kalır.
- Operasyon atama ve kontur kilitleme kullanıcı beklentisiyle uyuşmaz.
- G-code sırasında gereksiz iç çizgi veya yanlış geçiş oluşabilir.

Bu yalnız çiçeğe özgü değildir. Aynı sınıf şu örneklerde oluşabilir:

- Dala bağlı yaprak.
- Gövdeye bağlı kalp.
- Kuş ayağının dala temas etmesi.
- Harfin alt çizgiye temas etmesi.
- Süs motifinin çerçeveye bağlanması.
- Birbirine temas eden iki tekrar motif.

Sorunun kökü “hangi piksel siyah?” sorusu değildir. Kök sorun, **tek bir geometrik grafikten kullanıcı tarafından düzenlenebilir semantik nesnelerin nasıl çıkarılacağıdır**.

## İstenen Kullanıcı Davranışı

Varsayılan otomatik sonuç mümkün olduğunca doğru olmalı; fakat belirsiz semantik durumlarda kullanıcıya güvenilir düzeltme aracı sunulmalıdır.

Örnek dal + çiçek için kullanıcı şunları yapabilmeli:

1. Çiçeğe tıklayıp tamamını tek nesne olarak seçebilmek.
2. “Nesneye ayır” veya benzeri bir komutla çiçeği daldan ayırabilmek.
3. Ayrım sınırını/bağlantı noktasını gerekirse bir veya iki tıklamayla gösterebilmek.
4. Çiçeği bağımsız ölçekleyebilmek, taşıyabilmek, döndürebilmek ve kilitleyebilmek.
5. Dalın çiçek altında kalan kısmı için açık bir politika seçebilmek:
   - Dal çiçek altında devam etsin fakat çiçek nesnesine ait olmasın.
   - Dal çiçek sınırında kesilsin.
   - Kesişimde ortak düğüm korunsun.
6. İşlem geri alınabilir olmalı ve proje dosyasına kaydedilmelidir.
7. Geometri ayrımı G-code'da fazladan hayalet çizgi üretmemelidir.

## Danışmandan Beklenen Ana Teknik Karar

Aşağıdaki soruyu açık ve savunulabilir biçimde cevapla:

> Raster iskelet grafiğini doğrudan `vectorPaths` listesine çevirmek yerine, grafik düğümleri/kenarları ile kullanıcı nesneleri arasında hangi ara temsil kullanılmalıdır?

Şu seçenekleri değerlendir; yalnız isimlerini sıralama, bu proje için artı/eksi ve uygulanabilirliklerini karşılaştır:

1. Skeleton graph + articulation/cut vertex analizi.
2. Cycle basis ve kapalı motif çıkarımı.
3. Region adjacency graph.
4. Stroke width transform ve medial-axis sahipliği.
5. Kontur + merkez çizgi hibrit modeli.
6. Bağlantı noktalarında açı, eğrilik ve kalınlık sürekliliği.
7. Tekrarlanan motif/simetri ipuçları.
8. Görüntü segmentasyonu veya instance segmentation.
9. Kullanıcı seed/işaretleme destekli graph cut.
10. Lasso/marquee ile seçilen alanın grafikten ayrılması.
11. Junction-cut aracı: kullanıcının bir kavşağı keserek iki nesne oluşturması.
12. Birden fazla nesnenin aynı geometrik anchor'ı paylaşabildiği sahiplik modeli.

Tam otomatik semantik tanımanın çizgi resimlerinde her zaman güvenilir olmadığını kabul et. En iyi çözümün otomatik öneri + kullanıcı onayı kombinasyonu olup olmadığını değerlendir.

## Önerilecek Veri Modeli İçin Gereksinimler

Mevcut `vectorPaths` modelinin yanına veya üstüne örneğin şu kavramların gerekip gerekmediğini değerlendir:

```json
{
  "vectorGraph": {
    "nodes": [],
    "edges": []
  },
  "vectorObjects": [
    {
      "id": "object-flower-1",
      "name": "Çiçek 1",
      "edgeIds": [],
      "pathFragments": [],
      "anchors": [],
      "transform": {},
      "locked": false,
      "operation": "engrave_line",
      "confidence": 0.82,
      "createdBy": "auto|user"
    }
  ]
}
```

Şunlara açık cevap ver:

- Bir path iki nesneye temas ediyorsa nereden fiziksel olarak bölünecek?
- Ortak anchor kime ait olacak?
- Nesne ölçeklenince ortak anchor nasıl davranacak?
- Dal altta devam edecekse çiçek maskesiyle nasıl gizlenecek veya kırpılacak?
- Editör transformları kaynak koordinatında mı, nesne koordinatında mı tutulacak?
- G-code üretmeden önce graph/object modeli tekrar düz polyline takım yollarına nasıl çevrilecek?
- Eski `.laserjob.json` dosyaları nasıl geriye dönük açılacak?
- Undo/redo snapshot'ları yeni modeli nasıl taşıyacak?

## Otomatik Ayırma İçin Değerlendirilecek Heuristikler

Dal + çiçek örneğinde aşağıdaki sinyallerin birlikte kullanılıp kullanılamayacağını incele:

- Çiçek çoğunlukla kapalı çevrimlerden oluşur.
- Dal daha uzun, açık ve düşük eğrilikli bir ana yoldur.
- Çiçek-dal birleşiminde stroke yönü/eğriliği ani değişir.
- Dalın teğet devamlılığı çiçek içindeki çizgiden daha güçlü olabilir.
- Çiçek bir lokal bounding box içinde yoğun çevrim ve çoklu petal içerir.
- Kavşak kaldırıldığında oluşan alt grafiklerin kompaktlık, çevrim sayısı ve alan oranları farklıdır.
- Bir alt grafik ölçeklendiğinde bağlantı sınırında kaç anchor kalacağı ölçülebilir.

Ancak `if flower` veya kuş ayağı koordinatlarına özel kurallar önermemelisin. Çözüm yaprak, harf, kalp ve süs motifinde de çalışmalıdır.

## Kullanıcı Destekli Ayırma Aracı İçin UX İsteği

Tam otomatik ayrım güvenilir değilse şu iş akışını tasarla:

1. Kullanıcı “Nesne Ayır” aracını seçer.
2. Çiçeğin içine veya çevresine tıklar/lasso çizer.
3. Sistem seçilen bölgedeki graph edge'lerini vurgular.
4. Şüpheli junction noktaları farklı renkte gösterilir.
5. Kullanıcı bağlantıları koru/kes durumunu tek tıkla değiştirir.
6. Canlı önizlemede “Dal”, “Çiçek” gibi iki bağımsız grup görünür.
7. Onay sonrası iki `vectorObject` oluşur.
8. İşlem Ctrl+Z ile geri alınabilir.

Araç profesyonel CAD mantığında olmalı; serbest el boyama gibi belirsiz çalışmamalı. Hover/snap göstergesi, mm readout ve seçili graph edge vurgusu bulunmalıdır.

## Kesinlikle Kaçınılacak Yaklaşımlar

- Yalnız global `simplify` değerini artırmak.
- Bütün resmi blur ederek küçük ayrıntıları yok etmek.
- Tüm yakın endpoint'leri mesafe eşiğiyle birleştirmek.
- “Kuş ayağıysa farklı davran” gibi içerik/koordinat hardcode'u.
- Tek kaynak görselde iyi görünen sabit piksel eşikleri.
- Kullanıcı nesnesi ile skeleton path'i aynı kavram kabul etmek.
- G-code aşamasında semantik ayrımı tahmin etmeye çalışmak.
- Kaynak rasterı vektörmüş gibi önizleyip başarı iddia etmek.
- Yalnız ekran görüntüsü üzerinden çözüm doğrulamak.

## Güvenlik ve G-code Kısıtları

Öneri şu garantileri bozmamalı:

- `ignore` nesneler G-code'a girmemeli.
- Tabla dışı veya özel malzeme alanı dışındaki takım yolu doğrulanmalı/kırpılmalı.
- Kerf ve sınır kırpma sonrası final toolpath validator çalışmalı.
- Açık/kapalı yol bilgisi doğru kalmalı.
- Ayrılan nesne taşındığında eski konumunda hayalet takım yolu kalmamalı.
- Aynı edge iki nesnede bulunuyorsa G-code'da iki kez yakılmamalı.
- `cut` için gereksiz iç tekrar yolları üretilmemeli.
- `engrave_line` için gerçek açık çizgiler korunmalı.

## Performans Kısıtları

Gerçek örnekte yaklaşık olarak:

- Kaynak: `1254 × 1254 px`.
- CAD izleme: yaklaşık `3.83×`, en fazla `4800 px`.
- Sonuç: yaklaşık `9.000–10.000` vektör noktası ve `100+` path.

Beklentiler:

- Vektörleştirme birkaç saniye içinde tamamlanmalı.
- Zoom/drag sırasında Canvas donmamalı.
- Semantik nesne ayrımı mümkünse worker/backend tarafında yapılmalı.
- Nesne seçimi ve transform için mekânsal indeks veya cache ihtiyacı değerlendirilmeli.
- Her draw çağrısında tüm graph yeniden analiz edilmemeli.

## Zorunlu Kabul Senaryoları

En az şu test matrisini öner ve mümkünse sentetik fixture geometrileri tarif et:

### 1. Kuş Ayağı

- Yakın fakat ayrı iki çizgi birleşmemeli.
- Gerçek kavşak kopmamalı.
- Parmak gibi kısa yollar global sadeleştirmede kaybolmamalı.
- Zoom sırasında yalnız gerçek vektör değerlendirilmelidir.

### 2. Dal + Çiçek

- Çiçek otomatik veya kullanıcı yardımıyla ayrı nesne olmalı.
- Dal çiçeğin içine yanlışlıkla ait olmamalı.
- Çiçek bağımsız `0.5×`, `1.5×` ölçeklenebilmeli.
- Dalın geometrisi ölçeklemede değişmemeli.
- Bağlantı politikası seçilebilir olmalı.

### 3. Dal + Yaprak

- Yaprak çevrimi ayrı nesneye dönüştürülebilmeli.
- Yaprak orta damarı ister yaprağa ister dala atanabilmeli.

### 4. Metin + Alt Çizgi

- Temas eden harf ve çizgi yanlış tek nesne olmamalı.
- Harf iç boşlukları korunmalı.

### 5. Tek Gerçek Sürekli Çizgi

- Semantik ayırma gerçek sürekli yolu yanlış bölmemeli.

### 6. Tekrarlanan Motif

- Aynı çiçek/yaprak örnekleri ayrı nesneler olmalı.
- Bir örnek ölçeklendiğinde diğerleri etkilenmemeli.

### 7. G-code

- Ayrım öncesi/sonrası beklenen aktif takım yolu sayısı ölçülmeli.
- Hayalet, çift veya tabla dışı hareket oluşmamalı.

## Danışmandan Beklenen Çıktı Formatı

Yanıtını şu sırayla ver:

1. **Yönetici özeti:** En fazla 10 madde.
2. **Doğrulanmış mevcut mimari:** Dosya ve fonksiyon referanslarıyla.
3. **Kök nedenler:** Kuş ayağı ile dal-çiçek problemini ayrı değerlendir.
4. **Neden önceki yaklaşımlar yetmiyor:** Çözünürlük, simplify, stitch, weld ve centerline sınırları.
5. **Alternatifler tablosu:** Doğruluk, genellenebilirlik, performans, uygulama maliyeti, UX riski.
6. **Önerilen hedef mimari:** Graph + object modelini somutlaştır.
7. **Otomatik ayrım algoritması:** Adım adım ve pseudocode ile.
8. **Kullanıcı destekli “Nesne Ayır” aracı:** Etkileşim ve durum makinesi.
9. **Veri modeli/API/proje dosyası değişiklikleri.**
10. **G-code güvenlik etkisi ve validator noktaları.**
11. **Aşamalı uygulama planı:** P0/P1/P2, dosya bazında.
12. **Test planı:** Sentetik ve gerçek fixture'lar.
13. **Ölçülebilir başarı kriterleri.**
14. **Açık sorular ve varsayımlar.**

## Beklenen Karar Seviyesi

“Daha iyi segmentasyon kullanın” gibi genel bir yanıt yeterli değildir. Şunları somutlaştır:

- Hangi graph yapısı tutulacak?
- Hangi noktada path bölünecek?
- Hangi metriklerle otomatik nesne önerilecek?
- Belirsizlik nasıl puanlanacak?
- Kullanıcı hangi tek veya iki eylemle hatayı düzeltecek?
- Dönüşüm ve G-code için sahiplik nasıl çözülecek?
- Hangi mevcut fonksiyonlar korunacak, değiştirilecek veya kaldırılacak?
- İlk güvenli dikey dilim tam olarak hangi dosyalarda yapılacak?

Sonuç, yalnız bu kuş ve çiçek örneğini değil; temas eden çizgi sanatı nesnelerinin tamamını düzenlenebilir CAD nesnelerine dönüştürmek için genellenebilir olmalıdır.
