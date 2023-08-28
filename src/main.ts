import { loadLocal } from '@d2api/manifest-node';
import { spawnSync } from 'child_process';
import { readdirSync } from 'fs';
import fse from 'fs-extra';
import { basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import { registerWriteHook } from './helpers.js';

const { copyFileSync } = fse;

loadLocal();

const scriptRegex = /generate-([a-zA-Z\\-]+)\.js/;

const excludedScripts = ['pretty-manifest'];

const prioritizedScripts = [
  'enums',
  'season-info',
  'source-info',
  'watermark-info',
  'font-glyph-enums',
];
const toCompileOutputs = ['generated-enums.ts', 'd2-font-glyphs.ts', 'd2-season-info.ts'];

const copyDataToOutput = ['legacy-triumphs.json', 'stat-effects.ts'];

const scriptsDir = dirname(fileURLToPath(import.meta.url));

console.log(scriptsDir);

let files = readdirSync(scriptsDir).filter((file) => {
  const match = basename(file).match(scriptRegex);
  return match && !excludedScripts.includes(match[1]);
});

if (process.argv.length > 2) {
  const argScriptPatterns = process.argv.slice(2);
  files = files.filter((script) => argScriptPatterns.some((pattern) => script.includes(pattern)));
}

// Sort files so that prioritized files are in the order they appear in `prioritizedScripts`,
// and everything else comes alphabetically after
files.sort((fileA, fileB) => {
  const matchA = fileA.match(scriptRegex);
  const matchB = fileB.match(scriptRegex);
  if (matchA && !matchB) {
    return -1;
  } else if (!matchA && matchB) {
    return 1;
  } else if (matchA && matchB) {
    let indexA = prioritizedScripts.indexOf(matchA[1]);
    let indexB = prioritizedScripts.indexOf(matchB[1]);
    if (indexA === -1) {
      indexA = Number.MAX_SAFE_INTEGER;
    }
    if (indexB === -1) {
      indexB = Number.MAX_SAFE_INTEGER;
    }
    if (indexA === indexB) {
      return fileA.localeCompare(fileB, 'en-US');
    }
    return indexA - indexB;
  }
  return fileA.localeCompare(fileB, 'en-US');
});

registerWriteHook((fileName) => {
  if (toCompileOutputs.includes(basename(fileName))) {
    spawnSync('yarn', ['tsc']);
  }
});

for (const toCopyFile of copyDataToOutput) {
  copyFileSync(`./data/${toCopyFile}`, `./output/${toCopyFile}`);
}

const runtime: { [scriptName: string]: number } = {};

for (const file of files) {
  const t = process.hrtime();
  // Our files are individual scripts, so importing already
  // has the side effect of running their contents.
  await import('./' + file);
  const [s, ns] = process.hrtime(t);
  runtime[file] = s + ns / 1e9;
}

const runtimes = Object.entries(runtime).sort((a, b) => b[1] - a[1]);
console.table(runtimes);
