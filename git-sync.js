const simpleGit = require('simple-git');
const config = require('./config');

const git = simpleGit(config.vaultPath);

async function sync() {
  try {
    await git.add('-A');

    const status = await git.status();
    if (status.isClean()) {
      console.log('[git-sync] 변경사항 없음, 커밋 건너뜀');
      return;
    }

    const message = config.commitMessage();
    await git.commit(message);
    console.log(`[git-sync] 커밋 완료: ${message}`);

    await git.push('origin');
    console.log('[git-sync] 푸시 완료');
  } catch (err) {
    console.error('[git-sync] 오류:', err.message);
  }
}

module.exports = { sync };
