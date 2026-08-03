import * as fs from 'node:fs';
import * as path from 'node:path';
import { DDD_LAYER_NAMES, SRC_ROOT } from './constants';
import { isIgnoredPath, isInside } from './path-utils';

export interface DddModuleScope {
  moduleRoot: string;
  layerRoots: string[];
}

export class DddScope {
  private constructor(private readonly modules: DddModuleScope[]) {}

  static discover(): DddScope {
    if (!fs.existsSync(SRC_ROOT)) {
      return new DddScope([]);
    }

    const modules = fs
      .readdirSync(SRC_ROOT, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(SRC_ROOT, entry.name))
      .map((moduleRoot) => ({
        moduleRoot,
        layerRoots: discoverLayerRoots(moduleRoot),
      }))
      .filter((scope) => scope.layerRoots.length > 0);

    return new DddScope(modules);
  }

  getWatchRoots(): string[] {
    return [SRC_ROOT];
  }

  getAllKnownDddDirectories(): string[] {
    const directories = new Set<string>();

    for (const scope of this.modules) {
      directories.add(scope.moduleRoot);

      for (const layerRoot of scope.layerRoots) {
        for (const directory of walkDirectories(layerRoot)) {
          directories.add(directory);
        }
      }
    }

    return [...directories].sort();
  }

  findOwningModule(filePath: string): DddModuleScope | null {
    const relative = path.relative(SRC_ROOT, filePath);
    if (relative.startsWith('..') || path.isAbsolute(relative) || relative === '') {
      return null;
    }
    const segments = relative.split(path.sep);
    const moduleName = segments[0];
    if (!moduleName) return null;
    const moduleRoot = path.join(SRC_ROOT, moduleName);

    try {
      const stat = fs.statSync(moduleRoot);
      if (!stat.isDirectory()) return null;
    } catch {
      return null;
    }

    return {
      moduleRoot,
      layerRoots: discoverLayerRoots(moduleRoot),
    };
  }

  isDddDirectory(directoryPath: string): boolean {
    const scope = this.findOwningModule(directoryPath);
    if (!scope) return false;

    if (directoryPath === scope.moduleRoot) return true;

    return scope.layerRoots.some((layerRoot) =>
      isInside(layerRoot, directoryPath),
    );
  }

  isDddPath(filePath: string): boolean {
    const scope = this.findOwningModule(filePath);
    if (!scope) return false;

    if (path.dirname(filePath) === scope.moduleRoot) {
      return true;
    }

    return scope.layerRoots.some((layerRoot) => isInside(layerRoot, filePath));
  }

  getDddAncestors(directoryPath: string): string[] {
    const scope = this.findOwningModule(directoryPath);
    if (!scope) return [];

    const ancestors: string[] = [];
    let current = directoryPath;

    while (isInside(scope.moduleRoot, current)) {
      if (this.isDddDirectory(current)) {
        ancestors.push(current);
      }

      if (current === scope.moduleRoot) break;
      current = path.dirname(current);
    }

    return ancestors;
  }

  getExportableDirectories(
    parentDirectory: string,
    childDirectories: string[],
  ): string[] {
    const scope = this.findOwningModule(parentDirectory);
    if (!scope) return [];

    if (parentDirectory === scope.moduleRoot) {
      return childDirectories.filter((directory) =>
        scope.layerRoots.includes(path.join(parentDirectory, directory)),
      );
    }

    return childDirectories;
  }

  isModuleRoot(directoryPath: string): boolean {
    return this.modules.some((scope) => scope.moduleRoot === directoryPath);
  }
}

function discoverLayerRoots(moduleRoot: string): string[] {
  return fs
    .readdirSync(moduleRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => DDD_LAYER_NAMES.has(entry.name))
    .map((entry) => path.join(moduleRoot, entry.name));
}

function walkDirectories(root: string): string[] {
  const directories: string[] = [];
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || isIgnoredPath(current) || !fs.existsSync(current)) continue;

    directories.push(current);

    const children = fs.readdirSync(current, { withFileTypes: true });
    for (const child of children) {
      if (child.isDirectory()) {
        stack.push(path.join(current, child.name));
      }
    }
  }

  return directories;
}
