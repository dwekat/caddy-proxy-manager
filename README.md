# Caddy Proxy Manager CLI (cpm)

`cpm` is a command-line tool for managing Caddy-based reverse proxies. It allows you to easily add, list, and remove proxies, handle SSL certificates with `mkcert`, and update your hosts file with `sudo` privileges.

## Features
- **List Proxies**: View all currently configured proxies.
- **Add Proxy**: Easily add a new proxy with SSL using `mkcert`.
- **Remove Proxy**: Remove a configured proxy and clean up associated entries.

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

#### 2. Add Proxy
Add a new proxy with a specified domain and target port. This command also handles SSL certificate generation and updates the `/etc/hosts` file.
```bash
cpm add <domain> <targetPort>
```
Example:
```bash
cpm add example.local 3000
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

## Configuration

By default, `cpm` uses the following paths:
- **Caddyfile**: `~/.caddy/Caddyfile`
- **Certificates**: `~/.caddy/certs/`

Make sure these paths exist and are accessible by `cpm`.

## Troubleshooting
- **mkcert not installed**: Make sure `mkcert` is installed and the local CA is set up.
  ```bash
  brew install mkcert && mkcert -install
  ```
- **Permission Issues**: The tool uses `sudo` to update the `/etc/hosts` file, so you may be prompted for your password.

## License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

---

Happy proxying! 🎉
