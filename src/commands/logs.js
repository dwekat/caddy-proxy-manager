import { program } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import { getLogPath } from '../utils/logger.js';
import { followLogs, showLastLines } from '../utils/logger.js';
import { enableDomainLogging, disableDomainLogging } from '../utils/logger.js';
import { reloadCaddy } from '../utils/caddy.js';
import { CADDYFILE_PATH } from '../config/constants.js';

// View logs command
program
  .command('logs [domain]')
  .description('View Caddy logs, optionally filtered by domain')
  .option('-f, --follow', 'Follow log output')
  .option('-n, --lines <lines>', 'Number of lines to show', '100')
  .option('--log-path <path>', 'Custom log file path')
  .action(async (domain, options) => {
    try {
      const logPath = options.logPath || getLogPath(domain);

      if (!fs.existsSync(logPath)) {
        console.log(chalk.red('No Caddy log file found.'));
        console.log(chalk.yellow('Caddy logs have been configured but the log file does not exist yet.'));
        console.log(chalk.blue("This usually means Caddy needs to be restarted or hasn't received any requests."));
        console.log(chalk.yellow('Try restarting Caddy:'));
        console.log(chalk.green('cpm stop && cpm start'));
        return;
      }

      if (options.follow) {
        await followLogs(logPath, domain);
      } else {
        await showLastLines(logPath, parseInt(options.lines), domain);
      }
    } catch (error) {
      console.error(chalk.red(`Error viewing logs: ${error.message}`));
      process.exit(1);
    }
  });

// Enable domain-specific logs
program
  .command('logs:enable <domain>')
  .description('Enable domain-specific logs')
  .action(async (domain) => {
    try {
      const caddyfileContent = fs.readFileSync(CADDYFILE_PATH, 'utf-8');
      const domainRegex = new RegExp(`(${domain}\\s*\\{[^}]*\\})`, 's');
      const match = caddyfileContent.match(domainRegex);

      if (!match) {
        throw new Error(`Domain "${domain}" not found in Caddyfile.`);
      }

      const updatedContent = enableDomainLogging(domain, caddyfileContent);
      fs.writeFileSync(CADDYFILE_PATH, updatedContent);
      console.log(chalk.green(`Enabling logs for domain: ${domain}`));

      await reloadCaddy();
    } catch (error) {
      console.error(chalk.red(`Error enabling logs: ${error.message}`));
      process.exit(1);
    }
  });

// Disable domain-specific logs
program
  .command('logs:disable <domain>')
  .description('Disable domain-specific logs')
  .action(async (domain) => {
    try {
      const caddyfileContent = fs.readFileSync(CADDYFILE_PATH, 'utf-8');
      const domainRegex = new RegExp(`(${domain}\\s*\\{[^}]*\\})`, 's');
      const match = caddyfileContent.match(domainRegex);

      if (!match) {
        throw new Error(`Domain "${domain}" not found in Caddyfile.`);
      }

      const updatedContent = disableDomainLogging(domain, caddyfileContent);
      fs.writeFileSync(CADDYFILE_PATH, updatedContent);
      console.log(chalk.yellow(`Disabling logs for domain: ${domain}`));

      await reloadCaddy();
    } catch (error) {
      console.error(chalk.red(`Error disabling logs: ${error.message}`));
      process.exit(1);
    }
  }); 