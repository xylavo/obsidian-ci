const chokidar = require('chokidar');
const config = require('./config');
const { sync } = require('./git-sync');
const { pull } = require('./git-pull');
const { withLock } = require('./lock');

let timer = null;

function scheduleSync() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => withLock(sync), config.debounceMs);
}

withLock(pull);
setInterval(() => withLock(pull), config.pullIntervalMs);

const watcher = chokidar.watch(config.vaultPath, {
  ignored: [
    /(^|[/\\])\.git([/\\]|$)/,
    /(^|[/\\])node_modules([/\\]|$)/,
    ...config.ignoredPatterns.map((p) => new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))),
  ],
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 1000,
    pollInterval: 200,
  },
});

watcher
  .on('ready', () => {
    console.log(`[watcher] 감시 시작: ${config.vaultPath}`);
    console.log(`[watcher] 디바운스: ${config.debounceMs / 1000}초`);
  })
  .on('add', (filePath) => {
    console.log(`[watcher] 파일 추가: ${filePath}`);
    scheduleSync();
  })
  .on('change', (filePath) => {
    console.log(`[watcher] 파일 변경: ${filePath}`);
    scheduleSync();
  })
  .on('unlink', (filePath) => {
    console.log(`[watcher] 파일 삭제: ${filePath}`);
    scheduleSync();
  })
  .on('error', (err) => {
    console.error('[watcher] 오류:', err.message);
  });

process.on('SIGINT', () => {
  console.log('\n[watcher] 감시 종료');
  watcher.close();
  process.exit(0);
});
