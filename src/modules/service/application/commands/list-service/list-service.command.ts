import { Command } from '@nestjs/cqrs';
import { ListServiceRequestDto, ListServiceResponseDto } from './list-service.request.dto';

export class ListServiceCommand extends Command<ListServiceResponseDto> {
  constructor(public readonly payload: ListServiceRequestDto) {
    super();
  }
}
