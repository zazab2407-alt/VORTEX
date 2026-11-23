import fs from 'node:fs';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config/env.js';
import sanitize from './middleware/sanitize.js';
import requireCustomHeader from './middleware/csrf.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import routes from './routes/index.js';

fs.mkdirSync(config.uploadsDir, { recursive: true });

const app = express();
app.disable('x-powered-by');
if (config.isProd) app.set('trust proxy', 1); // correct client IPs behind a host's proxy (rate limiting)

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } })); // allow the web app to show /uploads images
app.use(cors({
  origin(origin, cb) {
    if (!origin || config.clientUrls.includes(origin)) return cb(null, true); // no Origin = curl / server-to-server
    cb(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(cookieParser());
app.use(sanitize);

app.use('/uploads', express.static(config.uploadsDir, { maxAge: '7d', index: false }));
app.use('/api', apiLimiter, requireCustomHeader, routes);

app.use(notFound);
app.use(errorHandler);

export default app;
