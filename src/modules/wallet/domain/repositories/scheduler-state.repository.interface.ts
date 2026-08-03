export interface ISchedulerStateRepository {
  getLastReconciledUntil(): Promise<Date | null>;
  advanceCursor(endWindow: Date): Promise<void>;
}
