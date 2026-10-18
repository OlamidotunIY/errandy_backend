import { Command } from '@nestjs/cqrs';
import { UpdateServicePriceRequestDto, UpdateServicePriceResponseDto } from './update-service-price.request.dto';

export class UpdateServicePriceCommand extends Command<UpdateServicePriceResponseDto> {
  constructor(public readonly payload: UpdateServicePriceRequestDto) {
    super();
  }
}
