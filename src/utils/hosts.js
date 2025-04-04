import chalk from 'chalk';
import { HOSTS_FILE, HOSTS_BLOCK_START, HOSTS_BLOCK_END } from '../config/constants.js';
import { execSudo } from './sudo.js';

/**
 * Ensures the cpm block exists in /etc/hosts file
 * @returns {Promise<void>}
 */
export function ensureHostsBlock() {
  return new Promise((resolve, reject) => {
    const command = `grep -q "${HOSTS_BLOCK_START}" ${HOSTS_FILE} || echo -e "\\n${HOSTS_BLOCK_START}\\n${HOSTS_BLOCK_END}" >> ${HOSTS_FILE}`;
    execSudo(command)
      .then((result) => resolve())
      .catch((error) => {
        console.error(chalk.red(`Failed to ensure cpm block in hosts file: ${error}`));
        reject(error);
      });
  });
}

/**
 * Checks if a domain already exists in the hosts file
 * @param {string} domain - The domain to check
 * @returns {Promise<boolean>} - True if domain exists, false otherwise
 */
export function domainExistsInHosts(domain) {
  return new Promise((resolve, reject) => {
    const checkCommand = `grep -q "127.0.0.1 ${domain}" ${HOSTS_FILE}`;
    console.log(chalk.blue(`Checking if domain exists: ${domain}`));
    
    execSudo(checkCommand)
      .then((result) => {
        // grep returns exit code 0 if match found, 1 if no match
        const exists = result.exitCode === 0;
        
        if (exists) {
          console.log(chalk.blue(`Domain ${domain} exists in hosts file.`));
          resolve(true);
        } else {
          console.log(chalk.blue(`Domain ${domain} does not exist in hosts file.`));
          resolve(false);
        }
      })
      .catch((error) => {
        console.error(chalk.red(`Error checking domain existence: ${error.message}`));
        // In case of error, assume domain doesn't exist to be safe
        resolve(false);
      });
  });
}

/**
 * Adds a domain to the cpm block in /etc/hosts
 * @param {string} domain - The domain to add
 * @returns {Promise<void>}
 */
export function addDomainToHosts(domain) {
  return ensureHostsBlock()
    .then(() => domainExistsInHosts(domain))
    .then((exists) => {
      if (exists) {
        console.log(chalk.yellow(`Domain ${domain} already exists in hosts file.`));
        return Promise.resolve();
      }
      
      return new Promise((resolve, reject) => {
        const hostEntry = `127.0.0.1 ${domain}`;
        const combinedCommand = `
          sed -i '' '/${HOSTS_BLOCK_START}/a\\
${hostEntry}\\
' ${HOSTS_FILE}
        `;

        execSudo(combinedCommand)
          .then((result) => {
            console.log(chalk.green(`Added ${domain} to hosts file.`));
            resolve();
          })
          .catch((error) => {
            console.error(chalk.red(`Failed to add domain to hosts file: ${error}`));
            reject(error);
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
    execSudo(removeHostEntry)
      .then((result) => {
        console.log(chalk.green(`Removed ${domain} from hosts file.`));
        resolve();
      })
      .catch((error) => {
        console.error(chalk.red(`Failed to remove domain from hosts file: ${error}`));
        reject(error);
      });
  });
} 