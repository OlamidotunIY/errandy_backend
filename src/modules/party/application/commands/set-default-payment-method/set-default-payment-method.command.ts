import { Command } from '@nestjs/cqrs';
import {
  SetDefaultPaymentMethodRequestDto,
  SetDefaultPaymentMethodResponseDto,
} from '.';

export class SetDefaultPaymentMethodCommand extends Command<SetDefaultPaymentMethodResponseDto> {
  constructor(public readonly payload: SetDefaultPaymentMethodRequestDto) {
    super();
  }
}
