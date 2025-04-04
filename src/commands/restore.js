import { program } from 'commander';
import chalk from 'chalk';
import { DEFAULT_BACKUP_PATH } from '../config/constants.js';
import { loadProxyConfigs } from '../utils/file.js';
import { addDomainToHosts } from '../utils/hosts.js';
import { generateCertificates } from '../utils/ssl.js';
import { reloadCaddy } from '../utils/caddy.js';
import { ensureDomainDirectories, getDomainLogPath } from '../utils/file.js';
import fs from 'fs';
import { CADDYFILE_PATH } from '../config/constants.js';

program
  .command('restore')
  .description('Restore proxies from a YAML file')
  .option('-f, --file <file>', 'Input file path', DEFAULT_BACKUP_PATH)
  .action(async (options) => {
    try {
      const backupData = await loadProxyConfigs(options.file);

      // Clear existing Caddyfile
      fs.writeFileSync(CADDYFILE_PATH, '', 'utf8');
      console.log(chalk.yellow('Cleared existing Caddyfile'));

      console.log(chalk.blue(`Restoring ${backupData.proxies.length} proxies...`));

      for (const proxy of backupData.proxies) {
        try {
          let tlsDirective = '';

          if (proxy.ssl) {
            const certificates = generateCertificates(proxy.domain);
            tlsDirective = `tls ${certificates.cert} ${certificates.key}`;
          }

          // Create domain-specific directory structure
          ensureDomainDirectories(proxy.domain);

          // Get domain-specific log file path
          const domainLogPath = getDomainLogPath(proxy.domain);

          // Update Caddyfile with the proxy configuration
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
          console.log(chalk.green(`Restored proxy for ${proxy.domain}`));

          // Add domain to /etc/hosts within the cpm block
          await addDomainToHosts(proxy.domain);
        } catch (error) {
          console.error(chalk.red(`Failed to restore proxy ${proxy.domain}: ${error.message}`));
        }
      }

      // Format and reload Caddy after restoring all domains
      await reloadCaddy();
      console.log(chalk.green('Restore operation completed.'));
    } catch (error) {
      console.error(chalk.red(`Failed to restore proxies: ${error.message}`));
      process.exit(1);
    }
  }); 