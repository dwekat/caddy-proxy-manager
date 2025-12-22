# Caddy Proxy Manager (cpm)

<a href="https://www.buymeacoffee.com/dwekat" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" width="217"></a>

A CLI tool to manage local reverse proxies using Caddy server. This tool makes it easy to:

- Add and remove proxy configurations
- Manage SSL certificates
- Monitor proxy status
- View and manage logs
- Backup and restore configurations

## Platform Support

**Currently supports:** macOS and Linux  
**Windows support:** Coming soon

## Prerequisites

- Node.js >= 18.0.0
- Caddy server installed
  - macOS: `brew install caddy`
  - Linux: See [Caddy installation guide](https://caddyserver.com/docs/install)
- mkcert installed for custom certificates
  - macOS: `brew install mkcert`
  - Linux: `sudo apt install mkcert` (Ubuntu/Debian) or `sudo dnf install mkcert` (Fedora)

## Installation

```bash
# Install globally
npm install -g caddy-proxy-manager

# Or install locally
npm install caddy-proxy-manager
```

## Usage

### Add a Proxy

```bash
# Add a proxy with Caddy's automatic HTTPS (default)
cpm add example.test 3000

# Add a proxy with mkcert-generated certificates
cpm add example.test 3000 --custom-cert
```

### Certificate Management

```bash
# Add or update certificate for an existing domain (uses mkcert by default)
cpm cert example.test

# Add or update with specific certificate files
cpm cert example.test --cert /path/to/cert.pem --key /path/to/key.pem
```

### Remove a Proxy

```bash
cpm rm example.test
```

### List Proxies

```bash
# List all proxies
cpm ls

# List with health check
cpm ls --health
```

### Check Port Status

```bash
cpm ports
```

### Manage Logs

```bash
# View global logs
cpm logs

# View domain-specific logs
cpm logs example.test

# Follow logs in real-time
cpm logs -f

# Show last N lines
cpm logs -n 100

# Enable domain-specific logging
cpm logs:enable example.test

# Disable domain-specific logging
cpm logs:disable example.test
```

### Backup and Restore

```bash
# Backup to default file (cpm-backup.yml)
cpm backup

# Backup to custom file
cpm backup -o my-backup.yml

# Restore from default file
cpm restore

# Restore from custom file
cpm restore -f my-backup.yml
```

### Bulk Operations

```bash
# Add multiple proxies from a YAML file
cpm bulk -f proxies.yml
```

Example `proxies.yml`:

```yaml
proxies:
  - domain: app1.test
    port: 3000
    useCustomCert: true
  - domain: app2.test
    port: 3001
    useCustomCert: false
```

### Server Management

```bash
# Start Caddy server
cpm start

# Stop Caddy server
cpm stop

# Check server status
cpm status
```

### Shell Completion

```bash
# Generate and install shell completion
cpm completion

# Generate without installing
cpm completion --no-install
```

## Development

```bash
# Clone the repository
git clone https://github.com/dwekat/caddy-proxy-manager.git
cd caddy-proxy-manager

# Install dependencies
npm install

# Run in development mode
npm run dev

# Run linter
npm run lint

# Format code
npm run format

# Run tests
npm test
```

## License

MIT
