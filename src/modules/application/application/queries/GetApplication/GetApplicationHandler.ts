import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetApplicationQuery, GetApplicationQueryDTO } from './';
import { IApplicationRepository } from '@src/modules';

@QueryHandler(GetApplicationQuery)
export class GetApplicationHandler implements IQueryHandler<GetApplicationQuery> {
  constructor(public readonly repository: IApplicationRepository) {}
  execute(query: GetApplicationQuery): Promise<GetApplicationQueryDTO> {
    const { userId, limit, cursor } = query.payload;
  }
}
