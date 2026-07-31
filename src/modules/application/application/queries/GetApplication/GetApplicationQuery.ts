import { Query, QueryHandler } from '@nestjs/cqrs';
import { GetApplicationQueryDTO, GetApplicationQueryPayload } from './';

export class GetApplicationQuery extends Query<GetApplicationQueryDTO> {
  constructor(public readonly payload: GetApplicationQueryPayload) {
    super();
  }
}
