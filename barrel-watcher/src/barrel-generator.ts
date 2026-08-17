import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { DddScope } from './ddd-scope';
import {
  exportSpecifierForDirectory,
  exportSpecifierForFile,
  isExportableTypeScriptFile,
  isIgnoredPath,
} from './path-utils';

export class BarrelGenerator {
  constructor(private readonly scope: DddScope) {}

  async updateDirectory(directoryPath: string): Promise<boolean> {
    if (
      !this.scope.isDddDirectory(directoryPath) ||
      isIgnoredPath(directoryPath)
    ) {
      return false;
    }

    const stat = await safeStat(directoryPath);
    if (!stat?.isDirectory()) return false;

    const entries = await fs.readdir(directoryPath, { withFileTypes: true });

    const childDirectories = entries
      .filter((entry) => entry.isDirectory())
      .filter((entry) => !isIgnoredPath(path.join(directoryPath, entry.name)))
      .map((entry) => entry.name);

    const exportableDirectories = this.scope
      .getExportableDirectories(directoryPath, childDirectories)
      .sort((a, b) => a.localeCompare(b));

    const exportableFiles = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((fileName) =>
        this.scope.isModuleRoot(directoryPath)
          ? false
          : isExportableTypeScriptFile(fileName),
      )
      .sort((a, b) => a.localeCompare(b));

    const lines = [
      ...exportableDirectories.map(
        (directoryName) =>
          `export * from '${exportSpecifierForDirectory(directoryName)}';`,
      ),
      ...exportableFiles.map(
        (fileName) => `export * from '${exportSpecifierForFile(fileName)}';`,
      ),
    ];

    const nextContents = lines.length > 0 ? `${lines.join('\n')}\n` : '';
    const barrelPath = path.join(directoryPath, 'index.ts');
    const currentContents = await safeReadFile(barrelPath);

    if (currentContents === nextContents) {
      return false;
    }

    await fs.writeFile(barrelPath, nextContents, 'utf8');
    return true;
  }

  async updateDirectories(directoryPaths: Iterable<string>): Promise<number> {
    let updated = 0;
    const sortedDirectories = [...new Set(directoryPaths)].sort(
      (a, b) => b.length - a.length,
    );

    for (const directoryPath of sortedDirectories) {
      if (await this.updateDirectory(directoryPath)) {
        updated += 1;
      }
    }

    return updated;
  }
}

async function safeReadFile(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

async function safeStat(filePath: string) {
  try {
    return await fs.stat(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}
