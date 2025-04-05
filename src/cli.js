#!/usr/bin/env node

import { program } from 'commander';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { ensureConfig } from './utils/config.js';
import { checkMkcert } from './utils/ssl.js';

// Import commands
import './commands/add.js';
import './commands/backup.js';
import './commands/bulk.js';
import './commands/cert.js';
import './commands/completion.js';
import './commands/list.js';
import './commands/logs.js';
import './commands/migrate.js';
import './commands/ports.js';
import './commands/remove.js';
import './commands/restore.js';
import './commands/start.js';
import './commands/status.js';
import './commands/stop.js';

// Ensure config file exists with default configuration
ensureConfig();

// Check if mkcert is installed
try {
  checkMkcert();
} catch (error) {
  console.warn(chalk.yellow(`Warning: ${error.message}`));
  console.warn(chalk.yellow('Custom certificates will not be available without mkcert.'));
  
  // Provide OS-specific installation instructions
  const platform = process.platform;
  if (platform === 'darwin') {
    console.warn(chalk.cyan('To install mkcert on macOS:'));
    console.warn(chalk.cyan('  brew install mkcert'));
    console.warn(chalk.cyan('  mkcert -install'));
  } else if (platform === 'linux') {
    console.warn(chalk.cyan('To install mkcert on Linux:'));
    console.warn(chalk.cyan('  For Ubuntu/Debian: sudo apt install mkcert'));
    console.warn(chalk.cyan('  For Fedora: sudo dnf install mkcert'));
    console.warn(chalk.cyan('  For other distributions, visit: https://github.com/FiloSottile/mkcert'));
    console.warn(chalk.cyan('  Then run: mkcert -install'));
  } else if (platform === 'win32') {
    console.warn(chalk.cyan('To install mkcert on Windows:'));
    console.warn(chalk.cyan('  Using Chocolatey: choco install mkcert'));
    console.warn(chalk.cyan('  Using Scoop: scoop install mkcert'));
    console.warn(chalk.cyan('  Then run: mkcert -install'));
  } else {
    console.warn(chalk.cyan('To install mkcert, visit: https://github.com/FiloSottile/mkcert'));
  }
}

// Get package version
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8')
);

// Setup program
program
  .name('cpm')
  .description('Caddy Proxy Manager - A CLI tool to manage local reverse proxies')
  .version(packageJson.version);

// Parse arguments
program.parse(process.argv); 