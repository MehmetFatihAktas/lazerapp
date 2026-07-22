# Danisma: GRBL Lazer Icin Profesyonel Dolgulu Yazi G-code Uretimi

Sen, GRBL/GRBLHAL tabanli diyot lazerlerde raster ve vektor dolgu kazima, hareket planlama, step motor dinamigi ve G-code uretimi konusunda uzman bir CNC/lazer yazilim muhendisisin.

Amacimiz, kendi lazer editorumuzun **dolgulu yazi kazima G-code algoritmasini** profesyonel hale getirmek. Genel tavsiye vermek yerine asagidaki gercek dosya olcumlerini incele, olasi nedenleri sirala ve uygulanabilir bir algoritma oner.

## Sorun

- Ayni yazi bazen duzgun, bazen fiziksel olarak yamuk/kaymis basiliyor.
- Bazi denemelerde harflerin bir bolumu yana kayiyor, satirlar ust uste biniyor veya yazi egik gorunuyor.
- Kayis gerginligi ve temel mekanik kontrol normal gorunuyor; yine de adim kaybi, ivme, kasnak, ray surtunmesi ve planner davranisi ihtimal dahilinde.
- G-code geometrisinin kendisinde hata olup olmadigini ve en saglam dolgu tarama yontemini ayirmak istiyoruz.

## Makine ve Kontrol Varsayimlari

- GRBL/GRBLHAL sinifi kontrolcu
- Diyot lazer
- Lazer modu acik olmali: `$32=1`
- Dinamik lazer komutu: `M4`
- Proje profili `maxS=1000`; dosyadaki `S200` yaklasik `%20` guce denk geliyor
- Gercek `$100/$101`, `$110/$111`, `$120/$121`, mikrostep ve mekanik degerler henuz bu incelemede dogrulanmadi

Bu varsayimlardan biri karari etkiliyorsa bunu acikca belirt ve hangi degerin olculmesi gerektigini yaz.

## Incelenen Gercek Dosya

Dosya: `YAZITESTI.nc`

Olculen ozet:

| Ozellik | Deger |
|---|---:|
| G-code satiri | 2180 |
| Lazer acik hareket | 914 |
| Tarama satiri | 168 |
| Nominal satir araligi | 0.08 mm |
| Lazer acik hiz | F1800 mm/dk = 30 mm/sn |
| Satir geri donus hizi | F3000 mm/dk = 50 mm/sn |
| Lazer gucu | S200 |
| Tarama yonu | Tum lazer acik hareketler soldan saga |
| Sabit overscan | Her iki tarafta 2.0 mm |
| Aktif geometri bbox | X 14.384..50.914, Y 12.844..26.844 mm |
| Kazima uzunlugu | 2565.9 mm |
| Lazer kapali hareket | 8192.4 mm |
| Tahmini sure | 286.2 sn |
| Yay / desteklenmeyen komut | Yok |
| Guvenli kapanis | `M5 S0`, sonra `G0 X2 Y2` |

Geometrik denetim sonucu:

- 914 lazer acik segmentin tamami yataydir (`Y1 == Y2`).
- Tamami pozitif X yonundedir (`X2 > X1`).
- Sifir veya negatif uzunluklu lazer segmenti yoktur.
- 168 tarama satirinin 167 ardarda araligi tam `0.08 mm`'dir.
- Tek `0.72 mm` Y boslugu, gorunen `I/İ` harfinin noktasi ile govdesi arasindaki dogal bosluktur.
- Her satirin bas ve sonundaki overscan 2.0 mm'dir (yuvarlama nedeniyle bir satirda 1.999 mm).
- Modal baslik dogrudur: `G21`, `G90`, `G94`, `M4 S0`.
- Dosyada guvenlik uyarisi veya cozulmeyen hareket yoktur.

Tek tutarsizlik: yorum satiri `(engrave vector Metin: SAM R0)` diyor, fakat lazer-acik geometri onizlemesi `SAIM/SAİM` biciminde. Bunun nesne adi/metadata eskimesi mi yoksa gercek kaynak metin uyusmazligi mi oldugunu da ayri bir yazilim hatasi olarak degerlendir. Fiziksel yamulmanin nedeni oldugunu varsayma.

## Mevcut G-code Deseni

Her satir kabaca boyle uretiliyor:

```gcode
G1 X32.4050 Y26.8437 F3000 S0   ; onceki satirdan sola hizli capraz geri donus
G1 X34.4050 Y26.8437 F1800 S0   ; 2 mm lead-in / overscan
G1 X35.8280 Y26.8437 F1800 S200 ; dolu bolge
G1 X37.8280 Y26.8437 S0         ; 2 mm lead-out

G1 X32.2113 Y26.7637 F3000 S0   ; sonraki satira sola hizli geri donus
G1 X34.2113 Y26.7637 F1800 S0
G1 X35.9923 Y26.7637 F1800 S200
G1 X37.9923 Y26.7637 S0
```

Bir satirda birden fazla harf adasi varsa kafa soldan saga tek geciste ilerliyor, adalar arasinda `S0`, dolu bolgelerde `S200` kullaniliyor. Satir bitince lazer kapali olarak `F3000` ile sola ve bir sonraki Y konumuna capraz geri donuyor.

## Ozellikle Cevaplanacak Sorular

### 1. Dosya Geometrisi

1. Yukaridaki olcumlere gore G-code koordinat geometrisinde yamuk yazi uretecek bir hata var mi?
2. Tum lazer-acik segmentlerin yatay ve ayni yonde olmasi, geometrinin matematiksel olarak duz oldugunu kanitlamak icin yeterli mi?
3. Metadata `SAM` ile gorunen `SAIM/SAİM` farki hangi katmanda kontrol edilmeli?

### 2. Fiziksel Kayma Icin Kok Neden Siralamasi

Asagidaki ihtimalleri olasilik ve kanit sirasi ile degerlendir:

- Her 0.08 mm satirda `F3000` ters yon/capraz geri donusun adim kaybina yol acmasi
- `$120/$121` ivmesinin fazla olmasi
- 2 mm overscan'in F1800 hizina ulasmak icin yetersiz olmasi
- X kasnak setskuru, motor mili, ray surtunmesi veya kablo suruklemesi
- Seri aktarim/buffer problemi
- M4 dinamik gucun hizlanma bolgesindeki optik etkisi
- Bir yonlu taramada termal egilme veya malzeme hareketi
- Koordinat yuvarlama ya da satir araligi hatasi

Her madde icin "geometriyi kaydirir", "yalnizca tonu etkiler" veya "ikisini de etkileyebilir" siniflandirmasi yap.

### 3. En Iyi Dolgulu Yazi Tarama Algoritmasi

Su secenekleri karsilastir ve bu makine sinifi icin bir varsayilan sec:

1. Tek yonlu tarama: her satir soldan saga, lazer kapali geri donus
2. Cift yonlu serpantin: satirlar sirayla soldan saga ve sagdan sola
3. Tum nesne bbox'i boyunca sabit baslangic/bitisli raster
4. Her satirin dolu bbox'ina gore degisken baslangic/bitisli raster
5. Kontur-paralel veya offset-pocket dolgu

Karsilastirma olcutleri:

- Backlash ve yon degisimi hassasiyeti
- Adim kaybi riski
- Kazima kalitesi
- Kose/kenar koyulugu
- Sure
- Planner ve seri buffer yuku
- Coklu harf adalari ve harf ic bosluklari

### 4. Overscan Hesabi

Sabit 2 mm yerine fiziksel ivmeye dayali bir overscan formulu oner. En az su modeli tartis:

```text
d_accel = v^2 / (2 * a)
d_overscan = d_accel + emniyet_payi
```

- `v`: gercek kazima hizi, mm/sn
- `a`: ilgili eksen ivmesi, mm/sn^2

F500, F750, F1000 ve F1800 icin; `a=50, 100, 200, 500 mm/sn^2` ornek tablosu ver.

GRBL planner/junction davranisi nedeniyle bu basit formulu nasil emniyetli hale getirecegimizi acikla. Overscan tabla sinirina sigmiyorsa hiz dusurme, nesneyi kaydirma veya islemi engelleme kararini belirt.

### 5. Onerilen G-code Satir Sablonu

Tek bir scanline ve sonraki satira gecis icin uretime hazir, acik bir G-code ornegi ver. Sunlari netlestir:

- `G0` mi `G1 S0` mi kullanilmali?
- Geri donus hizi kazima hizindan yuksek olmali mi?
- Y adimi X geri donusuyla capraz mi, ayri hareket mi olmali?
- `S` ayni satirda mi degismeli?
- `M4` bir kez header'da mi kalmali?
- Satir basinda gercek sabit hiza ulasilmasi nasil garanti edilir?
- Is sonunda `M5`, `S0` ve guvenli donus sirasi ne olmali?

### 6. Makine/G-code Ayrim Testi

Sorunun dosyada mi makinede mi oldugunu kesinlestirecek kucuk ve dusuk riskli bir test plani tasarla:

- Lazer kapali kare/izgara frame testi
- Ayni yatay cizgiyi 20-50 kez tekrarlama testi
- Tek yonlu ve cift yonlu dolgu karsilastirmasi
- F500/F750/F1000/F1800 hiz kademeleri
- Dusuk guc ile yazili test
- 90 derece dondurulmus ayni geometri testi
- Kumpasla olculecek referans noktalar

Her test icin beklenen sonucu ve hangi arizayi kanitladigini yaz. Once mekanik olarak guvenli testleri sirala.

### 7. Uygulamaya Entegrasyon

Uretici icin implementation-ready pseudocode ver:

- Polygonlardan even-odd scanline araliklari uretme
- Global Y fazi ve sabit line interval
- Ayni satirdaki adalari siralama/birlestirme
- Lazer kapali bosluklar
- Ivmeye dayali overscan
- Tabla siniri kirpma/engel mantigi
- Tek yonlu ve opsiyonel kalibre edilmis cift yonlu mod
- Satir bazli hareket ve guc komutlari
- Preflight kontrolleri

Ardindan birim/regresyon testlerini listele. En az su invariant'lar test edilsin:

- Lazer acik tum segmentler scan eksenine paralel
- Satir araligi tolerans icinde
- Lazer acikken travel veya ters yon yok
- Overscan lazersiz ve tabla icinde
- Satirlar arasinda lazer mutlaka sifir
- Header/footer modal ve guvenli
- Geometri hash'i ayni girdide deterministik
- Text etiketi ile gercek glyph kaynagi ayni revision'dan geliyor

## Beklenen Cevap Formati

1. **Kisa karar:** Mevcut dosyada geometri hatasi var/yok ve neden
2. **Kok neden siralamasi:** olasilik, kanit, nasil dogrulanir
3. **Onerilen varsayilan algoritma**
4. **Overscan hesap tablosu**
5. **Ornek G-code**
6. **Uygulama pseudocode'u**
7. **Makine test protokolu**
8. **Kabul kriterleri ve regresyon testleri**

Belirsiz bilgileri gercek gibi kabul etme. "Kayislari sik" gibi tek cumlelik genel cevap verme. Hangi onerinin geometrik dogrulugu, hangisinin ton kalitesini, hangisinin adim kaybi riskini etkiledigini ayri ayri acikla.
