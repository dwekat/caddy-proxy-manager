import shell from 'shelljs';
import fs from 'fs';
import chalk from 'chalk';
import { spawn } from 'child_process';
import { CADDYFILE_PATH } from '../config/constants.js';
import { validateCertificates } from './ssl.js';

/**
 * Reloads Caddy with the specified config file
 * @returns {Promise<void>}
 */
export async function reloadCaddy() {
  try {
    console.log(chalk.yellow('Formatting Caddyfile...'));
    const formatResult = shell.exec(`caddy fmt --overwrite ${CADDYFILE_PATH}`);
    
    if (formatResult.code !== 0) {
      throw new Error(`Failed to format Caddyfile: ${formatResult.stderr}`);
    }

    const caddyfileContent = fs.readFileSync(CADDYFILE_PATH, 'utf-8');
    if (!validateCertificates(caddyfileContent)) {
      throw new Error('Caddy reload aborted due to missing certificates.');
    }

    console.log(chalk.yellow('Reloading Caddy with specified config file...'));
    const reloadResult = shell.exec(`caddy reload --config ${CADDYFILE_PATH}`, {
      silent: true,
    });

    if (reloadResult.code === 0) {
      console.log(chalk.green('Caddy reloaded successfully with the specified config.'));
    } else {
      throw new Error(`Failed to reload Caddy: ${reloadResult.stderr}`);
    }
  } catch (error) {
    console.error(chalk.red(error.message));
    throw error;
  }
}

/**
 * Starts Caddy in the background
 * @returns {Promise<void>}
 */
export function startCaddy() {
  return new Promise((resolve, reject) => {
    try {
      const caddyProcess = spawn('caddy', ['start', '--config', CADDYFILE_PATH], {
        detached: true,
        stdio: 'ignore',
      });

      caddyProcess.unref();
      console.log(chalk.green('Caddy started successfully in the background.'));
      resolve();
    } catch (error) {
      console.error(chalk.red(`Failed to start Caddy: ${error.message}`));
      reject(error);
    }
  });
}

/**
 * Stops the Caddy server
 * @returns {Promise<void>}
 */
export function stopCaddy() {
  return new Promise((resolve, reject) => {
    const result = shell.exec('caddy stop', { silent: true });

    if (result.code === 0) {
      console.log(chalk.green('Caddy stopped successfully.'));
      resolve();
    } else {
      console.error(chalk.red('Failed to stop Caddy:'), result.stderr);
      reject(new Error(result.stderr));
    }
  });
}

/**
 * Gets Caddy process information
 * @returns {Object|null} Process information or null if not running
 */
export function getCaddyProcessInfo() {
  const pidResult = shell.exec('pgrep -x caddy', { silent: true });

  if (pidResult.code !== 0) {
    return null;
  }

  const pid = pidResult.stdout.trim();
  const uptimeResult = shell.exec(`ps -p ${pid} -o etime=`, { silent: true });
  const memoryResult = shell.exec(`ps -p ${pid} -o %mem=`, { silent: true });

  return {
    pid,
    uptime: uptimeResult.stdout.trim(),
    memory: memoryResult.stdout.trim() + '%',
  };
}

/**
 * Gets the number of active Caddy connections
 * @returns {string} Number of connections or 'Unknown'
 */
export function getCaddyConnections() {
  try {
    const result = shell.exec('sudo lsof -p $(pgrep -x caddy) | grep -c TCP', {
      silent: true,
    });
    return result.stdout.trim();
  } catch (error) {
    return 'Unknown';
  }
}

/**
 * Checks if a port is in use
 * @param {number} port - The port to check
 * @returns {boolean} True if port is in use, false otherwise
 */
export function isPortInUse(port) {
  const result = shell.exec(`lsof -i :${port} -t`, { silent: true });
  return result.code === 0;
}

/**
 * Gets process information for a port
 * @param {number} port - The port to check
 * @returns {Object|null} Process information or null if not found
 */
export function getProcessForPort(port) {
  const result = shell.exec(`lsof -i :${port} -P -n`, { silent: true });
  if (result.code === 0) {
    const lines = result.stdout.trim().split('\n');
    if (lines.length > 1) {
      const parts = lines[1].split(/\s+/);
      return {
        pid: parts[1],
        name: parts[0],
      };
    }
  }
  return null;
} 