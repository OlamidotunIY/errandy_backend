import { PartyId } from '@module/party';

export class ClientRole {
  constructor(
    public readonly id: PartyId,
    private _defaultPaymentMethodId?: string,
    private _isActive: boolean = true,
    public readonly createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
  ) {}

  private touch(): void {
    this.updatedAt = new Date();
  }

  setDefaultPaymentMethod(paymentMethodId: string): void {
    this._defaultPaymentMethodId = paymentMethodId;
    this.touch();
  }

  deactivate(): void {
    this._isActive = false;
    this.touch();
  }

  get defaultPaymentMethodId(): string | undefined {
    return this._defaultPaymentMethodId;
  }

  get isActive(): boolean {
    return this._isActive;
  }
}
