import { program } from 'commander';
import chalk from 'chalk';
import { loadProxyConfigs } from '../utils/file.js';
import { addDomainToHosts } from '../utils/hosts.js';
import { generateCertificates } from '../utils/ssl.js';
import { reloadCaddy } from '../utils/caddy.js';
import { ensureDomainDirectories, getDomainLogPath } from '../utils/file.js';
import fs from 'fs';
import { CADDYFILE_PATH } from '../config/constants.js';

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
          let tlsDirective = '';

          if (proxy.useCustomCert) {
            const certificates = generateCertificates(proxy.domain);
            tlsDirective = `tls ${certificates.cert} ${certificates.key}`;
          }

          // Create domain-specific directory structure
          ensureDomainDirectories(proxy.domain);

          // Get domain-specific log file path
          const domainLogPath = getDomainLogPath(proxy.domain);

          // Update Caddyfile with the new proxy configuration
          const proxyConfig = `
${proxy.domain} {
  log {
    output file ${domainLogPath}
    format console
  }
  reverse_proxy http://127.0.0.1:${proxy.port}
  ${tlsDirective}
}
`;
          fs.appendFileSync(CADDYFILE_PATH, proxyConfig);
          console.log(chalk.green(`Added proxy for ${proxy.domain}`));
          console.log(chalk.green(`Domain logs will be written to ${domainLogPath}`));

          // Add domain to /etc/hosts within the cpm block
          await addDomainToHosts(proxy.domain);
        } catch (error) {
          console.error(chalk.red(`Failed to add proxy ${proxy.domain}: ${error.message}`));
        }
      }

      // Format and reload Caddy after adding all domains
      await reloadCaddy();
      console.log(chalk.green('Bulk operation completed.'));
    } catch (error) {
      console.error(chalk.red(`Failed to process bulk operation: ${error.message}`));
      process.exit(1);
    }
  }); 