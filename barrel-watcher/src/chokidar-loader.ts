type ChokidarModule = typeof import('chokidar');

export async function loadChokidar(): Promise<ChokidarModule> {
  const dynamicImport = new Function(
    'specifier',
    'return import(specifier)',
  ) as (specifier: string) => Promise<ChokidarModule>;

  return dynamicImport('chokidar');
}
