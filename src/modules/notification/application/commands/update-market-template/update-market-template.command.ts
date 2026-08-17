export class UpdateMarketTemplateCommand {
  constructor(
    public readonly marketId: string,
    public readonly type: string,
    public readonly subject: string,
    public readonly html: string,
    public readonly name?: string,
  ) {}
}
