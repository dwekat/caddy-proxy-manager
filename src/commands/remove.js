import { program } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import shell from 'shelljs';
import { CADDYFILE_PATH } from '../config/constants.js';
import { removeDomainFromHosts } from '../utils/hosts.js';
import { removeCertificates } from '../utils/ssl.js';
import { reloadCaddy } from '../utils/caddy.js';
import { getDomainDir } from '../utils/file.js';

program
  .command('rm <domain>')
  .description('Remove a proxy')
  .action(async (domain) => {
    try {
      let caddyfileContent = fs.readFileSync(CADDYFILE_PATH, 'utf-8');

      // Find and remove the proxy configuration
      const regex = new RegExp(`\\s*${domain}\\s*\\{[^}]*\\}`, 'g');
      const newContent = caddyfileContent.replace(regex, '');

      if (newContent === caddyfileContent) {
        throw new Error(`Domain "${domain}" not found in Caddyfile.`);
      }

      // Write updated content back to Caddyfile
      fs.writeFileSync(CADDYFILE_PATH, newContent);
      console.log(chalk.green(`Removed proxy for ${domain}`));

      // Remove domain from the cpm block in /etc/hosts
      await removeDomainFromHosts(domain);

      // Remove SSL certificates if they exist
      removeCertificates(domain);

      // Clean up domain directory
      const domainDir = getDomainDir(domain);
      if (fs.existsSync(domainDir)) {
        try {
          shell.rm('-rf', domainDir);
          console.log(chalk.green(`Removed domain directory at ${domainDir}`));
        } catch (error) {
          console.log(chalk.yellow(`Could not remove domain directory: ${error.message}`));
        }
      }

      // Format and reload Caddy after removing the domain
      await reloadCaddy();
    } catch (error) {
      console.error(chalk.red(`Failed to remove proxy: ${error.message}`));
      process.exit(1);
    }
  }); 