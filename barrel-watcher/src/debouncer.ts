export class DirectoryDebouncer {
  private readonly pending = new Set<string>();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly delayMs: number,
    private readonly flush: (directories: string[]) => Promise<void>,
  ) {}

  add(directories: Iterable<string>): void {
    for (const directory of directories) {
      this.pending.add(directory);
    }

    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      void this.flushNow();
    }, this.delayMs);
  }

  async flushNow(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const directories = [...this.pending];
    this.pending.clear();

    if (directories.length === 0) return;
    await this.flush(directories);
  }
}
