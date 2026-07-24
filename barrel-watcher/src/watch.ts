import * as path from 'node:path';
import { BarrelGenerator } from './barrel-generator';
import { loadChokidar } from './chokidar-loader';
import { DirectoryDebouncer } from './debouncer';
import { DddScope } from './ddd-scope';
import { isIgnoredPath, normalizeEventPath } from './path-utils';

export async function watchBarrels(): Promise<void> {
  const scope = DddScope.discover();
  const generator = new BarrelGenerator(scope);
  const chokidar = await loadChokidar();

  const watchRoots = scope.getWatchRoots();
  if (watchRoots.length === 0) {
    console.log('[barrel-watcher] No DDD module roots found.');
    return;
  }

  const debouncer = new DirectoryDebouncer(100, async (directories) => {
    const updated = await generator.updateDirectories(directories);
    if (updated > 0) {
      console.log(`[barrel-watcher] Updated ${updated} barrel file(s).`);
    }
  });

  const watcher = chokidar.watch(watchRoots, {
    ignored: (watchedPath: string) => isIgnoredPath(watchedPath),
    ignoreInitial: true,
    persistent: true,
  });

  const enqueuePath = (eventPath: string): void => {
    const absolutePath = normalizeEventPath(eventPath);
    if (isIgnoredPath(absolutePath) || !scope.isDddPath(absolutePath)) return;

    const eventDirectory = path.extname(absolutePath)
      ? path.dirname(absolutePath)
      : absolutePath;

    debouncer.add(scope.getDddAncestors(eventDirectory));
  };

  watcher
    .on('add', enqueuePath)
    .on('unlink', enqueuePath)
    .on('addDir', enqueuePath)
    .on('unlinkDir', enqueuePath)
    .on('error', (error) => {
      console.error('[barrel-watcher] Watch error:', error);
    });

  process.once('SIGINT', () => {
    void shutdown();
  });
  process.once('SIGTERM', () => {
    void shutdown();
  });

  async function shutdown(): Promise<void> {
    await debouncer.flushNow();
    await watcher.close();
    process.exit(0);
  }

  console.log(
    `[barrel-watcher] Watching ${watchRoots.length} DDD module root(s).`,
  );
}
