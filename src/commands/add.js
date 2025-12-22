import { program } from 'commander';
import chalk from 'chalk';
import { addDomainToHosts } from '../utils/hosts.js';
import { generateCertificates } from '../utils/ssl.js';
import {
  reloadCaddy,
  startCaddy,
  getCaddyProcessInfo,
} from '../utils/caddy.js';
import { ensureDomainDirectories } from '../utils/file.js';
import { addProxy } from '../utils/config.js';

program
  .command('add <domain> <targetPort>')
  .description('Add a new proxy. Uses Caddy automatic HTTPS by default.')
  .option(
    '--custom-cert',
    'Use mkcert-generated certificates instead of Caddy automatic CA'
  )
  .action(async (domain, targetPort, options) => {
    try {
      // Create domain-specific directory structure
      ensureDomainDirectories(domain);

      let tlsOptions = {};
      if (options.customCert) {
        const certificates = generateCertificates(domain);
        tlsOptions = {
          tlsCertPath: certificates.cert,
          tlsKeyPath: certificates.key,
        };
        console.log(chalk.green(`Generated mkcert certificate for ${domain}`));
      } else {
        console.log(
          chalk.green(
            `Using Caddy's automatic certificate authority for ${domain}`
          )
        );
      }

      // Add proxy configuration
      const proxyAdded = addProxy(domain, parseInt(targetPort, 10), {
        enableLogging: true,
        ...tlsOptions,
      });

      if (!proxyAdded) {
        console.log(
          chalk.yellow(`Skipping domain ${domain} as it already exists.`)
        );
        return;
      }

      console.log(chalk.green(`Added proxy for ${domain}`));

      // Add domain to /etc/hosts within the cpm block
      await addDomainToHosts(domain);

      // Check if Caddy is running, if not start it
      const processInfo = getCaddyProcessInfo();
      if (!processInfo) {
        await startCaddy();
      }

      // Reload Caddy after adding the new domain
      await reloadCaddy();
    } catch (error) {
      console.error(chalk.red(`Failed to add proxy: ${error.message}`));
      process.exit(1);
    }
  });
