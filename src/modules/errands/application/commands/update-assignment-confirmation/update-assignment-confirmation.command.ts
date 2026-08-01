import { Command } from '@nestjs/cqrs';
import {
  UpdateAssignmentConfirmationRequestDto,
  UpdateAssignmentConfirmationResponseDto,
} from '.';

export class UpdateAssignmentConfirmationCommand extends Command<UpdateAssignmentConfirmationResponseDto> {
  constructor(public readonly payload: UpdateAssignmentConfirmationRequestDto) {
    super();
  }
}
