#!/usr/bin/env node

import {program} from 'commander';
import chalk from 'chalk';
import shell from 'shelljs';
import sudo from 'sudo-prompt';
import fs from 'fs';
import path from 'path';
import Table from 'cli-table3';
import { spawn } from 'child_process';

const CADDYFILE_PATH = path.join(process.env.HOME, '.caddy', 'Caddyfile');
const HOSTS_FILE = '/etc/hosts';
const CERTS_PATH = path.join(process.env.HOME, '.caddy', 'certs');

// Host block markers
const HOSTS_BLOCK_START = '# cpm-managed block - start';
const HOSTS_BLOCK_END = '# cpm-managed block - end';

// Function to ensure cpm block exists in /etc/hosts
function ensureHostsBlock() {
  const command = `grep -q "${HOSTS_BLOCK_START}" ${HOSTS_FILE} || echo -e "\\n${HOSTS_BLOCK_START}\\n${HOSTS_BLOCK_END}" >> ${HOSTS_FILE}`;
  sudo.exec(command, {name: 'Caddy Proxy Manager'}, (error) => {
    if (error) console.error(chalk.red(`Failed to ensure cpm block in hosts file: ${error}`));
  });
}

// Function to add domain to the cpm block in /etc/hosts
function addDomainToHosts(domain) {
  ensureHostsBlock();
  const hostEntry = `127.0.0.1 ${domain}`;

  // Command to add the entry right after the HOSTS_BLOCK_START, ensuring each entry goes on a new line
  const combinedCommand = `
    sed -i '' '/${HOSTS_BLOCK_START}/a\\
${hostEntry}\\
' ${HOSTS_FILE}
  `;

  sudo.exec(combinedCommand, {name: 'Caddy Proxy Manager'}, (error) => {
    if (error) {
      console.error(chalk.red(`Failed to add domain to hosts file: ${error}`));
    } else {
      console.log(chalk.green(`Added ${domain} to hosts file.`));
    }
  });
}

// Function to remove domain from the cpm block in /etc/hosts
function removeDomainFromHosts(domain) {
  const removeHostEntry = `sed -i '' '/^127.0.0.1 ${domain}$/d' ${HOSTS_FILE}`;
  sudo.exec(removeHostEntry, {name: 'Caddy Proxy Manager'}, (error) => {
    if (error) console.error(chalk.red(`Failed to remove domain from hosts file: ${error}`));
    else console.log(chalk.green(`Removed ${domain} from hosts file.`));
  });
}

// Function to check if mkcert is installed
function checkMkcert() {
  if (!shell.which('mkcert')) {
    console.log(chalk.red('Error: mkcert is not installed.'));
    console.log(chalk.yellow('Please install mkcert using the following command:'));
    console.log(chalk.green('brew install mkcert && mkcert -install'));
    process.exit(1);
  }
}

// Function to ensure mkcert’s local CA is installed
function ensureLocalCA() {
  const certPath = path.join(shell.env.HOME, 'Library/Application Support/mkcert');
  if (!fs.existsSync(certPath)) {
    console.log(chalk.red('Error: mkcert local CA is not installed.'));
    console.log(chalk.yellow('Please run the following command to install the local CA:'));
    console.log(chalk.green('mkcert -install'));
    process.exit(1);
  }
}

// Function to ensure all certificate files referenced in Caddyfile exist
function validateCertificates() {
  const caddyfileContent = fs.readFileSync(CADDYFILE_PATH, 'utf-8');
  const certPattern = /tls\s+([^\s]+)\s+([^\s]+)/g;
  let match;
  let allCertsExist = true;

  while ((match = certPattern.exec(caddyfileContent)) !== null) {
    const certPath = match[1];
    const keyPath = match[2];

    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      console.log(chalk.red(`Missing certificate or key file: ${certPath} or ${keyPath}`));
      allCertsExist = false;
    }
  }

  return allCertsExist;
}

// Ensure Caddyfile exists
if (!fs.existsSync(CADDYFILE_PATH)) {
  shell.mkdir('-p', path.dirname(CADDYFILE_PATH));
  fs.writeFileSync(CADDYFILE_PATH, '');
}

// Function to reload Caddy with specified config file and format it
function reloadCaddy() {
  console.log(chalk.yellow('Formatting Caddyfile...'));
  shell.exec(`caddy fmt --overwrite ${CADDYFILE_PATH}`);

  // Validate all certificates before reloading
  if (!validateCertificates()) {
    console.log(chalk.red('Caddy reload aborted due to missing certificates.'));
    return;
  }

  console.log(chalk.yellow('Reloading Caddy with specified config file...'));
  const reloadResult = shell.exec(`caddy reload --config ${CADDYFILE_PATH}`, {silent: true});
  if (reloadResult.code === 0) {
    console.log(chalk.green('Caddy reloaded successfully with the specified config.'));
  } else {
    console.log(chalk.red('Failed to reload Caddy:', reloadResult.stderr));
  }
}

// Command: List all proxies
program
  .command('ls')
  .description('List all proxies')
  .action(() => {
    const caddyfileContent = fs.readFileSync(CADDYFILE_PATH, 'utf-8');

    if (!caddyfileContent.trim()) {
      console.log(chalk.yellow('No proxies found.'));
      return;
    }

    const table = new Table({
      head: [chalk.blue('Domain'), chalk.blue('Port'), chalk.blue('Custom SSL')],
      colWidths: [30, 10, 15],
    });

    // Parse proxy configurations by looking for domain blocks in the Caddyfile
    const proxyBlocks = caddyfileContent.split(/\n\n+/);  // Split by double newlines for each block

    proxyBlocks.forEach((block) => {
      const domainMatch = block.match(/^(\S+)\s*\{/);  // Match the domain name at the start of each block
      const portMatch = block.match(/reverse_proxy http:\/\/127\.0\.0\.1:(\d+)/);  // Match port in reverse_proxy directive
      const tlsEnabled = block.includes('tls');  // Check if tls directive is in the block

      if (domainMatch && portMatch) {
        const domain = domainMatch[1];
        const port = portMatch[1];
        table.push([domain, port, tlsEnabled ? 'Yes' : 'No']);
      }
    });

    console.log(table.toString());
  });

// Command: Add a new proxy
program
  .command('add <domain> <targetPort>')
  .description('Add a new proxy. Use --custom-cert flag to use mkcert-generated certificates.')
  .option('--custom-cert', 'Use mkcert-generated certificates instead of Caddy internal CA')
  .action((domain, targetPort, options) => {
    let tlsDirective = '';

    if (options.customCert) {
      checkMkcert();  // Check if mkcert is installed
      ensureLocalCA(); // Check if local CA is installed

      const certPath = path.join(CERTS_PATH, `${domain}.pem`);
      const certKeyPath = path.join(CERTS_PATH, `${domain}-key.pem`);

      // Generate certificates if they do not exist
      if (!fs.existsSync(certPath) || !fs.existsSync(certKeyPath)) {
        console.log(chalk.yellow(`Generating certificate for ${domain}...`));
        shell.exec(`mkcert -cert-file ${certPath} -key-file ${certKeyPath} ${domain}`);
      }

      // Update the tlsDirective to use custom certs
      tlsDirective = `tls ${certPath} ${certKeyPath}`;
    }

    // Update Caddyfile with the new proxy configuration, using either tls internal or custom certs
    const proxyConfig = `
${domain} {
  reverse_proxy http://127.0.0.1:${targetPort}
  ${tlsDirective}
}
`;
    fs.appendFileSync(CADDYFILE_PATH, proxyConfig);
    console.log(chalk.green(`Added proxy for ${domain}`));

    // Add domain to /etc/hosts within the cpm block
    addDomainToHosts(domain);

    // Format and reload Caddy after adding the new domain
    reloadCaddy();
  });

// Command: Remove a proxy
program
  .command('rm <domain>')
  .description('Remove a proxy')
  .action((domain) => {
    let caddyfileContent = fs.readFileSync(CADDYFILE_PATH, 'utf-8');

    // Find and remove the proxy configuration
    const regex = new RegExp(`\\s*${domain}\\s*\\{[^}]*\\}`, 'g');
    caddyfileContent = caddyfileContent.replace(regex, '');
    fs.writeFileSync(CADDYFILE_PATH, caddyfileContent);
    console.log(chalk.green(`Removed proxy for ${domain}`));

    // Remove domain from the cpm block in /etc/hosts
    removeDomainFromHosts(domain);

    // Delete the certificate files if they exist
    const certPath = path.join(CERTS_PATH, `${domain}.pem`);
    const certKeyPath = path.join(CERTS_PATH, `${domain}-key.pem`);

    if (fs.existsSync(certPath)) {
      fs.unlinkSync(certPath);
      console.log(chalk.green(`Deleted certificate for ${domain}.`));
    }
    if (fs.existsSync(certKeyPath)) {
      fs.unlinkSync(certKeyPath);
      console.log(chalk.green(`Deleted certificate key for ${domain}.`));
    }

    // Format and reload Caddy after removing the domain
    reloadCaddy();
  });

// Command: Start Caddy in the background
program
  .command('start')
  .description('Start Caddy in the background using the specified Caddyfile')
  .action(() => {
    const caddyProcess = spawn('caddy', ['start', '--config', CADDYFILE_PATH], {
      detached: true,
      stdio: 'ignore', // Detach completely by ignoring stdio
    });

    caddyProcess.unref(); // Ensure the process does not keep the Node.js event loop active

    console.log(chalk.green('Caddy started successfully in the background.'));
  });

// Command: Stop Caddy
program
  .command('stop')
  .description('Stop the Caddy server running in the background')
  .action(() => {
    const stopCommand = 'caddy stop';
    const result = shell.exec(stopCommand, {silent: true});

    if (result.code === 0) {
      console.log(chalk.green('Caddy stopped successfully.'));
    } else {
      console.error(chalk.red('Failed to stop Caddy:'), result.stderr);
    }
  });

// Command: Check Caddy status
program
  .command('status')
  .description('Check if the Caddy server is running')
  .action(() => {
    try {
      const result = shell.exec('pgrep -x caddy', { silent: true });

      if (result.code === 0) {
        console.log(chalk.green('Caddy is running.'));
      } else {
        console.log(chalk.red('Caddy is not running.'));
      }
    } catch (error) {
      console.error(chalk.red('Error while checking Caddy status:'), error.message);
    }
  });

// Parse arguments
program.parse(process.argv);
