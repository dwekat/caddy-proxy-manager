import fs from 'fs';
import chalk from 'chalk';
import { spawn } from 'child_process';
import { getDomainLogPath } from './file.js';
import { LOGS_PATH } from '../config/constants.js';

/**
 * Follows log output in real-time
 * @param {string} logPath - Path to the log file
 * @param {string} [domain] - Optional domain to filter logs
 * @returns {Promise<void>}
 */
export function followLogs(logPath, domain = null) {
  return new Promise((resolve, reject) => {
    try {
      // Prepare commands
      const tailArgs = ['-f', logPath];
      const grepArgs = domain ? ['-i', domain] : [];

      console.log(
        chalk.yellow(
          `Showing logs${domain ? ` for ${domain}` : ''} from ${logPath}...`
        )
      );

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
      if (grep) {
        grep.stderr.on('data', (data) =>
          console.error(chalk.red(`Grep error: ${data}`))
        );
      }

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
          reject(new Error(`Log process exited with code ${code}`));
        } else {
          resolve();
        }
        cleanup();
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Shows last N lines of logs
 * @param {string} logPath - Path to the log file
 * @param {number} lines - Number of lines to show
 * @param {string} [domain] - Optional domain to filter logs
 * @returns {Promise<void>}
 */
export function showLastLines(logPath, lines, domain = null) {
  return new Promise((resolve, reject) => {
    try {
      const tailArgs = ['-n', lines.toString(), logPath];
      const grepArgs = domain ? ['-i', domain] : [];

      console.log(
        chalk.yellow(
          `Showing last ${lines} lines${
            domain ? ` for ${domain}` : ''
          } from ${logPath}...`
        )
      );

      const tail = spawn('tail', tailArgs);
      let lastProcess = tail;

      if (grepArgs.length > 0) {
        const grep = spawn('grep', grepArgs);
        tail.stdout.pipe(grep.stdin);
        lastProcess = grep;
      }

      lastProcess.stdout.pipe(process.stdout);

      lastProcess.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Process exited with code ${code}`));
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Enables domain-specific logging in Caddyfile
 * @param {string} domain - The domain to enable logging for
 * @param {string} caddyfileContent - Current Caddyfile content
 * @returns {string} Updated Caddyfile content
 */
export function enableDomainLogging(domain, caddyfileContent) {
  const domainLogPath = getDomainLogPath(domain);
  const domainRegex = new RegExp(`(${domain}\\s*\\{)`, 's');
  
  if (!caddyfileContent.includes(`log {`)) {
    return caddyfileContent.replace(
      domainRegex,
      `$1\n  log {\n    output file ${domainLogPath}\n    format console\n  }`
    );
  }
  
  return caddyfileContent;
}

/**
 * Disables domain-specific logging in Caddyfile
 * @param {string} domain - The domain to disable logging for
 * @param {string} caddyfileContent - Current Caddyfile content
 * @returns {string} Updated Caddyfile content
 */
export function disableDomainLogging(domain, caddyfileContent) {
  return caddyfileContent.replace(/\s*log\s*\{[^}]*\}/s, '');
}

/**
 * Gets appropriate log file path for a domain
 * @param {string} domain - The domain name
 * @returns {string} Log file path
 */
export function getLogPath(domain = null) {
  if (domain) {
    const domainLogPath = getDomainLogPath(domain);
    if (fs.existsSync(domainLogPath)) {
      return domainLogPath;
    }
  }

  // Default log paths to check
  const possibleLogPaths = [
    `${LOGS_PATH}/access.log`,
    '/var/log/caddy/access.log',
    `${process.env.HOME}/.local/share/caddy/logs/access.log`,
  ];

  for (const path of possibleLogPaths) {
    if (fs.existsSync(path)) {
      return path;
    }
  }

  return `${LOGS_PATH}/access.log`;
} 