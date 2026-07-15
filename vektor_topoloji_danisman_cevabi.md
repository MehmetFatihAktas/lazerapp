# Vektör Topolojisi Danışman Cevabı

Danışmandan gelen cevabı bu satırın altına yapıştırın.

1. Yönetici özeti
Denetim sınırı: İstenen Windows çalışma ağacı ve referans PNG’ler bu oturumun dosya sistemine bağlı değil. Bu nedenle yerel git status, git diff, commit edilmemiş 4×/4800 px değişiklikler ve gerçek kuş görseli üzerinde piksel ölçümü doğrulanamadı. GitHub main incelendi; uzak dalın son commit’i bef60dc. GitHub’daki app.js kopyasında node --check geçti; diğer testler yerel çalışma ağacına karşı çalıştırılmadı. İncelenen kapsam ve kabul senaryoları yüklenen teknik briefe dayanıyor.
Ana teknik karar: Canonical düzenleme modeli doğrudan vectorPaths olmamalı. Bunun yerine öznitelikli planar stroke graph + kullanıcı nesnesi/sahiplik katmanı + yalnız türetilmiş toolpath cache kullanılmalı.
Kuş ayağı problemi, esas olarak yanlış bir topoloji onarımıdır: 8-komşuluk, piksel ölçekli junction kümeleri, mesafe/açı tabanlı stitch ve endpoint-to-path snap; birbirine yakın fakat ayrı çizgileri birleştirebilir.
Dal–çiçek problemi, çoğu zaman yanlış skeleton topolojisi değil, eksik nesne sahipliği ve semantik bölümleme problemidir. Raster gerçekten bağlıysa skeleton’ın tek bağlı grafik üretmesi doğrudur; yanlış olan bu grafiğin teknik kenarlarını kullanıcı nesnesi saymaktır.
stitch_open_vector_paths, snap_open_vector_endpoints_to_paths, weld ve benzeri işlemler CAD modunda canonical geometriyi koşulsuz değiştirmemeli; kanıt, güven puanı ve geri alınabilir graph-edit önerileri üretmelidir.
Otomatik ayrım için tek bir teknik yeterli değildir. Önerilen birleşim: biconnected block/articulation analizi + cycle ipuçları + kontur/merkez çizgi hibriti + açı/eğrilik/stroke-width sürekliliği + lokal kompaktlık. Yüksek güvenli sonuçlar otomatik uygulanabilir; belirsiz sonuçlar kullanıcıya öneri olarak gösterilmelidir.
İlk güvenli dikey dilim, tam otomatik “çiçek tanıma” değil; stable graph IDs, fiziksel edge split, junction-cut aracı, nesne transformu, proje v2 migrasyonu ve authoritative G-code flattening olmalıdır.
Canonical graph kaynak koordinatında kalmalı; rasterdan fiziksel tasarım alanına bir sourceToDesign matrisi bulunmalı, kullanıcı nesnesi transformları ise mm tabanlı nesne koordinatında tutulmalıdır. Ortak anchor’ın davranışı detached, pinned veya shared-joint bağlantı politikasıyla belirlenmelidir.
G-code öncesinde graph/object modeli tek bir authoritative derleyicide düz polyline’lara çevrilmeli; burada ignore, mask, operation, transform, açık/kapalı yol, canonical edge sahipliği ve duplicate emission doğrulanmalıdır. Mevcut final validator sınır güvenliği sağlar, fakat çift yakma ve hayalet yol sahipliğini tek başına kanıtlamaz.
Mimari çözümün güvenilirliği tek kuş/çiçek örneğiyle değil; çözünürlük, eşik, rotasyon, çizgi kalınlığı ve bağlantı varyasyonlarını kapsayan sentetik fixture’lar ile gerçek kaynakların gold graph/object anotasyonları üzerinden ölçülmelidir.
2. Doğrulanmış mevcut mimari
2.1 Depo ve çalışma ağacı durumu

Yerel Windows yolu bu çalışma ortamında bulunmadığı için aşağıdaki üç komutun yerel sonucu bilinmiyor:

İstenen kontrol	Bu oturumdaki durum
git status -sb	Yerel çalışma ağacı bağlı değil; doğrulanamadı
git diff --stat	Commit edilmemiş değişiklikler görülemedi
git diff --check	Yerel diff üzerinde çalıştırılamadı
git log --oneline -15	GitHub main geçmişi üzerinden doğrulandı
node --check laser_editor/app.js	GitHub mainden alınan kopyada geçti
JS/Python testleri	Kaynakları incelendi; yerel branch’e karşı çalıştırılmadı
Referans PNG ve hata ekranları	Verilen Windows yolları erişilebilir değil

GitHub mainin son commit’i 13 Temmuz 2026 tarihli bef60dc — Improve CAD/CAM workflow and vector editing; bu commit 26 dosyada 8.271 ekleme ve 408 silme içeriyor.

Uzak main için son 15 commit:

bef60dc Improve CAD/CAM workflow and vector editing
9882394 Fix vector product modes and photo engraving
b07908d Show photos first in vectorize dialog
cf035cc Add vector micro tab support
879f935 Add vector cut suitability warnings
631450d Add professional vectorization modes
220b66f Improve material area drawing cursor
e434b3c Add rich font controls for text objects
f37901b Constrain material area drawing to grid
5b2732a Improve project portability and editor workflow
770f53a Stabilize laser editor production workflow
4525b72 Fix vector clipping for slanted polygons
52ecc0d Clarify table units and relayout on bed size changes
3e35092 Stabilize table settings and grid preview
729dde7 Make editor grid visible at all table sizes

Bu nedenle aşağıdaki kod denetimi GitHub main için geçerlidir. Yerelde tarif edilen yaklaşık 3,83×/4800 px geliştirmeleri remote main ile aynı kabul edilmemelidir.

2.2 Ürün modu → motor modu → Python çağrı zinciri

laser_editor_server.py ürün modlarını şu şekilde Python motoruna yönlendiriyor:

Ürün modu	Motor modu
cad_line_art	cad_centerline
cut_template / cut_stencil	auto
line_engrave	centerline
fill_motif / filled_ornament	potrace
photo_engrave	Vektör hattından ayrı raster gravür

cad_line_art sonrasında sunucu ayrıca classify_vector_region_boundaries çağırarak yolları cut veya engrave_line olarak işaretliyor. Bu işlem operasyon sınıflandırmasıdır; kullanıcı nesnesi segmentasyonu değildir.

GitHub maindeki CAD centerline zinciri özetle şöyledir:

vectorize_image
  -> source profile / threshold / mask cleanup
  -> CAD trace resize
  -> solidify_centerline_mask
  -> fill_centerline_micro_holes
  -> thin_binary
  -> trace_skeleton_vectors
  -> stitch_open_vector_paths
  -> straighten_centerline_paths
  -> flatten_axis_aligned_centerline_runs
  -> preserve_centerline_dot_components
  -> source ölçeğine geri dönüş
  -> snap_open_vector_endpoints_to_paths
  -> filter / stats / preview

Önemli ayrıntılar:

Uzak mainde CAD trace scale en fazla 2× ile sınırlandırılmış; kullanıcı briefindeki yaklaşık 4×/4800 px davranışı bu uzak sürümde görünmüyor.
CAD modunda prune_skeleton_spurs atlanıyor; non-CAD centerline akışında kullanılabiliyor.
trace_skeleton_vectors, 8-komşu skeleton piksellerinde derecesi 2 olmayan pikselleri teknik düğüm kabul ederek düğümden düğüme zincirleri polyline’a çeviriyor.
Trace sonrasında generic stitch_open_vector_paths hâlâ çalışıyor.
CAD modunda ayrıca endpoint-to-path snap çalışıyor.
polish_centerline_curves, açıkça seçilmiş CAD centerline yolunda ana adım değil; auto-centerline tarafında kullanılıyor.

Bu sıra kritik: önce teknik graph edge’leri path’lere çevriliyor, sonra topoloji onarımı path düzeyinde yapılıyor. O aşamada semantic nesne veya edge ownership bilgisi bulunmuyor.

2.3 Kritik fonksiyonların remote main çağrı durumu
Fonksiyon	Gözlenen durum	Mimari yorum
thin_binary	Aktif	Korunmalı; graph öncesi raster işlemi
_skeleton_neighbors	Aktif	8-komşuluk nedeniyle diagonal temaslar özellikle test edilmeli
prune_skeleton_spurs	CAD’de atlanıyor	Destrüktif silme yerine ignore önerisi olarak değerlendirilmesi daha güvenli
trace_skeleton_vectors	Aktif ve temel	build_skeleton_graph + graph_to_paths olarak ayrılmalı
stitch_raw_point_paths	Generic stitch mantığına bağlı yardımcı	Semantic karar veremez
stitch_open_vector_paths	Trace sonrasında aktif	Canonical mutation yerine repair proposal üretmeli
snap_open_vector_endpoints_to_paths	CAD hattında aktif	Kuş ayağı riskinin doğrudan kaynaklarından biri
fill_centerline_micro_holes	CAD hattında aktif	Topoloji değişikliği kaydedilmeli ve bütçelenmeli
preserve_centerline_dot_components	Aktif	Küçük dolu ayrıntı koruması olarak kalabilir
straighten_centerline_paths	Aktif	Topoloji dondurulduktan sonra uygulanmalı
flatten_axis_aligned_centerline_runs	Aktif	Aynı şekilde geometrik post-process olmalı
polish_centerline_curves	Mod bağımlı	Edge düğüm anchor’larını koruyarak kullanılmalı
classify_vector_region_boundaries	Sunucu post-process’i	Operation hint olarak kalmalı; object detector sayılmamalı
weld_open_endpoints	Remote üretim zincirinde erişilebilir çağrı doğrulanmadı	Yerel diff görülmeden silinmemeli
merge_coincident_open_paths	Remote üretim zincirinde erişilebilir çağrı doğrulanmadı	Önce local call graph doğrulanmalı
centerline_dense_junction_holes	Remote ana zincirde çağrısı görülmedi	Yerel geliştirmelerle karşılaştırılmalı

Generic stitching; mesafe, endpoint yönü ve benzeri lokal ölçülere göre adayları birleştiriyor. Rasterdaki beyaz ayırıcı bölge, object ownership, stroke-width sürekliliği veya birleştirmenin yaratacağı semantic sonuç doğrudan modelde bulunmuyor.

2.4 Frontend düzenleme ve proje modeli

laser_editor/vector_edit.js şu anda graph veya semantic object modülü değil; nearestPointOnPolyline, anchor ekleme, polyline kesiti değiştirme, sadeleştirme, smoothing ve fitting gibi tek-polyline geometrik araçları sunuyor.

app.js tarafında:

Seçim ve operasyon ataması esas olarak pattern.vectorPaths üzerinden ilerliyor.
Pattern düzeyinde x, y, width, height, rotation tutuluyor.
Noktalar sourceWidth/sourceHeight oranıyla pattern boyutuna ölçekleniyor.
Proje şeması laser-editor-project-v1.
Proje kaydı patterns içinde vectorPaths ve originalVectorPaths kopyalıyor.
Undo/redo; parts, placements, patterns, seçim, material area ve UI inputlarını içeren tam durum snapshot’ları kullanıyor; limit 50.

Bu yapı P0 migrasyonu için avantajlıdır: graph ve objects, pattern içine seri hale getirildiğinde mevcut snapshot mekanizması doğruluk açısından onları taşıyabilir. Bununla birlikte 10.000 noktalı graph’ın 50 kez derin kopyalanması bellek maliyeti yaratır; derived cache’ler snapshot dışında tutulmalıdır.

2.5 G-code akışı

Mevcut build_embedded_vector_engrave_lines yaklaşık olarak:

Aktif vectorPaths listesini alıyor.
cut, engrave_line, engrave_fill, ignore operasyonlarını normalize ediyor.
removed ve ignore yolları atlıyor.
Fill tarama yollarını üretiyor.
Pattern transformunu uyguluyor.
Malzeme/clip region kırpması yapıyor.
Cut yollarında kerf uyguluyor.
Uygun kapalı cut yollarına mikro köprü ekliyor.
G-code satırlarını oluşturuyor.

validate_final_toolpaths son aşamada sonlu koordinat, tabla sınırı, margin ve özel üretim alanı denetimi yapıyor; segmentleri örnekleyerek yolun izin verilen alanda kaldığını kontrol ediyor. Fakat bu validator’ın girdisinde semantic lineage bulunmadığı için “aynı edge iki nesneden iki kez geldi”, “silinen nesnenin eski transformu cache’te kaldı” veya “iki object aynı toolpath’i sahipleniyor” sorularını cevaplamıyor.

3. Kök nedenler
3.1 Kuş ayağı: yanlış topoloji onarımı

Bu problem semantic tanımadan önce oluşuyor. Dört ayrı risk katmanı var.

A. Raster ve 8-komşuluk

İnce iki siyah çizgi diagonal olarak tek pikselde yaklaşırsa 8-komşuluk bunları bağlı sayabilir. Threshold veya morfolojik kapatma bir piksel köprü eklediğinde, skeleton bu bağlantıyı gerçek kabul eder. Daha yüksek çözünürlük bu olasılığı azaltabilir fakat ortadan kaldırmaz.

B. Junction’ın tek piksel sanılması

Gerçek skeleton junction’ları çoğu zaman bir piksel değil, birkaç yüksek dereceli pikselden oluşan küçük bir kümedir. Her degree != 2 pikseli bağımsız düğüm saymak:

Çok sayıda mikro-edge üretir.
Yapay kısa path’ler oluşturur.
Endpoint ve junction ayrımını gürültülü hale getirir.
Sonraki stitch/snap aşamasının yanlış aday görmesine yol açar.

Çözüm, trace öncesinde bu pikselleri junction region olarak kümelemek ve dışarı çıkan degree-2 zincirlerini region’ın “gate”leri saymaktır.

C. Generic stitch ve snap

Mevcut yaklaşımda bir endpoint’in başka endpoint’e veya bir yolun ortasına yakın olması, yön açısının kabul edilebilir olması bağlantı için yeterli hale gelebiliyor. Ancak kuş parmağı gibi mikro yapılarda şu kanıtlar da gereklidir:

Aradaki raster koridorda siyah stroke desteği var mı?
İki çizgi arasında güvenilir beyaz bariyer var mı?
Aday, karşılıklı en iyi eşleşme mi?
Aynı endpoint için benzer puanlı başka adaylar var mı?
Birleştirme yeni cycle, degree artışı veya connected-component birleşmesi yaratıyor mu?
Kısa yol gerçekten spur mu, yoksa korunması gereken parmak/detay mı?

Bunlar olmadan mesafe eşiği yalnız geometrik yakınlığı semantic bağlantı zanneder.

D. Global post-processing

Global simplify, smoothing veya straighten:

Kısa parmağı tamamen kaldırabilir.
Junction’a yakın yönü değiştirerek snap skorunu bozabilir.
Bir mikro-path’i düz çizgiye indirip başka yolla çakıştırabilir.
Gerçek bir T junction’ı koparırken sahte yakınlığı koruyabilir.

Bu nedenle topoloji değişiklikleri önce kararlaştırılmalı; geometrik güzelleştirme edge bazında ve düğüm anchor’ları sabitlenerek sonra yapılmalıdır.

Kuş ayağı için kök neden cümlesi

Hata, “çözünürlük yetersiz” olmaktan çok, bağlantı kararının raster kanıtı, yerel stroke ölçeği ve topolojik risk bilgisi olmadan path düzeyinde verilmesidir.

3.2 Dal–çiçek: eksik nesne sahipliği

Dal çizgisi rasterda çiçeğe gerçekten temas ediyorsa skeleton’ın tek connected component üretmesi yanlış değildir. Hatta dal çiçek merkezine giriyorsa geometrik grafikte bu bağlantı tamamen gerçektir.

Yanlış varsayım şudur:

skeleton edge/path == kullanıcının algıladığı nesne

Oysa üç ayrı kavram vardır:

Geometrik graph: Hangi stroke parçaları fiziksel olarak temas ediyor?
Kullanıcı nesnesi: Hangi edge’ler birlikte seçilip transform edilmeli?
Üretim yolu: Hangi transform ve operasyonlarla hangi segmentler gerçekten yakılmalı?

Mevcut vectorPaths bu üçünü tek listede birleştiriyor.

Articulation neden tek başına yeterli değil?

Tek temaslı basit bir çiçekte junction kaldırıldığında çiçek ayrılabilir. Ancak:

Dal çiçeğe iki noktadan temas edebilir.
Dal çiçeğin içinden geçip çıkabilir.
Çiçek petalleri ve merkez çizgileri aynı biconnected block içinde olabilir.
Orta damar hem yaprağa hem dala semantic olarak bağlanabilir.
Alt çizgi bir harfe iki noktadan değebilir.
Tek continuous stroke gerçekten ayrılmaması gereken bir cycle içerebilir.

Bu nedenle articulation noktaları iyi bir gate adayıdır, object membership’in tek kaynağı değildir.

Dal–çiçek için kök neden cümlesi

Problem skeleton’ın connected olması değil; connected graph içindeki edge’lerin bir veya daha fazla düzenlenebilir nesneye nasıl ait olduğunun, bağlantı politikasının ve transform davranışının modellenmemesidir.

4. Önceki yaklaşımlar neden yetmiyor?
Yaklaşım	Sağladığı fayda	Neden ana problemi çözmüyor
Çözünürlüğü 2×/4× artırmak	Quantization ve küçük eğri örneklemesi iyileşir	Raster gerçekten temas ediyorsa semantic ayrım oluşmaz; stitch hatası daha yüksek çözünürlükte de yapılabilir
Global simplify azaltmak	Mikro ayrıntı korunabilir	Yanlış bağlantıyı çözmez; yalnız daha çok noktayla yanlış graph üretir
Global simplify artırmak	Nokta sayısı ve gürültü azalır	Parmak, yaprak damarı, harf detayı gibi gerçek kısa stroke’ları siler
Blur/morfolojik close	Küçük kopuklukları kapatabilir	Yakın fakat ayrı çizgileri de birleştirir; topolojiyi geri döndürülemez biçimde değiştirir
Endpoint stitch	Gerçek tarama boşluklarını iyileştirir	Mesafe ve açı, semantic sahiplik için yeterli değildir
Endpoint-to-path snap	T junction boşluklarını kapatabilir	Kısa parmak veya süs çizgisini yakındaki gövdeye yapıştırabilir
Weld/merge	Coincident parçaları temizleyebilir	İki nesnenin bilinçli olarak yakın veya üst üste olduğu durumları ayıramaz
Centerline	Çift konturdan tek stroke çıkarır	Bağlı stroke grafiğinin hangi nesneye ait olduğunu söylemez
Region classification	Cut/engrave operasyon ipucu verir	“Çiçek”, “dal”, “harf” gibi transform nesnesi çıkarmaz
Rasterı vektör üstünde göstermek	Kaynak karşılaştırması sağlar	Raster çizgi ile gerçek vector path karışırsa yanlış başarı algısı yaratır
Gerekli politika değişikliği
Stitch/snap artık doğrudan geometri mutasyonu değil, RepairProposal olmalı.
Eşikler piksel değil yerel stroke-width oranı ile ifade edilmeli.
Bağlantı adayında pozitif siyah destek ve negatif beyaz bariyer birlikte değerlendirilmelidir.
Bir graph editinin connected-component, cycle rank ve junction degree üzerindeki etkisi kaydedilmelidir.
Belirsiz topoloji değişikliği varsayılan olarak uygulanmamalıdır.
Smoothing, straighten ve flatten ancak graph revision dondurulduktan sonra çalışmalıdır.
5. Alternatifler tablosu
Teknik	Doğruluk	Genellenebilirlik	Performans	Uygulama maliyeti	UX riski	Bu proje için karar
1. Articulation/cut vertex	Orta	Orta	Çok iyi	Düşük	Düşük	Tek temaslı ayrımlar için gate adayı; tek başına detector değil
2. Cycle basis	Çevrimli motifte orta-yüksek	Orta	İyi	Orta	Orta	Çiçek/yaprak/harf boşluğu için güçlü structural cue
3. Region adjacency graph	Dolgu ve konturda yüksek; saf centerline’da düşük	Orta	İyi	Orta-yüksek	Düşük	Kontur katmanında kullanılmalı, centerline’ın yerine geçmemeli
4. Stroke width / medial-axis sahipliği	Destekleyici	Yüksek	İyi	Orta	Düşük	Width continuity ve junction scale ölçüsü olarak kullanılmalı
5. Kontur + centerline hibriti	Yüksek	Yüksek	Orta-iyi	Yüksek	Düşük	Önerilen temel algısal temsil
6. Açı/eğrilik/kalınlık sürekliliği	Orta-yüksek	Yüksek	Çok iyi	Orta	Otomatikte orta	Ana edge/gate skorlama sinyali
7. Tekrar/simetri	Orta	Orta	Orta	Yüksek	Orta	P2’de zayıf prior; karar verici değil
8. Instance segmentation	Domain verisi varsa yüksek, aksi halde değişken	Düşük-orta	Pahalı	Çok yüksek	Yüksek	P2’de yalnız proposal kanalı
9. Kullanıcı seed’li graph cut	Yüksek	Yüksek	İyi	Orta-yüksek	Düşük	P1 için önerilen belirsizlik çözümü
10. Lasso/marquee graph seçimi	Kullanıcı rehberliğinde yüksek	Yüksek	Çok iyi	Orta	Düşük	Seed üretmek için öneriliyor
11. Junction-cut aracı	Açık bağlantıda çok yüksek	Yüksek	Çok iyi	Düşük-orta	Düşük	P0’da zorunlu
12. Ortak anchor/sahiplik modeli	Detector değil; doğruluk için zorunlu	Yüksek	Çok iyi	Orta	Düşük	Hedef veri modelinin çekirdeği

Articulation ve biconnected component’ler lineer zamanda bulunabilir ve bağlantı kapıları için çok uygundur; ancak biconnected yapı semantic nesneyle aynı şey değildir.

Stroke-width ölçümü her piksel için lokal, veriye bağlı bir çizgi kalınlığı sinyali sağlayabilir; burada metin tanımak için değil, junction çevresindeki yerel ölçeği ve kalınlık sürekliliğini ölçmek için kullanılmalıdır.

Kullanıcı seed’leri ile hard constraints, açı/kalınlık/cycle ilişkileriyle soft constraints kullanan graph cut yaklaşımı; tam otomatik olmayan ama deterministik ve denetlenebilir bir ayrım aracı için uygundur.

Mask R-CNN ve promptable SAM gibi instance segmentation modelleri nesne maskesi önerebilir; fakat lazer çizgi sanatındaki temas, stroke sahipliği ve açık yol semantiği eğitim dağılımından farklıdır. Bu nedenle çıktıları canonical geometri olarak değil, graph edge seed’i veya proposal prior’ı olarak kullanılmalıdır.

GrabCut benzeri kullanıcı destekli yöntemler az etkileşimle foreground çıkarımını hedefler; ancak bu projede piksel foreground yerine stroke-edge sahipliği ayrılacağı için aynı UX fikri edge-adjacency graph üzerinde uygulanmalıdır.

6. Önerilen hedef mimari
6.1 Karar: üç katmanlı ara temsil

Önerilen canonical mimari:

1. Source Evidence
   raster mask, contour hierarchy, distance/stroke-width evidence

2. Attributed Vector Graph
   stable nodes + stable edges + lineage + topology

3. Vector Object / Ownership Graph
   edge ownership + transforms + anchors + connection policies

4. Derived Toolpath IR
   G-code öncesi geçici, düz polyline listesi

vectorPaths, dördüncü katmanda üretilebilen bir uyumluluk/çizim cache’i olabilir; düzenlemenin source of truth’ü olmamalıdır.

6.2 Önerilen veri modeli
{
  "vectorModelVersion": 2,
  "source": {
    "width": 1254,
    "height": 1254,
    "imageHash": "sha256:...",
    "traceScale": 3.83,
    "analysisVersion": "graph-v1"
  },

  "sourceToDesign": {
    "matrix": [0.08, 0, 0, 0.08, 0, 0],
    "unit": "mm"
  },

  "vectorGraph": {
    "revision": 17,
    "nodes": [
      {
        "id": "n42",
        "position": [612.3, 804.1],
        "type": "junction",
        "junctionRegionId": "jr8",
        "localStrokeWidth": 5.6,
        "confidence": 0.97,
        "lineage": {
          "sourceComponentId": 123
        }
      }
    ],
    "edges": [
      {
        "id": "e91",
        "startNodeId": "n42",
        "endNodeId": "n55",
        "points": [[612.3, 804.1], [614.0, 802.8]],
        "closed": false,
        "lengthSource": 94.2,
        "widthProfile": [5.5, 5.7, 5.4],
        "tangentStart": [0.71, -0.70],
        "tangentEnd": [0.83, -0.55],
        "curvatureStats": {
          "mean": 0.03,
          "max": 0.21
        },
        "blockId": "block12",
        "cycleIds": [],
        "lineage": {
          "parentEdgeId": null,
          "sourcePathIds": ["raw-17"],
          "splitRange": [0, 1]
        },
        "warnings": []
      }
    ]
  },

  "vectorObjects": [
    {
      "id": "object-flower-1",
      "name": "Kompakt motif 1",
      "edgeRefs": [
        {
          "edgeId": "e91",
          "ownership": "exclusive",
          "role": "internalStroke",
          "emit": true
        }
      ],
      "attachments": [
        {
          "id": "attachment-1",
          "graphNodeId": "n42",
          "policy": "pinned",
          "localAnchor": [12.4, 18.0]
        }
      ],
      "localFrame": {
        "originDesign": [52.0, 37.0]
      },
      "transform": [1, 0, 0, 1, 0, 0],
      "resizePolicy": "scale",
      "locked": false,
      "removed": false,
      "deformable": true,
      "operation": "engrave_line",
      "confidence": 0.82,
      "createdBy": "auto-proposal-confirmed"
    }
  ],

  "connections": [
    {
      "id": "connection-8",
      "attachmentIds": ["attachment-1", "attachment-2"],
      "policy": "pinned",
      "geometryPolicy": "shared-node",
      "manufacturingPolicy": "emit-underlay"
    }
  ],

  "occlusionMasks": [
    {
      "id": "mask-2",
      "ownerObjectId": "object-flower-1",
      "targetObjectIds": ["object-branch-1"],
      "mode": "toolpath-subtract",
      "clearanceMm": 0.0,
      "enabled": false
    }
  ],

  "objectProposals": [],
  "derivedToolpaths": {
    "graphRevision": 17,
    "cacheOnly": true,
    "vectorPaths": []
  }
}
6.3 Doğrudan cevaplar
Soru	Önerilen karar
Bir path iki nesneye geçiyorsa nereden bölünecek?	Kullanıcı gate’i, lasso sınırı veya otomatik gate’in canonical edge üzerindeki en yakın izdüşümü bulunur. Arclength parametresi t ile exact split node eklenir; parent edge iki veya daha fazla stable child edge’e bölünür. Nesneler child edge’lerin tamamını sahiplenir.
Bölme junction kümesinin içindeyse?	Keyfi centroidte değil, junction region’dan çıkan gate zincirlerinde bölünür. Böylece piksel-kümesi artefaktı semantic sınır haline gelmez.
Ortak anchor kime ait?	Tek bir nesneye ait değildir. Anchor graph node veya connection entity’sidir; nesneler ona attachment ile bağlanır.
Nesne ölçeklenince anchor ne olur?	detached: bağlantı kopar ve nesne serbesttir. pinned: anchor world koordinatı sabit kalır, nesne o pivot etrafında ölçeklenir. shared-joint: iki attachment aynı world noktasına constraint edilir. Birden çok anchor transformu aşırı kısıtlarsa kullanıcıdan detach/pin seçimi istenir.
Çiçek ölçeklenince dal değişir mi?	Varsayılan P0 davranışı: dal transformu değişmez. Çiçek tek attachment etrafında ölçeklenir veya detach edilir. Dal geometrisi hiçbir zaman sessizce deforme edilmez.
Dal çiçek altında devam edecekse?	Ownership ve üretim görünürlüğü ayrılır. emit-underlay: dal gerçekten yakılmaya devam eder. mask-underlay: dal graph’ta kalır fakat çiçek silhouette’ı içindeki takım yolu çıkarılır. cut-at-boundary: dal fiziksel olarak sınır kesişimlerinde bölünür, iç fragment devre dışı bırakılır.
Transform nerede tutulacak?	Raster/graph kaynak koordinatında kalır. sourceToDesign kaynak pikselini pattern-local mm’ye çevirir. Kullanıcı nesnesi transformu mm tabanlı object/design koordinatında tutulur. Pattern placement/rotation en dış transformdur.
Dünya koordinatı nasıl hesaplanır?	world = T_pattern × T_object × T_sourceToDesign × p_source.
Aynı edge iki nesnede olabilir mi?	Transform edilebilir ownership varsayılan olarak exclusive olmalıdır. İkinci nesnede bulunması gerekiyorsa referenceOnly veya explicit shared-use olur ve tek emissionOwnerId atanır.
G-code’a nasıl çevrilecek?	Graph revision doğrulanır; object transformları çözülür; connection/mask politikaları uygulanır; canonical edge fragmentları tekilleştirilir; geçici düz polyline IR üretilir; sonra mevcut kerf/fill/clip/tab hattına girer.
Eski .laserjob.json nasıl açılacak?	V1 yükleyici her eski vectorPathi bir graph edge ve bir legacy-path-object olarak migrate eder. Operation, removed, locked/deformable ve ID korunur. Eski projeye otomatik semantic grouping yapılmaz.
Undo/redo nasıl taşıyacak?	P0’da mevcut pattern snapshot mekanizması kullanılabilir; graph, objects ve connections seri hale gelir. Raster analysis cache, Path2D, spatial index ve derived toolpaths snapshot’a alınmaz. P1’de command-based graph edits veya copy-on-write’a geçilir.
6.4 Temel veri modeli invariant’ları
Bir object edge ref’i olmayan active edge G-code’a çıkamaz.
Bir exclusive edge aynı revision’da iki transform edilebilir object tarafından sahiplenemez.
Her graph split parent lineage ve [t0,t1] aralığını korur.
Object transformu canonical graph noktalarını değiştirmez.
Derived vectorPaths, graph revision ile eşleşmiyorsa geçersizdir.
removed veya ignore object’in edge’leri hiçbir derived toolpath’te bulunamaz.
Ortak node, ortak edge anlamına gelmez.
Conflicting operation bulunan shared-use, sessiz öncelik yerine preflight hatası üretir.
Her G-code segmentinde en az objectId, edgeId, graphRevision provenance’ı bulunur.
Cache hiçbir zaman proje geometrisinin source of truth’ü değildir.
7. Otomatik ayrım algoritması
7.1 Aşama A — Source evidence

Aynı threshold maskesinden üç paralel temsil çıkarılmalıdır:

Binary foreground mask
Contour hierarchy / planar regions
Skeleton + distance/stroke-width field

Kontur katmanı; kapalı petal, yaprak, harf boşluğu ve silhouette sağlar. Skeleton katmanı açık çizgi ve stroke bağlantısını sağlar. Distance field, yerel stroke kalınlığını verir.

7.2 Aşama B — Junction region graph

Skeleton pikseli başına doğrudan düğüm üretmek yerine:

Her skeleton pikselinin 8-komşu derecesini hesapla.
degree != 2 pikselleri aday olarak işaretle.
Birbirine temas eden veya çok yakın adayları junction region olarak kümele.
Region’dan çıkan degree-2 zincirlerini gate olarak belirle.
Junction node konumunu skeleton centroid’i yerine distance-field ağırlıklı merkez veya gate geometrisine en düşük toplam hata veren noktadan seç.
Pure cycle’da teknik bir cycle-anchor ekle.

Böylece graph düğümleri piksel gürültüsünden daha stabil olur.

7.3 Aşama C — Gap repair önerileri

Her açık endpoint için candidate endpoint ve candidate path-interior eşleşmeleri bulunur. Ancak değişiklik yalnız şu sinyallerle puanlanır:

gap / localStrokeWidth
tangent alignment
curvature continuation
width continuity
foreground support along bridge
white-barrier penalty
mutual-best-match
competing-candidate margin
component merge effect
cycle creation effect
junction degree increase
micro-path protection penalty

Önerilen hard kurallar:

Mesafe tek başına yeterli değildir.
Beyaz bariyer güçlü ise otomatik join yapılamaz.
Kısa edge’in başka yola snap edilmesi daha yüksek güven eşiği gerektirir.
Candidate karşılıklı en iyi değilse otomatik uygulanmaz.
Bir component birleşmesi veya yeni cycle yaratılması ayrıca raporlanır.
Her kabul edilmiş onarım createdByRepairId ve confidence taşır.
7.4 Aşama D — Graph öznitelikleri

Her edge için bir kez hesaplanıp cache’lenmeli:

Uzunluk
Başlangıç/bitiş tangent’ı
Eğrilik profili
Yerel stroke-width profili
Geodesic diameter katkısı
Biconnected block ID
Bridge olup olmadığı
Fundamental cycle üyelikleri
Contour/region ilişkileri
Bounding box
Raster support skoru
Tekrar/simetri descriptor’ı — P2
Source component ve repair lineage
7.5 Aşama E — Gate ve candidate subgraph üretimi

Candidate gate kaynakları:

Articulation node’ları
Bridge edge’ler
Narrow neck bölgeleri
Cycle-rich kompakt alt graph ile uzun smooth path arasındaki temaslar
Ani tangent/eğrilik değişimi
Stroke-width değişimi
Contour silhouette giriş/çıkışları
Lasso sınırının edge ile kesişimleri
Kullanıcının açıkça işaretlediği junction’lar

Candidate object’ler:

Bir articulation sonrası alt graph
Bir veya birkaç komşu biconnected block
Cycle cluster çevresindeki lokal graph
Lasso içindeki edge set’i
Repeated motif descriptor eşleşmeleri
Graph cut sonucu oluşan connected edge partition
7.6 Aşama F — Skorlama

Bir candidate C, remainder R ve gate kümesi G için:

motifScore(C):
    cycle density
    contour closure
    compactness
    local edge density
    repeated-shape similarity

trunkScore(R):
    longest smooth geodesic / total length
    low mean curvature
    tangent continuation through gate
    width continuity

cutPenalty(G):
    strong tangent continuation
    strong width continuity
    strong raster bridge support
    excessive number of anchors
    creation of tiny fragments
    break of a true continuous stroke

separationEvidence(G):
    curvature discontinuity
    width discontinuity
    narrow neck
    contour silhouette boundary
    compact-vs-elongated subgraph contrast

Örnek sembolik skor:

S(C, G) =
    w1 * cycleDensity(C)
  + w2 * compactness(C)
  + w3 * contourClosure(C)
  + w4 * trunkContrast(C, R)
  + w5 * widthDiscontinuity(G)
  + w6 * curvatureDiscontinuity(G)
  + w7 * repeatPrior(C)
  - w8 * tangentContinuityAcrossCut(G)
  - w9 * rasterBridgeSupport(G)
  - w10 * tinyFragmentPenalty(C, R)
  - w11 * anchorCountPenalty(G)

Ağırlıklar tek görsele göre elle ayarlanmamalı; fixture corpus üzerinde kalibre edilmelidir.

Güven puanı

Yalnız ham skor kullanılmamalı:

margin     = bestScore - secondBestScore
stability  = threshold/scale perturbasyonlarında aynı gate'in korunma oranı
support    = raster + contour + width sinyallerinin tutarlılığı
hardMargin = en yakın güvenlik kuralına uzaklık

confidence = Calibrate(margin, stability, support, hardMargin)

Politika:

Yüksek güven: Object proposal otomatik oluşturulur, fakat UI’da “otomatik öneri” olarak görünür.
Orta güven: Nesne bölünmez; gate’ler kullanıcıya sunulur.
Düşük güven: Otomatik öneri yapılmaz.
İlk sürümde precision, recall’dan öncelikli olmalıdır. Yanlış otomatik bölme, ayrılmamış nesneden daha tehlikelidir.
7.7 Pseudocode
def analyze_vector_objects(binary_mask, settings):
    contours = extract_contours_and_hierarchy(binary_mask)
    distance = compute_local_stroke_width(binary_mask)

    skeleton = thin_binary(binary_mask)
    pixel_graph = build_pixel_skeleton_graph(skeleton, connectivity=8)

    junction_regions = cluster_junction_pixels(
        pixel_graph,
        distance_field=distance,
        local_radius_policy=True,
    )

    graph = collapse_to_attributed_stroke_graph(
        pixel_graph=pixel_graph,
        junction_regions=junction_regions,
        distance_field=distance,
        contours=contours,
    )

    repair_proposals = propose_gap_repairs(
        graph=graph,
        binary_mask=binary_mask,
        distance_field=distance,
        require_mutual_best=True,
        use_white_barrier=True,
        compute_topology_delta=True,
    )

    for proposal in repair_proposals:
        if proposal.confidence >= settings.auto_repair_threshold:
            graph = apply_graph_edit(graph, proposal)
        else:
            graph.pending_repairs.append(proposal)

    graph = recompute_graph_attributes(graph, contours, distance)

    blocks = biconnected_components(graph)
    cycles = fundamental_cycle_basis_per_block(graph, blocks)

    gates = set()
    gates |= articulation_gate_candidates(graph, blocks)
    gates |= bridge_gate_candidates(graph)
    gates |= narrow_neck_candidates(graph, distance)
    gates |= contour_crossing_candidates(graph, contours)
    gates |= continuity_discontinuity_candidates(graph)

    candidates = propose_subgraphs(
        graph=graph,
        blocks=blocks,
        cycles=cycles,
        gates=gates,
        max_local_radius=settings.object_search_radius,
    )

    scored = []
    for candidate in candidates:
        features = object_partition_features(
            graph=graph,
            candidate=candidate,
            contours=contours,
            distance_field=distance,
            binary_mask=binary_mask,
        )
        score = partition_model.score(features)
        scored.append((candidate, features, score))

    ranked = resolve_overlapping_candidates(scored)

    proposals = []
    for best, runner_up in ranked:
        stability = perturbation_stability(
            best,
            threshold_offsets=(-5, 0, +5),
            scale_variants=settings.validation_scales,
        )
        confidence = confidence_calibrator(
            best.score,
            runner_up.score,
            stability,
            best.features.support_consistency,
        )

        proposals.append(
            ObjectProposal(
                edge_ids=best.edge_ids,
                gate_ids=best.gate_ids,
                confidence=confidence,
                auto_applicable=confidence >= settings.auto_object_threshold,
                created_by="structural-analysis",
            )
        )

    derived_paths = graph_to_preview_paths(graph)

    return {
        "vectorGraph": graph,
        "objectProposals": proposals,
        "repairProposals": repair_proposals,
        "vectorPaths": derived_paths,
    }
7.8 Kullanıcı seed’li graph cut

Piksel graph cut yerine edge-adjacency graph, yani stroke graph’ın line graph’ı kullanılmalı:

Her stroke edge bir partition node’u olur.
Aynı junction’a bağlanan edge’ler komşudur.
Kullanıcının tıkladığı/lasso içine aldığı edge’ler hard foreground seed olur.
Açıkça dışarıda kalan veya mevcut ana gövdeye ait edge’ler background seed olur.
İki edge’i aynı nesnede tutma maliyeti; tangent, width, cycle ve contour cohesion ile artar.
Düşük continuity veya silhouette sınırında cut ucuzlaşır.
def separate_with_user_seed(graph, selected_edge_ids, outside_edge_ids, overrides):
    partition_graph = build_edge_adjacency_graph(graph)

    for adjacency in partition_graph.adjacencies:
        adjacency.keep_cost = (
            W_ANGLE * tangent_continuity(adjacency)
            + W_WIDTH * width_continuity(adjacency)
            + W_CYCLE * cycle_cohesion(adjacency)
            + W_RASTER * raster_bridge_support(adjacency)
            - W_CURVATURE * curvature_jump(adjacency)
            - W_NECK * narrow_neck_evidence(adjacency)
        )

    apply_hard_foreground_seeds(partition_graph, selected_edge_ids)
    apply_hard_background_seeds(partition_graph, outside_edge_ids)
    apply_user_gate_overrides(partition_graph, overrides)

    foreground, background, cut_gates = min_cut(partition_graph)

    return build_separation_preview(
        foreground_edges=foreground,
        background_edges=background,
        cut_gates=cut_gates,
    )

Bu yöntem “çiçek” sınıfını bilmek zorunda değildir; kullanıcının seçtiği kompakt stroke kümesini tutarlı biçimde graph’tan ayırır.

8. Kullanıcı destekli “Nesne Ayır” aracı
8.1 Durum makinesi
Durum	Kullanıcı/olay	Sistem davranışı
idle	Araç seçilir	Raster karışımı kapatılır; vector-only graph overlay açılır
hover	Pointer edge’e yaklaşır	En yakın edge/junction vurgulanır; snap göstergesi ve mm readout gösterilir
seeding	Tıklama veya lasso	Seçilen edge’ler hard foreground seed olur
analyzing	Seed tamamlanır	Worker/backend edge graph cut ve gate adaylarını hesaplar
review	Proposal gelir	Seçilen alt graph, kalan graph ve şüpheli gate’ler ayrı biçimde gösterilir
gate-edit	Kullanıcı junction/gate’e tıklar	Gate keep ↔ cut arasında geçer; min-cut anında yeniden hesaplanır
policy-edit	Bağlantı seçilir	shared-node, cut-at-boundary, continue-under ve üretim maskesi seçilir
preview	Transform denemesi	Ayrılan object taşınır/ölçeklenir; dalın değişmediği ve toolpath sonucu canlı görünür
commit	Onay	Edge split, object creation, connection ve mask tek atomic komutla kaydedilir
cancel	Esc/iptal	Graph revision değişmeden araç kapanır
undo	Ctrl+Z	Atomic separation komutu tamamen geri alınır
8.2 Önerilen etkileşim
Kullanıcı Nesne Ayır aracını seçer.
Çiçeğin bir petaline/merkezine tıklar veya çevresine lasso çizer.
Hit-test, yalnız raster pikselini değil graph edge’lerini seçer.
Sistem seçilen alt graph’ı ve candidate boundary gates’i gösterir.
Her gate için:
Kes
Koru
Ortak anchor
seçenekleri bulunur.
Canlı preview’da iki geçici object görünür.
Kullanıcı gerekirse bir veya iki gate’i değiştirir.
Bağlantı politikasını seçer.
Onayla iki object oluşur.
8.3 Profesyonel CAD davranışları
Hover toleransı ekran pikseli cinsinden sabit, seçim sonucu source/design koordinatında kesin olmalı.
Tooltip’te:
edge uzunluğu,
en yakın noktanın X/Y mm değeri,
junction degree,
local stroke width,
proposal confidence gösterilebilir.
Lasso bir edge’i ortadan keserse preview için geçici fragment üretilir; onayda canonical edge exact parametrelerde bölünür.
Gate işaretleri renk dışında şekil/simgeyle de ayrılmalı.
Tab, alternatif proposal’lar arasında geçebilir.
Raster yalnız isteğe bağlı referans katmanı olmalı; default QA görünümü gerçek vector graph olmalıdır.
Semantic model yoksa sistem “Çiçek” diye kesin isim vermemeli. “Kompakt motif 1” ve “Ana yol 1” gibi yapısal adlar güvenlidir; kullanıcı adını değiştirebilir.
Proposal backend’den geldiğinde graphRevision eşleşmesi zorunlu olmalı. Kullanıcı arada geometriyi değiştirmişse eski proposal uygulanmamalıdır.
8.4 Bağlantı politikası UX’i

Ortak düğüm

İki object aynı attachment noktasında kalır.
Çiçek pivot etrafında ölçeklenebilir.
Serbest taşıma başlatılırsa “Bağlantıyı ayır / sabit tut” seçimi çıkar.

Sınırda kes

Dal, motif silhouette kesişimlerinde fiziksel child edge’lere bölünür.
İç fragment removed veya ignore olur.
Preview gerçek G-code’a karşılık gelir.

Altından devam

İki ayrı üretim seçeneği olmalıdır:

Yakmaya devam et: Ownership dala aittir; çiçeğin altında da engrave edilir.
Maskeyle gizle: Dal graph’ta korunur, fakat çiçek silhouette’ı takım yolundan çıkarılır.

Bu ayrım yalnız görsel layer sırasıyla ifade edilmemelidir; üretim sonucu farklıdır.

9. Veri modeli, API ve proje dosyası değişiklikleri
9.1 Proje şeması

Önerilen üst seviye:

{
  "schema": "laser-editor-project-v2",
  "version": 2,
  "features": {
    "embeddedPartGeometry": true,
    "vectorGraph": true,
    "vectorObjects": true,
    "toolpathProvenance": true
  }
}

Pattern içinde:

{
  "vectorModelVersion": 2,
  "sourceToDesign": {},
  "vectorGraph": {},
  "vectorObjects": [],
  "connections": [],
  "occlusionMasks": [],
  "vectorPaths": [],
  "vectorPathsDerivedFromRevision": 17
}

vectorPaths bir geçiş sürümü boyunca tutulabilir; fakat graph revision uyuşmazsa kullanılmamalıdır.

9.2 V1 → V2 migrasyonu

Migration deterministik ve semantic açıdan muhafazakâr olmalıdır:

for old_path in pattern.vectorPaths:
    start_node = node_for(old_path.points[0])
    end_node = start_node if old_path.closed else node_for(old_path.points[-1])

    edge = GraphEdge(
        id=f"legacy-edge-{old_path.id}",
        points=old_path.points,
        closed=old_path.closed,
        lineage={"legacyPathId": old_path.id},
    )

    obj = VectorObject(
        id=f"legacy-object-{old_path.id}",
        edgeRefs=[{"edgeId": edge.id, "ownership": "exclusive"}],
        operation=old_path.operation,
        removed=old_path.removed,
        locked=old_path.locked,
        createdBy="v1-migration",
    )

Neden bir object per old path?

Eski projede her path ayrı seçilebildiği için davranış korunur.
Migrasyon sırasında tahmine dayalı grouping yapılmaz.
Kullanıcı daha sonra “Nesne Birleştir” veya auto proposal kullanabilir.
Operation ve removed state bire bir korunur.
9.3 Frontend clone ve undo değişiklikleri

Mevcut clonePatternPayload ağırlıklı olarak vectorPaths, originalVectorPaths, stats ve seed alanlarını özel olarak kopyalıyor. Yeni nested graph modelinin spread ile sığ kopyalanması gizli mutation hatalarına yol açar. Şunlar eklenmeli:

function cloneVectorGraph(graph) { ... }
function cloneVectorObjects(objects) { ... }
function cloneConnections(connections) { ... }
function cloneOcclusionMasks(masks) { ... }

P0:

Mevcut full snapshot undo devam eder.
Graph ve objects derin kopyalanır.
Derived toolpaths, spatial indexes, Path2D ve raster analysis cache alınmaz.
Snapshot geri yüklenince cache’ler revision’dan yeniden üretilir.

P1:

SplitEdge
MergeEdges
CreateObject
DeleteObject
SetEdgeOwnership
SetConnectionPolicy
SetOcclusionPolicy
TransformObject
AcceptRepairProposal
RejectRepairProposal

komutlarıyla command-based undo veya copy-on-write graph revision’a geçilebilir.

9.4 API değişiklikleri
/api/vectorize-image

Ek response:

{
  "vectorGraph": {},
  "vectorObjects": [],
  "objectProposals": [],
  "repairProposals": [],
  "vectorPaths": [],
  "stats": {
    "graphNodes": 0,
    "graphEdges": 0,
    "junctionRegions": 0,
    "autoRepairsApplied": 0,
    "ambiguousRepairs": 0,
    "objectProposalCount": 0
  }
}
/api/analyze-vector-separation

Request:

{
  "graphRevision": 17,
  "patternId": "pat-1",
  "foregroundEdgeIds": ["e1", "e2"],
  "backgroundEdgeIds": [],
  "lassoSourcePoints": [],
  "gateOverrides": {
    "g12": "cut",
    "g18": "keep"
  }
}

Response:

{
  "graphRevision": 17,
  "proposalId": "sep-27",
  "foregroundEdgeIds": [],
  "backgroundEdgeIds": [],
  "cutGates": [],
  "confidence": 0.84,
  "warnings": []
}
/api/commit-vector-separation

İki seçenek vardır:

Graph editleri frontend’de saf fonksiyonlarla yapıp projeyi kaydetmek.
Backend’in SplitEdge/CreateObject komutlarını authoritative olarak üretmesi.

Üretim güvenliği için ikinci seçenek daha güçlüdür; frontend preview aynı komutları simüle eder, commit backend’den dönen graph revision ile yapılır.

/api/generate

V1 ve V2 pattern kabul etmeli:

if pattern.vectorModelVersion == 2:
    vector_paths = compile_vector_objects(pattern)
else:
    vector_paths = legacy_vector_paths(pattern)
9.5 Operation sahipliği

Önerilen precedence:

Edge-level explicit override
Object operation
Pattern operation
Default engrave_line

Fakat aynı canonical edge için farklı active operasyonlar oluşursa:

Sessizce biri seçilmemeli.
Preflight conflict üretilmeli.
Kullanıcı bir emission owner veya explicit multi-pass seçmelidir.
10. G-code güvenlik etkisi ve validator noktaları
10.1 Önerilen authoritative derleme sırası
Project schema validation
  -> V1 migration if needed
  -> Graph reference validation
  -> Object ownership validation
  -> Resolve sourceToDesign
  -> Resolve object transforms
  -> Resolve anchor constraints
  -> Resolve underlay/mask policies
  -> Resolve effective operations
  -> Flatten canonical edge instances
  -> Canonical provenance deduplication
  -> Geometric duplicate detection
  -> Open/closed operation validation
  -> Fill generation
  -> Kerf
  -> Material/part clipping
  -> Micro tabs
  -> G-code emission
  -> Parse powered toolpaths
  -> Final bed/material validator
10.2 Yeni zorunlu validator’lar
Validator	Engellediği hata
Graph reference integrity	Silinmiş/nonexistent node veya edge referansı
Exclusive ownership	Aynı edge’in iki bağımsız object tarafından sahiplenilmesi
Transform validity	NaN, sonsuz, singular transform
Revision validity	Eski cache veya stale proposal kullanımı
Operation legality	Açık yola yanlış fill, explicit olmayan open-cut
Ignore/removed provenance	Gizli nesnenin G-code’a sızması
Canonical emission uniqueness	Aynı edge’in iki kez yakılması
Geometric duplicate validator	Clone sonucu provenance farklı olsa da üst üste gelen takım yolu
Ghost-path validator	Eski object transformundan kalmış derived path
Mask validity	Yanlış nesnenin silhouette’ıyla kırpma
Closed-path integrity	Kerf/fill sonrası kapanış bozulması
Self-intersection/degeneracy	Kerf veya transform sonrası geçersiz cut
Final material bounds	Mevcut tabla ve özel alan güvenliği
10.3 Tekil emisyon anahtarı

İlk katman provenance tabanlı olmalıdır:

emissionKey =
  canonicalEdgeLineageId
  + sourceInterval
  + resolvedTransformHash
  + operation
  + passGroup

Kurallar:

Aynı key iki kez gelirse tekilleştirilir veya hata verilir.
Aynı canonical edge farklı operation ile gelirse conflict.
Farklı transform varsa gerçekten farklı instance olabilir.
Shared reference emit: false ise yalnız seçim/anchor amacı taşır.
Explicit multi-pass ancak kullanıcı tarafından etkinleştirilmişse izinlidir.

İkinci katman geometrik validator:

Noktaları mm toleransına quantize eder.
Aynı veya ters yönlü segmentleri bulur.
Collinear overlap’ı ölçer.
Bilinçli tekrar olmayan çakışmaları preflight’ta raporlar.
10.4 Hayalet yolun yapısal olarak önlenmesi

Hayalet yol genellikle materialized vectorPaths listesinin source of truth kabul edilmesinden çıkar. Önerilen modelde:

Object taşındığında yalnız object.transform değişir.
Toolpath cache’in graphRevision/objectTransformRevision değeri geçersiz olur.
G-code sırasında cache’e güvenilmez; object modelinden yeniden compile edilir.
Eski world-coordinate polyline proje içinde authoritative olarak tutulmaz.
10.5 Açık/kapalı operasyon politikası
engrave_line: açık ve kapalı edge’leri koruyabilir.
engrave_fill: kapalı silhouette veya açıkça tanımlı fill region gerektirir.
cut: varsayılan kapalı yol; açık cut gerekiyorsa allowOpenCut: true gibi açık bir politika taşımalıdır.
ignore: hiçbir toolpath üretmez.
removed: object ve edge refs compile aşamasında tamamen dışlanır.
cut-at-boundary: inside fragmentın operation’ı otomatik ignore olur; source graph lineage korunur.
10.6 Mevcut validator’ın yeri

Mevcut final material/bed validator kaldırılmamalı. Yeni semantic/provenance denetimleri onun önüne eklenmeli; kerf ve clip sonrasında mevcut final validator yine çalışmalıdır. Böylece:

Semantic sahiplik önce,
Fiziksel takım yolu geometrisi sonra,
Makine sınırı en son

doğrulanır.

laser_grbl.py semantic graph’ı bilmek zorunda değildir; yalnız üretilmiş ve doğrulanmış G-code’u göndermeye devam etmelidir.

11. Aşamalı uygulama planı
P0 — Güvenli dikey dilim
Amaç

Tam otomatik tanıma yapmadan, kullanıcıya gerçek graph tabanlı ayrım ve güvenli üretim sağlamak.

Dosya bazında
Dosya	P0 değişikliği
laser_editor_core.py	build_skeleton_graph, junction-region clustering, stable node/edge IDs, split_graph_edge, graph_to_preview_paths, compile_vector_objects
laser_editor_server.py	V2 response alanları, separation/commit API, V1/V2 generate dispatch
laser_editor/app.js	Graph/object state, object seçimi, object transformu, project v2, clone helpers, vector-only QA modu, cache revision
laser_editor/vector_edit.js	Saf graph hit-test, edge projection, exact split, junction gate grouping, object partition yardımcıları
laser_editor/index.html	“Nesne Ayır”, gate policy ve underlay seçenekleri
laser_editor/style.css	Graph edge, junction, gate, preview ve confidence durumları
test_vectorize_pipeline.py	Junction clustering, exact split, bird-gap fixture, branch-flower graph fixture
test_vector_edit.js	Edge split, ownership, transform, anchor policy, undo command testleri
test_packing.js	Pattern bounds ve packing’in nested object modelinden etkilenmediği regresyonu
dxf_to_laser_gcode.py	Mümkünse değişiklik yok; flattened ve doğrulanmış yolları tüketmeye devam etmeli
laser_grbl.py	Değişiklik yok; regresyon testleri
Yeni test_vector_object_gcode.py	Duplicate, ghost, ignore, mask, open/closed ve provenance testleri
P0 kullanıcı yeteneği
Vektör graph oluşturulur.
Kullanıcı junction’a veya lasso’ya göre alt graph seçer.
Gate’leri kes/koru yapar.
İki object oluşur.
Çiçek bağımsız taşınır/ölçeklenir.
Dal değişmez.
G-code compiler object modelinden düz yol üretir.
Undo ve save/open çalışır.
P0 çıkış kriteri
V1 projeler kayıpsız açılıyor.
Junction-cut atomic ve geri alınabilir.
0,5×/1,5× object scale dalı değiştirmiyor.
Aynı edge çift yakılmıyor.
Object taşındığında eski konumda powered path kalmıyor.
Mevcut testler ve yeni graph/G-code testleri geçiyor.
P1 — Otomatik öneri ve kullanıcı seed’li ayrım
Biconnected blocks, articulation ve cycle attributes
Contour-centerline ilişkileri
Width/tangent/curvature skoru
Conservative repair proposals
Lasso seed + edge graph cut
shared-node, pinned, detached
emit-underlay, mask-underlay, cut-at-boundary
Spatial index ve object Path2D cache
Confidence ve alternative proposal UI
Command-based undo’ya geçiş değerlendirmesi
P2 — Gelişmiş algısal ipuçları
Tekrarlanan motif descriptor’ları
Simetri ve shape matching
Domain fixture’larından confidence kalibrasyonu
Opsiyonel SAM/instance segmentation proposal’ları
Graph analysis worker/backend paralelleştirmesi
Öğrenilmiş gate score modeli
Büyük corpus benchmark ve otomatik regression dashboard
Mevcut fonksiyonlar için karar matrisi
Korunacak
thin_binary
_skeleton_neighbors
preserve_centerline_dot_components
straighten_centerline_paths
flatten_axis_aligned_centerline_runs
polish_centerline_curves
classify_vector_region_boundaries — yalnız operation hint olarak
Mevcut clip, kerf ve final material validator
Yeniden yapılandırılacak
trace_skeleton_vectors
→ build_skeleton_graph ve graph_to_vector_paths
stitch_raw_point_paths
→ propose_endpoint_repairs
stitch_open_vector_paths
→ confidence/provenance taşıyan graph edit proposal
snap_open_vector_endpoints_to_paths
→ endpoint-to-edge proposal; yüksek güven dışında otomatik mutation yok
fill_centerline_micro_holes
→ topology delta ve raster support raporlayan kontrollü cleanup
filter_vector_paths
→ graph edge quality ile derived toolpath filtering ayrılmalı
Karantinaya alınacak; hemen silinmeyecek
weld_open_endpoints
merge_coincident_open_paths
centerline_dense_junction_holes

Bunlar ancak yerel commit edilmemiş çalışma ağacındaki gerçek çağrı zinciri görüldükten ve fixture karşılaştırması yapıldıktan sonra kaldırılmalıdır.

12. Test planı

Mevcut Python testleri; junction anchor koruması, centerline solidify, doğal T snap ve yakındaki yan kontura yanlış snap yapılmaması gibi faydalı geometrik regresyonları kapsıyor. JavaScript vector_edit testleri ise tek-polyline repair, anchor ve smoothing davranışına odaklanıyor. Semantic object ownership, branch-flower transformu ve G-code duplicate provenance fixture’ları henüz görünmüyor.

12.1 Sentetik fixture matrisi
Fixture	Geometri	Varyasyonlar	Temel assertion
Kuş ayağı	Gerçek T junction + yakın fakat ayrı kısa parmaklar	1×/2×/4×, 0°/15°/45°, farklı stroke width, blur ve threshold	Yakın ayrı çizgi birleşmez; gerçek junction korunur
Dal + çiçek	Uzun düşük eğrilikli trunk + 5 çevrimli kompakt motif	Tek temas, çift temas, trunk merkezden geçiyor	Motif ayrılır; trunk değişmez
Dal + yaprak	Kapalı leaf loop + orta damar + dal	Midrib yaprağa veya dala atanabilir	İki ownership seçeneği de geçerli
Metin + alt çizgi	Counter içeren glyph benzeri loop ve temas eden çizgi	Tek/çift temas, farklı kalınlık	Harf boşluğu korunur; underline ayrı object
Gerçek continuous stroke	S-eğrisi, spiral veya kesintisiz flourish	Kendine yaklaşan fakat ayrılmaması gereken stroke	Auto split yapılmaz
Tekrarlanan motif	Aynı dala bağlı N benzer cycle cluster	Ölçek ve rotasyon varyasyonu	Her instance bağımsız object
G-code	Yukarıdaki object graph’larının üretim derlemesi	Move, scale, ignore, mask, shared refs	Duplicate/ghost/out-of-bounds yok
12.2 Kuş ayağı fixture’ı

Geometrik olarak şu alt senaryolar ayrı ayrı üretilmeli:

İki paralel kısa çizgi arası 0,25×, 0,5×, 1,0×, 1,5× local stroke width.
Gerçek T junction.
Endpoint’in uzun yolun ortasına yakın fakat beyaz bariyerle ayrı olduğu durum.
Diagonal tek-piksel yakınlık.
2–4 stroke-width uzunluğunda kısa parmak.
Threshold ile bir piksel köprü oluşan ve oluşmayan çift.
Stitch uygulanırsa component sayısını değiştiren candidate.
Stitch uygulanırsa yeni cycle yaratan candidate.

Assertions:

false_join_count == 0
true_junction_recall == 1.0
micro_edge_retained_length_ratio >= target
repair_proposal_confidence(false_join) < auto_threshold
repair_proposal_confidence(true_gap) >= expected_threshold
12.3 Dal + çiçek fixture’ı

Sentetik graph:

100 mm eşdeğerinde açık trunk.
5 petal cycle cluster.
Merkezde 3–5 iç stroke.
Trunk ile motif arasında:
bir gate,
iki gate,
trunk-through-center,
yalnız teğet temas

Testler:

Auto proposal varsa yalnız yüksek confidence’ta uygulanır.
Lasso seed ile doğru motif edge set’i bulunur.
Commit sonrası hiçbir edge iki exclusive object’te bulunmaz.
0,5× ve 1,5× flower scale uygulanır.
Branch canonical/world geometry değişimi tolerans içinde sıfırdır.
shared-node, cut-at-boundary ve iki underlay modu ayrı ayrı compile edilir.
Undo graph revision ve G-code hash’ini eski haline getirir.
Save/open sonrası aynı graph ve toolpath hash’i elde edilir.
12.4 Dal + yaprak
Leaf contour cycle
Midrib
Stem
Bir veya iki attachment

İki gold ownership:

A: leaf outline + midrib -> leaf
B: leaf outline -> leaf, midrib -> stem

Sistem her ikisini de kullanıcı gate override ile ifade edebilmelidir.

12.5 Metin + alt çizgi
O, A, P benzeri counter içeren sentetik glyph
Alt çizgiye bir veya iki noktadan temas
Counter çevrimlerinin cycle membership’i korunmalı
Underline ayrıldığında harf içinde açık fragment oluşmamalı
engrave_line ve cut operasyon varyasyonları test edilmeli
12.6 Gerçek continuous stroke

Özellikle yanlış pozitif önlemek için:

Tek kalemle çizilmiş S eğrisi
Kendine yakın spiral
Düşük açılı gerçek branch continuation
Uzun stroke üzerinde küçük curvature değişimi

Assertions:

auto_object_split_count == 0
continuity_cut_cost > threshold
user can still force explicit cut
12.7 Tekrarlanan motif
Aynı topolojiye sahip 3–8 motif
Hafif ölçek/rotasyon/noise farkları
Her motif farklı object ID
Birini transform etmek diğerlerinin geometry hash’ini değiştirmemeli
Repetition prior yalnız confidence artırmalı; ownership’i zorlamamalı
12.8 G-code fixture’ları

Her fixture için şu setler saklanmalı:

expected_active_object_ids
expected_canonical_edge_ids
expected_emission_keys
expected_powered_segment_count
expected_closed_cut_count
expected_open_engrave_count
expected_ignored_edge_ids

Testler:

ignore sıfır powered segment üretir.
Silinen/moved object eski konumda segment bırakmaz.
Shared anchor duplicate segment üretmez.
Shared edge conflict preflight hatası verir.
mask-underlay inside segmentleri çıkarır.
emit-underlay onları korur.
Kerf sonrası son yol material area dışına çıkmaz.
engrave_fill yalnız geçerli kapalı bölgeden çıkar.
engrave_line gerçek açık yolları korur.
12.9 Metamorphic testler

Aynı fixture için:

2× ve 4× raster çözünürlük
Eşik ±5/±10
Yatay/dikey mirror
90° rotasyon
Uniform scale
Küçük Gaussian noise
OpenCV ximgproc thinning ile fallback thinning

Topolojik sonuçların exact nokta listesi değil şu invariant’ları karşılaştırılmalı:

component count
junction gate count
cycle rank
object edge membership
attachment count
active toolpath provenance

thin_binary farklı backend kullanabildiği için üretim determinismi isteniyorsa thinning motoru sabitlenmeli veya her iki backend fixture’ları ayrı doğrulanmalıdır.

12.10 Gerçek fixture’lar

Verilen kuş PNG’si ve yakın plan ekranlar erişilebilir hale geldiğinde:

Kaynak dosyanın hash’i kaydedilmeli.
Raster crop koordinatları değil, graph edge/node ID’leriyle gold annotation oluşturulmalı.
Hatalı ve beklenen bağlantılar listelenmeli.
Gerçek vector-only SVG/JSON çıktısı fixture’a eklenmeli.
Preview raster kapalıyken görsel doğrulama yapılmalı.
Kaynak, threshold mask, skeleton, graph ve final toolpath ayrı debug artifact olarak saklanmalı.
13. Ölçülebilir başarı kriterleri

Aşağıdakiler mevcut sonuç iddiası değil, önerilen kabul hedefleridir.

Alan	Başarı ölçütü
Yüksek güvenli auto split	Precision ≥ %98; ilk sürümde recall daha düşük olabilir
Kuş false join	Kabul corpus’unda 0
Gerçek junction	Recall ≥ %99; kritik fixture’larda %100
Mikro-stroke korunması	Gold stroke uzunluğunun ≥ %98’i
Branch invariance	Flower 0,5×/1,5× scale sonrası branch Hausdorff farkı ≤ max(0,02 mm, 0,25 mapped source pixel)
Object bağımsızlığı	Bir object transformunda diğer object graph/transform hash’i değişmez
Kullanıcı düzeltme maliyeti	Bir lasso/tık + en fazla iki gate toggle + onay
Duplicate burn	0 beklenmeyen duplicate emission key
Hayalet yol	0 stale-transform provenance
Ignore güvenliği	0 powered segment
Alan güvenliği	Kerf/clip sonrası 0 tabla veya material-area ihlali
Proje migrasyonu	V1 → V2 → save/open sonrası operation ve geometri kaybı 0
Undo/redo	Graph, object ve toolpath hash’i tam geri döner
Determinizm	Aynı image/settings/engine ile aynı graph ID/topology hash’i
Canvas hover	P95 < 8 ms
Canvas frame	Drag/zoom sırasında P95 < 16,7 ms
Lasso proposal	10.000 noktalı örnekte P95 < 100 ms veya async preview
Graph analizi	Skeleton hazır olduktan sonra P95 ≤ 750 ms hedefi
Toplam vectorization	Referans makinede 1254→4800 örneğinde ≤ 5 s hedefi
Bellek	4800² analizinde kontrollü peak; tercihen < 512 MB

4800² görüntü yaklaşık 23 milyon pikseldir. Tek uint8 mask yaklaşık 23 MB, tek float32 distance field yaklaşık 92 MB tutar. Birden fazla mask, skeleton ve OpenCV geçici buffer’ları birlikte yüzlerce MB’a ulaşabilir. Bu nedenle:

Distance field bir kez hesaplanmalı.
Gereksiz raster ara dizileri erken serbest bırakılmalı.
Proje JSON’una pixel support array’i yazılmamalı.
Graph’ta kompakt width/support özetleri tutulmalı.
Her draw çağrısında graph analizi yapılmamalı.
Hit-test için object AABB + uniform spatial grid/R-tree kullanılmalı.
Her object için Path2D ve zoom-LOD cache tutulmalı.
Yalnız değişen object’in cache’i invalidate edilmelidir.
14. Açık sorular ve varsayımlar
Yerel diff bilinmiyor. Remote main 2× trace sınırına sahipken brief yaklaşık 3,83×/4800 px yerel geliştirme tarif ediyor. P0 kod planı uygulanmadan önce yerel git status, git diff ve gerçek çağrı zinciri karşılaştırılmalı.
Gerçek PNG’ler incelenemedi. Kuş ayağına ilişkin kök neden analizi kod ve kullanıcı gözlemlerine dayanıyor; gerçek hata noktasında siyah piksel köprüsü mü, stitch mi, endpoint-to-path snap mi olduğu henüz ölçülmüş değil.
“Dal çiçeğin altında devam etsin” üretim anlamı netleştirilmeli. Dal gerçekten lazerle yakılacak mı, yoksa yalnız source geometry olarak korunup çiçek altında maskelenecek mi? Bunlar ayrı seçenek olmalıdır.
Açık cut politikası tanımlanmalı. Ürün bilinçli açık kesim yollarına izin veriyorsa validator bunu explicit işaretle kabul etmeli; aksi halde açık cut preflight uyarısı vermelidir.
Shared geometry ve multi-pass politikası belirlenmeli. Aynı canonical edge’in hem cut hem engrave edilmesi bazı özel işlerde istenebilir. Varsayılan conflict olmalı; izin explicit olmalıdır.
Pattern resize semantiği kesinleştirilmeli. Tüm pattern resize edildiğinde object transformları pattern ile ölçeklenecek mi, yoksa locked/preserve nesneler fiziksel mm boyutunu koruyacak mı? Veri modeli her iki davranışı desteklemeli.
Çoklu anchor transformu: Bir motif iki noktadan dala bağlıysa nonuniform scale mathematically overconstrained olabilir. UX; detach, tek anchor’a pin veya deformable bağlantı seçeneklerinden birini istemelidir.
Source raster proje içinde kalacak mı? Kaynak dosya bulunamazsa graph ve object editleri devam edebilir; ancak yeniden threshold/analysis yapılamaz. Proje taşınabilirliği için image hash ve opsiyonel embedded source politikası gereklidir.
Semantic adlandırma ayrı karar olmalı. Yapısal graph analizi nesneyi güvenilir biçimde ayırabilir fakat ona “çiçek” adı vermek için semantic classifier gerekir. P0/P1 otomatik adları yapısal tutmalıdır.
Contour-centerline hibriti mod bazında uygulanmalı. filled-ornament için region ağırlığı yüksek, line-engrave için stroke graph ağırlığı yüksek olabilir; tek scoring profili bütün modlara zorlanmamalıdır.
Confidence kalibrasyonu için corpus gerekli. Eşikler tek kuş görselinden seçilmemeli; kuş ayağı, dal-yaprak, metin-alt çizgi, continuous stroke ve tekrar motiflerinden oluşan etiketli corpus kullanılmalıdır.
Mimari güven düzeyi: Graph + object ownership + derived toolpath ayrımı konusunda güven yüksektir. Otomatik gate skorlarının exact ağırlıkları ve auto-apply eşiği için gerçek fixture ölçümü yapılmadan güvenilir sabit değer verilemez.

Nihai öneri: İlk sürümde semantic tanımayı büyütmek yerine canonical graph’ı doğru kurup kullanıcı nesnesini graph’tan ayıran açık sahiplik modelini ve junction-cut dikey dilimini tamamlayın. Otomatik analiz bu modelin üstünde öneri üretmeli; G-code ise yalnız doğrulanmış object ownership’ten türetilmelidir.