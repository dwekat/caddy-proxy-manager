import sudo from 'sudo-prompt';
import chalk from 'chalk';
import { HOSTS_FILE, HOSTS_BLOCK_START, HOSTS_BLOCK_END } from '../config/constants.js';

/**
 * Ensures the cpm block exists in /etc/hosts file
 * @returns {Promise<void>}
 */
export function ensureHostsBlock() {
  return new Promise((resolve, reject) => {
    const command = `grep -q "${HOSTS_BLOCK_START}" ${HOSTS_FILE} || echo -e "\\n${HOSTS_BLOCK_START}\\n${HOSTS_BLOCK_END}" >> ${HOSTS_FILE}`;
    sudo.exec(command, { name: 'Caddy Proxy Manager' }, (error) => {
      if (error) {
        console.error(chalk.red(`Failed to ensure cpm block in hosts file: ${error}`));
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Adds a domain to the cpm block in /etc/hosts
 * @param {string} domain - The domain to add
 * @returns {Promise<void>}
 */
export function addDomainToHosts(domain) {
  return ensureHostsBlock().then(() => {
    return new Promise((resolve, reject) => {
      const hostEntry = `127.0.0.1 ${domain}`;
      const combinedCommand = `
        sed -i '' '/${HOSTS_BLOCK_START}/a\\
${hostEntry}\\
' ${HOSTS_FILE}
      `;

      sudo.exec(combinedCommand, { name: 'Caddy Proxy Manager' }, (error) => {
        if (error) {
          console.error(chalk.red(`Failed to add domain to hosts file: ${error}`));
          reject(error);
        } else {
          console.log(chalk.green(`Added ${domain} to hosts file.`));
          resolve();
        }
      });
    });
  });
}

/**
 * Removes a domain from the cpm block in /etc/hosts
 * @param {string} domain - The domain to remove
 * @returns {Promise<void>}
 */
export function removeDomainFromHosts(domain) {
  return new Promise((resolve, reject) => {
    const removeHostEntry = `sed -i '' '/^127.0.0.1 ${domain}$/d' ${HOSTS_FILE}`;
    sudo.exec(removeHostEntry, { name: 'Caddy Proxy Manager' }, (error) => {
      if (error) {
        console.error(chalk.red(`Failed to remove domain from hosts file: ${error}`));
        reject(error);
      } else {
        console.log(chalk.green(`Removed ${domain} from hosts file.`));
        resolve();
      }
    });
  });
} 