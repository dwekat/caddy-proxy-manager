import { program } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { parseProxyConfigs } from '../utils/file.js';
import { isPortInUse, getProcessForPort } from '../utils/caddy.js';
import { TABLE_CONFIG } from '../config/constants.js';

program
  .command('ports')
  .description('Check status of ports used by proxies')
  .action(() => {
    try {
      const proxies = parseProxyConfigs();

      if (proxies.length === 0) {
        console.log(chalk.yellow('No proxies found.'));
        return;
      }

      const table = new Table({
        ...TABLE_CONFIG,
        head: [
          chalk.blue('Domain'),
          chalk.blue('Port'),
          chalk.blue('Status'),
          chalk.blue('Process'),
        ],
        colWidths: [30, 10, 15, 30],
      });

      proxies.forEach((proxy) => {
        const port = proxy.port;
        const isUsed = isPortInUse(port);
        const process = getProcessForPort(port);

        table.push([
          proxy.domain,
          port,
          isUsed ? chalk.green('IN USE') : chalk.red('NOT IN USE'),
          process ? `${process.name} (PID: ${process.pid})` : 'N/A',
        ]);
      });

      console.log(table.toString());
    } catch (error) {
      console.error(chalk.red(`Error checking ports: ${error.message}`));
      process.exit(1);
    }
  }); 