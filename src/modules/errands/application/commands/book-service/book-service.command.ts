import { Command } from '@nestjs/cqrs';
import { BookServiceRequestDto, BookServiceResponseDto } from '.';

export class BookServiceCommand extends Command<BookServiceResponseDto> {
  constructor(public readonly payload: BookServiceRequestDto) {
    super();
  }
}
