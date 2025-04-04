import shell from 'shelljs';
import fs from 'fs';
import chalk from 'chalk';
import { spawn } from 'child_process';
import { CADDY_CONFIG_PATH } from '../config/constants.js';
import { validateCertificates } from './ssl.js';
import { execSudo } from './sudo.js';

/**
 * Reloads Caddy with the specified config file
 * @returns {Promise<void>}
 */
export async function reloadCaddy() {
  console.log(chalk.yellow('Reloading Caddy with JSON config...'));
  
  const reloadResult = shell.exec(`caddy reload --config ${CADDY_CONFIG_PATH}`, {
    silent: true
  });

  if (reloadResult.code === 0) {
    console.log(chalk.green('Caddy reloaded successfully.'));
    return true;
  } else {
    console.error(chalk.red('Failed to reload Caddy:'), reloadResult.stderr);
    return false;
  }
}

/**
 * Starts Caddy in the background
 * @returns {Promise<void>}
 */
export function startCaddy() {
  console.log(chalk.yellow('Starting Caddy with JSON config...'));
  
  const startResult = shell.exec(`caddy start --config ${CADDY_CONFIG_PATH}`, {
    silent: true
  });

  if (startResult.code === 0) {
    console.log(chalk.green('Caddy started successfully.'));
    return true;
  } else {
    console.error(chalk.red('Failed to start Caddy:'), startResult.stderr);
    return false;
  }
}

/**
 * Stops the Caddy server
 * @returns {Promise<void>}
 */
export function stopCaddy() {
  console.log(chalk.yellow('Stopping Caddy...'));
  
  const stopResult = shell.exec('caddy stop', { silent: true });

  if (stopResult.code === 0) {
    console.log(chalk.green('Caddy stopped successfully.'));
    return true;
  } else {
    console.error(chalk.red('Failed to stop Caddy:'), stopResult.stderr);
    return false;
  }
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
    memory: memoryResult.stdout.trim() + '%'
  };
}

/**
 * Gets Caddy active connections
 * @returns {string} Number of active connections
 */
export function getCaddyConnections() {
  try {
    const result = shell.exec('lsof -p $(pgrep -x caddy) | grep -c TCP', {
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