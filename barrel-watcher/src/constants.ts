import * as path from 'node:path';

export const REPO_ROOT = process.cwd();
export const SRC_ROOT = path.join(REPO_ROOT, 'src');

export const DDD_LAYER_NAMES = new Set([
  'domain',
  'application',
  'infrastructure',
  'presentation',
]);

export const IGNORED_DIRECTORY_NAMES = new Set([
  'node_modules',
  'dist',
  'coverage',
  '.git',
]);

export const IGNORED_FILE_PATTERNS = [
  /\.spec\.ts$/,
  /\.test\.ts$/,
  /\.e2e\.ts$/,
  /\.module\.ts$/,
  /\.controller\.ts$/,
  /\.service\.ts$/,
];
