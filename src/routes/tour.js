import { Router } from 'express';
import { requireLogin } from '../auth.js';
import { users } from '../db/master.js';
import { nowIso, returnTo } from '../util.js';

/**
 * Karşılama turu "görüldü" işareti. Gövdedeki user_id (ve benzeri alanlar) yok sayılır;
 * güncellenen satır yalnız oturumdaki kullanıcıdır. Yeniden başlatma sunucuda tutulmaz (?tur=1 istemcide).
 */
export const tourRouter = Router();

/** fetch: Accept: application/json veya x-csrf-token → 204. Aksi halde form gönderimi → 303. */
function prefersNoContent(req) {
  if (req.get('x-csrf-token')) return true;
  return String(req.get('accept') || '').includes('application/json');
}

tourRouter.post('/tur/goruldu', requireLogin, (req, res) => {
  users.markTourSeen(req.user.id, nowIso());
  if (prefersNoContent(req)) return res.status(204).end();
  return res.redirect(303, returnTo(req, '/'));
});
