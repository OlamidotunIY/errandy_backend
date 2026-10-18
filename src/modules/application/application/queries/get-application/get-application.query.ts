import { Query, QueryHandler } from '@nestjs/cqrs';
import { GetApplicationQueryDTO } from './get-application.query.dto';
import { GetApplicationQueryPayload } from './get-application.query.payload';

export class GetApplicationQuery extends Query<GetApplicationQueryDTO> {
  constructor(public readonly payload: GetApplicationQueryPayload) {
    super();
  }
}
