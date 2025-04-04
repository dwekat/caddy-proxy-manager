import { program } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import yaml from 'js-yaml';
import { DEFAULT_BACKUP_PATH } from '../config/constants.js';
import { addProxy } from '../utils/config.js';
import { reloadCaddy } from '../utils/caddy.js';
import { addDomainToHosts } from '../utils/hosts.js';
import { ensureDomainDirectories } from '../utils/file.js';
import { generateCertificates } from '../utils/ssl.js';

program
  .command('restore')
  .description('Restore proxies from a YAML file')
  .option('-f, --file <file>', 'Input file path', DEFAULT_BACKUP_PATH)
  .action(async (options) => {
    try {
      if (!fs.existsSync(options.file)) {
        throw new Error(`Backup file not found: ${options.file}`);
      }

      const fileContents = fs.readFileSync(options.file, 'utf8');
      const backupData = yaml.load(fileContents);

      if (!backupData.proxies || !Array.isArray(backupData.proxies)) {
        throw new Error('Invalid backup file format.');
      }

      for (const proxy of backupData.proxies) {
        try {
          // Create domain-specific directory structure
          ensureDomainDirectories(proxy.domain);

          let tlsOptions = {};
          if (proxy.ssl) {
            const certificates = generateCertificates(proxy.domain);
            tlsOptions = {
              tlsCertPath: certificates.cert,
              tlsKeyPath: certificates.key
            };
          }

          // Add proxy configuration
          addProxy(proxy.domain, proxy.port, {
            enableLogging: true,
            ...tlsOptions
          });

          console.log(chalk.green(`Restored proxy for ${proxy.domain}`));

          // Add domain to /etc/hosts within the cpm block
          await addDomainToHosts(proxy.domain);
        } catch (error) {
          console.error(chalk.red(`Failed to restore proxy ${proxy.domain}: ${error.message}`));
        }
      }

      // Reload Caddy after restoring all domains
      await reloadCaddy();
      console.log(chalk.green('Restore operation completed.'));
    } catch (error) {
      console.error(chalk.red(`Failed to restore proxies: ${error.message}`));
      process.exit(1);
    }
  }); 