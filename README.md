# Caddy Proxy Manager CLI (cpm)

`cpm` is a command-line tool for managing Caddy-based reverse proxies. It allows you to easily add, list, and remove proxies, handle SSL certificates with `mkcert`, and update your hosts file with `sudo` privileges.

## Features
- **List Proxies**: View all currently configured proxies with health status.
- **Add Proxy**: Easily add a new proxy with SSL using `mkcert`.
- **Remove Proxy**: Remove a configured proxy and clean up associated entries.
- **Health Checks**: Check health status of your proxies.
- **Port Monitoring**: See which ports are in use and by which processes.
- **Backup & Restore**: Save and restore proxy configurations to YAML files.
- **Domain-Specific Directories**: Each domain gets its own directory with dedicated logs.
- **Bulk Operations**: Add multiple proxies at once from a YAML file.
- **Status Info**: View detailed Caddy process information.
- **Shell Completion**: Tab completion for commands and domains.
- **Log Management**: Enable or disable logs for specific domains.

## Prerequisites
- **[Caddy](https://caddyserver.com/)** should be installed and configured on your machine.
- **[mkcert](https://github.com/FiloSottile/mkcert)** should be installed to handle SSL certificate creation:
```bash
brew install mkcert && mkcert -install
```

## Installation
Install the package globally via npm:

```bash
npm install -g caddy-proxy-manager
```

After installation, the command `cpm` will be available globally on your machine.

## Usage

### Commands
Below are the available commands for `cpm`:

#### 1. List Proxies
View all currently configured proxies in your Caddyfile.
```bash
cpm ls
```

With health check:
```bash
cpm ls --health
```

#### 2. Add Proxy
Add a new proxy with a specified domain and target port. This command also handles SSL certificate generation and updates the `/etc/hosts` file.
```bash
cpm add <domain> <targetPort>
```
Example:
```bash
cpm add example.local 3000
```

With custom certificate:
```bash
cpm add example.local 3000 --custom-cert
```

#### 3. Remove Proxy
Remove an existing proxy by specifying the domain. This will also remove the entry from the hosts file.
```bash
cpm rm <domain>
```
Example:
```bash
cpm rm example.local
```

#### 4. Backup Proxies
Backup all proxy configurations to a YAML file.
```bash
cpm backup
```

With custom output path:
```bash
cpm backup -o /path/to/backup.yml
```

#### 5. Restore Proxies
Restore proxy configurations from a backup file.
```bash
cpm restore
```

From specific file:
```bash
cpm restore -f /path/to/backup.yml
```

#### 6. Check Port Status
View the status of ports used by your proxies.
```bash
cpm ports
```

#### 7. View Logs
View Caddy logs, optionally filtered by domain.
```bash
cpm logs
```

For a specific domain:
```bash
cpm logs example.local
```

Follow logs:
```bash
cpm logs -f
```

#### 8. Enable or Disable Logs for a Domain
Enable or disable logging for a specific domain.
```bash
cpm logs-toggle example.local
```

Disable logs for a domain:
```bash
cpm logs-toggle example.local --disable
```

#### 9. Bulk Operations
Add multiple proxies from a YAML configuration file.
```bash
cpm bulk -f proxies.yml
```

Example `proxies.yml`:
```yaml
proxies:
  - domain: example1.local
    port: 3000
    useCustomCert: true
  - domain: example2.local
    port: 3001
```

#### 10. Server Status
Check detailed Caddy server status.
```bash
cpm status
```

#### 11. Shell Completion
Generate and install shell completion automatically:
```bash
cpm completion
```

Generate without installing:
```bash
cpm completion --no-install
```

The completion script will be automatically added to your shell configuration file (`.bashrc`, `.zshrc`, or `config.fish`) based on your current shell. You'll need to restart your shell or source the config file for the changes to take effect.

#### 12. Start/Stop Caddy
Start Caddy in the background:
```bash
cpm start
```

Stop Caddy:
```bash
cpm stop
```

## Configuration

By default, `cpm` uses the following paths:
- **Caddyfile**: `~/.caddy/Caddyfile`
- **Certificates**: `~/.caddy/certs/`
- **Global Log**: `~/.caddy/logs/access.log`
- **Domain Directories**: `~/.caddy/<domain>/` - Each domain gets its own directory
- **Domain Logs**: `~/.caddy/<domain>/logs/access.log` - Domain-specific logs

Make sure these paths exist and are accessible by `cpm`. The tool will create them automatically if they don't exist.

Logging is automatically configured in the Caddyfile, with each domain getting its own log file in its dedicated directory for better separation and debugging. The global log file captures general Caddy activity not specific to any domain.

## Troubleshooting
- **mkcert not installed**: Make sure `mkcert` is installed and the local CA is set up.
  ```bash
  brew install mkcert && mkcert -install
  ```
- **Permission Issues**: The tool uses `sudo` to update the `/etc/hosts` file, so you may be prompted for your password.
- **Logs not showing**: Ensure Caddy is configured to write logs to `/var/log/caddy/access.log` or update the log path in the source code.

## License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

---

Happy proxying! 🎉
