import { program } from 'commander';
import chalk from 'chalk';
import shell from 'shelljs';

program
  .command('stop')
  .description('Stop the Caddy server running in the background')
  .action(() => {
    try {
      console.log(chalk.yellow('Stopping Caddy...'));
      const result = shell.exec('caddy stop', { silent: true });

      if (result.code === 0) {
        console.log(chalk.green('Caddy stopped successfully.'));
      } else {
        throw new Error(result.stderr);
      }
    } catch (error) {
      console.error(chalk.red(`Failed to stop Caddy: ${error.message}`));
      process.exit(1);
    }
  }); 