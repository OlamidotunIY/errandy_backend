import { BarrelGenerator } from './barrel-generator';
import { DddScope } from './ddd-scope';

export async function initializeBarrels(): Promise<void> {
  const scope = DddScope.discover();
  const generator = new BarrelGenerator(scope);
  const directories = scope.getAllKnownDddDirectories();
  const updated = await generator.updateDirectories(directories);

  console.log(
    `[barrel-watcher] Scanned ${directories.length} DDD director${
      directories.length === 1 ? 'y' : 'ies'
    }; updated ${updated} barrel file${updated === 1 ? '' : 's'}.`,
  );
}
