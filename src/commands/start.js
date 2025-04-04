import { program } from 'commander';
import chalk from 'chalk';
import { startCaddy } from '../utils/caddy.js';
import { ensureCaddyfile } from '../utils/file.js';

program
  .command('start')
  .description('Start Caddy in the background using the specified Caddyfile')
  .action(async () => {
    try {
      // Ensure Caddyfile exists with global logging config
      ensureCaddyfile();

      // Start Caddy server
      await startCaddy();
    } catch (error) {
      console.error(chalk.red(`Failed to start Caddy: ${error.message}`));
      process.exit(1);
    }
  }); 