import { Command } from '@nestjs/cqrs';
import {
  UpdateAssignmentConfirmationRequestDto,
  UpdateAssignmentConfirmationResponseDto,
} from './update-assignment-confirmation.request.dto';

export class UpdateAssignmentConfirmationCommand extends Command<UpdateAssignmentConfirmationResponseDto> {
  constructor(public readonly payload: UpdateAssignmentConfirmationRequestDto) {
    super();
  }
}
