import { program } from 'commander';
import chalk from 'chalk';
import { removeDomainFromHosts } from '../utils/hosts.js';
import { removeProxy } from '../utils/config.js';
import { reloadCaddy } from '../utils/caddy.js';
import fs from 'fs';
import path from 'path';
import { CERTS_PATH } from '../config/constants.js';

program
  .command('rm <domain>')
  .description('Remove a proxy')
  .action(async (domain) => {
    try {
      // Remove proxy from config
      const removed = removeProxy(domain);
      
      if (!removed) {
        console.log(chalk.yellow(`No proxy found for domain: ${domain}`));
        return;
      }
      
      console.log(chalk.green(`Removed proxy for ${domain}`));

      // Remove domain from /etc/hosts
      await removeDomainFromHosts(domain);

      // Delete certificate files if they exist
      const certPath = path.join(CERTS_PATH, `${domain}.pem`);
      const certKeyPath = path.join(CERTS_PATH, `${domain}-key.pem`);

      if (fs.existsSync(certPath)) {
        fs.unlinkSync(certPath);
        console.log(chalk.green(`Deleted certificate for ${domain}`));
      }
      
      if (fs.existsSync(certKeyPath)) {
        fs.unlinkSync(certKeyPath);
        console.log(chalk.green(`Deleted certificate key for ${domain}`));
      }

      // Reload Caddy to apply changes
      await reloadCaddy();
    } catch (error) {
      console.error(chalk.red(`Failed to remove proxy: ${error.message}`));
      process.exit(1);
    }
  }); 