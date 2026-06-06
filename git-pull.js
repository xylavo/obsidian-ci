const simpleGit = require('simple-git');
const config = require('./config');

const git = simpleGit(config.vaultPath);

async function pull() {
  try {
    await git.fetch('origin');

    const status = await git.status();

    if (!status.isClean()) {
      console.log('[git-pull] 미커밋 변경사항 있음, pull 건너뜀 (CI가 처리 예정)');
      return;
    }

    if (status.behind === 0) {
      console.log('[git-pull] 원격 변경사항 없음');
      return;
    }

    console.log(`[git-pull] ${status.behind}개 커밋 뒤처짐, pull --rebase 시작`);

    try {
      await git.pull('origin', status.current, { '--rebase': 'true' });
      console.log('[git-pull] pull --rebase 완료');
    } catch (rebaseErr) {
      console.warn('[git-pull] 충돌 발생, 원격 버전으로 강제 초기화:', rebaseErr.message);
      try { await git.rebase(['--abort']); } catch (_) {}
      await git.reset(['--hard', `origin/${status.current}`]);
      console.log('[git-pull] 강제 초기화 완료');
    }
  } catch (err) {
    console.error('[git-pull] 오류:', err.message);
  }
}

module.exports = { pull };
