export class GetMarketTemplateQuery {
  constructor(
    public readonly marketId: string,
    public readonly type: string,
  ) {}
}
