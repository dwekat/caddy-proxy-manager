import { program } from 'commander';
import chalk from 'chalk';
import { spawn } from 'child_process';
import { CADDY_CONFIG_PATH } from '../config/constants.js';

program
  .command('start')
  .description('Start Caddy in the background using the specified config')
  .action(() => {
    try {
      // Start Caddy in the background
      const caddyProcess = spawn(
        'caddy',
        ['run', '--config', CADDY_CONFIG_PATH],
        {
          detached: true,
          stdio: 'ignore',
        }
      );

      caddyProcess.unref();
      console.log(chalk.green('Caddy started successfully in the background.'));
    } catch (error) {
      console.error(chalk.red(`Failed to start Caddy: ${error.message}`));
      process.exit(1);
    }
  });
