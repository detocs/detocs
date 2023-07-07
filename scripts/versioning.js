const proc = require('child_process');
const { version } = require('../package.json');

/**
 * @returns {string}
 */
function getVersion() {
  const currentHash = proc.execSync('git rev-parse --short HEAD')
    .toString()
    .replace(/\W/g, '');
  const versionHash = proc.execSync(`git rev-list -n 1 --abbrev-commit v${version}`)
    .toString()
    .replace(/\W/g, '');
  const changes = proc.execSync('git status --untracked-files=no --porcelain')
    .toString();
  console.log(`v${version} commit: ${versionHash}`);
  console.log(`current commit: ${currentHash}`);
  console.log(`current changes:\n${changes}`);
  let fullVersion = version;
  if (currentHash !== versionHash || changes) {
    fullVersion = `${version}-${currentHash}`;
    if (changes) {
      fullVersion += '-dirty';
    }
  }
  console.log(`Version: ${fullVersion}`);
  return fullVersion;
}

module.exports = {
  getVersion,
};
