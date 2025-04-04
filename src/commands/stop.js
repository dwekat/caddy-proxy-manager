import { program } from 'commander';
import chalk from 'chalk';
import { stopCaddy } from '../utils/caddy.js';

program
  .command('stop')
  .description('Stop the Caddy server running in the background')
  .action(async () => {
    try {
      await stopCaddy();
    } catch (error) {
      console.error(chalk.red(`Failed to stop Caddy: ${error.message}`));
      process.exit(1);
    }
  }); 