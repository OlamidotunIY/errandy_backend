import { Command } from '@nestjs/cqrs';
import { BookServiceRequestDto, BookServiceResponseDto } from './book-service.request.dto';

export class BookServiceCommand extends Command<BookServiceResponseDto> {
  constructor(public readonly payload: BookServiceRequestDto) {
    super();
  }
}
