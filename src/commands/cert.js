import { program } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { generateCertificates } from '../utils/ssl.js';
import { reloadCaddy, getCaddyProcessInfo, startCaddy } from '../utils/caddy.js';
import { updateDomainCert, domainExistsInConfig } from '../utils/config.js';

program
  .command('cert <domain>')
  .description('Add or update SSL certificate for an existing domain')
  .option('--cert <path>', 'Path to custom certificate file')
  .option('--key <path>', 'Path to custom certificate key file')
  .option('--generate', 'Generate a new certificate using mkcert (default behavior)')
  .action(async (domain, options) => {
    try {
      // Check if the domain exists
      if (!domainExistsInConfig(domain)) {
        console.error(chalk.red(`Domain ${domain} does not exist in configuration. Add it first with 'add' command.`));
        process.exit(1);
      }

      let certPath;
      let keyPath;

      // User provided custom cert and key files
      if (options.cert && options.key) {
        if (!fs.existsSync(options.cert)) {
          console.error(chalk.red(`Certificate file not found: ${options.cert}`));
          process.exit(1);
        }
        if (!fs.existsSync(options.key)) {
          console.error(chalk.red(`Certificate key file not found: ${options.key}`));
          process.exit(1);
        }
        certPath = path.resolve(options.cert);
        keyPath = path.resolve(options.key);
        console.log(chalk.green(`Using custom certificate files`));
      } 
      // Generate a new certificate using mkcert (default behavior)
      else {
        const certificates = generateCertificates(domain);
        certPath = certificates.cert;
        keyPath = certificates.key;
        console.log(chalk.green(`Generated new certificate for ${domain} using mkcert`));
      }

      // Update the domain's TLS configuration
      updateDomainCert(domain, certPath, keyPath);
      console.log(chalk.green(`Updated SSL certificate for ${domain}`));

      // Check if Caddy is running, if not start it
      const processInfo = getCaddyProcessInfo();
      if (!processInfo) {
        await startCaddy();
      }

      // Reload Caddy to apply changes
      await reloadCaddy();
      console.log(chalk.green(`Caddy reloaded with new certificate configuration`));
    } catch (error) {
      console.error(chalk.red(`Failed to update certificate: ${error.message}`));
      process.exit(1);
    }
  }); 