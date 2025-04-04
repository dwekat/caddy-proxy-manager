import { program } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { getProxies } from '../utils/config.js';
import { TABLE_CONFIG } from '../config/constants.js';

program
  .command('ls')
  .description('List all proxies')
  .action(() => {
    try {
      const proxies = getProxies();

      if (!proxies || proxies.length === 0) {
        console.log(chalk.yellow('No proxies found.'));
        return;
      }

      const table = new Table({
        ...TABLE_CONFIG,
        head: [
          chalk.blue('DOMAIN'),
          chalk.blue('PORT'),
          chalk.blue('CUSTOM_SSL')
        ],
        colWidths: [35, 8, 12]
      });

      proxies.forEach(proxy => {
        table.push([
          proxy.domain,
          proxy.port,
          proxy.ssl ? 'Yes' : 'No'
        ]);
      });

      console.log(table.toString());
    } catch (error) {
      console.error(chalk.red(`Failed to list proxies: ${error.message}`));
      process.exit(1);
    }
  }); 