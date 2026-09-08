# Veteriner kliniği listesi: kaynaklar ve kullanım kuralları

> Bu metin hukuki mütalaa değildir. Hukuki değerlendirmelerin tamamı `[avukat teyidi]` gerektirir.

## 1) Kısa cevap (8 madde)

1. **En iyi kaynak Tarım ve Orman Bakanlığı'nın ruhsatlı tesis Excel listeleridir**: ücretsiz, 9.344 aktif kayıt; ad, ticari unvan, il/ilçe, ruhsat no, sorumlu hekim, personel sayısı, adres ve 4.844 kayıtta e-posta içerir, **telefon maskelidir** (`0(5xx)xxx 2359`).
2. **İkinci sırada il veteriner hekimler odalarının kendi dizinleri gelir**: Ankara Odası 581 kaydı ad/sorumlu hekim/**telefon**/adres ile ücretsiz yayımlar; Bursa Odası 345 kaydı telefonsuz yayımlar.
3. **İstanbul'da oda listesi yoktur**: İVHO (ivho.org.tr) herkese açık klinik dizini yayımlamıyor; ücretsiz alternatif İBB Açık Veri'deki 791 koordinatlı kayıttır (telefonsuz).
4. **OSM/Overpass ücretsiz ve hukuken en rahat kaynaktır**: ODbL, ticari kullanım serbest, liste şirket dışına çıkmadığı sürece share-alike ve atıf yükümlülüğü doğmaz; telefon boşluklarını kapatmak için idealdir.
5. **Google Places API teknik olarak en iyi, hukuken kapalıdır**: Maps Platform Şartları 3.2.3(a) "işletme adlarını ve adreslerini kopyalayıp kaydetmeyi" açıkça yasaklar; kalıcı saklanabilen tek alanlar `place_id` (süresiz) ve lat/lng (30 gün).
6. **Başvuru/onay gerektirenler**: CİMER-bilgi edinme (15-30 gün, telefon talebi reddedilir), Foursquare OS Places (ücretsiz ama hesap + onay), oda protokolü, Yandex/HERE (yıllık ticari sözleşme).
7. **Almayın/yapmayın**: hazır firma listesi satın almak (KVKK sorumluluğu size geçer) ve ticari rehberleri kazımak (TTK m.55/1-c + FSEK Ek m.8).
8. **Listeyi nasıl kullanabilirsiniz**: yüz yüze ziyaret **EVET** (6563 kapsamı dışı); telefon araması, e-posta ve SMS **ŞARTLA** (İYS kaydı + ret kontrolü zorunlu); binlerce kliniğe tek seferde toplu tanıtım SMS'i **HAYIR** (ceza on katına kadar artar).

## 2) Kaç klinik var?

| Kapsam | Sayı | Tarih | Kaynak |
|---|---|---|---|
| Türkiye, aktif ruhsatlı tesis | **9.344** (9.101 muayenehane + 130 poliklinik + 113 hayvan hastanesi) | 06/01/2025 | Bakanlık Excel listeleri |
| İstanbul | **1.124** (1.050 + 58 + 16) | 06/01/2025 | Aynı dosyalar |
| İstanbul | **892** (849 + 32 + 11) ve 1.357 aktif hekim | 14/03/2022 | İstanbul İl Tarım ve Orman Müdürlüğü |
| Ankara / İzmir / Konya / Antalya / Bursa | 513 / 444 / 433 / 356 / 267 | 06/01/2025 | Aynı dosyalar |

İstanbul 2022→2025 arasında %26 büyümüş, poliklinik sayısı 32'den 58'e çıkmıştır: yazılıma bütçe ayıran segment en hızlı büyüyen segmenttir. TÜİK'te veteriner kliniği/hekimi istatistiği **bulunamadı**; Türkiye geneli toplam hekim sayısı için güncel resmi rakam da **bulunamadı** (2022'de "Bakanlık bünyesinde 9.531 hekim" verisi yalnızca kamu istihdamıdır).

**Açık kaynakların kapsama beklentisi:** İBB verisi İstanbul'da 791/1.124 ≈ **%70** (2020 kesitli, telefonsuz). OSM bundan daha düşük ve il/ilçe bazında çok dengesizdir. Pratik beklenti: **OSM tek başına gerçek evrenin yarısından azını verir**; Bakanlık omurgası + OSM/oda telefonu birleşimi %90+'a çıkar.

## 3) Kaynak karşılaştırma tablosu

| Kaynak | Kapsam | Alanlar (ad/adres/telefon/web) | Maliyet | Yasal durum | Erişim yolu | Tavsiye |
|---|---|---|---|---|---|---|
| **OSM / Overpass** | Eksik, büyükşehir ağırlıklı | Ad ✔ / diğerleri kısmen + koordinat | Ücretsiz | ODbL; ticari kullanım serbest, iç kullanımda share-alike doğmaz | Overpass API, anahtarsız | **Kullan** — telefon zenginleştirme katmanı |
| **Google Places API** | En kapsamlı ve güncel | Hepsi ✔ (telefon/web yalnız Enterprise) | Text/Nearby Pro 32, Enterprise 35 USD /1000; Details Enterprise 20 USD /1000 | ToS 3.2.3(a) kaydetmeyi, 3.2.3(d)(iii) "rehber/reklam ürünü" kullanımını yasaklar | API + faturalandırma | **Liste kurmak için kullanma**; yalnız canlı doğrulama |
| **İVHO ve il odaları** | İl bazlı | Ankara: ad+hekim+**telefon**+adres (581); Bursa: ad+hekim+adres (345); İstanbul: liste yok | Ücretsiz | Kamuya açık; telefonlar çoğunlukla hekimin cebi → KVKK riski yüksek | HTML scrape; İstanbul için odaya başvuru | **Kullan**; telefonları gönderim değil arama listesi say |
| **Bakanlık ruhsat kayıtları / bilgi edinme** | Türkiye geneli 9.344 | Ad ✔ / Adres ✔ / Telefon **maskeli** / Web ✘ + e-posta (4.844) + ruhsat no | Ücretsiz | Kamuya açık; ancak vergi no + gerçek kişi adı + kişisel e-posta içerir | .xls indirme; 404 ise Web Archive; güncel sürüm için CİMER | **Omurga olarak kullan** |
| **TOBB / oda kayıtları (NACE 75)** | Parçalı, 300+ ayrı portal; şahıs işletmeleri çoğunlukla esnaf odasında | Unvan ✔ / Adres ✔ / Telefon kısmen / Web genelde boş | Ücretsiz | Kamuya açık | Oda portalları tek tek; TOBB toplu indirmesi **doğrulanamadı** | **İkincil** — tüzel kişi doğrulaması |
| **Ticari liste satıcıları** | Doğrulanamıyor | İddiaya göre hepsi | Fiyat yayımlanmıyor | KVKK 21/07/2026 duyurusu: verinin üçüncü kişiden alınması tek başına hukuki dayanak sağlamaz | Satıcı ile sözleşme | **Alma** |
| **Web kazıma (rehber siteleri)** | Geniş ama güvenilmez | Değişken | Sunucu maliyeti | TTK m.55/1-c haksız rekabet + FSEK Ek m.8 veritabanı hakkı | Bot/scraper | **Ticari rehberleri kazıma**; kamu sayfaları düşük riskli |
| **Sosyal medya (Instagram/Facebook)** | Geniş ama yapısız | Ad, bazen telefon/DM | Ücretsiz | Meta Otomatik Veri Toplama Şartları izinsiz kazımayı yasaklar | Elle | **Veri kaynağı yapma**; elle DM düşük riskli satış kanalı |

Ek ücretsiz kaynaklar: İBB Açık Veri (791 koordinatlı İstanbul kaydı, XLSX), il tarım müdürlüğü sayfaları (Artvin: 22 kayıt; ilçe/ad/hekim/**telefon**), Anadolu Sigorta anlaşmalı veteriner PDF'i (166 kayıt; ad/il/ilçe/adres/telefon, 2022), Overture Places (CDLA-Permissive-2.0), Foursquare OS Places (Apache-2.0, gated).

## 4) Adım adım: daha kapsamlı liste nasıl elde edilir

1. **Omurgayı indir (gün 1).** Üç Bakanlık .xls dosyasını al. Canlı adres 404 verirse Web Archive kopyalarını kullan; Türkiye'den tarayıcıyla mutlaka tekrar dene — daha güncel sürüm olduğuna dair güçlü işaret var (üçüncü taraf bir site İstanbul için 1.214 diyor, bizim dosyada 1.124).
2. **Vergi no sütununu sil** — pazarlama için gereksiz, ihlalde ağırlaştırıcı.
3. **Segmentle.** Personel sayısı ≥3 muayenehaneler + 130 poliklinik + 113 hayvan hastanesi ≈ 1.000 kayıtlık gerçek hedef kitle.
4. **Telefonu doldur.** OSM/Overpass + Ankara Odası (576 benzersiz telefon) + il tarım müdürlüğü sayfaları + sigorta anlaşmalı klinik PDF'leri. Eşleştirme anahtarı: normalize edilmiş ad + ilçe; ikinci tur: koordinat (100-150 m) + ad benzerliği (Jaro-Winkler ≥0,85).
5. **Mükerrer temizle.** Öncelik sırası: ruhsat (belge) no > vergi no > ad+ilçe > koordinat. Her kayıtta `kaynak`, `lisans`, `cekim_tarihi`, `alici_tipi (TACIR/GERCEK_KISI/BELIRSIZ)` sütunlarını tut; Overpass sorgusunu ve ham JSON yanıtını arşivle — denetimde "bu numarayı türetmedik/satın almadık" savunmasının tek kanıtı budur.
6. **İstanbul için odaya yaz.** Yönetmelik m.11: "Ruhsat verilmiş muayenehane ve poliklinikteki veteriner hekimlerin adı-soyadı, muayenehane ve polikliniğin adresi, ruhsat tarih ve numarası bölge veteriner hekimler odasına bir yazıyla bildirilir." Oda, ilin tam listesine yasal olarak sahiptir. Talebiniz "liste verin" değil **"üyelerinize indirim protokolü"** olsun: duyuruyu oda yapar, siz SMS atmazsınız, 6563 riski sıfırlanır.
7. **Bilgi edinme başvurusu (yedek yol).** CİMER'e taslak metin: *"4982 sayılı Kanun kapsamında, Bakanlığınızın 'Çalışma İzni Verilen Özel Klinikler' sayfasında kamuya açık olarak yayımlanan ruhsatlı muayenehane, poliklinik ve hayvan hastanesi listelerinin en güncel sürümünün elektronik ortamda (Excel) tarafıma iletilmesini talep ederim."* Amacı ticari/pazarlama olarak belirtme, telefon/kişisel iletişim bilgisi isteme — reddedilir. Ret halinde 15 gün içinde BEDK'ye itiraz.
8. **Google'ı yalnız doğrulama için kur (opsiyonel).** Text Search (Pro) + telefon için Place Details (Enterprise); 81 il taraması kabaca 170 USD. **Sonucu diske yazma** — kalıcı tabloda yalnızca `place_id` tut. Maliyet engel değil, lisans engel.
9. **3-6 ayda bir yeniden doğrula**; kapanmış/taşınmış klinikleri işaretle.

## 5) Hukuk: bu listeyle ne yapabilirsin

### Kanal bazlı karar tablosu `[avukat teyidi]`

| Kanal | Karar | Şart |
|---|---|---|
| **Yüz yüze ziyaret / kartvizit** | **EVET** | 6563 elektronik ortam tanımı dışında; İYS ve onay yükümlülüğü yok. Kartviziti CRM'e girersen KVKK m.5 dayanağı + aydınlatma gerekir. |
| **Telefonla arama** | **ŞARTLA** | Arama da "ticari elektronik ileti"dir (Yön. m.4/1-o "telefon, çağrı merkezleri"ni sayar). Tacir/esnafta onay gerekmez ama İYS kaydı + ARAMA kanalında ret kontrolü zorunlu; görüşme başında ticaret unvanı ve "tanıtım" ibaresi. |
| **E-posta** | **ŞARTLA – en temiz elektronik kanal** | Aynı İYS zinciri. Konu satırında "Tanıtım", gövdede MERSİS + unvan, tek tıkla ret. `info@`/`klinik@` gibi kurumsal rol adresleri tüzel kişide KVKK dışıdır → ilk dalga için en uygun hedef. |
| **SMS** | **ŞARTLA – en riskli** | Aynı İYS zinciri + SMS'te MERSİS no ve başta "TANITIM" ibaresi. Toplu gönderimde ceza on katına çıkar; cep numarasında KVKK riski de açılır. |

### Tacir istisnası — tam metin ve sınırı `[avukat teyidi]`

Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik **m.6/3**: *"Tacir veya esnaf olan alıcıların elektronik iletişim adreslerine gönderilen ticari elektronik iletiler için önceden onay alınması zorunlu değildir. Ancak tacir ve esnafların 9 uncu maddede yer alan reddetme hakkını kullanması halinde onayları alınmadan ticari elektronik ileti gönderilemez."*

Sınırı **m.6/6**'dır: *"Üçüncü fıkra kapsamında ileti gönderilmesinden önce tacir veya esnaf olan alıcıların elektronik iletişim adresleri hizmet sağlayıcı tarafından İYS'ye kaydedilir ve İYS üzerinden alıcıların ret hakkını kullanıp kullanmadığı kontrol edilir."* m.6/5 İYS kontrolü muafiyetini bilinçli olarak 1., 2. ve 4. fıkralara tanır — **3. fıkra (tacir) muafiyetin dışındadır**. Yani "tacire onay gerekmez" doğru ama yarım cümledir. `[avukat teyidi]`

### İYS yükümlülüğü `[avukat teyidi]`

Yön. m.5/2: ileti göndermek isteyenler İYS'ye kaydolur. m.11/6-7: aracı hizmet sağlayıcı, İYS'ye kayıtlı olmayan gönderici için ve onaysız alıcıya gönderimi **başlatmaz**. Ret talebi 3 iş günü içinde uygulanır (m.10/1) ve 3 iş günü içinde İYS'ye bildirilir (m.9/6). Teserix müşterileri adına gönderim yaptığında **aracı hizmet sağlayıcı** sıfatını da kazanır; müşterilerinin İYS uyumunu denetleme yükümlülüğü ürüne yük olur.

### KVKK `[avukat teyidi]`

- **Kapsam:** Ltd/A.Ş. unvanı + santral + kurumsal e-posta KVKK dışıdır. Muayenehaneler gerçek kişi hekim adına ruhsatlandırıldığından listenin büyük kısmı **kapsam içidir**; belirsizleri kapsam içi say.
- **Meşru menfaat (m.5/2-f):** kullanılabilir ama Kurul pazarlama gönderimlerinde bugüne dek kabul etmemiştir (2022/1072: 50.000 TL; 2022/902: 30.000 TL; 2021/1210). Yazılı denge testi hazırlayıp dosyalayın; kapsamı kurumsal adreslerle sınırlayın.
- **"Zaten internette açıktı" savunması:** KVKK'nın 16.12.2020 alenileştirme duyurusuna göre geçersiz; 2022/861 kararında arama motorundan bulunan iş e-postasına gönderilen pazarlama e-postası 150.000 TL ile cezalandırıldı. AYM'nin 27.01.2026 tarihli Viennalife kararı (RG 16.06.2026/33282) bu gerekçeyle ceza kesilmesini kanunilik yönünden sakatladı; bu **serbestlik değil, belirsizliktir**.
- **Aydınlatma (m.10 + Tebliğ m.6-b):** veri kişiden alınmadığı için **ilk iletişim esnasında** yapılmalı. Pratik: "Bilgileriniz açık kaynaklardan alınmıştır. Aydınlatma metni: teserix.com/kvkk".
- **VERBİS:** 50 çalışan **ve** 100 milyon TL bilanço altındaki Teserix muaftır (Kurul 2023/1154); muafiyet aydınlatma, m.5 dayanağı, veri güvenliği ve 30 günde başvuru yanıtlama yükümlülüklerini kaldırmaz. Kliniklerin hasta sahibi verisi bakımından Teserix **veri işleyendir**: yazılı veri işleyen sözleşmesi şart (m.12/2).

### Cezalar (2026) `[avukat teyidi]`

- 6563 m.12/1-a onaysız gönderim: **2.859 – 14.309 TL**; m.12/2 "bir defada birden fazla kimseye" gönderimde **on katına kadar → 143.090 TL**; m.12/4 bir yıl içinde tekrarda iki katı (Tebliğ, RG 25.12.2025/33118).
- KVKK m.18/1-b veri güvenliği (Kurul'un izinsiz pazarlamada fiilen kullandığı bent): **256.357 – 17.092.242 TL**; m.18/1-a aydınlatma: **85.437 – 1.709.200 TL**.
- İki otorite ayrı ayrı ceza keser; mahsuplaşma yoktur.

## 6) Teserix için önerilen yol (ilk 30 gün)

- **Gün 1-5 – Veri.** Bakanlık omurgasını kur, İstanbul'u ayır (1.124), poliklinik + hayvan hastanesi + personel ≥3 filtresiyle **~150-200 kayıtlık A listesi** çıkar. İBB koordinatlarıyla Kadıköy (146), Beşiktaş (56), Şişli/Bakırköy/Maltepe (39'ar) rotalarını kur.
- **Gün 1-10 – Altyapı, paralel.** MERSİS numarası → İYS hizmet sağlayıcı kaydı + taahhütname (temel hizmetler ücretsiz) → marka ve ARAMA/E-POSTA kanalları tanımı → teserix.com/kvkk aydınlatma metni → yazılı meşru menfaat değerlendirmesi → kalıcı ret (suppression) listesi.
- **Gün 6-20 – Saha.** Kadıköy-Beşiktaş-Şişli hattında **günde 8-10 klinik ziyareti**, hedef 100+ yüz yüze temas. Hukuken en temiz kanal budur ve İYS beklemez.
- **Gün 15-30 – Arama ve e-posta.** A listesindeki kurumsal adreslere (Bakanlık dosyasındaki `info@`/klinik alan adlı e-postalar) İYS ret kontrolünden geçmiş, m.8 uyumlu **tekil** tanıtım e-postası; ardından telefonla takip.
- **Gün 10-30 – Oda kanalı.** İVHO'ya "üyelere özel indirim protokolü" teklifi; paralel olarak TVHB listesinden Ankara, İzmir, Bursa, Antalya odalarına aynı teklif. Riski en düşük, dönüşümü en yüksek kanal budur.

**Kırmızı çizgiler:**
1. **Toplu tanıtım SMS'i atma.** 6563 m.12/2 tam olarak bu senaryoyu on kat cezalandırır; dahası SMS sağlayıcı hesabınız (Netgsm, VatanSMS vb.) İYS uyumsuz gönderimde kapanır — bu risk cezadan hızlı gerçekleşir ve **ürününüzü durdurur**.
2. **Cep numaralarına ve `@gmail.com` gibi kişisel adreslere ilk dalgada dokunma.** Yalnız kurumsal adres ve sabit hat.
3. **Google Places çıktısını CSV'ye yazma**; `place_id` dışında hiçbir alanı kalıcı tutma.
4. **Hazır firma listesi satın alma, ticari rehber kazıma.**
5. **Listeyi hiçbir üçüncü kişiye satma/paylaşma** — hem ODbL hem KVKK aktarım ihlali doğurur.
6. **Vergi no sütununu saklama**, sil.

## 7) Kaynaklar

- Bakanlık ruhsatlı klinik listeleri: https://www.tarimorman.gov.tr/Konu/1122/calisma-izni-verilen-ozel-klinikler | arşiv: https://web.archive.org/web/20250708161801id_/https://www.tarimorman.gov.tr/GKGM/Belgeler/DB_Hayvan_Sagligi/ruhsatli_ozel_klinikler.xls
- Veteriner Hekim Muayenehane ve Poliklinik Yönetmeliği (m.11): https://www.mevzuat.gov.tr/File/GeneratePdf?mevzuatNo=15393&mevzuatTur=KurumVeKurulusYonetmeligi&mevzuatTertip=5 | https://www.resmigazete.gov.tr/eskiler/2011/10/20111015-2.htm
- Ankara VHO: https://www.avho.org.tr/muayenehaneler/ (+ /poliklinikler/, /hayvan-hastaneleri/) | Bursa: https://bursavho.org/muayenehaneler/
- İVHO: https://www.ivho.org.tr/ | TVHB 81 oda: https://tvhb.org.tr/odalar/
- İBB Açık Veri: https://data.ibb.gov.tr/dataset/istanbul-saglik-kurum-ve-kuruluslari-verisi
- İstanbul İl Müdürlüğü 2022 istatistiği: https://istanbul.tarimorman.gov.tr/Haber/1964/Veteriner-Hekim-Muayenehane-Poliklinik-Ve-Hayvan-Hastanesine-Yonelik-Ruhsatlandirma-Ve-Denetim-Islemleri-Devam-Ediyor
- Google Maps Platform Şartları: https://cloud.google.com/maps-platform/terms/ | fiyatlar: https://developers.google.com/maps/billing-and-pricing/pricing
- ODbL / OSM SSS: https://opendatacommons.org/licenses/odbl/1-0/ | https://osmfoundation.org/wiki/Licence/Licence_and_Legal_FAQ
- 6563 sayılı Kanun: https://mevzuat.gov.tr/MevzuatMetin/1.5.6563.pdf | Yönetmelik: https://www.mevzuat.gov.tr/File/GeneratePdf?mevzuatNo=20914&mevzuatTur=KurumVeKurulusYonetmeligi&mevzuatTertip=5
- İYS: https://iys.org.tr/hizmet-saglayici/kurumsal-hizmetler
- KVKK: alenileştirme duyurusu https://www.kvkk.gov.tr/Icerik/6843/-ALENILESTIRME-HAKKINDA-KAMUOYU-DUYURUSU | 2022/861 https://www.kvkk.gov.tr/Icerik/7580/2022-861 | 2022/1072 https://www.kvkk.gov.tr/Icerik/7579/2022-1072 | üçüncü kişilerden veri duyurusu https://www.kvkk.gov.tr/Icerik/8830/ucuncu-kisilerden-elde-edilen-kisisel-verilerin-reklam-ve-pazarlama-amacli-kullanilmasina-iliskin-kamuoyu-duyurusu | VERBİS istisnası https://www.kvkk.gov.tr/Icerik/7646/Kamuoyu-Duyurusu-Veri-Sorumlulari-Siciline-Kayit-Yukumlulugune-Iliskin-Istisna-Kriterinde-Degisiklik-Yapilmasi-Hakkinda-
- Aydınlatma Tebliği: https://kvkk.gov.tr/Icerik/5443/AYDINLATMA-YUKUMLULUGUNUN-YERINE-GETIRILMESINDE-UYULACAK-USUL-VE-ESASLAR-HAKKINDA-TEBLIG
- 2026 ceza tutarları: https://www.erdem-erdem.av.tr/bilgi-bankasi/elektronik-ticaret-kanunu-kapsaminda-idari-para-cezalari-2026-yili-icin-guncellendi
- Diğer: https://artvin.tarimorman.gov.tr/Link/10/Ilimizdeki-Ozel-Veteriner-Klinikleri | https://www.anadolusigorta.com.tr/Files/Products/SizeOzelSigortalar/Veteriner_hekim_guncel_listesi_180122.pdf | https://docs.overturemaps.org/attribution/ | https://huggingface.co/datasets/foursquare/fsq-os-places