#!/usr/bin/env node

import { program } from 'commander';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// Import commands
import './commands/add.js';
import './commands/backup.js';
import './commands/bulk.js';
import './commands/completion.js';
import './commands/logs.js';
import './commands/ports.js';
import './commands/remove.js';
import './commands/restore.js';
import './commands/start.js';
import './commands/status.js';
import './commands/stop.js';

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