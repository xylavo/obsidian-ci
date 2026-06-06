const path = require('path');

if (!process.env.OBSIDIAN_VAULT_PATH) {
  throw new Error('OBSIDIAN_VAULT_PATH 환경변수가 설정되지 않았습니다. .env 파일을 확인하세요.');
}

module.exports = {
  vaultPath: path.resolve(process.env.OBSIDIAN_VAULT_PATH),
  debounceMs: 30_000,
  pullIntervalMs: 5 * 60 * 1000,
  commitMessage: () => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    return `auto: ${date} ${time}`;
  },
  ignoredPatterns: [
    '.obsidian/workspace.json',
  ],
};
