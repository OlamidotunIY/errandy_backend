import type { GenericEndpointContext } from 'better-auth';
import * as geoip from 'geoip-lite';

export class IpCountryResolver {
  static resolve(context: GenericEndpointContext | null): string {
    if (!context) return 'UNKNOWN';

    // Note: better-auth passes standard web Request objects.
    const request = context.request;
    const cloudflareCountry = request?.headers?.get('cf-ipcountry')?.trim();
    if (cloudflareCountry && /^[a-z]{2}$/i.test(cloudflareCountry)) {
      return cloudflareCountry.toUpperCase();
    }

    const ip =
      request?.headers?.get('cf-connecting-ip') ||
      request?.headers?.get('x-forwarded-for') ||
      '';

    // Split by comma in case of multiple proxy IPs and take the first one
    const clientIp = ip.split(',')[0].trim();

    if (clientIp) {
      const geo = geoip.lookup(clientIp);
      if (geo && geo.country) {
        return geo.country.toUpperCase(); // e.g. "NG", "GH"
      }
    }

    return 'UNKNOWN';
  }
}
