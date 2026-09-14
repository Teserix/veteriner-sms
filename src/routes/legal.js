import { Router } from 'express';
import { requireRole, pendingLegalDocs } from '../auth.js';
import { legalAcceptances } from '../db/master.js';
import { LEGAL_DOCS, ACCEPT_REQUIRED, renderDoc } from '../legal.js';
import { clientIp } from '../ratelimit.js';
import { audit } from '../audit.js';
import { nowIso } from '../util.js';

/**
 * Sözleşme kabulü (klinik yöneticisi). Metinler sayfaya gömülü gösterilir, kutular boş gelir,
 * sözleşme ile veri işleme eki ayrı ayrı onaylanır (TBK m.21; Kurul 2025/1072: tek eylemle toplu onay yok).
 * Kabul kaydı: kullanıcı, klinik, belge, sürüm, SHA-256, tarih, IP, tarayıcı.
 */
export const legalRouter = Router();

function render(req, res, error = null) {
  const pending = pendingLegalDocs(req.user);
  res.render('sozlesme', {
    title: 'Sözleşme onayı',
    docs: ACCEPT_REQUIRED.map((slug) => ({ ...renderDoc(slug), pending: pending.includes(slug) })),
    pending,
    error,
  });
}

legalRouter.get('/sozlesme', requireRole('admin'), (req, res) => {
  if (!req.user.clinicId) return res.redirect('/admin');
  render(req, res);
});

legalRouter.post('/sozlesme', requireRole('admin'), (req, res) => {
  if (!req.user.clinicId) return res.redirect('/admin');
  const pending = pendingLegalDocs(req.user);
  const missing = pending.filter((slug) => req.body[`accept_${slug}`] !== '1');
  if (missing.length) {
    return render(req, res, 'Devam etmek için her belgeyi ayrı ayrı okuyup onaylayın: ' + missing.map((s) => LEGAL_DOCS[s].title).join(', '));
  }
  const at = nowIso();
  for (const slug of pending) {
    const d = LEGAL_DOCS[slug];
    legalAcceptances.add({
      user_id: req.user.id, clinic_id: req.user.clinicId, slug, version: d.version, doc_sha256: d.sha256,
      accepted_at: at, ip: clientIp(req), user_agent: String(req.headers['user-agent'] || '').slice(0, 200),
    });
    audit(req, 'legal.accept', { entityType: 'legal_doc', entityId: slug, meta: { version: d.version, sha256: d.sha256.slice(0, 16) } });
  }
  res.redirect('/?ok=' + encodeURIComponent('Sözleşme kabul edildi. Kopyasını Ayarlar › Sözleşmeler bölümünden her zaman görüntüleyebilirsiniz.'));
});
