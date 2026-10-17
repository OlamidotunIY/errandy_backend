import * as client from 'prom-client';
import type { Request, Response, NextFunction } from 'express';

export const metricsRegistry = new client.Registry();

client.collectDefaultMetrics({
  register: metricsRegistry,
  prefix: 'errandy_',
});

export const httpRequestsTotal = new client.Counter({
  name: 'errandy_http_requests_total',
  help: 'Total number of HTTP/GraphQL requests handled by Errandy API',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [metricsRegistry],
});

export const httpRequestDurationSeconds = new client.Histogram({
  name: 'errandy_http_request_duration_seconds',
  help: 'Duration of HTTP/GraphQL requests in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

/**
 * Express middleware that records Prometheus request counts and latency histograms,
 * and serves `GET /metrics` for Prometheus scraping.
 */
export function prometheusMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const path = (req.originalUrl || req.url || '/').split('?')[0];

  if (req.method === 'GET' && path === '/metrics') {
    metricsRegistry
      .metrics()
      .then((metrics) => {
        res.setHeader('Content-Type', metricsRegistry.contentType);
        res.status(200).send(metrics);
      })
      .catch((err) => {
        res.status(500).send(err instanceof Error ? err.message : String(err));
      });
    return;
  }

  // Skip recording self-scrapes and healthchecks in request metrics
  if (path === '/health') {
    next();
    return;
  }

  const endTimer = httpRequestDurationSeconds.startTimer();

  res.on('finish', () => {
    const normalizedRoute = path.startsWith('/graphql')
      ? '/graphql'
      : path.startsWith('/api/auth')
        ? '/api/auth'
        : path.startsWith('/webhooks/paystack')
          ? '/webhooks/paystack'
          : path;

    const labels = {
      method: req.method,
      route: normalizedRoute,
      status_code: String(res.statusCode),
    };

    httpRequestsTotal.inc(labels);
    endTimer(labels);
  });

  next();
}
