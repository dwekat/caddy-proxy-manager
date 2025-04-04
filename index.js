#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import shell from 'shelljs';
import sudo from 'sudo-prompt';
import fs from 'fs';
import path from 'path';
import Table from 'cli-table3';
import { spawn } from 'child_process';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';
import ora from 'ora';

const CADDYFILE_PATH = path.join(process.env.HOME, '.caddy', 'Caddyfile');
const HOSTS_FILE = '/etc/hosts';
const CERTS_PATH = path.join(process.env.HOME, '.caddy', 'certs');
const LOGS_PATH = path.join(process.env.HOME, '.caddy', 'logs');
const DEFAULT_BACKUP_PATH = './cpm-backup.yml';
const DEFAULT_LOG_FILE = path.join(LOGS_PATH, 'access.log');

// Host block markers
const HOSTS_BLOCK_START = '# cpm-managed block - start';
const HOSTS_BLOCK_END = '# cpm-managed block - end';

// Function to ensure cpm block exists in /etc/hosts
function ensureHostsBlock() {
  const command = `grep -q "${HOSTS_BLOCK_START}" ${HOSTS_FILE} || echo -e "\\n${HOSTS_BLOCK_START}\\n${HOSTS_BLOCK_END}" >> ${HOSTS_FILE}`;
  sudo.exec(command, { name: 'Caddy Proxy Manager' }, (error) => {
    if (error)
      console.error(
        chalk.red(`Failed to ensure cpm block in hosts file: ${error}`)
      );
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

  sudo.exec(combinedCommand, { name: 'Caddy Proxy Manager' }, (error) => {
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
  sudo.exec(removeHostEntry, { name: 'Caddy Proxy Manager' }, (error) => {
    if (error)
      console.error(
        chalk.red(`Failed to remove domain from hosts file: ${error}`)
      );
    else console.log(chalk.green(`Removed ${domain} from hosts file.`));
  });
}

// Function to check if mkcert is installed
function checkMkcert() {
  if (!shell.which('mkcert')) {
    console.log(chalk.red('Error: mkcert is not installed.'));
    console.log(
      chalk.yellow('Please install mkcert using the following command:')
    );
    console.log(chalk.green('brew install mkcert && mkcert -install'));
    process.exit(1);
  }
}

// Function to ensure mkcert's local CA is installed
function ensureLocalCA() {
  const certPath = path.join(
    shell.env.HOME,
    'Library/Application Support/mkcert'
  );
  if (!fs.existsSync(certPath)) {
    console.log(chalk.red('Error: mkcert local CA is not installed.'));
    console.log(
      chalk.yellow('Please run the following command to install the local CA:')
    );
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
      console.log(
        chalk.red(`Missing certificate or key file: ${certPath} or ${keyPath}`)
      );
      allCertsExist = false;
    }
  }

  return allCertsExist;
}

// Function to get domain-specific directory
function getDomainDir(domain) {
  return path.join(process.env.HOME, '.caddy', domain);
}

// Function to get domain-specific log directory
function getDomainLogsDir(domain) {
  return path.join(getDomainDir(domain), 'logs');
}

// Function to get domain-specific log file path
function getDomainLogPath(domain) {
  return path.join(getDomainLogsDir(domain), 'access.log');
}

// Ensure Caddyfile exists with global logging config
if (!fs.existsSync(CADDYFILE_PATH)) {
  shell.mkdir('-p', path.dirname(CADDYFILE_PATH));

  // Create logs directory if it doesn't exist
  if (!fs.existsSync(LOGS_PATH)) {
    shell.mkdir('-p', LOGS_PATH);
    console.log(chalk.green(`Created logs directory at ${LOGS_PATH}`));
  }

  // Create initial Caddyfile with global logging configuration
  const globalConfig = `{
  log {
    output file ${DEFAULT_LOG_FILE}
    format console
  }
}
`;
  fs.writeFileSync(CADDYFILE_PATH, globalConfig);
  console.log(
    chalk.green(
      `Initialized Caddyfile with logging configuration at ${CADDYFILE_PATH}`
    )
  );
} else {
  // Ensure logs directory exists
  if (!fs.existsSync(LOGS_PATH)) {
    shell.mkdir('-p', LOGS_PATH);
    console.log(chalk.green(`Created logs directory at ${LOGS_PATH}`));
  }

  // Check if global log config exists, add if not
  const caddyfileContent = fs.readFileSync(CADDYFILE_PATH, 'utf-8');
  if (
    !caddyfileContent.includes('log {') &&
    !caddyfileContent.includes('output file')
  ) {
    const globalConfig = `{
  log {
    output file ${DEFAULT_LOG_FILE}
    format console
  }
}

`;
    fs.writeFileSync(CADDYFILE_PATH, globalConfig + caddyfileContent);
    console.log(chalk.green(`Added logging configuration to Caddyfile`));
  }
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
  const reloadResult = shell.exec(`caddy reload --config ${CADDYFILE_PATH}`, {
    silent: true,
  });
  if (reloadResult.code === 0) {
    console.log(
      chalk.green('Caddy reloaded successfully with the specified config.')
    );
  } else {
    console.log(chalk.red('Failed to reload Caddy:', reloadResult.stderr));
  }
}

// Function to perform health check on a domain
async function checkDomainHealth(domain, port) {
  try {
    const url = `https://${domain}`;
    const spinner = ora(`Checking ${url}...`).start();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(url, {
        signal: controller.signal,
        // Skip certificate validation for self-signed certs
        agent: function (_parsedURL) {
          return { rejectUnauthorized: false };
        },
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        spinner.succeed(`${url} is ${chalk.green('UP')}`);
        return true;
      } else {
        spinner.fail(`${url} returned status ${response.status}`);
        return false;
      }
    } catch (error) {
      spinner.fail(`${url} is ${chalk.red('DOWN')} - ${error.message}`);
      return false;
    }
  } catch (error) {
    console.error(chalk.red(`Error checking ${domain}: ${error.message}`));
    return false;
  }
}

// Function to check if port is in use
function isPortInUse(port) {
  const result = shell.exec(`lsof -i :${port} -t`, { silent: true });
  return result.code === 0;
}

// Function to get process using a port
function getProcessForPort(port) {
  const result = shell.exec(`lsof -i :${port} -P -n`, { silent: true });
  if (result.code === 0) {
    const lines = result.stdout.trim().split('\n');
    if (lines.length > 1) {
      const parts = lines[1].split(/\s+/);
      return {
        pid: parts[1],
        name: parts[0],
      };
    }
  }
  return null;
}

// Parse Caddyfile to get proxy configurations
function parseProxyConfigs() {
  try {
    const caddyfileContent = fs.readFileSync(CADDYFILE_PATH, 'utf-8');

    if (!caddyfileContent.trim()) {
      return [];
    }

    const proxies = [];
    const proxyBlocks = caddyfileContent.split(/\n\n+/);

    proxyBlocks.forEach((block) => {
      const domainMatch = block.match(/^(\S+)\s*\{/);
      const portMatch = block.match(
        /reverse_proxy http:\/\/127\.0\.0\.1:(\d+)/
      );
      const tlsEnabled = block.includes('tls');

      if (domainMatch && portMatch) {
        proxies.push({
          domain: domainMatch[1],
          port: portMatch[1],
          ssl: tlsEnabled,
        });
      }
    });

    return proxies;
  } catch (error) {
    console.error(chalk.red(`Error parsing Caddyfile: ${error.message}`));
    return [];
  }
}

// Get Caddy process information
function getCaddyProcessInfo() {
  const pidResult = shell.exec('pgrep -x caddy', { silent: true });

  if (pidResult.code !== 0) {
    return null;
  }

  const pid = pidResult.stdout.trim();
  const uptimeResult = shell.exec(`ps -p ${pid} -o etime=`, { silent: true });
  const memoryResult = shell.exec(`ps -p ${pid} -o %mem=`, { silent: true });

  return {
    pid,
    uptime: uptimeResult.stdout.trim(),
    memory: memoryResult.stdout.trim() + '%',
  };
}

// Function to get Caddy active connections
function getCaddyConnections() {
  try {
    const result = shell.exec('sudo lsof -p $(pgrep -x caddy) | grep -c TCP', {
      silent: true,
    });
    return result.stdout.trim();
  } catch (error) {
    return 'Unknown';
  }
}

// Command: List all proxies
program
  .command('ls')
  .description('List all proxies')
  .option('--health', 'Include health check information')
  .action(async (options) => {
    const caddyfileContent = fs.readFileSync(CADDYFILE_PATH, 'utf-8');

    if (!caddyfileContent.trim()) {
      console.log(chalk.yellow('No proxies found.'));
      return;
    }

    const tableHeaders = options.health
      ? [
        chalk.blue('DOMAIN'),
        chalk.blue('PORT'),
        chalk.blue('CUSTOM_SSL'),
        chalk.blue('HEALTH'),
        chalk.blue('PORT_STATUS'),
      ]
      : [chalk.blue('DOMAIN'), chalk.blue('PORT'), chalk.blue('CUSTOM_SSL')];

    const colWidths = options.health ? [35, 8, 12, 12, 18] : [35, 8, 12];

    const table = new Table({
      head: tableHeaders,
      colWidths: colWidths,
      chars: {
        'top': '', 'top-mid': '', 'top-left': '', 'top-right': '',
        'bottom': '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
        'left': '', 'left-mid': '', 'mid': '', 'mid-mid': '',
        'right': '', 'right-mid': '', 'middle': ' '
      },
      style: {
        'padding-left': 1,
        'padding-right': 1,
        head: ['blue'],
        border: []
      }
    });

    // Parse proxy configurations by looking for domain blocks in the Caddyfile
    const proxyBlocks = caddyfileContent.split(/\n\n+/); // Split by double newlines for each block

    for (const block of proxyBlocks) {
      const domainMatch = block.match(/^(\S+)\s*\{/); // Match the domain name at the start of each block
      const portMatch = block.match(
        /reverse_proxy http:\/\/127\.0\.0\.1:(\d+)/
      ); // Match port in reverse_proxy directive
      const tlsEnabled = block.includes('tls'); // Check if tls directive is in the block

      if (domainMatch && portMatch) {
        const domain = domainMatch[1];
        const port = portMatch[1];

        if (options.health) {
          // Add port status check
          const portStatus = isPortInUse(port)
            ? chalk.green('LISTENING')
            : chalk.red('NOT LISTENING');

          // Perform health check if requested
          const healthStatus = await checkDomainHealth(domain, port);
          const healthText = healthStatus
            ? chalk.green('HEALTHY')
            : chalk.red('UNHEALTHY');

          table.push([
            domain,
            port,
            tlsEnabled ? 'Yes' : 'No',
            healthText,
            portStatus,
          ]);
        } else {
          table.push([domain, port, tlsEnabled ? 'Yes' : 'No']);
        }
      }
    }

    console.log(table.toString());
  });

// Command: Add a new proxy
program
  .command('add <domain> <targetPort>')
  .description(
    'Add a new proxy. Use --custom-cert flag to use mkcert-generated certificates.'
  )
  .option(
    '--custom-cert',
    'Use mkcert-generated certificates instead of Caddy internal CA'
  )
  .action((domain, targetPort, options) => {
    let tlsDirective = '';

    if (options.customCert) {
      checkMkcert(); // Check if mkcert is installed
      ensureLocalCA(); // Check if local CA is installed

      const certPath = path.join(CERTS_PATH, `${domain}.pem`);
      const certKeyPath = path.join(CERTS_PATH, `${domain}-key.pem`);

      // Generate certificates if they do not exist
      if (!fs.existsSync(certPath) || !fs.existsSync(certKeyPath)) {
        console.log(chalk.yellow(`Generating certificate for ${domain}...`));
        shell.exec(
          `mkcert -cert-file ${certPath} -key-file ${certKeyPath} ${domain}`
        );
      }

      // Update the tlsDirective to use custom certs
      tlsDirective = `tls ${certPath} ${certKeyPath}`;
    }

    // Create domain-specific directory structure
    const domainDir = getDomainDir(domain);
    const domainLogsDir = getDomainLogsDir(domain);

    if (!fs.existsSync(domainDir)) {
      shell.mkdir('-p', domainDir);
      console.log(chalk.green(`Created domain directory at ${domainDir}`));
    }

    if (!fs.existsSync(domainLogsDir)) {
      shell.mkdir('-p', domainLogsDir);
      console.log(
        chalk.green(`Created domain logs directory at ${domainLogsDir}`)
      );
    }

    // Get domain-specific log file path
    const domainLogPath = getDomainLogPath(domain);

    // Update Caddyfile with the new proxy configuration, using either tls internal or custom certs
    // Now including domain-specific logging
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
    fs.appendFileSync(CADDYFILE_PATH, proxyConfig);
    console.log(chalk.green(`Added proxy for ${domain}`));
    console.log(chalk.green(`Domain logs will be written to ${domainLogPath}`));

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

    // Optionally clean up domain directory
    const domainDir = getDomainDir(domain);
    if (fs.existsSync(domainDir)) {
      try {
        shell.rm('-rf', domainDir);
        console.log(chalk.green(`Removed domain directory at ${domainDir}`));
      } catch (error) {
        console.log(
          chalk.yellow(`Could not remove domain directory: ${error.message}`)
        );
      }
    }

    // Format and reload Caddy after removing the domain
    reloadCaddy();
  });

// Command: Backup proxies to a YAML file
program
  .command('backup')
  .description('Backup proxies to a YAML file')
  .option('-o, --out <file>', 'Output file path', DEFAULT_BACKUP_PATH)
  .action((options) => {
    const proxies = parseProxyConfigs();

    if (proxies.length === 0) {
      console.log(chalk.yellow('No proxies found to backup.'));
      return;
    }

    try {
      const backupData = {
        timestamp: new Date().toISOString(),
        caddyfilePath: CADDYFILE_PATH,
        proxies,
      };

      const yamlStr = yaml.dump(backupData);
      fs.writeFileSync(options.out, yamlStr, 'utf8');
      console.log(
        chalk.green(
          `Successfully backed up ${proxies.length} proxies to ${options.out}`
        )
      );
    } catch (error) {
      console.error(chalk.red(`Failed to backup proxies: ${error.message}`));
    }
  });

// Command: Restore proxies from a YAML file
program
  .command('restore')
  .description('Restore proxies from a YAML file')
  .option('-f, --file <file>', 'Input file path', DEFAULT_BACKUP_PATH)
  .action((options) => {
    try {
      if (!fs.existsSync(options.file)) {
        console.error(chalk.red(`Backup file not found: ${options.file}`));
        return;
      }

      const fileContents = fs.readFileSync(options.file, 'utf8');
      const backupData = yaml.load(fileContents);

      if (!backupData.proxies || !Array.isArray(backupData.proxies)) {
        console.error(chalk.red('Invalid backup file format.'));
        return;
      }

      // Clear existing Caddyfile
      fs.writeFileSync(CADDYFILE_PATH, '', 'utf8');

      // Add each proxy from the backup
      backupData.proxies.forEach((proxy) => {
        const options = { customCert: proxy.ssl };
        program.commands
          .find((cmd) => cmd._name === 'add')
          ._actionHandler(proxy.domain, proxy.port, options);
      });

      console.log(
        chalk.green(
          `Successfully restored ${backupData.proxies.length} proxies from ${options.file}`
        )
      );
    } catch (error) {
      console.error(chalk.red(`Failed to restore proxies: ${error.message}`));
    }
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
    const result = shell.exec(stopCommand, { silent: true });

    if (result.code === 0) {
      console.log(chalk.green('Caddy stopped successfully.'));
    } else {
      console.error(chalk.red('Failed to stop Caddy:'), result.stderr);
    }
  });

// Command: Check port status
program
  .command('ports')
  .description('Check status of ports used by proxies')
  .action(() => {
    const proxies = parseProxyConfigs();

    if (proxies.length === 0) {
      console.log(chalk.yellow('No proxies found.'));
      return;
    }

    const table = new Table({
      head: [
        chalk.blue('Domain'),
        chalk.blue('Port'),
        chalk.blue('Status'),
        chalk.blue('Process'),
      ],
      colWidths: [30, 10, 15, 30],
    });

    proxies.forEach((proxy) => {
      const port = proxy.port;
      const isUsed = isPortInUse(port);
      const process = getProcessForPort(port);

      table.push([
        proxy.domain,
        port,
        isUsed ? chalk.green('IN USE') : chalk.red('NOT IN USE'),
        process ? `${process.name} (PID: ${process.pid})` : 'N/A',
      ]);
    });

    console.log(table.toString());
  });

// Command: View logs for a domain
program
  .command('logs [domain]')
  .description('View Caddy logs, optionally filtered by domain')
  .option('-f, --follow', 'Follow log output')
  .option('-n, --lines <lines>', 'Number of lines to show', '100')
  .option('--log-path <path>', 'Custom log file path')
  .action((domain, options) => {
    // If domain is specified, use domain-specific log file
    let logPath = options.logPath;

    if (domain && !logPath) {
      const domainLogPath = getDomainLogPath(domain);
      if (fs.existsSync(domainLogPath)) {
        logPath = domainLogPath;
      }
    }

    // If no log path determined yet, use default paths
    if (!logPath) {
      // Default log paths to check
      const possibleLogPaths = [
        DEFAULT_LOG_FILE,
        '/var/log/caddy/access.log',
        path.join(process.env.HOME, '.local/share/caddy/logs/access.log'),
      ];

      // If no custom path, try to find an existing log file
      for (const potentialPath of possibleLogPaths) {
        if (fs.existsSync(potentialPath)) {
          logPath = potentialPath;
          break;
        }
      }
    }

    // If domain specified but no domain log file found
    if (
      domain &&
      !fs.existsSync(getDomainLogPath(domain)) &&
      !options.logPath
    ) {
      console.log(
        chalk.yellow(`No specific log file found for domain: ${domain}`)
      );

      // Try to create domain directory structure and suggest reloading Caddy
      const domainDir = getDomainDir(domain);
      const domainLogsDir = getDomainLogsDir(domain);

      if (!fs.existsSync(domainDir)) {
        shell.mkdir('-p', domainDir);
        console.log(chalk.green(`Created domain directory at ${domainDir}`));
      }

      if (!fs.existsSync(domainLogsDir)) {
        shell.mkdir('-p', domainLogsDir);
        console.log(
          chalk.green(`Created domain logs directory at ${domainLogsDir}`)
        );
      }

      console.log(
        chalk.blue(
          `This domain may have been added before domain-specific logging was enabled.`
        )
      );
      console.log(
        chalk.green(
          `Falling back to global log file: ${logPath || DEFAULT_LOG_FILE}`
        )
      );
      console.log(
        chalk.yellow(
          `Consider updating your Caddyfile to use domain-specific logging:`
        )
      );
      console.log(
        chalk.green(`
${domain} {
  log {
    output file ${getDomainLogPath(domain)}
    format console
  }
  ...other directives...
}
      `)
      );
      console.log(
        chalk.yellow(
          `Then reload Caddy with: caddy reload --config ${CADDYFILE_PATH}`
        )
      );
    }

    // If no log file found
    if (!logPath || !fs.existsSync(logPath)) {
      console.log(chalk.red('No Caddy log file found.'));
      console.log(
        chalk.yellow(
          'Caddy logs have been configured but the log file does not exist yet.'
        )
      );
      console.log(
        chalk.blue(
          "This usually means Caddy needs to be restarted or hasn't received any requests."
        )
      );
      console.log(chalk.yellow('Try restarting Caddy:'));
      console.log(chalk.green('cpm stop && cpm start'));
      return;
    }

    // Prepare commands
    const tailArgs = options.follow
      ? ['-f', logPath]
      : ['-n', options.lines, logPath];
    const grepArgs =
      domain && logPath !== getDomainLogPath(domain) ? ['-i', domain] : [];

    console.log(
      chalk.yellow(
        `Showing logs${domain ? ` for ${domain}` : ''} from ${logPath}...`
      )
    );

    // Start the tail process
    const tail = spawn('tail', tailArgs);
    let lastProcess = tail;

    // Start the grep process if needed
    let grep;
    if (grepArgs.length > 0) {
      grep = spawn('grep', grepArgs);
      lastProcess.stdout.pipe(grep.stdin);
      lastProcess = grep;
    }

    // Pipe the final output to the main process stdout
    lastProcess.stdout.pipe(process.stdout);

    // Handle errors
    tail.stderr.on('data', (data) =>
      console.error(chalk.red(`Tail error: ${data}`))
    );
    if (grep)
      grep.stderr.on('data', (data) =>
        console.error(chalk.red(`Grep error: ${data}`))
      );

    // Handle process exits
    const cleanup = () => {
      if (!tail.killed) tail.kill();
      if (grep && !grep.killed) grep.kill();
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    lastProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(chalk.red(`Log process exited with code ${code}`));
      }
      cleanup(); // Ensure all processes are killed on exit
    });
  });

// Command: Enable logs for a domain
program
  .command('logs:enable <domain>')
  .description('Enable domain-specific logs')
  .action((domain) => {
    try {
      // Read the Caddyfile content
      let caddyfileContent = fs.readFileSync(CADDYFILE_PATH, 'utf-8');

      // Extract the domain's block from the Caddyfile
      const domainRegex = new RegExp(`(${domain}\\s*\\{[^}]*\\})`, 's');
      const match = caddyfileContent.match(domainRegex);

      if (!match) {
        console.log(chalk.red(`Domain "${domain}" not found in Caddyfile.`));
        return;
      }

      const domainBlock = match[1];

      // Check if log directive already exists
      if (domainBlock.includes('log {')) {
        console.log(
          chalk.blue(`Domain ${domain} already has logging configured.`)
        );
        return;
      }

      // Create domain logs directory if it doesn't exist
      const domainDir = getDomainDir(domain);
      const domainLogsDir = getDomainLogsDir(domain);
      const domainLogPath = getDomainLogPath(domain);

      if (!fs.existsSync(domainDir)) {
        shell.mkdir('-p', domainDir);
        console.log(chalk.green(`Created domain directory at ${domainDir}`));
      }

      if (!fs.existsSync(domainLogsDir)) {
        shell.mkdir('-p', domainLogsDir);
        console.log(
          chalk.green(`Created domain logs directory at ${domainLogsDir}`)
        );
      }

      // Add log directive right after domain declaration
      const updatedBlock = domainBlock.replace(
        new RegExp(`(${domain}\\s*\\{)`, 's'),
        `$1\n  log {\n    output file ${domainLogPath}\n    format console\n  }`
      );

      // Replace the old block with the updated one
      caddyfileContent = caddyfileContent.replace(domainRegex, updatedBlock);
      fs.writeFileSync(CADDYFILE_PATH, caddyfileContent);

      console.log(chalk.green(`Enabling logs for domain: ${domain}`));
      console.log(
        chalk.green(`Domain logs will be written to ${domainLogPath}`)
      );

      // Format and reload Caddy
      reloadCaddy();
    } catch (error) {
      console.error(
        chalk.red(`Error enabling logs for domain ${domain}: ${error.message}`)
      );
    }
  });

// Command: Disable logs for a domain
program
  .command('logs:disable <domain>')
  .description('Disable domain-specific logs')
  .action((domain) => {
    try {
      // Read the Caddyfile content
      let caddyfileContent = fs.readFileSync(CADDYFILE_PATH, 'utf-8');

      // Extract the domain's block from the Caddyfile
      const domainRegex = new RegExp(`(${domain}\\s*\\{[^}]*\\})`, 's');
      const match = caddyfileContent.match(domainRegex);

      if (!match) {
        console.log(chalk.red(`Domain "${domain}" not found in Caddyfile.`));
        return;
      }

      const domainBlock = match[1];

      // Check if log directive exists
      if (!domainBlock.includes('log {')) {
        console.log(
          chalk.blue(`Domain ${domain} does not have logging configured.`)
        );
        return;
      }

      // Remove log directive
      const updatedBlock = domainBlock.replace(/\s*log\s*\{[^}]*\}/s, '');

      // Replace the old block with the updated one
      caddyfileContent = caddyfileContent.replace(domainRegex, updatedBlock);
      fs.writeFileSync(CADDYFILE_PATH, caddyfileContent);

      console.log(chalk.yellow(`Disabling logs for domain: ${domain}`));

      // Format and reload Caddy
      reloadCaddy();
    } catch (error) {
      console.error(
        chalk.red(`Error disabling logs for domain ${domain}: ${error.message}`)
      );
    }
  });

// Command: Add multiple proxies from a YAML file
program
  .command('bulk')
  .description('Add multiple proxies from a YAML file')
  .option('-f, --file <file>', 'YAML file with proxy configurations')
  .action((options) => {
    if (!options.file) {
      console.error(
        chalk.red('Please specify a YAML file using --file option.')
      );
      return;
    }

    try {
      if (!fs.existsSync(options.file)) {
        console.error(chalk.red(`File not found: ${options.file}`));
        return;
      }

      const fileContents = fs.readFileSync(options.file, 'utf8');
      const config = yaml.load(fileContents);

      if (!config.proxies || !Array.isArray(config.proxies)) {
        console.error(
          chalk.red(
            'Invalid configuration file format. Expected "proxies" array.'
          )
        );
        return;
      }

      console.log(chalk.blue(`Adding ${config.proxies.length} proxies...`));

      config.proxies.forEach((proxy) => {
        if (!proxy.domain || !proxy.port) {
          console.error(
            chalk.red(`Skipping invalid proxy: ${JSON.stringify(proxy)}`)
          );
          return;
        }

        const cmdOptions = { customCert: proxy.useCustomCert };
        program.commands
          .find((cmd) => cmd._name === 'add')
          ._actionHandler(proxy.domain, proxy.port, cmdOptions);
      });

      console.log(chalk.green('Bulk operation completed.'));
    } catch (error) {
      console.error(
        chalk.red(`Failed to process bulk operation: ${error.message}`)
      );
    }
  });

// Command: Enhanced status command
program
  .command('status')
  .description('Show detailed Caddy server status')
  .action(() => {
    try {
      // Check if Caddy is running
      const result = shell.exec('pgrep -x caddy', { silent: true });

      if (result.code !== 0) {
        console.log(chalk.red('Caddy is not running.'));
        return;
      }

      // Get process information
      const processInfo = getCaddyProcessInfo();

      if (!processInfo) {
        console.log(chalk.red('Could not retrieve Caddy process information.'));
        return;
      }

      // Get active connections
      const connections = getCaddyConnections();

      // Create status table
      const table = new Table();

      table.push(
        { Status: chalk.green('RUNNING') },
        { PID: processInfo.pid },
        { Uptime: processInfo.uptime },
        { 'Memory Usage': processInfo.memory },
        { 'Active Connections': connections },
        { Caddyfile: CADDYFILE_PATH }
      );

      console.log(table.toString());

      // Show proxy count
      const proxies = parseProxyConfigs();
      console.log(chalk.blue(`Managing ${proxies.length} proxies.`));
    } catch (error) {
      console.error(
        chalk.red('Error while checking Caddy status:'),
        error.message
      );
    }
  });

// Setup command completion
program
  .command('completion')
  .description('Generate shell completion script')
  .option('--no-install', 'Generate script without installing it')
  .action((options) => {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const completionPath = path.join(__dirname, 'completion.sh');

    // Generate completion script
    const completionScript = `
# cpm shell completion
_cpm_completion() {
  local cur prev opts
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  
  # Basic commands
  opts="add backup bulk completion help logs logs:enable logs:disable ls ports restore rm start status stop"
  
  # Complete command options based on the command
  case "\${prev}" in
    add)
      # No completion for domain, it's user input
      return 0
      ;;
    rm)
      # Attempt to complete domain from Caddyfile
      local domains=$(grep -o '^[^ ]*' ${CADDYFILE_PATH} | grep -v '^$')
      COMPREPLY=( $(compgen -W "\${domains}" -- \${cur}) )
      return 0
      ;;
    logs|logs:enable|logs:disable)
      local domains=$(grep -o '^[^ ]*' ${CADDYFILE_PATH} | grep -v '^$')
      COMPREPLY=( $(compgen -W "\${domains}" -- \${cur}) )
      return 0
      ;;
    *)
      ;;
  esac
  
  COMPREPLY=( $(compgen -W "\${opts}" -- \${cur}) )
  return 0
}

complete -F _cpm_completion cpm
`;

    fs.writeFileSync(completionPath, completionScript, 'utf8');
    console.log(
      chalk.green(`Completion script generated at: ${completionPath}`)
    );

    // If the install option is false, just print instructions and exit
    if (!options.install) {
      console.log(chalk.yellow('Add the following line to your shell config:'));
      console.log(chalk.blue(`source ${completionPath}`));
      return;
    }

    // Detect user's shell
    const userShell = process.env.SHELL || '/bin/bash';
    const shellName = path.basename(userShell);

    // Determine the appropriate config file
    let configFile;
    let shellConfigFiles = {
      bash: ['.bashrc', '.bash_profile'],
      zsh: ['.zshrc'],
      fish: ['.config/fish/config.fish'],
    };

    let configFiles = shellConfigFiles[shellName] || ['.bashrc'];

    // Find the first existing config file
    for (const file of configFiles) {
      const fullPath = path.join(process.env.HOME, file);
      if (fs.existsSync(fullPath)) {
        configFile = fullPath;
        break;
      }
    }

    if (!configFile) {
      console.log(
        chalk.red(`Could not find config file for ${shellName}. Using default.`)
      );
      configFile = path.join(process.env.HOME, configFiles[0]);
    }

    // Line to add to config
    const sourceLine = `source ${completionPath}`;

    try {
      // Check if line already exists in config
      let configContent = '';
      if (fs.existsSync(configFile)) {
        configContent = fs.readFileSync(configFile, 'utf8');
      }

      if (configContent.includes(sourceLine)) {
        console.log(
          chalk.green(`Completion already installed in ${configFile}`)
        );
        return;
      }

      // Add the line to the config file
      const appendContent = `\n# Added by caddy-proxy-manager\n${sourceLine}\n`;
      fs.appendFileSync(configFile, appendContent, 'utf8');

      console.log(chalk.green(`✅ Completion installed in ${configFile}`));
      console.log(
        chalk.yellow(`To use completion in current shell, run: ${sourceLine}`)
      );
    } catch (error) {
      console.error(chalk.red(`Error installing completion: ${error.message}`));
      console.log(
        chalk.yellow('Add the following line to your shell config manually:')
      );
      console.log(chalk.blue(sourceLine));
    }
  });

// Parse arguments
program.parse(process.argv);
