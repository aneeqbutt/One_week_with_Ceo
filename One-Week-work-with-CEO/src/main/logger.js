// ─── Terminal Logger ──────────────────────────────────────────────────────────
// Provides timestamped, color-coded console output for the Electron main process.
// Import the named exports you need: log, success, warn, error, ipc, db

// Force UTF-8 output on Windows so emojis render correctly
if (process.platform === 'win32') {
  try {
    const { execSync } = await import('child_process');
    execSync('chcp 65001', { stdio: 'ignore' });
  } catch {}
  process.stdout.setEncoding?.('utf8');
  process.stderr.setEncoding?.('utf8');
}

const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  gray:   '\x1b[90m',
  white:  '\x1b[37m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  magenta:'\x1b[35m',
  blue:   '\x1b[34m',
};

function ts() {
  return new Date().toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
}

function prefix(label, color) {
  return `${c.gray}[${ts()}]${c.reset} ${color}${label}${c.reset}`;
}

// General info
export function log(msg) {
  console.log(`${prefix('ℹ ', c.white)} ${msg}`);
}

// Success
export function success(msg) {
  console.log(`${prefix('✅', c.green)} ${msg}`);
}

// Warning
export function warn(msg) {
  console.warn(`${prefix('⚠️ ', c.yellow)} ${msg}`);
}

// Error — pass the Error object as second arg for the stack/message
export function error(msg, err) {
  console.error(`${prefix('❌', c.red)} ${c.bold}${msg}${c.reset}`);
  if (err) {
    console.error(`${c.gray}   message : ${c.red}${err.message}${c.reset}`);
    if (err.code)  console.error(`${c.gray}   pg code : ${c.yellow}${err.code}${c.reset}`);
    if (err.stack) console.error(`${c.gray}   stack   :\n${err.stack.split('\n').slice(1, 4).join('\n')}${c.reset}`);
  }
}

// IPC channel activity  (direction: '←' = incoming from renderer, '→' = returning)
export function ipc(channel, direction = '←', detail = '') {
  const dir = direction === '←' ? `${c.cyan}←${c.reset}` : `${c.magenta}→${c.reset}`;
  const det = detail ? ` ${c.gray}(${detail})${c.reset}` : '';
  console.log(`${prefix('IPC', c.cyan)} ${dir} ${c.bold}${channel}${c.reset}${det}`);
}

// Database operation
export function db(operation, detail = '') {
  const det = detail ? ` ${c.gray}${detail}${c.reset}` : '';
  console.log(`${prefix('DB ', c.blue)} ${operation}${det}`);
}

// Section divider — use at startup or major state changes
export function section(title) {
  const line = '─'.repeat(50);
  console.log(`\n${c.gray}${line}${c.reset}`);
  console.log(`${c.bold}${c.white}  ${title}${c.reset}`);
  console.log(`${c.gray}${line}${c.reset}\n`);
}
