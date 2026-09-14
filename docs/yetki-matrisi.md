# Erişim yetki ve kontrol matrisi

Kişisel Veri Güvenliği Rehberi §3.1 ("erişim yetki ve kontrol matrisi oluşturulması ... önerilmektedir") ve Tablo 4.1 uyarınca. Uygulamada Ayarlar › Erişim yetki matrisi bölümünde de gösterilir. Kod karşılığı: `requireRole()` (`src/auth.js`), `clinicScope` (`src/routes/clinic.js`), `/admin` yalnızca `superadmin`.

İlke: "İzin verilmedikçe her şey yasaktır" (Rehber §2.2). Her klinik ayrı SQLite dosyasında; bir kliniğin oturumu başka kliniğin dosyasını açamaz (`test/tenant-isolation.test.js`).

| Veri / işlem | Klinik yöneticisi (`admin`) | Personel (`staff`) | Sistem yöneticisi (`superadmin`, Teserix) |
|---|---|---|---|
| Hasta sahipleri, hayvanlar | oku, yaz, sil, dışa aktar (CSV/JSON), anonimleştir | oku, yaz | — |
| Hatırlatmalar | oku, yaz, sil, elle gönder | oku, yaz, elle gönder | — |
| SMS geçmişi | oku | oku | — |
| SMS tercihi (ret / yeniden açma) | değiştir | değiştir (ret ve düzenleme) | — |
| İlgili kişi başvuruları | oku, kaydet, kapat | oku, kaydet, kapat | — |
| Ayarlar (şablon, hukuki kimlik, saklama süresi, sağlayıcı bilgileri) | oku, yaz | — | — |
| CSV içe aktarma | evet (onay beyanı zorunlu) | — | — |
| Kullanıcılar | oluştur, rol değiştir, pasifleştir, sil, parola sıfırla | — | klinik yöneticisi parolasını sıfırlama (denetim kaydıyla) |
| Sözleşme kabulü | kabul eder (zorunlu kapı) | — | kabul kayıtlarını görür |
| Klinik açma / kapama / silme | — | — | evet |
| Denetim günlüğü | — | — | oku |
| Veri ihlali kayıtları | — | — | oku, yaz |
| Klinik veritabanı dosyası (disk) | — | — | işletim düzeyinde erişim (yedek, taşıma); uygulama arayüzünden hasta verisi ekranı yok |

Erişim kayıtları (`audit_log`): giriş/çıkış, kullanıcı işlemleri, ayar değişikliği, içe aktarma, dışa aktarma (`owner.export`, `export.csv`), hasta sahibi görüntüleme (`owner.view`), arama (`owner.search`, aranan metin yazılmaz), SMS geçmişi görüntüleme (`sms.view`), tercih değişiklikleri (`consent.grant/revoke`), silme/anonimleştirme, sözleşme kabulü, ihlal kayıtları, periyodik imha turları (`retention.run`). Kayıtlarda telefon, mesaj gövdesi ve parola bulunmaz; 3 yıl sonra kullanıcı e-postası ve IP maskelenir.

Ayrılan personel: klinik yöneticisi Kullanıcılar sayfasından hesabı pasifleştirir; oturumlar anında geçersiz olur (`sessions.deleteForUser`).
