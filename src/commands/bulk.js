import { program } from 'commander';
import chalk from 'chalk';
import { loadProxyConfigs } from '../utils/file.js';
import { addDomainToHosts } from '../utils/hosts.js';
import { generateCertificates } from '../utils/ssl.js';
import { reloadCaddy } from '../utils/caddy.js';
import { ensureDomainDirectories } from '../utils/file.js';
import { addProxy } from '../utils/config.js';

program
  .command('bulk')
  .description('Add multiple proxies from a YAML file')
  .requiredOption('-f, --file <file>', 'YAML file with proxy configurations')
  .action(async (options) => {
    try {
      const config = await loadProxyConfigs(options.file);
      console.log(chalk.blue(`Adding ${config.proxies.length} proxies...`));

      for (const proxy of config.proxies) {
        if (!proxy.domain || !proxy.port) {
          console.error(
            chalk.red(`Skipping invalid proxy: ${JSON.stringify(proxy)}`)
          );
          continue;
        }

        try {
          // Create domain-specific directory structure
          ensureDomainDirectories(proxy.domain);

          let tlsOptions = {};
          // Use custom mkcert certificates if specified
          if (proxy.useCustomCert) {
            const certificates = generateCertificates(proxy.domain);
            tlsOptions = {
              tlsCertPath: certificates.cert,
              tlsKeyPath: certificates.key
            };
            console.log(chalk.green(`Generated mkcert certificate for ${proxy.domain}`));
          } else {
            console.log(chalk.green(`Using Caddy's automatic certificate authority for ${proxy.domain}`));
          }

          // Add proxy configuration
          const proxyAdded = addProxy(proxy.domain, proxy.port, {
            enableLogging: true,
            ...tlsOptions
          });

          if (!proxyAdded) {
            console.log(chalk.yellow(`Skipping domain ${proxy.domain} as it already exists.`));
            continue;
          }

          console.log(chalk.green(`Added proxy for ${proxy.domain}`));

          // Add domain to /etc/hosts within the cpm block
          await addDomainToHosts(proxy.domain);
        } catch (error) {
          console.error(chalk.red(`Failed to add proxy ${proxy.domain}: ${error.message}`));
        }
      }

      // Reload Caddy after adding all domains
      await reloadCaddy();
      console.log(chalk.green('Bulk operation completed.'));
    } catch (error) {
      console.error(chalk.red(`Failed to process bulk operation: ${error.message}`));
      process.exit(1);
    }
  }); 