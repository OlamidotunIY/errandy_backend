import { initializeBarrels } from './init';
import { watchBarrels } from './watch';

async function main(): Promise<void> {
  const command = process.argv[2];

  if (command === 'init') {
    await initializeBarrels();
    return;
  }

  if (command === 'watch') {
    await watchBarrels();
    return;
  }

  console.error('Usage: ts-node barrel-watcher/src/cli.ts <init|watch>');
  process.exitCode = 1;
}

void main().catch((error) => {
  console.error('[barrel-watcher] Fatal error:', error);
  process.exitCode = 1;
});
