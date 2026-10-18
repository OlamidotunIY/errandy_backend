import { Command } from '@nestjs/cqrs';
import {
  ConfirmAssignmentCompletionRequestDto,
  ConfirmAssignmentCompletionResponseDto,
} from './confirm-assignment-completion.request.dto';

export class ConfirmAssignmentCompletionCommand extends Command<ConfirmAssignmentCompletionResponseDto> {
  constructor(public readonly payload: ConfirmAssignmentCompletionRequestDto) {
    super();
  }
}
