import * as path from 'node:path';
import { IGNORED_DIRECTORY_NAMES, IGNORED_FILE_PATTERNS, SRC_ROOT } from './constants';

export function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

export function isInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function isIgnoredPath(filePath: string): boolean {
  return filePath
    .split(path.sep)
    .some((part) => IGNORED_DIRECTORY_NAMES.has(part));
}

export function isTypeScriptSourceFile(fileName: string): boolean {
  return fileName.endsWith('.ts') && !fileName.endsWith('.d.ts');
}

export function isExportableTypeScriptFile(fileName: string): boolean {
  if (!isTypeScriptSourceFile(fileName)) return false;
  if (fileName === 'index.ts') return false;
  return !IGNORED_FILE_PATTERNS.some((pattern) => pattern.test(fileName));
}

export function exportSpecifierForFile(fileName: string): string {
  return `./${fileName.replace(/\.ts$/, '')}`;
}

export function exportSpecifierForDirectory(directoryName: string): string {
  return `./${directoryName}`;
}

export function normalizeEventPath(eventPath: string): string {
  return path.isAbsolute(eventPath) ? eventPath : path.join(process.cwd(), eventPath);
}

export function isUnderSrc(filePath: string): boolean {
  return isInside(SRC_ROOT, filePath);
}
