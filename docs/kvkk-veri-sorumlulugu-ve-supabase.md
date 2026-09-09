# Veriyi kim tutmalı? KVKK sorumluluğu ve Supabase değerlendirmesi

**Teserix / veteriner-sms — karar belgesi, 09.09.2026**
Bu belge hukuki mütalaa değildir. Her hukuki nitelendirme `[avukat teyidi]` gerektirir. Rakamlar ve madde numaraları birincil kaynaktan (mevzuat.gov.tr, kvkk.gov.tr, cdn.tbmm.gov.tr, supabase.com) doğrulanmıştır; doğrulanamayanlar açıkça işaretlenmiştir.

**Bu sürümde denetim notu:** Aşağıdaki her madde numarası, tarih, tutar ve süre birincil metin açılarak yeniden denetlenmiştir. Önceki sürümde yer alan üç maddi hata düzeltilmiş (TCK 135/1 ceza aralığı, veri işleyen sözleşmesinin dayanağı, yedeklemenin "lokasyon dışı" olarak aktarılması), bir emsal karar (2020/559) doğrulanamadığı için çıkarılmış, iki önemli hüküm (TCK 139 şikâyet rejimi, 7545 s.K. m.8/5'in veri merkezi kayrası) belgeye eklenmiştir.

---

## 1) Kısa cevap (10 madde)

1. **Evet, kanunen sorumluluğunuz var** — ama muhtemelen "veri sorumlusu" değil, **veri işleyen** sorumluluğu. Amaç ve vasıtaları belirleyen klinik veri sorumlusudur (KVKK m.3/1-ı ve ğ). `[avukat teyidi]`
2. **Bu sorumluluk verinin nerede durduğundan bağımsızdır.** m.12/2: veri sorumlusu, güvenlik tedbirlerinin alınmasında "bu kişilerle birlikte **müştereken sorumludur**". m.12/4 süresiz sır saklama yükümlülüğünü doğrudan size yükler: "Bu yükümlülük görevden ayrılmalarından sonra da devam eder." (Her iki fıkra da birincil metinden doğrulandı.)
3. **KVKK idari para cezalarının çoğu size kesilemez.** m.18/2 (7499 s.K. ile değişik) birincil metinden doğrulandı: "Birinci fıkranın (a), (b), (c) ve (ç) bentlerinde öngörülen idari para cezaları veri sorumlusu, (d) bendinde öngörülen idari para cezası veri sorumlusu **veya veri işleyen** gerçek kişiler ile özel hukuk tüzel kişileri hakkında uygulanır." Ceza kliniğe kesilir, klinik size rücu eder.
4. **Size doğrudan kesilebilen tek KVKK cezası** m.18/1-(d): yurt dışı aktarımda standart sözleşmeyi 5 iş günü içinde Kuruma bildirmemek — **2026'da 90.308 – 1.806.177 TL** (KVKK resmî tablosundan birebir doğrulandı). Bu ceza bugün hiç doğmuyor; **yalnızca Supabase senaryosunda doğar**.
5. **TCK 135-140 cezai sorumluluğu doğrudan sizindir.** KVKK m.17/1 ve m.17/2 birincil metinden doğrulandı. Ayrıca **TCK 139 uyarınca 135, 136 ve 138 şikâyete bağlı DEĞİLDİR** — savcılık re'sen soruşturur (bkz. §4). Buna karşılık TCK 140, tüzel kişiler hakkında güvenlik tedbiri öngörür; yani şirket yapısı ne sizi korur ne de sizi tek başına aklar.
6. **Supabase'e taşırsanız eklenen YENİ yükümlülükler:** (a) KVKK m.9 yurt dışı aktarım rejimi, (b) Kurul'un ilan ettiği standart sözleşmenin değiştirilmeden imzalatılması, (c) noter onaylı çeviri + apostil, (d) 5 iş günü içinde Kuruma bildirim ve her değişiklikte yeniden bildirim, (e) m.9/8 gereği sonraki aktarımlar (alt işleyenler) bakımından da aynı güvencelerin sağlanması, (f) aydınlatma metinlerine yurt dışı aktarım ibaresi.
7. **Supabase'in Türkiye bölgesi yoktur** (bölge listesi açıldı, doğrulandı). Frankfurt dahil her bölge yurt dışıdır ve Kurul **bugüne kadar hiçbir ülke için yeterlilik kararı vermemiştir**. kvkk.gov.tr "Yurt Dışına Aktarım" sayfasındaki "Yeterli korumanın bulunduğu ülkeler" başlığının altında birebir şu cümle yer alır: *"Bu konuda Kurul tarafından henüz bir belirleme yapılmamıştır."*
8. **Açık rıza yolu Supabase için kapalıdır — bu artık yorum değil, Kurum'un yazılı görüşüdür.** m.9/6 istisnaları "arızi olmak kaydıyla" uygulanır. KVKK'nın *Kişisel Verilerin Yurt Dışına Aktarılması Rehberi* (Yayın No: 48) bunu birebir şöyle somutlaştırır: *"…ancak arızi nitelik arz ettiğinde yani tek veya birkaç sefer gerçekleşen, süreklilik arz etmeyen ve olağan faaliyet akışı içinde bulunmayan durumlarda yapılabilir."* ve kritik cümle: *"Örneğin veri alıcısına, bir veri tabanına doğrudan erişim izni verilmesi de kural olarak düzenli ve süreklilik arz eden bir veri aktarımı olarak kabul edileceğinden bu kapsamda sayılmayacaktır."* Sürekli SaaS barındırması tam olarak budur.
9. **Alan bazlı şifreleme sizi m.9'dan kurtarmaz.** `[avukat teyidi]` — Dikkat: bu bir çıkarımdır, nokta atışı dayanağı yoktur. Yurt Dışına Aktarılması Rehberi'nde şifrelemenin aktarımı kapsam dışına çıkarıp çıkarmadığına dair **hiçbir ifade bulunamadı** (metinde "şifrele" kökü hiç geçmiyor). Anahtar sizde kaldığı sürece verinin geri döndürülebilir olduğu ve dolayısıyla kişisel veri niteliğini koruduğu değerlendirmesi hukuken güçlüdür ama **doğrulanmamıştır**. Yine de m.12 savunması için şifrelemeyi yapın.
10. **Bugünkü en acil üç eksik:** (1) FileVault kapalı ve `.env` içindeki APP_SECRET şifresiz diskte; (2) yedeklerin ağ dışında/fiziksel olarak ayrı bir kopyası yok — Kişisel Veri Güvenliği Rehberi böl. 3.6'ya açık aykırılık; (3) hiçbir klinikle yazılı veri işleyen sözleşmesi yok. Üçü de Supabase'den bağımsız ve üçü de bu hafta kapatılabilir.

---

## 2) Rolünüz: veri işleyen misiniz, veri sorumlusu mu?

**Ayrımın kaynağı:** KVKK m.3/1-(ı) veri sorumlusunu "işleme amaçlarını ve vasıtalarını belirleyen"; m.3/1-(ğ) veri işleyeni "veri sorumlusunun verdiği yetkiye dayanarak onun adına işleyen" olarak tanımlar.

Kurul'un **30.01.2020 tarih 2020/71 sayılı** karar özeti ölçütleri somutlaştırır. **Düzeltme:** Önceki sürümde bu karardan yapılan alıntı kararın gerçek lafzıyla birebir örtüşmüyordu. Kararın doğrulanmış ifadesi şudur — veri sorumlusunun belirlediği temel unsurlar:

> *"hangi kişisel verilerin toplanacağı, toplanan verilerin hangi amaçlarla kullanılacağı ve ne şekilde işleneceği, verilerin ne kadar süreyle saklanacağı, veri saklama politikasının ne şekilde olacağı, verilere kimlerin erişme yetkisi olacağı"*

**Sizin durumunuz:** Hangi hastanın kaydedileceğine, kime SMS gideceğine klinik karar veriyor; klinik kendi SMS sağlayıcı hesabını kullanıyor; süper yönetici hasta verisini göremiyor. Bu tablo **veri işleyen** konumunu destekler.

**Ama bir çatlak var.** Bugün şu üç kararı tek taraflı, ürün kararı olarak siz veriyorsunuz: (a) hangi alanların tutulacağı (`owners.notes`, `pets.breed`, `birth_date`), (b) `sms_log`'da sahip silinse bile `owner_name`/`pet_name`/`phone` snapshot'ının kalması, (c) yedeklerin 14 gün tutulması. 2020/71'in yukarıdaki listesi "hangi kişisel verilerin toplanacağı" ve "verilerin ne kadar süreyle saklanacağı" kalemlerini açıkça veri sorumlusuna bırakıyor.

**Aynı karar** ise sözleşmeyle veri işleyene bırakılabilecek konuları da sayıyor (doğrulanmış lafız):

> *"Kişisel verilerin hangi yöntemle saklanacağı, Kişisel verilerin saklanmasına ilişkin sürelerin doğru uygulanabilmesi için kullanılacak metot, Kişisel verilerin silinmesi, yok edilmesi ve anonim hale getirilmesi yöntemleri"*

Dikkat edin: karar **yöntem/metot** seçimini veri işleyene bırakıyor; **sürenin kendisini** değil. Yani "yedeği 14 gün tutuyorum" kararı, sözleşmeyle kliniğin talimatı hâline getirilmediği sürece rahat bir alan değildir.

**Pratik sonuç:** Bu kararlar **yazılı sözleşmeyle kliniğin talimatı hâline getirilirse** veri işleyen kalırsınız. Getirilmezse, en azından bu işlemler bakımından veri sorumlusu (veya müşterek sorumlu) sayılmanız hukuken tartışılabilir hâle gelir. `[avukat teyidi]` — Bu eşiğe dair nokta atışı bir Kurul kararı **bulunamadı**.

**Aydınlatma özel notu:** 2020/71'e göre *"aydınlatma yükümlülüğünün bizzat veri sorumlusu tarafından veya veri sorumlusunun yetkilendirdiği bir kişi tarafından yerine getirilebilir"*; yetkilendirilen kişinin veri işleyen olabileceği de kararda kabul edilmiştir. Ayrıca aydınlatmanın yapıldığını **ispat yükü veri sorumlusundadır**. Yani şablonu siz sağlayın, ama metinde **veri sorumlusu olarak kliniği gösterin** — kendinizi göstermeyin.

---

## 3) Nerede olursa olsun geçerli yükümlülükler

| Yükümlülük | Dayanak | Sizin durumunuz | Yapılacak | Ceza riski (2026 TL) |
|---|---|---|---|---|
| Yazılı veri işleyen sözleşmesi | **Düzeltildi:** m.12/2 müşterek sorumluluğu kurar ama yazılı sözleşmeyi *emretmez*; yazılılık Veri Güvenliği Rehberi böl. 2.5'te **"önerilmektedir"** ifadesiyle geçer | **YOK** | Rehber 2.5'in saydığı unsurları içeren KVİS şablonu; sözleşmesiz klinik alma | Dolaylı: kliniğe 256.357–17.092.242 (m.18/1-b), size rücu |
| Uygun güvenlik düzeyi (teknik-idari tedbirler) | m.12/1 | **EKSİK** | Zafiyet taraması, yetki matrisi, log izleme | 256.357–17.092.242 (kliniğe) |
| Disk şifreleme | Rehber böl. 3.3. **Düzeltildi:** Rehber'in lafzı emredici değil, tanımlayıcıdır: *"tam disk şifrelemesiyle cihazın tümü şifrelenebilir ya da cihazda bulunan bir dosya şifrelenebilir"* | **YOK** — `fdesetup status` → Off | `fdesetup enable`; kurtarma anahtarını cihaz dışında sakla; firmware parolası | m.12/1 üzerinden aynı bent |
| Yedeklerin **ağ dışında** tutulması | Rehber böl. 3.6 — birebir: *"veri seti yedekleri **mutlaka ağ dışında tutulmalıdır**"* ve *"tüm yedeklerin fiziksel güvenliğinin de sağlandığından emin olunmalıdır"* | **YOK** — aynı diskte, ayrı kopya yok | `src/backup.js`'e şifreli, ağ dışı/ayrı ortam kopyası; anahtar cihaz dışında | Aynı bent |
| İhlal bildirimi (72 saat) | m.12/5 ("en kısa sürede"); Kurul **24.01.2019 t. 2019/10** kararı "en kısa süre"yi 72 saat olarak yorumlar; içerik: 2019/271 | **EKSİK** — müdahale planı yok | 2019/10 veri işleyene ayrı bir görev yükler: *"veri işleyenin bu konuda herhangi bir gecikmeye yer vermeksizin veri sorumlusuna bildirimde bulunmasına"*. Sözleşmeye somut süre yazın + hazır şablonlar + ihlal kaydı | Geç bildirim ayrıca cezalandırılıyor (emsal 2020/465) |
| Aydınlatma yükümlülüğü | m.10/1; Kurul 2020/71 | **EKSİK** | Klinik adına şablon + "aydınlatma yapıldı" zaman damgası (ispat kliniğe ait) | 85.437–1.709.200 (kliniğe) |
| Saklama-imha politikası ve periyodik imha | İmha Yönetmeliği (RG 28.10.2017, S.30224) m.5/1, m.5/3, m.11/2, m.11/3, m.7/3 | **YOK** — kodda yalnızca `sessions.purgeExpired` var | **Önemli nüans:** m.5/1 uyarınca politika hazırlama yükümlülüğü **yalnızca VERBİS'e kayıtla yükümlü** veri sorumlularına aittir. VERBİS istisnasındaki tipik klinik için politika zorunlu değildir; bu durumda **m.11/3 devreye girer: yükümlülüğün doğduğu tarihi takip eden 3 ay içinde** imha. Politika varsa periyodik imha aralığı **her hâlde 6 ayı geçemez** (m.11/2). İmha kayıtları **en az 3 yıl** saklanır (m.7/3) | 256.357–17.092.242; ayrıca m.17/2 → TCK 138 |
| İlgili kişi başvurusu (30 gün) | m.11, m.13/2; İmha Yönetmeliği m.12/1 | **EKSİK** | Ürüne "sahip verisini dışa aktar / sil" akışı; talep üçüncü kişilere de yansımalı (m.12/1-b) | Kurul kararına uymama: 427.263–17.092.242 |
| VERBİS | m.16/2; Sicil Yönetmeliği (RG 30.12.2017, S.30286) m.5/1; Kurul **06.07.2023 t. 2023/1154** (yıllık çalışan sayısı <50 **ve** yıllık mali bilanço <100 mn TL, ana faaliyeti özel nitelikli veri işleme olmayanlar istisna) | **GEREKMİYOR** (yükümlülük veri işleyene ait değildir; tipik klinik de istisnada) | Kendi tüzel kişiliğiniz için eşiği ayrıca değerlendirin. **Not:** Kurul'un 04.09.2025 t. **2025/1572** kararı, ana faaliyeti özel nitelikli veri işlemek olanlar için ayrı ve çok daha düşük bir eşik (<10 çalışan ve <10 mn TL) getirmiştir; hayvan sağlık verisi özel nitelikli olmadığından klinik bu rejime **girmez** `[avukat teyidi]` | 341.809–17.092.242 (eşiği aşan klinikte) |
| Erişim yetkisi ve log kayıtları | Rehber Tablo 4.1 ("Log Kayıtları", "Yetki Matrisi", "Erişim Logları", "Sızma Testi") | **KISMEN VAR** (denetim günlüğü var, uyarı/izleme yok) | Log üzerine anomali uyarısı; süper yönetici işlemleri için ayrı alarm. *Not: Rehber tabloları "alınabilecek" tedbirleri gösterir; kapalı bir zorunluluk listesi değildir* | 256.357–17.092.242 |
| Çalışan gizlilik taahhüdü | m.12/4; Rehber böl. 2.5 (*"süresiz sır saklama yükümlülüğüne tabi olacağının da bu sözleşmede yer alması önem taşımaktadır"*); Tablo 4.2 "Gizlilik Taahhütnameleri" | **YOK** | Kendinize ve çalışacak herkese süresiz gizlilik taahhütnamesi | TCK 136 riski |
| Zafiyet taraması / sızma testi | Rehber böl. 3.2 — birebir: *"bilişim sistemlerinin bilinen zaafiyetlere karşı korunması için düzenli olarak zaafiyet taramaları ve sızma testlerinin yapılması … **gerekmektedir**"* | **YOK** | Yıllık test + raporu sakla (2020/465'te doğrudan gerekçe olarak kullanıldı) | 256.357–17.092.242 |
| Canlıya alma prosedürü + politikaların tarihi | Kurul 12.03.2020 t. 2020/213 | **YOK** | Politikaları **bugün** tarihlendir — 2020/213'te veri sorumlusunun politikası vardı ama *"bu politikanın yürürlük tarihinin veri ihlalinin gerçekleştiği tarihten sonra olduğu"* tespiti aleyhe değerlendirildi | 427.263–17.092.242 |

---

## 4) Ceza tablosu

**İdari para cezaları.** Aşağıdaki tutarların tamamı KVKK'nın kendi resmî tablosu ("6698 SAYILI KANUNDAKİ İDARİ PARA CEZALARI", kvkk.gov.tr) açılarak **hücre hücre doğrulanmıştır**. 2026 sütunu için tabloda gösterilen yeniden değerleme oranı **%25,49**'dur.

| Bent | Fiil | Kanundaki asıl tutar | 2026 alt–üst | Muhatabı |
|---|---|---|---|---|
| m.18/1-a | Aydınlatma yükümlülüğünü yerine getirmeme | 5.000 – 100.000 | 85.437 – 1.709.200 | Yalnızca veri sorumlusu |
| m.18/1-b | Veri güvenliği yükümlülüklerinin ihlali | 15.000 – 1.000.000 | 256.357 – 17.092.242 | Yalnızca veri sorumlusu |
| m.18/1-c | Kurul kararlarını yerine getirmeme | 25.000 – 1.000.000 | 427.263 – 17.092.242 | Yalnızca veri sorumlusu |
| m.18/1-ç | VERBİS'e kayıt/bildirim ihlali | 20.000 – 1.000.000 | 341.809 – 17.092.242 | Yalnızca veri sorumlusu |
| m.18/1-d | m.9/5 bildirim yükümlülüğünü yerine getirmeme | 50.000 – 1.000.000 | **90.308 – 1.806.177** | **Veri sorumlusu VEYA veri işleyen** |

> **(d) bendinin neden diğerlerinden düşük olduğu:** Bu bent 7499 s.K. m.35 ile **2024'te** eklendiği için yalnızca iki yıllık yeniden değerlemeye tabi olmuştur (2024: 50.000/1.000.000 → 2025: 71.965/1.439.300 → 2026: 90.308/1.806.177). Diğer bentler 2016'dan beri artmaktadır. Rakamların tümü resmî tablodan birebir alınmıştır.
>
> **Not:** %25,49 oranını belirleyen VUK Genel Tebliği'nin metnini birincil kaynaktan **açamadım**; ancak oran ve tutarlar KVKK'nın kendi resmî tablosunda yazılı olduğu için tutarlar doğrulanmış sayılmalıdır. Tablonun altında 5326 s. Kabahatler Kanunu m.17/7'ye yapılan atıf da doğrulandı. m.18/3 uyarınca cezalara karşı **idare mahkemelerinde** dava açılır (7499 ile eklenen fıkra; birincil metinden doğrulandı).

**Senaryo eşlemesi.** Mac mini çalınır ve veri sızarsa → kliniğe m.18/1-b; sizin riskiniz rücu + TCK. Supabase'e güvencesiz geçilirse → hukuka aykırı yurt dışı aktarım pratikte **m.18/1-b üzerinden** cezalandırılıyor. Doğrulanmış emsaller:

- **Kurul 17.03.2022 t. 2022/249** — bir teknoloji şirketi, *"sunucuları yurt dışında bulunan sistem"* üzerinden açık rıza ve taahhütname olmaksızın yurt dışına aktarım. **950.000 TL, m.18/1-b.** (Tutar ve dayanak doğrulandı.)
- **Kurul 03.09.2021 t. 2021/891** — WhatsApp. **1.950.000 TL, m.18/1-b.** Önemli nüans: m.9 ihlali tespit edilmiş olmasına rağmen **ayrı bir yurt dışı aktarım cezası kesilmemiş**, ihlal tek bir m.18/1-b cezasına dahil edilmiştir. Bu, "aktarım ihlali güvenlik cezası üzerinden fiyatlanır" tezini destekler.
- **Kurul 12.03.2020 t. 2020/213** — internet servis sağlayıcısı; canlıya alma prosedürlerinin uygulanmaması ve politikanın ihlalden **sonra** yürürlüğe girmiş olması. **300.000 TL, m.18/1-b.**
- **Kurul 16.06.2020 t. 2020/465** — kurumsal yazılım hizmeti sunan veri sorumlusu; ihlali 06.03.2019'da tespit edip 29.04.2019'da bildirmiş (**55 gün** gecikme). Geç bildirim için **50.000 TL**, toplam **125.000 TL** (o günkü tarife). Kararda sızma testi yapılmamış olması ayrıca gerekçe gösterilmiştir.
- ~~Kurul 2020/559 (900.000 TL)~~ — **ÇIKARILDI.** Bu karar numarası ve tutarı kvkk.gov.tr üzerinde **doğrulanamadı**. Belgede emsal olarak kullanılmamalıdır.

Standart sözleşme imzalanır ama 5 iş gününde bildirilmezse → **doğrudan size** m.18/1-d.

**Hapis cezaları (TCK 135-140).** KVKK m.17/1 ("…5237 sayılı Türk Ceza Kanununun 135 ila 140 ıncı madde hükümleri uygulanır") ve m.17/2 (m.7'ye aykırı olarak silmeyen/anonim hâle getirmeyenler **TCK 138**'e göre cezalandırılır) **birincil metinden doğrulandı.**

**Kaynak şeffaflığı:** TCK'nın güncel konsolide metnini mevzuat.gov.tr'den defalarca denememe rağmen **indiremedim** (bağlantı zaman aşımı). Aşağıdaki aralıklar KVKK'nın kendi resmî yayını olan *Kişisel Verilerin Korunması Kanununa İlişkin Uygulama Rehberi*'nde madde madde alıntılanan metinden alınmıştır; ayrıca 5237 s. Kanunun Adalet Bakanlığı'nca yayımlanan **ilk hâli** ve 6698 s. Kanunun **madde 30** değişiklik metni ile çapraz kontrol edilmiştir. Düzenleyici otoritenin yayını olmakla birlikte **yasama metni değildir**; avukat teyidi şarttır.

- **TCK 135/1** (kişisel verilerin kaydedilmesi): **"altı aydan üç yıla kadar" hapis.** ⚠️ **DÜZELTME — bu belgenin önceki sürümünde bu aralık "doğrulanamadı" olarak bırakılmıştı; artık çözülmüştür ve yaygın olarak dolaşan "bir yıldan üç yıla" bilgisi YANLIŞTIR.** Üç kaynak örtüşüyor: (i) 5237'nin 2004 tarihli asıl metni "altı aydan üç yıla" diyor; (ii) 6698 s.K. **m.30/2 yalnızca 135'in İKİNCİ fıkrasını** değiştirmiştir, birinci fıkraya dokunmamıştır (değişiklik metni açılarak görüldü); (iii) KVKK Uygulama Rehberi de "altı aydan üç yıla" diye alıntılıyor.
- **TCK 135/2**: 6698 m.30/2 ile bu fıkra ayrı bir suç olmaktan çıkarılıp **nitelikli hâle** dönüştürülmüştür: kişisel verinin siyasi/felsefi/dini görüş, ırk, ahlaki eğilim, cinsel yaşam, **sağlık durumu** veya sendikal bağlantıya ilişkin olması hâlinde *"birinci fıkra uyarınca verilecek ceza yarı oranında artırılır"*. **Sizin için kritik:** hasta HAYVAN olduğu için hayvanın sağlık verisi bu kapsamda değildir; ama `owners.notes` alanına **sahibin** sağlık/inanç bilgisi yazılırsa bu nitelikli hâl devreye girebilir `[avukat teyidi]`.
- **TCK 136/1** (verme, yayma veya ele geçirme): **"iki yıldan dört yıla kadar"** hapis. Senaryo: süper yöneticinin parola sıfırlayıp klinik verisine bakması/dışa aktarması; demo veya hata ayıklama dökümünde gerçek veri paylaşmak.
- **TCK 137** (nitelikli hâller): *"Belli bir meslek ve sanatın sağladığı kolaylıktan yararlanmak suretiyle"* işlenirse ceza **yarı oranında artırılır**. Sistem yöneticisi/yazılımcı sıfatınız bu bende girme riski taşır.
- **TCK 138/1** (süresi geçtiği hâlde yok etmeme): **"bir yıldan iki yıla kadar"** hapis. Senaryo: müşteri ayrıldıktan sonra `tenant.db` ve yedeklerinin silinmemesi. 138/2 ise konusu CMK'ya göre yok edilmesi gereken veri olduğunda cezayı bir kat artırır.
- **TCK 139 (şikâyet) — belgeye YENİ eklendi ve risk açısından önemlidir:** *"Kişisel verilerin kaydedilmesi, verileri hukuka aykırı olarak verme veya ele geçirme ve verileri yok etmeme **hariç**, bu bölümde yer alan suçların soruşturulması ve kovuşturulması şikâyete bağlıdır."* Yani **135, 136 ve 138 şikâyete bağlı değildir**; müşteriniz şikâyetçi olmasa bile savcılık re'sen soruşturur ve şikâyetten vazgeçme dosyayı kapatmaz.
- **TCK 140**: bu suçlar dolayısıyla **tüzel kişiler hakkında güvenlik tedbirlerine** hükmolunur.
- **TCK 136/2'nin (7188 s.K. ile eklendiği belirtilen nitelikli hâl) varlığı ve lafzı birincil metinden DOĞRULANAMADI.** KVKK Uygulama Rehberi 136'yı tek fıkra hâlinde alıntıladığından Rehber'in bu noktada güncel olmaması muhtemeldir. Avukatınıza teyit ettirin.

---

## 5) Seçenek karşılaştırması

| Ölçüt | **A: Mac mini (bugünkü hâli)** | **B: Mac mini (sertleştirilmiş)** | **C: Türkiye'de VPS** | **D: Supabase (AB)** |
|---|---|---|---|---|
| Veri nerede | İstanbul, konut | İstanbul, konut | Türkiye, veri merkezi | AB (eu-central-1 Frankfurt); alt işleyen zinciri ABD/AB karışık |
| KVKK yurt dışı aktarım yükü | **Yok** | **Yok** | **Yok** | Tam m.9 rejimi: standart sözleşme + noter çeviri/apostil + 5 iş günü bildirim + m.9/8 sonraki aktarım zinciri |
| Güvenlik | **Zayıf**: FileVault kapalı, yedek şifresiz, sızma testi yok | Orta-iyi: FileVault + firmware parolası + şifreli ağ dışı yedek | Orta-iyi (PostgreSQL'i siz işletirsiniz) | **En iyi**: SOC 2 Type 2, ISO 27001, at-rest şifreleme (belge iddiaları supabase.com/security'den; bağımsız denetim raporları görülmedi) |
| Kesinti riski | **Yüksek**: `autorestart 0`, UPS yok, tek disk, ev interneti, Tailscale Funnel | Orta (UPS + `autorestart 1`; FileVault açıksa beklenmedik kesintide birim kilitli açılır) | Düşük | Düşük — ama SLA **%99,9 yalnızca Enterprise aboneleri için sözleşmesel** (supabase.com/sla açıldı, doğrulandı) |
| Kurtarma süresi | **Belirsiz/sonsuz** — ayrı kopya yok, disk ölürse veri gider | Saatler (dış yedekten) | Saatler | Dakikalar–saatler; Pro planda **günlük yedekler 7 gün** saklanır; PITR ayrı eklenti |
| Yıllık maliyet | ~0 TL marjinal (donanım mevcut) | UPS + ayrı depolama — **fiyat doğrulanamadı** | **Doğrulanamadı** — teklif gerekiyor | Pro **$25/ay**; PITR eklentisi **$100/ay (7 günlük saklama başına)**; Team **$599/ay**; uygulama barındırma ayrı; + avukat/noter/tercüme masrafı (fiyatların tümü supabase.com/pricing'den doğrulandı) |
| İşletme yükü | Sizde, tamamı | Sizde, tamamı | Sizde (DB yönetimi dahil) | Düşük teknik yük, **yüksek hukuki-idari yük** |
| Ölçeklenme | 10 kliniğe kadar; ötesi zorlanır | 50 kliniğe kadar mümkün | İyi | Çok iyi (tek proje + izolasyon politikaları ile 50 klinik ~$25–35/ay) |
| Satışta anlatımı | Zor — "verim evimde" | "Verileriniz Türkiye'de, şifreli, yedekli" | **En güçlü**: Türkiye + veri merkezi + belge | "ISO/SOC belgeli" güçlü, ama "veriler Almanya'da" itiraz doğurur |

**A — Artı:** Sıfır ek maliyet; m.9 hiç doğmuyor; internet kesikken bile panel yerelde çalışıyor. **Eksi:** FileVault kapalı; yedeğin ağ dışı kopyası yok (Rehber 3.6'ya açık aykırılık); konutta fiziksel güvenlik zayıf. Ayrıca **7545 s. Siber Güvenlik Kanunu m.8/5** (RG 19.03.2025; metin TBMM'nin yayımladığı kanun metninden birebir doğrulandı) şunu düzenler: *"Millî güvenlik, kamu düzeni, suç işlenmesinin veya siber saldırıların önlenmesi amacıyla hâkim kararı üzerine veya gecikmesinde sakınca bulunan hâllerde Cumhuriyet savcısının yazılı emri ile **konutta, işyerinde ve kamuya açık olmayan kapalı alanlarda arama yapılabilir**, … kopya çıkarma ve el koyma işlemi gerçekleştirilebilir."* Veteriner mevzuatındaki elektronik kayıt hükmüne ilişkin iddia (Yönetmelik m.17/1-b, "kayıtlar tutulmamış sayılır") **birincil metinden doğrulanamadı** — mevzuat.gov.tr ve resmigazete.gov.tr bu oturumda açılamadı; §10'a taşındı.

**B — Artı:** En yüksek fayda/maliyet oranı; hukuki konum bozulmuyor; veri hacmi ölçüldü, **2,5 MB** — ağ dışı yedek maliyeti pratikte sıfır. **Eksi:** Fiziksel güvenlik ve tek nokta arıza sorunu tam çözülmüyor; FileVault açıldıktan sonra beklenmedik güç kesintisinde sunucu kilitli açılır (`man fdesetup`: `authrestart` güvenliği bilinçli olarak zayıflatır) — **fişi çekip test edin**.

**C — Artı:** Hukuken en temiz; fiziksel güvenlik ve süreklilik profesyonelleşiyor; satış anlatımı en güçlü. **Ve belgeye yeni eklenen güçlü bir gerekçe:** 7545 s.K. m.8/5'in son cümlesi *"Yetkilendirilmiş veri merkezi işletmecilerinin veri merkezlerinde **sadece hâkim kararıyla** arama, kopya çıkarma ve el koyma işlemi yapılabilir"* der. Yani lisanslı bir veri merkezindeki veri, konuttaki veriden **daha yüksek bir usul güvencesine** sahiptir: savcının yazılı emri yetmez. Bu, C seçeneğinin A ve B'ye karşı somut ve ölçülebilir hukuki üstünlüğüdür. **Eksi:** Hiçbir Türk sağlayıcıdan yayımlanmış **yönetilen PostgreSQL** ürünü veya makine-okunabilir fiyat bulunamadı — teklif almanız gerekiyor; DB yönetimi (yükseltme, PITR, izleme) sizde kalır.

**D — Artı:** Teknik güvenlik açık farkla en iyi; yönetilen yedek/PITR; ölçeklenme sorunsuz; belge talep eden kurumsal müşteriye cevabınız olur. **Eksi:** Yurt dışı aktarım yükü; Supabase'in DPA'sında **Türkiye/KVKK/6698 hiç geçmiyor** (metin arandı, eşleşme yok); akit taraf **Supabase Pte. Ltd. (Singapur)**; bölge sonradan **yerinde değiştirilemez** (Supabase dokümantasyonu: bölge değiştirmenin yolu yeni proje açıp göç etmektir); hesap sona erdikten sonra veri **30 günlük saklama süresinin (DPA 11.2) bitiminde silinir**; çevrimdışı çalışma tamamen biter.

---

## 6) Supabase seçilirse ne yapmak zorundasınız

1. **Bölge seçimi:** `eu-central-1` (Frankfurt). Supabase'in bölge listesinde **Türkiye yoktur**; "Europe" grubu AB dışı Londra ve Zürih'i de kapsar. Bölge proje oluşturulurken sabitlenir ve **yerinde değiştirilemez** — yanlış seçim tam göç demektir.
2. **DPA:** Ayrı imza gerekmiyor; birebir: *"The Parties agree that acceptance of the Agreement shall have the same effect as signing the SCCs."* AB SCC'lerini içerir. **Bu KVKK için yeterli değildir** — AB SCC'si ile Kurul'un ilan ettiği standart sözleşme farklı belgelerdir.
3. **KVKK standart sözleşmesi — tıkanma noktası burası.** Kurul **04.06.2024 t. 2024/959** s. kararıyla standart sözleşme metinlerini kabul etti; ilan edilen modüller arasında **SS-3 (Veri İşleyenden Veri İşleyene)** vardır ve sizin durumunuza bu uyar `[avukat teyidi]`. Yönetmelik (RG 10.07.2024, S.32598) **m.14/3** birebir: *"Standart sözleşmenin, üzerinde herhangi bir değişiklik yapılmaksızın kullanılması zorunludur. Standart sözleşmenin yabancı dilde de akdedilmesi hâlinde Türkçe metin esas alınır."* m.14/7 ise değişiklik yapılması veya **geçerli imza bulunmaması** hâlinde Kurul'un m.15 uyarınca inceleme başlatacağını söyler.
   KVKK'nın **05.02.2025** tarihli kamuoyu duyurusu en sık hataları sayıyor (duyuru açıldı, doğrulandı): tarafları temsile yetkili kişilerce imzalanmaması; **Türkçe metin üzerinde her iki tarafın da imzasının bulunmaması**; imza yetki belgelerinin sunulmaması; yabancı dildeki her belgenin **noter onaylı Türkçe çevirisinin** eklenmemesi (Lahey sözleşmesine taraf ülkeler için **apostil şerhi** yeterli); **beş iş günlük** sürenin aşılması.
   **Supabase bunu imzalamazsa hukuka uygun yol kalmaz** — açık rıza sürekli aktarımda kullanılamaz (§1.8'deki Rehber alıntısı). Bu nedenle **Supabase'e geçmeden önce tek bir yazılı soru sorun:** "Kurul'un ilan ettiği Türkçe SS-3 metnini, değiştirmeden, apostilli yetki belgesiyle imzalar mısınız?" Cevap alınmadan mimariye dokunmayın. Supabase'in kamuya açık hiçbir belgesinde bu konuda taahhüt **bulunamadı**.
4. **Kurula 5 iş günü bildirim:** Yönetmelik m.14/5 birebir: *"Standart sözleşme, imzaların tamamlanmasından itibaren beş iş günü içinde fiziki olarak veya kayıtlı elektronik posta (KEP) adresi ya da Kurul tarafından belirlenen diğer yöntemlerle Kuruma bildirilir."* Kurul'un **17.10.2024 t. 2024/1793** kararıyla kurulan **Standart Sözleşme Bildirim Modülü** bu "diğer yöntem"dir. **Pratik nokta (yeni eklendi):** aynı fıkra *"Aktarım tarafları standart sözleşmede, bildirim yükümlülüğünün kimin tarafından yerine getirileceğini belirleyebilir. Eğer bu konuda bir belirleme yapılmamışsa standart sözleşme **veri aktaran** tarafından Kuruma bildirilir"* der — belirleme yapılmazsa yük otomatik olarak sizdedir. m.14/6 uyarınca bildirime yetki belgeleri ve noter onaylı çeviriler eklenir. Taraf/içerik değişirse yeniden bildirim gerekir.
5. **Aydınlatma metni:** m.10/1-(c) gereği kliniklerin aydınlatma metnine yurt dışı aktarım, alıcı grupları ve aktarımın hukuki dayanağı eklenir.
6. **Klinik sözleşmesi:** Supabase'in **alt işleyen** olarak adı, bölgesi ve alt işleyen listesi eki; alt işleyen kullanımına klinik onayı; bölge değişikliğinin bildirime bağlanması. **Doğrulanamadı:** Supabase alt işleyen listesinin güncel sayısı ("~24") ve yeni alt işleyenlere itiraz süresi ("5 gün") bu oturumda **teyit edilemedi** — liste JavaScript ile yüklenen ve 01.06.2026 tarihli ayrı bir PDF olarak yayımlanıyor; açılamadı. Sözleşme yazmadan önce PDF'i indirip sayın.
7. **Teknik tedbirler:** Veri Güvenliği Rehberi böl. 3.4 birebir: *"…kriptografik yöntemlerle şifrelenmesi, bulut ortamlarına şifrelenerek atılması, kişisel veriler için mümkün olan yerlerde, özellikle hizmet alınan her bir bulut çözümü için ayrı ayrı şifreleme anahtarları kullanılması gerekmektedir"* ve *"Bulut bilişim hizmet ilişkisi sona erdiğinde; kişisel verileri kullanılır hale getirmeye yarayabilecek şifreleme anahtarlarının tüm kopyalarının da yok edilmesi gerekir."* Anahtarı Supabase dışında (Türkiye'de) tutun. **Loglara telefon/ad yazmayın.** *Düzeltme:* önceki sürümdeki "loglar BigQuery'ye gidiyor" ifadesi artık koşulludur — Supabase dokümantasyonuna göre log arka ucu Haziran 2026'dan itibaren ClickHouse'a geçmiştir ve BigQuery bu tarihten önce oluşturulmuş projeler için geçerlidir; **bugün açılacak yeni bir proje için doğrulanması gerekir**. Gerçek zamanlı (realtime) katmanının Fly.io üzerinde çalıştığı bilgisi de Supabase kaynaklarında geçmekte ama alt işleyen listesinden **teyit edilemedi**. Haftalık `pg_dump` alıp Türkiye'de şifreli saklayın.

**Gerçekçi tıkanma sırası:** (1) SS-3 imzası — en muhtemel tıkanma; (2) apostil + noter çevirisi + 5 iş günü penceresi; (3) alt işleyen değişikliklerinde tekrar bildirim; (4) her klinik için ayrı sözleşme mi gerektiği — **mevzuattan net değil**, Kuruma yazılı görüş sorulmalı.

---

## 7) Mimari etkisi

Bugünkü güvenlik iddianız `src/db/tenant.js` başında yazılı: bir istek yalnızca oturumdaki kliniğin dosyasını açar, "başka bir kliniğin verisine ulaşması **fiziksel olarak mümkün değildir**". Supabase'de bunun karşılığı yoktur; izolasyon **politika bazlı** hâle gelir.

**Somut iş listesi (ölçülen metrikler üzerinden):**
- Şema tasarımı + RLS veya şema-başına-klinik politikaları — **2–3 gün**
- `node:sqlite` senkron API'sinden asenkron `pg`'ye geçiş: **73 adet `.prepare()`** çağrısı (tenant.js 44, master.js 28, migrate.js 1) ve **89 route kaydının** (bugün yalnızca 8'i `async`) tamamının `await`'e çevrilmesi — **3–5 gün**
- SQLite'a özgü **32 kod noktası**: 6 × `AUTOINCREMENT` → `GENERATED ALWAYS AS IDENTITY`; `date(r.due_date, '-' || … || ' days')` → `INTERVAL`; INTEGER 0/1 → BOOLEAN; `lastInsertRowid` → `RETURNING id`; `.changes` → `rowCount`; `PRAGMA user_version` → migrasyon tablosu
- `src/backup.js` tümüyle gereksizleşir (`VACUUM INTO`, `PRAGMA wal_checkpoint` Postgres'te yok) → yerine haftalık `pg_dump` — **1–2 gün** (veri göç scripti dahil)
- `test/tenant-isolation.test.js` yeniden yazımı (dosya izolasyonu testi → RLS politika/negatif entegrasyon testi) — **2–4 gün**. **Göçün en riskli tek kalemi budur.**
- Saha doğrulama + geri dönüş planı — **1–2 gün**

**Toplam: 9–16 tam gün** (tek geliştirici; Postgres/RLS deneyimi zayıfsa iki katına çıkabilir).

**İzolasyon gücü karşılaştırması:** Ayrı dosya = işletim sistemi seviyesinde ayrım, kod hatası veri karışmasına yol açamaz. RLS = "her sorguya bir WHERE eklemek" gibi; **kritik tuzak**: `service_role` anahtarı `bypassrls` yetkisine sahiptir ve sunucu tarafı Express uygulaması tipik olarak bununla bağlanır — o zaman RLS **hiç çalışmaz** ve izolasyon tamamen kodunuzdaki `WHERE clinic_id = ?` ifadelerine kalır. RLS seçilirse her istekte `SET LOCAL app.clinic_id` + `USING (clinic_id = current_setting('app.clinic_id'))` deseni zorunludur. Mevcut zihinsel modele en yakın ve en az riskli seçenek **tek proje + şema-başına-klinik**'tir (maliyeti tek projeyle aynı, ~$25/ay). Proje-başına-klinik modeli 50 klinikte kabaca $1.250/ay eder (50 × $25 Pro) ve tek kişiyle işletilemez — *önceki sürümdeki ~$515/ay rakamı hatalıydı ve düzeltilmiştir.*

---

## 8) Tavsiye

**Şimdi Supabase'e geçmeyin. Mac mini'yi bu hafta sertleştirin (Seçenek B), 10 kliniği geçtiğinizde Türkiye'de bir VPS'e taşıyın (Seçenek C).**

**Gerekçe:** Bugünkü mimarinizin tek ve büyük hukuki üstünlüğü, m.9 rejiminin hiç doğmamasıdır — bu, size doğrudan kesilebilecek **tek** KVKK cezasını (90.308–1.806.177 TL) sıfırlar. Supabase bu avantajı, karşılığında imzalanacağı belirsiz bir sözleşmeye ve sürekli bildirim yüküne takas eder. Buna karşılık Supabase'in çözdüğü sorunlar (şifreleme, ayrı yedek) FileVault + şifreli ağ dışı yedekle **birkaç saatte ve sıfır hukuki maliyetle** çözülüyor; veri hacminiz **2,5 MB**.

**Risk anlatımının dengelenmesi (denetçi notu):** Bu belge idari para cezalarının üst sınırlarını (17.092.242 TL) sıkça anıyor. Gerçekçi olun: doğrulanan emsallerde fiilen kesilen tutarlar **125.000 – 1.950.000 TL** aralığındadır ve bunlar çok sayıda ilgili kişiyi etkileyen, çok uluslu veya büyük ölçekli veri sorumlularına ilişkindir. 10–50 kliniklik bir işte üst sınıra yaklaşan bir ceza **beklenmez**. Buna karşılık iki risk hafife alınmamalıdır: (i) cezanın **kliniğe** kesilip size rücu edilmesi, ki bu küçük bir işletme için ölçek fark etmeksizin yıkıcıdır; (ii) TCK 135/136/138'in **şikâyete bağlı olmaması** — bu, ceza riskinin müşteri ilişkisiyle yönetilemeyeceği anlamına gelir. Asıl risk, ceza tavanı değil, bu ikisidir.

- **10 klinikte:** Sertleştirilmiş Mac mini yeterli. Yazılı veri işleyen sözleşmesi ve ağ dışı yedek pazarlık konusu bile değil, ön koşul.
- **50 klinikte:** Konutta üretim sunucusu savunulamaz hâle gelir (Rehber 3.3/3.6 fiziksel güvenlik + 7545 s.K. m.8/5 konutta arama; buna karşılık yetkilendirilmiş veri merkezinde **yalnızca hâkim kararıyla** arama yapılabilir). Türkiye'de VPS'e geçin; PostgreSQL'e geçiş kararını burada verin ama **veriyi yurt dışına çıkarmadan**.
- **200 klinikte:** Yönetilen hizmet ve belgeler (SOC 2/ISO) satış için gerekli hâle gelir. O noktada ya Türkiye'de bölge açmış bir hiper-ölçekli sağlayıcı olur (**doğrulanamadı** — herhangi bir sağlayıcının Türkiye bölgesi taahhüdü teyit edilemedi), ya da Supabase/AB'ye SS-3 imzalı olarak geçersiniz.

---

## 9) Bugün yapılacaklar listesi

1. **`sudo pmset -a autorestart 1`** — elektrik gelince sunucu kendi açılsın. **5 dakika.** (Ölçüldü: bugün `autorestart 0`.)
2. **FileVault'u aç**, kurtarma anahtarını cihaz dışında sakla, firmware parolası koy. Sonra **fişi çekip test et** — geri gelmiyorsa evde barındırma FileVault ile çalışmıyor demektir. **2 saat.**
3. **Şifreli, ağ dışı yedek** (`age`/`gpg` + ayrı fiziksel ortam ve konum, tercihen Türkiye). Anahtar Mac mini dışında. **3 saat.** — Veri 2,5 MB; maliyeti sıfıra yakın. (Not: `data/backups` altında ölçüm anında **5 günlük** klasör vardı; 14 günlük politikanızla uyumu kontrol edin.)
4. **Veri işleyen sözleşmesi şablonu** (Rehber 2.5'in saydığı unsurlar: yazılılık, yalnızca veri sorumlusunun talimatı doğrultusunda işleme, saklama-imha politikasına uygunluk, **süresiz sır saklama**, ihlalin derhal veri sorumlusuna bildirilmesi, aktarılan veri kategorilerinin ayrı maddede sayılması, veri sorumlusunun denetim hakkı) + kendinize süresiz gizlilik taahhütnamesi. **1 gün.** Sözleşmesiz klinik almayın.
5. **İhlal müdahale planı** + klinik için Kurul bildirim taslağı + 2019/271'in **5 unsurunu** içeren hasta sahibi bildirim metni (ihlalin ne zaman gerçekleştiği; hangi veri kategorilerinin etkilendiği; olası sonuçlar; alınan/önerilen tedbirler; irtibat kişisi bilgileri) + "gecikmeksizin kliniğe bildirim" sözleşme maddesi. **1 gün.**
6. **Periyodik imha + `sms_log` anonimleştirme** özelliğini yaz; imha kayıtlarını **en az 3 yıl** sakla (İmha Yönetmeliği m.7/3). Klinik VERBİS istisnasındaysa politika zorunlu değildir ama **m.11/3'ün 3 aylık süresi** işler. **2–3 gün.**
7. **`notes` alanlarına uyarı**: "Sahibe ait sağlık, inanç, mali bilgi yazmayın" + bunu sözleşmede kliniğin taahhüdü yap. **1 saat.** (Hayvan sağlık verisi m.6 kapsamında özel nitelikli **değildir** — bu avantajı serbest metin alanlarıyla kaybetmeyin; ayrıca TCK 135/2 nitelikli hâli sahibin sağlık verisi için devreye girebilir.)
8. **UPS al.** Fiyat doğrulanamadı; teklif alın.
9. **Politikaları bugün tarihlendir** ve versiyonla (2020/213: politikanın yürürlük tarihinin ihlalden sonra olması aleyhe değerlendirildi).
10. **Üç Türk sağlayıcıdan yazılı teklif iste** (4 vCPU / 8 GB / 100 GB NVMe, günlük yedek, ayrı lokasyona kopya, KVKK veri işleyen sözleşmesi, ISO 27001 belge kopyası). **Ek soru:** sağlayıcının 7545 s.K. anlamında "yetkilendirilmiş veri merkezi işletmecisi" olup olmadığını yazılı sorun — §5'te açıklanan usul güvencesi buna bağlıdır.

---

## 10) Belirsizlikler ve avukata sorulacaklar

1. Supabase, Kurul'un ilan ettiği Türkçe SS-3 metnini **değiştirmeden ve apostilli yetki belgesiyle** imzalar mı? (Supabase'e sorulacak; kamuya açık taahhüt **bulunamadı**.)
2. Teserix–Supabase arasında **tek bir standart sözleşme** tüm klinikleri kapsar mı, yoksa klinik başına ayrı sözleşme mi gerekir? Bildirim yükümlülüğü sözleşmede kime atanmalı (Yönetmelik m.14/5)? (Mevzuattan net değil; Kuruma yazılı görüş sorulmalı.)
3. Ürün kararlarını (tutulacak alanlar, saklama süresi, `sms_log` snapshot'ı) tek taraflı belirleyen bir SaaS sağlayıcısı hangi eşikte **veri sorumlusu** sayılır? (Nokta atışı Kurul kararı **bulunamadı**.)
4. **TCK m.136/2** nitelikli hâli mevcut mudur ve lafzı nedir? (7188 s.K. ile eklendiği ikincil kaynaklarda belirtiliyor; **birincil metin açılamadı**.) TCK 135/1'in "altı aydan üç yıla" olduğu §4'te çözülmüştür ancak konsolide kanun metni üzerinden **teyit edilmelidir** — mevzuat.gov.tr bu oturumda erişilemedi.
5. Kurul, bu belgenin tarihinden sonra herhangi bir ülke için **yeterlilik kararı** yayımladı mı? (Supabase kararından önce Resmî Gazete ve kvkk.gov.tr yeniden taranmalı; 09.09.2026 itibarıyla "henüz bir belirleme yapılmamıştır".)
6. Veteriner Hekim Muayenehane ve Poliklinik Yönetmeliği uyarınca tutulan kayıtların **yasal saklama süresi** nedir ve m.17'de elektronik kayıtların zarar görmesine ilişkin bir hüküm var mıdır? (**Doğrulanamadı** — mevzuat.gov.tr ve resmigazete.gov.tr açılamadı. Saklama tablosunun hukuki dayanağı için gereklidir; önceki sürümde kesin gibi aktarılan "kayıtlar tutulmamış sayılır" ifadesi bu nedenle çıkarılmıştır.)
7. KVKK **idari para cezaları sigortalanabilir mi**? Mesleki Sorumluluk Sigortası Genel Şartları'nın A.4 bölümü "Aksine Sözleşme Yoksa Teminat Dışında Kalan Hâller" başlığını taşıyor (başlık doğrulandı); ancak **idari para cezalarına ilişkin bendin varlığı ve numarası (A.4.3-a) doğrulanamadı**. Genel şart metni açılarak teyit edilmelidir.
8. Tailscale Funnel'ın taşıdığı **bağlantı meta verileri** (IP, SNI, log) m.9 anlamında ayrı bir yurt dışı aktarım oluşturur mu? (Hukuki nitelendirme **doğrulanamadı**.)
9. Randevu/aşı hatırlatma SMS'i **6563 s. Kanun ve İYS** kapsamında ticari elektronik ileti sayılır mı? (Bu araştırmanın kapsamı dışındaydı; ayrıca incelenmeli.)
10. Klinik sözleşmesinde **sorumluluk tavanı ve rücu sınırı** nasıl kurgulanmalı? Türkiye'de dava edilebilirsiniz; Supabase Pte. Ltd. (Singapur) karşısındaki dava kabiliyetiniz ise sözleşmenin yetki ve tahkim hükümlerine bağlıdır — **bu hükümler bu denetimde ayrıca doğrulanmadı**; ToS/DPA'nın uygulanacak hukuk ve uyuşmazlık maddeleri okunmalıdır.
11. Türkiye'deki VPS/colocation fiyatları ve sertifikaları **birincil kaynaktan doğrulanamadı**; teklif ve belge kopyası istenmelidir. Sağlayıcının 7545 s.K. anlamında yetkilendirilmiş veri merkezi işletmecisi olup olmadığı ayrıca sorulmalıdır.
12. Supabase alt işleyen listesinin **güncel sayısı ve içeriği** (BigQuery/ClickHouse, Fly.io dahil) ile yeni alt işleyenlere **itiraz süresi** doğrulanmalıdır (01.06.2026 tarihli PDF indirilmeli).

---

## 11) Kaynaklar

Aşağıdaki kaynaklardan **★ ile işaretlenenler** bu denetim sırasında birincil metni açılarak doğrulanmıştır. İşaretsiz olanlar belgede atıf düzeyinde kalmıştır.

**Mevzuat:** ★6698 s. KVKK (mevzuat.gov.tr, tam metin PDF; m.3, 9, 12, 17, 18, 30, Geçici m.3 ve değişiklik tablosu okundu) · ★7499 s. Kanun (RG **12.03.2024, S.32487**; m.34 ile KVKK m.9 değiştirildi, m.35 ile m.18 değiştirildi; 6698'in resmî değişiklik tablosunda yürürlük **1/6/2024**; Geçici m.3 ile eski m.9/1 **1/9/2024**'e kadar uygulanmaya devam etti) · ★Kişisel Verilerin Yurt Dışına Aktarılmasına İlişkin Usul ve Esaslar Hakkında Yönetmelik (RG **10.07.2024, S.32598**; m.14 ve m.15 okundu) · ★Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik (RG **28.10.2017, S.30224**; m.5, 7, 11, 12) · ★Veri Sorumluları Sicili Hakkında Yönetmelik (RG **30.12.2017, S.30286**) · ★7545 s. Siber Güvenlik Kanunu (m.8 tam metni TBMM kanun metninden; RG **19.03.2025** — Resmî Gazete **sayısı doğrulanamadı**) · Veteriner Hekim Muayenehane ve Poliklinik Yönetmeliği (**doğrulanamadı**) · ★5326 s. Kabahatler Kanunu m.17/7 (KVKK ceza tablosunda birebir alıntılanmış hâliyle) · Mesleki Sorumluluk Sigortası Genel Şartları (**kısmen doğrulanamadı**).

**Kurul kararları ve duyuruları:** ★2020/71 (30.01.2020, rol ayrımı ve aydınlatma) · ★2019/10 (24.01.2019, 72 saat) · ★2019/271 (18.09.2019, ilgili kişiye bildirimin 5 asgari unsuru) · ★2020/213 (12.03.2020, 300.000 TL) · ★2020/465 (16.06.2020, toplam 125.000 TL; 50.000 TL geç bildirim) · ★2021/891 (03.09.2021, WhatsApp, 1.950.000 TL, m.18/1-b) · ★2022/249 (17.03.2022, 950.000 TL, m.18/1-b) · ★2023/1154 (06.07.2023, VERBİS eşiği: <50 çalışan ve <100 mn TL) · ★2024/959 (04.06.2024, standart sözleşmeler; SS-3 dahil dört modül) · ★2024/1793 (17.10.2024, Standart Sözleşme Bildirim Modülü) · ★2025/1572 (04.09.2025, özel nitelikli veri ana faaliyetli veri sorumluları için VERBİS istisnası) · ★05.02.2025 tarihli standart sözleşme kamuoyu duyurusu · ★2026 idari para cezası tablosu. *(Önceki sürümde listelenen 2019/157, 2020/173, 2020/345, 2020/559, 2021/187, 2021/464 kararları belgede hiçbir iddiayı desteklemek için kullanılmadığından ve/veya doğrulanamadığından listeden çıkarılmıştır.)*

**KVKK yayınları:** ★Kişisel Veri Güvenliği Rehberi (Teknik ve İdari Tedbirler) — böl. 2.5, 3.2, 3.3, 3.4, 3.6 ve Tablo 4.1/4.2 birebir okundu · ★Kişisel Verilerin Yurt Dışına Aktarılması Rehberi (Yayın No: 48) — "arızilik" ve istisnai aktarım bölümleri birebir okundu · ★Kişisel Verilerin Korunması Kanununa İlişkin Uygulama Rehberi — TCK 135-140 alıntıları buradan alındı.

**Supabase:** ★/legal/dpa (Supabase Pte. Ltd., Singapur; SCC kabulü; 11.2 otuz günlük saklama; Türkiye/KVKK/6698 geçmiyor) · /legal/customer-resources/subprocessor-list (01.06.2026 — **PDF açılamadı**) · ★/sla (%99,9 yalnızca Enterprise) · ★/pricing (Pro $25/ay, Team $599/ay, PITR $100/ay/7 gün, Pro 7 günlük günlük yedek) · ★/docs/guides/platform/regions (Türkiye bölgesi yok; eu-central-1 Frankfurt) · ★/docs/guides/troubleshooting/change-project-region (bölge yerinde değiştirilemez) · /docs/guides/telemetry/logs (BigQuery→ClickHouse geçişi **kesin olarak doğrulanamadı**).

**Diğer:** Apple Platform Security (FileVault) · macOS `man fdesetup` · Tailscale KB 1223 (Funnel).

**Yerel ölçümler:** `fdesetup status` (Off) · `pmset -g` (`autorestart 0`, UPS yok) · `system_profiler` (Macmini8,1, T2) · `diskutil apfs list` · `du -sh data` (2,5 MB) · `src/db/tenant.js`, `src/db/master.js`, `src/routes/clinic.js`, `src/backup.js`, `src/server.js`.

---

### Denetim özeti: neyin değiştiği

| # | Bulgu | İşlem |
|---|---|---|
| 1 | TCK 135/1 aralığı önceki sürümde "doğrulanamadı" idi; yaygın "1–3 yıl" bilgisi yanlış | **Düzeltildi:** "altı aydan üç yıla"; 6698 m.30/2'nin yalnızca 135/**2**'yi değiştirdiği gösterildi |
| 2 | TCK 139 (135/136/138 şikâyete bağlı değil) belgede hiç yoktu | **Eklendi** — ceza riskinin niteliğini değiştiriyor |
| 3 | "Yazılı veri işleyen sözleşmesi" m.12/2'ye dayandırılmıştı | **Düzeltildi:** m.12/2 müşterek sorumluluk kurar; yazılılık Rehber 2.5'te "önerilmektedir" |
| 4 | Rehber 3.6 "ağ dışında" iken "lokasyon dışında" olarak aktarılmıştı | **Düzeltildi**, birebir lafız kondu |
| 5 | Rehber 3.3 emredici gibi sunulmuştu | **Yumuşatıldı** — lafız tanımlayıcı ("şifrelenebilir") |
| 6 | Kurul 2020/559 (900.000 TL) emsali | **ÇIKARILDI** — doğrulanamadı |
| 7 | 2020/71 alıntısı kararın lafzıyla birebir değildi | **Gerçek lafızla değiştirildi** |
| 8 | İmha rejimi: politika yükümlülüğünün VERBİS'e bağlı olduğu atlanmıştı | **Eklendi** — istisnadaki klinikte 3 aylık m.11/3 kuralı işler |
| 9 | 7545 m.8/5'in veri merkezi kayrası ("sadece hâkim kararıyla") atlanmıştı | **Eklendi** — Seçenek C'nin en güçlü hukuki gerekçesi |
| 10 | Yönetmelik m.14/5'teki "belirleme yoksa veri aktaran bildirir" kuralı yoktu | **Eklendi** |
| 11 | Proje-başına-klinik maliyeti "~$515/ay" | **Düzeltildi:** 50 × $25 = ~$1.250/ay |
| 12 | BigQuery log iddiası, alt işleyen sayısı (~24), Fly.io | **Koşullu/doğrulanamadı olarak işaretlendi** |
| 13 | Veteriner Yönetmeliği m.17/1-b "tutulmamış sayılır" iddiası | **Metinden çıkarıldı**, §10'a soru olarak taşındı |
| 14 | Şifrelemenin m.9'dan kurtarmadığı iddiası dayanaklı sunulmuştu | **"Doğrulanamadı" + çıkarım** olarak işaretlendi |
| 15 | Risk anlatımı üst sınırlar üzerinden kurgulanmıştı | **Dengelendi** — emsal tutar aralığı ve asıl iki risk ayrıca yazıldı |
| 16 | Kullanılmayan/doğrulanmayan 6 Kurul kararı kaynakçada | **Çıkarıldı** |
| 17 | 2026 tutarları, %25,49, m.18/2, m.9/5, m.14/3, 2024/959, 2023/1154, 2019/10, 2019/271, 2022/249, 2021/891, 2020/213, 2020/465, Supabase fiyat/SLA/DPA/bölge | **Doğrulandı, değişiklik yok** |