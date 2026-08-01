import { Command } from '@nestjs/cqrs';
import { UpdateServicePriceRequestDto, UpdateServicePriceResponseDto } from '.';

export class UpdateServicePriceCommand extends Command<UpdateServicePriceResponseDto> {
  constructor(public readonly payload: UpdateServicePriceRequestDto) {
    super();
  }
}
