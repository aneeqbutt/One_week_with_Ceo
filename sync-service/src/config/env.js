import 'dotenv/config';

function required(key) {
  const val = process.env[key];
  if (val === undefined || val === '') throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key, fallback) {
  return process.env[key] ?? fallback;
}

export const env = {
  port: parseInt(optional('PORT', '4000'), 10),

  db1: {
    host:     optional('DB1_HOST', 'localhost'),
    port:     parseInt(optional('DB1_PORT', '5432'), 10),
    database: optional('DB1_DATABASE', 'upwork_jobs'),
    user:     optional('DB1_USER', 'postgres'),
    password: required('DB1_PASSWORD'),
  },

  sync: {
    intervalMs:  parseInt(optional('SYNC_INTERVAL_MS', '15000'), 10),
    batchSize:   parseInt(optional('SYNC_BATCH_SIZE', '50'), 10),
    maxAttempts: parseInt(optional('SYNC_MAX_ATTEMPTS', '5'), 10),
  },

  log: {
    level: optional('LOG_LEVEL', 'info'),
    dir:   optional('LOG_DIR', 'src/logs'),
  },
};
