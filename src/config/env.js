const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: process.env.ENV_FILE || path.resolve(process.cwd(), '.env') });

const required = ['PORT'];
required.forEach((k) => {
  if (!process.env[k]) throw new Error(`Missing required env var: ${k}`); // why: fail-fast
});

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT)
};