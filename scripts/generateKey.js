const crypto = require('crypto');
const machineId = require('node-machine-id');

const SECRET_SALT = 'e84825f600edcf5117bbb960ca276b87';

async function generateKey(clientId) {
  const hash = crypto.createHash('sha256');
  hash.update(clientId + SECRET_SALT);
  return hash.digest('hex').substring(0, 16).toUpperCase();
}

async function run() {
  const myId = await machineId.machineId();
  console.log('--- License Generator ---');
  console.log('Your Machine ID:', myId);
  console.log('License Key for this machine:', await generateKey(myId));
  console.log('\nRun this on your computer, paste the client Machine ID in code to generate their key.');
}

run();
