import { program } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { getCaddyProcessInfo, getCaddyConnections } from '../utils/caddy.js';
import { parseProxyConfigs } from '../utils/file.js';
import { CADDYFILE_PATH, TABLE_CONFIG } from '../config/constants.js';

program
  .command('status')
  .description('Show detailed Caddy server status')
  .action(() => {
    try {
      // Check if Caddy is running
      const processInfo = getCaddyProcessInfo();

      if (!processInfo) {
        console.log(chalk.red('Caddy is not running.'));
        return;
      }

      // Get active connections
      const connections = getCaddyConnections();

      // Create status table
      const table = new Table({
        ...TABLE_CONFIG,
        colWidths: [20, 40],
      });

      table.push(
        ['Status', chalk.green('RUNNING')],
        ['PID', processInfo.pid],
        ['Uptime', processInfo.uptime],
        ['Memory Usage', processInfo.memory],
        ['Active Connections', connections],
        ['Caddyfile', CADDYFILE_PATH]
      );

      console.log(table.toString());

      // Show proxy count
      const proxies = parseProxyConfigs();
      console.log(chalk.blue(`Managing ${proxies.length} proxies.`));
    } catch (error) {
      console.error(chalk.red(`Error while checking Caddy status: ${error.message}`));
      process.exit(1);
    }
  }); 