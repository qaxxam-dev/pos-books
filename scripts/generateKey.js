const crypto = require('crypto');
const machineId = require('node-machine-id');

const SECRET_SALT = 'e84825f600edcf5117bbb960ca276b87';

async function generateKey(clientId) {
  const hash = crypto.createHash('sha256');
  hash.update(clientId + SECRET_SALT);
  return hash.digest('hex').substring(0, 16).toUpperCase();
}

async function run() {
  const argId = process.argv[2];
  const targetId = argId || await machineId.machineId();
  
  console.log('--- License Generator ---');
  console.log('Target Machine ID:', targetId);
  console.log('Generated License Key:', await generateKey(targetId));
  
  if (!argId) {
    console.log('\nTo generate for a client, run: node scripts/generateKey.js "CLIENT_MACHINE_ID"');
  }
}

run();
