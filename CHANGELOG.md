# caddy-proxy-manager

## 4.0.0

### Major Changes

- Raise minimum Node.js to 22.12 (required by commander 15).

  Runtime dependency upgrades: commander 11 -> 15, ora 7 -> 9, shelljs 0.8 -> 0.10,
  js-yaml 4.2. Dev tooling: eslint 10, jest 30, commitlint 21, lint-staged 17.
  Add a tag-triggered GitHub Actions workflow that publishes to npm with provenance.

## 3.0.0

### Major Changes

- Initial v2.0.0 release of caddy-proxy-manager CLI tool for managing local reverse proxies using Caddy.

  Features:
  - Add and remove proxy configurations
  - SSL certificate management with mkcert
  - Server management (start/stop/status)
  - Log viewing and management
  - Backup and restore configurations
  - Bulk operations
  - Shell completion support
  - macOS and Linux support

## 2.0.0

### Major Changes

- 8aefe42: Initial v1.0.0 release of caddy-proxy-manager CLI tool for managing local reverse proxies using Caddy.
