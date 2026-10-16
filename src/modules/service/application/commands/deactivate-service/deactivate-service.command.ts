import { Command } from '@nestjs/cqrs';
import { DeactivateServiceRequestDto, DeactivateServiceResponseDto } from './deactivate-service.request.dto';

export class DeactivateServiceCommand extends Command<DeactivateServiceResponseDto> {
  constructor(public readonly payload: DeactivateServiceRequestDto) {
    super();
  }
}
