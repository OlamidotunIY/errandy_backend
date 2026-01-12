import { ObjectType, Field, registerEnumType } from '@nestjs/graphql';

export enum WalletFundingChannel {
  CARD = 'card',
  TRANSFER = 'transfer',
  QR = 'qr',
}

registerEnumType(WalletFundingChannel, {
  name: 'WalletFundingChannel',
  description: 'Payment channel for wallet funding',
});

@ObjectType()
export class BankTransferDetails {
  @Field()
  accountNumber: string;

  @Field()
  accountName: string;

  @Field()
  bankName: string;

  @Field({ nullable: true })
  expiresAt?: string;
}

@ObjectType()
export class QRCodeDetails {
  @Field()
  qrCode: string;

  @Field({ nullable: true })
  displayText?: string;
}

@ObjectType()
export class WalletFundingResponse {
  @Field()
  status: boolean;

  @Field()
  message: string;

  @Field()
  reference: string;

  @Field(() => WalletFundingChannel)
  channel: WalletFundingChannel;

  @Field()
  amount: number;

  @Field({ nullable: true, description: 'For card channel - redirect URL' })
  authorizationUrl?: string;

  @Field(() => BankTransferDetails, {
    nullable: true,
    description: 'For transfer channel - bank details',
  })
  bankDetails?: BankTransferDetails;

  @Field(() => QRCodeDetails, {
    nullable: true,
    description: 'For QR channel - QR code data',
  })
  qrDetails?: QRCodeDetails;
}
