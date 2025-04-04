import { program } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { DEFAULT_LOG_FILE } from '../config/constants.js';
import { getDomainLogPath, ensureDomainDirectories } from '../utils/file.js';
import { enableDomainLogging, disableDomainLogging } from '../utils/config.js';
import { reloadCaddy } from '../utils/caddy.js';

// View logs command
program
  .command('logs [domain]')
  .description('View Caddy logs, optionally filtered by domain')
  .option('-f, --follow', 'Follow log output')
  .option('-n, --lines <lines>', 'Number of lines to show', '100')
  .option('--log-path <path>', 'Custom log file path')
  .action((domain, options) => {
    try {
      // If domain is specified, use domain-specific log file
      let logPath = options.logPath;

      if (domain && !logPath) {
        const domainLogPath = getDomainLogPath(domain);
        if (fs.existsSync(domainLogPath)) {
          logPath = domainLogPath;
        }
      }

      // If no log path determined yet, use default paths
      if (!logPath) {
        // Default log paths to check
        const possibleLogPaths = [
          DEFAULT_LOG_FILE,
          '/var/log/caddy/access.log',
          path.join(process.env.HOME, '.local/share/caddy/logs/access.log'),
        ];

        // If no custom path, try to find an existing log file
        for (const potentialPath of possibleLogPaths) {
          if (fs.existsSync(potentialPath)) {
            logPath = potentialPath;
            break;
          }
        }
      }

      // If domain specified but no domain log file found
      if (domain && !fs.existsSync(getDomainLogPath(domain)) && !options.logPath) {
        console.log(chalk.yellow(`No specific log file found for domain: ${domain}`));
        console.log(chalk.blue('Creating domain-specific logging structure...'));

        // Create domain directory structure
        ensureDomainDirectories(domain);

        // Enable domain-specific logging
        if (enableDomainLogging(domain)) {
          console.log(chalk.green(`Enabled logging for domain: ${domain}`));
          console.log(chalk.green(`Domain logs will be written to: ${getDomainLogPath(domain)}`));
          reloadCaddy();
        }

        console.log(chalk.green(`Falling back to global log file: ${logPath || DEFAULT_LOG_FILE}`));
      }

      // If no log file found
      if (!logPath || !fs.existsSync(logPath)) {
        console.log(chalk.red('No Caddy log file found.'));
        console.log(chalk.yellow('Caddy logs have been configured but the log file does not exist yet.'));
        console.log(chalk.blue("This usually means Caddy needs to be restarted or hasn't received any requests."));
        console.log(chalk.yellow('Try restarting Caddy:'));
        console.log(chalk.green('cpm stop && cpm start'));
        return;
      }

      // Prepare commands
      const tailArgs = options.follow
        ? ['-f', logPath]
        : ['-n', options.lines, logPath];
      const grepArgs =
        domain && logPath !== getDomainLogPath(domain) ? ['-i', domain] : [];

      console.log(chalk.yellow(`Showing logs${domain ? ` for ${domain}` : ''} from ${logPath}...`));

      // Start the tail process
      const tail = spawn('tail', tailArgs);
      let lastProcess = tail;

      // Start the grep process if needed
      let grep;
      if (grepArgs.length > 0) {
        grep = spawn('grep', grepArgs);
        lastProcess.stdout.pipe(grep.stdin);
        lastProcess = grep;
      }

      // Pipe the final output to the main process stdout
      lastProcess.stdout.pipe(process.stdout);

      // Handle errors
      tail.stderr.on('data', (data) =>
        console.error(chalk.red(`Tail error: ${data}`))
      );
      if (grep)
        grep.stderr.on('data', (data) =>
          console.error(chalk.red(`Grep error: ${data}`))
        );

      // Handle process exits
      const cleanup = () => {
        if (!tail.killed) tail.kill();
        if (grep && !grep.killed) grep.kill();
      };
      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);

      lastProcess.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          console.error(chalk.red(`Log process exited with code ${code}`));
        }
        cleanup();
      });
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
      // Create domain directory structure
      ensureDomainDirectories(domain);

      // Enable domain-specific logging
      if (enableDomainLogging(domain)) {
        console.log(chalk.green(`Enabled logging for domain: ${domain}`));
        console.log(chalk.green(`Domain logs will be written to: ${getDomainLogPath(domain)}`));
        await reloadCaddy();
      } else {
        console.log(chalk.yellow(`Domain "${domain}" not found or logging already enabled.`));
      }
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
      if (disableDomainLogging(domain)) {
        console.log(chalk.yellow(`Disabling logs for domain: ${domain}`));
        await reloadCaddy();
      } else {
        console.log(chalk.yellow(`Domain "${domain}" not found or logging already disabled.`));
      }
    } catch (error) {
      console.error(chalk.red(`Error disabling logs: ${error.message}`));
      process.exit(1);
    }
  }); 