export class PhoneCountryResolver {
  static resolve(phoneNumber: string): string {
    if (phoneNumber.startsWith('+234')) return 'NG';
    if (phoneNumber.startsWith('+233')) return 'GH';
    if (phoneNumber.startsWith('+254')) return 'KE';
    return 'UNKNOWN';
  }
}
