# Kişisel Veri İşleme Eki (Veri İşleyen Sözleşmesi)

Sürüm 1 — Avukat incelemesi bekleyen taslak. Abonelik Sözleşmesi'nin ayrılmaz ekidir; 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) m.12/2 ve Kişisel Veri Güvenliği Rehberi §2.5 dikkate alınarak hazırlanmıştır.

## 1. Roller

- **Veri sorumlusu:** Klinik. Hasta sahiplerine ait kişisel verilerin işlenme amacını ve yöntemini belirler.
- **Veri işleyen:** {sirket_unvan} ("Teserix"). Kişisel verileri yalnızca Klinik adına ve Klinik'in bu ek ile verdiği talimatlar çerçevesinde işler.
- **Alt veri işleyenler:** (a) Klinik'in kendi hesabıyla sözleşme yaptığı SMS sağlayıcısı (Klinik'in doğrudan sözleşmesel ilişkisidir; Teserix yalnızca Klinik'in API bilgilerini şifreli saklar ve gönderim isteğini iletir); (b) sunucu barındırma sağlayıcısı: {yer_saglayici}. Teserix, alt işleyen değişikliğini en az 30 gün önceden bildirir; Klinik itiraz ederse sözleşmeyi tazminatsız feshedebilir.

## 2. İşlenen veriler ve ilgili kişiler

| İlgili kişi | Veri kategorisi | Veri türleri |
| Hasta sahibi | Kimlik, iletişim | ad-soyad, cep telefonu, e-posta, adres |
| Hasta sahibi | İşlem güvenliği | SMS gönderim kaydı (tarih, durum, sağlayıcı referansı), SMS tercihi ve değişiklik olayları (tarih, kanal, IP) |
| Hasta sahibi | Diğer | hayvana ait kimlik/sağlık kayıtları (ad, tür, ırk, doğum tarihi, mikroçip no, hatırlatma türü ve tarihi, not) |
| Klinik personeli | Kimlik, iletişim, işlem güvenliği | ad, e-posta, parola özeti, oturum ve denetim kayıtları (IP, tarayıcı) |

Özel nitelikli kişisel veri (KVKK m.6) işlenmesi öngörülmemiştir. Klinik, not alanlarına hasta sahibinin sağlık, din, siyasi görüş gibi özel nitelikli verilerini girmemeyi taahhüt eder.

## 3. İşleme amacı ve kapsamı

Veriler yalnızca (a) hasta ve hayvan kayıtlarının tutulması, (b) hatırlatma kısa mesajlarının planlanması ve gönderilmesi, (c) Klinik'in mevzuattan doğan kayıt ve ispat yükümlülüklerinin desteklenmesi amaçlarıyla işlenir. Teserix, verileri kendi amaçları için kullanmaz, üçüncü kişilere aktarmaz, analiz etmez, anonim istatistik dışında hiçbir biçimde değerlendirmez.

## 4. Talimata bağlılık

Teserix, kişisel verileri yalnızca bu ek ve uygulama içindeki işlevler yoluyla verilen talimatlarla işler. Bir talimatın mevzuata aykırı olduğunu değerlendirirse Klinik'i derhal bilgilendirir.

## 5. Veri konumu ve aktarım

Kişisel veriler Türkiye Cumhuriyeti sınırları içindeki sunucularda tutulur. Yurt dışına aktarım yapılmaz; Teserix, yurt dışına aktarım gerektirecek bir altyapı değişikliğini Klinik'in yazılı onayı ve KVKK m.9'daki usul tamamlanmadan yapmaz.

## 6. Güvenlik tedbirleri (KVKK m.12)

Teserix en az şu tedbirleri uygular:

- Her Klinik'in verisi fiziksel olarak ayrı veritabanı dosyasında tutulur; başka bir kliniğin verisine uygulama yoluyla erişim teknik olarak mümkün değildir.
- Rol tabanlı yetki matrisi (klinik yöneticisi / personel / sistem yöneticisi); sistem yöneticisinin hasta verisi ekranlarına erişimi yoktur.
- Parolalar tek yönlü özet (bcrypt) ile saklanır; SMS sağlayıcı hesap bilgileri AES-256-GCM ile şifrelenir.
- Sunucu diski tam disk şifrelemesiyle korunur; yedekler şifreli olarak üretim sunucusundan ayrı ortamda tutulur.
- Erişim ve işlem kayıtları (giriş, kayıt görüntüleme, dışa aktarma, silme, ayar değişikliği) denetim günlüğünde tutulur.
- İstek sınırlama, CSRF ve kaynak doğrulaması, güvenli çerez bayrakları, içerik güvenlik politikası uygulanır.
- Ayrılan personel hesapları Klinik yöneticisi tarafından kapatılır; Teserix tarafında sistem yöneticisi hesabı tek kişiyle sınırlıdır.

## 7. Gizlilik

Teserix ve çalışanları, öğrendikleri kişisel verileri KVKK m.12/4 uyarınca görevden ayrılmalarından sonra da **süresiz** olarak gizli tutar.

## 8. Veri ihlali

Teserix, kişisel verilerin kanuna aykırı olarak elde edildiğini öğrendiğinde Klinik'e **gecikmeksizin** ve her halde 24 saat içinde bildirir (Kurul kararı 2019/10). Bildirim; ihlalin niteliğini, etkilenen kayıt ve kişi sayısını, olası sonuçları ve alınan tedbirleri içerir. Kurul'a 72 saat içinde bildirim yükümlülüğü veri sorumlusu olarak Klinik'e aittir; Teserix bildirim formunun doldurulması için gerekli bilgileri sağlar ve ihlal kaydını tutar.

## 9. İlgili kişi başvuruları

Hasta sahibinin KVKK m.11 kapsamındaki başvurusu Klinik'e yapılır. Teserix, Klinik'in bu başvuruları 30 gün içinde yanıtlayabilmesi için uygulamada kişi bazlı veri dışa aktarma, düzeltme, silme/anonimleştirme ve başvuru takip araçlarını sağlar. Teserix'e doğrudan ulaşan başvurular Klinik'e yönlendirilir.

## 10. Saklama ve imha

- Hasta sahibi ve hayvan kayıtları: Klinik sildiği veya anonimleştirdiği anda; sözleşme sona erdiğinde ise 30 günlük dışa aktarma süresinin ardından imha edilir.
- SMS gönderim kayıtları: kişisel alanlar (telefon, mesaj, ad) Klinik'in belirlediği süre sonunda, en erken 3 yıl (Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik m.13/2) sonra otomatik anonimleştirilir; kayıt satırı 6563 sayılı Kanun m.11/3 uyarınca 10 yıl tutulur.
- Denetim günlüğü: 3 yıl sonra kullanıcı kimliği maskelenir.
- Yedekler: 14 gün döngüyle otomatik silinir; imha edilen bir kayıt en geç 14 gün sonra yedeklerden de çıkar.
- İmha işlemleri kayıt altına alınır ve bu kayıtlar en az 3 yıl saklanır (Yönetmelik m.7/3).

## 11. Denetim

Klinik, makul bir ön bildirimle yılda bir kez, Teserix'in bu ekteki yükümlülüklere uyumunu belgeler üzerinden denetleyebilir; gerekli görürse yerinde inceleme talep edebilir. Teserix, denetim bulgularını 30 gün içinde giderir.

## 12. Sözleşmenin sona ermesi

Abonelik sona erdiğinde Teserix, Klinik'in verilerini 30 gün boyunca dışa aktarılabilir tutar, ardından veritabanı dosyasını ve yedeklerini siler ve Klinik'e imha kaydını bildirir.

## 13. Sorumluluk

Teserix, bu ekteki yükümlülüklerini ihlal etmesinden doğan zararlardan Klinik'e karşı sorumludur. Klinik, veri sorumlusu olarak aydınlatma, hukuki dayanak, VERBİS (yükümlüyse) ve Kurul'a bildirim yükümlülüklerinden Teserix'e karşı sorumludur. KVKK m.12/2 uyarınca taraflar veri güvenliğine ilişkin tedbirlerin alınmasında müştereken sorumludur.

Bu ek, Klinik yöneticisinin uygulamadaki ayrı onay kutusunu işaretleyip onaylamasıyla yürürlüğe girer; kabul kaydı Abonelik Sözleşmesi ile aynı usulle tutulur.
