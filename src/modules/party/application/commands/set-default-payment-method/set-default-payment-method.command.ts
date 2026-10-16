import { Command } from '@nestjs/cqrs';
import {
  SetDefaultPaymentMethodRequestDto,
  SetDefaultPaymentMethodResponseDto,
} from './set-default-payment-method.request.dto';

export class SetDefaultPaymentMethodCommand extends Command<SetDefaultPaymentMethodResponseDto> {
  constructor(public readonly payload: SetDefaultPaymentMethodRequestDto) {
    super();
  }
}
