import { Router } from 'express';

/** CSV içe aktarma (WP7) - ayrı paket olarak tamamlanacak; şimdilik yer tutucu */
export const importRouter = Router();

importRouter.get('/', (req, res) => {
  res.render('error', { title: 'İçe aktarma', message: 'CSV içe aktarma özelliği henüz hazır değil.' });
});
