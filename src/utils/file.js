import fs from 'fs';
import path from 'path';
import shell from 'shelljs';
import chalk from 'chalk';
import yaml from 'js-yaml';
import { CADDY_CONFIG_PATH, LOGS_PATH } from '../config/constants.js';

/**
 * Gets domain-specific directory path
 * @param {string} domain - The domain name
 * @returns {string} Path to domain directory
 */
export function getDomainDir(domain) {
  return path.join(process.env.HOME, '.caddy', domain);
}

/**
 * Gets domain-specific logs directory path
 * @param {string} domain - The domain name
 * @returns {string} Path to domain logs directory
 */
export function getDomainLogsDir(domain) {
  return path.join(getDomainDir(domain), 'logs');
}

/**
 * Gets domain-specific log file path
 * @param {string} domain - The domain name
 * @returns {string} Path to domain log file
 */
export function getDomainLogPath(domain) {
  return path.join(getDomainLogsDir(domain), 'access.log');
}

/**
 * Ensures required directories exist
 * @param {string} domain - The domain name
 */
export function ensureDomainDirectories(domain) {
  const domainDir = getDomainDir(domain);
  const domainLogsDir = getDomainLogsDir(domain);

  if (!fs.existsSync(domainDir)) {
    shell.mkdir('-p', domainDir);
    console.log(chalk.green(`Created domain directory at ${domainDir}`));
  }

  if (!fs.existsSync(domainLogsDir)) {
    shell.mkdir('-p', domainLogsDir);
    console.log(chalk.green(`Created domain logs directory at ${domainLogsDir}`));
  }
}

/**
 * Ensures Caddyfile exists with global logging config
 */
export function ensureCaddyfile() {
  if (!fs.existsSync(CADDY_CONFIG_PATH)) {
    shell.mkdir('-p', path.dirname(CADDY_CONFIG_PATH));

    if (!fs.existsSync(LOGS_PATH)) {
      shell.mkdir('-p', LOGS_PATH);
      console.log(chalk.green(`Created logs directory at ${LOGS_PATH}`));
    }

    const globalConfig = `{
  log {
    output file ${path.join(LOGS_PATH, 'access.log')}
    format console
  }
}
`;
    fs.writeFileSync(CADDY_CONFIG_PATH, globalConfig);
    console.log(chalk.green(`Initialized Caddyfile at ${CADDY_CONFIG_PATH}`));
  }
}

/**
 * Parses proxy configurations from Caddyfile
 * @returns {Array} Array of proxy configurations
 */
export function parseProxyConfigs() {
  try {
    const caddyfileContent = fs.readFileSync(CADDY_CONFIG_PATH, 'utf-8');

    if (!caddyfileContent.trim()) {
      return [];
    }

    const proxies = [];
    const proxyBlocks = caddyfileContent.split(/\n\n+/);

    proxyBlocks.forEach((block) => {
      const domainMatch = block.match(/^(\S+)\s*\{/);
      const portMatch = block.match(/reverse_proxy http:\/\/127\.0\.0\.1:(\d+)/);
      const tlsEnabled = block.includes('tls');

      if (domainMatch && portMatch) {
        proxies.push({
          domain: domainMatch[1],
          port: portMatch[1],
          ssl: tlsEnabled,
        });
      }
    });

    return proxies;
  } catch (error) {
    console.error(chalk.red(`Error parsing Caddyfile: ${error.message}`));
    return [];
  }
}

/**
 * Saves proxy configurations to a YAML file
 * @param {string} filePath - Path to save the backup
 * @returns {Promise<void>}
 */
export async function saveProxyConfigs(filePath) {
  try {
    const proxies = parseProxyConfigs();

    if (proxies.length === 0) {
      throw new Error('No proxies found to backup.');
    }

    const backupData = {
      timestamp: new Date().toISOString(),
      caddyfilePath: CADDY_CONFIG_PATH,
      proxies,
    };

    const yamlStr = yaml.dump(backupData);
    fs.writeFileSync(filePath, yamlStr, 'utf8');
    console.log(chalk.green(`Successfully backed up ${proxies.length} proxies to ${filePath}`));
  } catch (error) {
    throw new Error(`Failed to backup proxies: ${error.message}`);
  }
}

/**
 * Loads proxy configurations from a YAML file
 * @param {string} filePath - Path to the backup file
 * @returns {Object} Backup data
 */
export function loadProxyConfigs(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Backup file not found: ${filePath}`);
    }

    const fileContents = fs.readFileSync(filePath, 'utf8');
    const backupData = yaml.load(fileContents);

    if (!backupData.proxies || !Array.isArray(backupData.proxies)) {
      throw new Error('Invalid backup file format.');
    }

    return backupData;
  } catch (error) {
    throw new Error(`Failed to load proxies: ${error.message}`);
  }
} 