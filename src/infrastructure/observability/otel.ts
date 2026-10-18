import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

let sdk: NodeSDK | null = null;

/**
 * Starts the OpenTelemetry NodeSDK for distributed tracing when
 * `OTEL_EXPORTER_OTLP_ENDPOINT` is configured (and not running in test mode).
 */
export function startOtel(defaultServiceName: string): void {
  if (process.env.NODE_ENV === 'test' || sdk) {
    return;
  }

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) {
    return;
  }

  const serviceName = process.env.OTEL_SERVICE_NAME || defaultServiceName;
  const tracesUrl = endpoint.endsWith('/v1/traces')
    ? endpoint
    : `${endpoint.replace(/\/$/, '')}/v1/traces`;

  const traceExporter = new OTLPTraceExporter({
    url: tracesUrl,
  });

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
    }),
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
      }),
    ],
  });

  sdk.start();

  const shutdown = () => {
    sdk?.shutdown().catch((err) => {
      console.error('[OpenTelemetry] Error shutting down SDK:', err);
    });
  };

  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
