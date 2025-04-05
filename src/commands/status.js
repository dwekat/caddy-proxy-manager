import { program } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { getCaddyProcessInfo, getCaddyConnections } from '../utils/caddy.js';
import { parseProxyConfigs } from '../utils/file.js';
import { CADDY_CONFIG_PATH, TABLE_CONFIG } from '../config/constants.js';
import shell from 'shelljs';

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

      // Check mkcert status
      const mkcertInstalled = shell.which('mkcert') ? true : false;
      const mkcertStatus = mkcertInstalled ? 
        chalk.green('Installed') : 
        chalk.red('Not Installed (Custom certificates unavailable)');

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
        ['Config File', CADDY_CONFIG_PATH],
        ['mkcert', mkcertStatus]
      );

      console.log(table.toString());

      // Show proxy count
      const proxies = parseProxyConfigs();
      console.log(chalk.blue(`Managing ${proxies.length} proxies.`));
      
      // Show mkcert installation instructions if not installed
      if (!mkcertInstalled) {
        console.log(chalk.yellow('\nmkcert is not installed. Install it to use custom certificates:'));
        
        // Provide OS-specific installation instructions
        const platform = process.platform;
        if (platform === 'darwin') {
          console.log(chalk.cyan('macOS:'));
          console.log(chalk.cyan('  brew install mkcert'));
          console.log(chalk.cyan('  mkcert -install'));
        } else if (platform === 'linux') {
          console.log(chalk.cyan('Linux:'));
          console.log(chalk.cyan('  For Ubuntu/Debian: sudo apt install mkcert'));
          console.log(chalk.cyan('  For Fedora: sudo dnf install mkcert'));
          console.log(chalk.cyan('  Then run: mkcert -install'));
        } else if (platform === 'win32') {
          console.log(chalk.cyan('Windows:'));
          console.log(chalk.cyan('  Using Chocolatey: choco install mkcert'));
          console.log(chalk.cyan('  Using Scoop: scoop install mkcert'));
          console.log(chalk.cyan('  Then run: mkcert -install'));
        } else {
          console.log(chalk.cyan('  Visit: https://github.com/FiloSottile/mkcert'));
        }
      }
    } catch (error) {
      console.error(chalk.red(`Error while checking Caddy status: ${error.message}`));
      process.exit(1);
    }
  }); 