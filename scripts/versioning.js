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
  console.log(currentHash, versionHash);
  let fullVersion = version;
  if (currentHash !== versionHash) {
    fullVersion = `${version}-${currentHash}`;
  }
  console.log(`Version: ${fullVersion}`);
  return fullVersion;
}

module.exports = {
  getVersion,
};
