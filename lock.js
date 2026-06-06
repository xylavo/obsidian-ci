let locked = false;

async function withLock(fn) {
  if (locked) return;
  locked = true;
  try {
    await fn();
  } finally {
    locked = false;
  }
}

module.exports = { withLock };
