import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import { config } from '../config.js';

/** Kimlik gerektirmeyen sağlık/sürüm uçları (Docker HEALTHCHECK, dağıtım doğrulama) */
export const opsRouter = Router();

let buildTime = 'unknown';
try {
  const p = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'BUILD_TIME');
  buildTime = fs.readFileSync(p, 'utf8').trim() || 'unknown';
} catch { /* dosya yoksa unknown */ }

opsRouter.get('/health', (req, res) => {
  res.json({ ok: true });
});

opsRouter.get('/version', (req, res) => {
  res.json({ name: 'veteriner-sms', version: config.version, buildTime });
});
