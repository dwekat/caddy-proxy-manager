import { program } from 'commander';
import fs from 'fs';
import chalk from 'chalk';
import { addDomainToHosts } from '../utils/hosts.js';
import { generateCertificates } from '../utils/ssl.js';
import { reloadCaddy } from '../utils/caddy.js';
import { ensureDomainDirectories, getDomainLogPath } from '../utils/file.js';

program
  .command('add <domain> <targetPort>')
  .description('Add a new proxy. Use --custom-cert flag to use mkcert-generated certificates.')
  .option('--custom-cert', 'Use mkcert-generated certificates instead of Caddy internal CA')
  .action(async (domain, targetPort, options) => {
    try {
      let tlsDirective = '';

      if (options.customCert) {
        const certificates = generateCertificates(domain);
        tlsDirective = `tls ${certificates.cert} ${certificates.key}`;
      }

      // Create domain-specific directory structure
      ensureDomainDirectories(domain);

      // Get domain-specific log file path
      const domainLogPath = getDomainLogPath(domain);

      // Update Caddyfile with the new proxy configuration
      const proxyConfig = `
${domain} {
  log {
    output file ${domainLogPath}
    format console
  }
  reverse_proxy http://127.0.0.1:${targetPort}
  ${tlsDirective}
}
`;
      fs.appendFileSync(process.env.CADDYFILE_PATH, proxyConfig);
      console.log(chalk.green(`Added proxy for ${domain}`));
      console.log(chalk.green(`Domain logs will be written to ${domainLogPath}`));

      // Add domain to /etc/hosts within the cpm block
      await addDomainToHosts(domain);

      // Format and reload Caddy after adding the new domain
      await reloadCaddy();
    } catch (error) {
      console.error(chalk.red(`Failed to add proxy: ${error.message}`));
      process.exit(1);
    }
  }); 