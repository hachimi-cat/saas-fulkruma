import express from 'express';
import { err } from '@forjio/sdk/http';
import routes from './routes/index.js';
import { requestId } from './middleware/auth.js';
import { startOutboxWorker } from './services/outbox-worker.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(requestId);

app.use('/api/v1', routes);

// Centralised error handler returns a Forjio-envelope 500.
app.use((e: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[api] unhandled', e);
  res.status(500).json(err('INTERNAL', 'unexpected server error', req.requestId ?? 'req_unknown'));
});

const port = Number(process.env.PORT ?? 4140);
app.listen(port, () => {
  console.log(`[api] ${process.env.FORJIO_SERVICE ?? 'fulkruma'} listening on ${port}`);
});

// Outbox worker runs alongside the API process. For production, prefer a
// separate pm2 entry: `node dist/services/outbox-worker.js`.
if (process.env.OUTBOX_WORKER_ENABLED !== 'false') {
  startOutboxWorker().catch((e) => {
    console.error('[outbox] fatal', e);
    process.exit(1);
  });
}
