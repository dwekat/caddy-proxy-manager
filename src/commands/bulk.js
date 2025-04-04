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
          if (proxy.useCustomCert) {
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