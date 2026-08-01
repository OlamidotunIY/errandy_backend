import { Command } from '@nestjs/cqrs';
import {
  ConfirmAssignmentCompletionRequestDto,
  ConfirmAssignmentCompletionResponseDto,
} from '.';

export class ConfirmAssignmentCompletionCommand extends Command<ConfirmAssignmentCompletionResponseDto> {
  constructor(public readonly payload: ConfirmAssignmentCompletionRequestDto) {
    super();
  }
}
