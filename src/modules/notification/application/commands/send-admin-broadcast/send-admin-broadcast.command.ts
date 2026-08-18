export class SendAdminBroadcastCommand {
  constructor(
    public readonly adminId: string,
    public readonly adminEmail: string,
    public readonly subject: string,
    public readonly templateId: string,
    public readonly targetUserIds?: string[],
    public readonly context?: Record<string, unknown>,
  ) {}
}
