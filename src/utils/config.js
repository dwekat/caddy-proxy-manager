import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { CADDY_CONFIG_PATH, DEFAULT_CONFIG } from '../config/constants.js';

/**
 * Ensures the Caddy config file exists with default configuration
 */
export function ensureConfig() {
  const configDir = path.dirname(CADDY_CONFIG_PATH);

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  if (!fs.existsSync(CADDY_CONFIG_PATH)) {
    fs.writeFileSync(
      CADDY_CONFIG_PATH,
      JSON.stringify(DEFAULT_CONFIG, null, 2)
    );
    return DEFAULT_CONFIG;
  }

  // Clean up any stale certificate references
  cleanupCertificateReferences();

  return readConfig();
}

/**
 * Reads and parses the Caddy config file
 * @returns {Object} The parsed configuration
 */
export function readConfig() {
  try {
    if (!fs.existsSync(CADDY_CONFIG_PATH)) {
      return DEFAULT_CONFIG;
    }
    const config = JSON.parse(fs.readFileSync(CADDY_CONFIG_PATH, 'utf8'));
    return config;
  } catch (error) {
    throw new Error(`Failed to read config: ${error.message}`);
  }
}

/**
 * Writes configuration to the Caddy config file
 * @param {Object} config - The configuration to write
 */
export function writeConfig(config) {
  try {
    fs.writeFileSync(CADDY_CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (error) {
    throw new Error(`Failed to write config: ${error.message}`);
  }
}

/**
 * Cleans up any stale certificate references in the config
 */
export function cleanupCertificateReferences() {
  try {
    const config = readConfig();

    // If there's no TLS configuration, nothing to clean up
    if (!config?.apps?.tls?.certificates?.load_files) {
      return;
    }

    const loadFiles = config.apps.tls.certificates.load_files;

    // If load_files isn't an array or is empty, nothing to clean up
    if (!Array.isArray(loadFiles) || loadFiles.length === 0) {
      return;
    }

    // Filter out certificates where files don't exist
    const validCerts = loadFiles.filter((cert) => {
      if (!cert.certificate || !cert.key) {
        return false;
      }

      return fs.existsSync(cert.certificate) && fs.existsSync(cert.key);
    });

    // If any certs were filtered out, update the config
    if (validCerts.length !== loadFiles.length) {
      console.log(
        chalk.yellow(
          `Cleaned up ${loadFiles.length - validCerts.length} stale certificate references`
        )
      );
      config.apps.tls.certificates.load_files = validCerts;
      writeConfig(config);
    }
  } catch (error) {
    console.error(
      chalk.red(`Error cleaning up certificates: ${error.message}`)
    );
  }
}

/**
 * Creates a route configuration for a domain
 * @param {string} domain - Domain name
 * @param {number} port - Target port
 * @param {Object} options - Additional options
 * @returns {Object} Route configuration
 */
export function createRouteConfig(domain, port) {
  const route = {
    match: [
      {
        host: [domain],
      },
    ],
    handle: [
      {
        handler: 'reverse_proxy',
        upstreams: [
          {
            dial: `127.0.0.1:${port}`,
          },
        ],
      },
    ],
    terminal: true,
  };

  return route;
}

/**
 * Converts legacy Caddyfile format to JSON config
 * @param {string} caddyfileContent - Content of the legacy Caddyfile
 * @returns {Object} JSON configuration
 */
export function convertToJsonConfig(caddyfileContent) {
  const config = {
    logging: {
      logs: {
        default: {
          encoder: {
            format: 'console',
          },
          writer: {
            output: 'file',
            filename: path.join(
              process.env.HOME,
              '.caddy',
              'logs',
              'access.log'
            ),
          },
        },
      },
    },
    apps: {
      http: {
        servers: {
          main: {
            listen: [':443'],
            routes: [],
            logs: {
              default_logger_name: 'default',
            },
            automatic_https: {
              disable: false,
            },
          },
        },
      },
    },
  };

  // Split the Caddyfile content into blocks
  const blocks = caddyfileContent.split(/\n\n+/);

  // Process each block
  blocks.forEach((block) => {
    // Skip global config block
    if (block.trim().startsWith('{')) {
      return;
    }

    // Extract domain and port
    const domainMatch = block.match(/^(\S+)\s*{/);
    const portMatch = block.match(/reverse_proxy http:\/\/127\.0\.0\.1:(\d+)/);

    if (domainMatch && portMatch) {
      const domain = domainMatch[1];
      const port = parseInt(portMatch[1], 10);

      // Create route config
      const route = createRouteConfig(domain, port);
      config.apps.http.servers.main.routes.push(route);
    }
  });

  return config;
}

/**
 * Migrates from legacy Caddyfile to JSON format
 * @param {string} caddyfileContent - Content of the legacy Caddyfile
 */
export function migrateToJson(caddyfileContent) {
  const config = convertToJsonConfig(caddyfileContent);
  writeConfig(config);
}

/**
 * Gets all configured proxies
 * @returns {Array<Object>} Array of proxy configurations
 */
export function getProxies() {
  const config = readConfig();
  if (!config?.apps?.http?.servers?.main?.routes) {
    return [];
  }

  const routes = config.apps.http.servers.main.routes;

  // Get custom certificates with their tags
  const customCerts = {};
  const loadFiles = config?.apps?.tls?.certificates?.load_files || [];

  if (Array.isArray(loadFiles) && loadFiles.length > 0) {
    loadFiles.forEach((cert) => {
      if (cert.tags && Array.isArray(cert.tags)) {
        cert.tags.forEach((tag) => {
          customCerts[tag] = true;
        });
      }
    });
  }

  return routes
    .map((route) => {
      const domain = route.match[0].host[0];
      const reversProxyHandler = route.handle.find(
        (h) => h.handler === 'reverse_proxy'
      );

      if (
        !reversProxyHandler ||
        !reversProxyHandler.upstreams ||
        reversProxyHandler.upstreams.length === 0
      ) {
        return null;
      }

      const port = reversProxyHandler.upstreams[0].dial.split(':')[1];
      const hasCustomCert = customCerts[domain] || false;

      return {
        domain,
        port: parseInt(port, 10),
        ssl: hasCustomCert ? 'custom' : 'auto',
      };
    })
    .filter(Boolean);
}

/**
 * Checks if a domain already exists in the Caddy configuration
 * @param {string} domain - Domain name to check
 * @returns {boolean} True if domain exists, false otherwise
 */
export function domainExistsInConfig(domain) {
  const config = readConfig();
  if (!config?.apps?.http?.servers?.main?.routes) {
    return false;
  }

  const routes = config.apps.http.servers.main.routes;
  return routes.some(
    (route) =>
      route.match &&
      Array.isArray(route.match) &&
      route.match[0]?.host &&
      Array.isArray(route.match[0].host) &&
      route.match[0].host.includes(domain)
  );
}

/**
 * Adds a new proxy configuration
 * @param {string} domain - Domain name
 * @param {number} port - Target port
 * @param {Object} options - Additional options
 * @returns {boolean} True if proxy was added, false if it already exists
 */
export function addProxy(domain, port, options = {}) {
  // First check if domain already exists
  if (domainExistsInConfig(domain)) {
    console.log(
      chalk.yellow(`Domain ${domain} already exists in Caddy configuration.`)
    );
    return false;
  }

  const config = readConfig();
  const route = createRouteConfig(domain, port, options);

  // Add the route to the configuration
  config.apps.http.servers.main.routes.push(route);

  // Add TLS configuration if certificate and key paths are provided
  if (options.tlsCertPath && options.tlsKeyPath) {
    // Ensure the TLS app configuration exists
    if (!config.apps.tls) {
      config.apps.tls = {};
    }

    if (!config.apps.tls.certificates) {
      config.apps.tls.certificates = {};
    }

    // Create certificate config for this domain
    const certConfig = {
      certificate: options.tlsCertPath,
      key: options.tlsKeyPath,
      tags: [domain],
    };

    // Get existing certificates or initialize an empty array
    let loadFiles = config.apps.tls.certificates.load_files || [];

    // If load_files isn't an array, initialize it
    if (!Array.isArray(loadFiles)) {
      loadFiles = [];
    }

    // Add the new certificate to the array of certificates
    loadFiles.push(certConfig);

    // Update the configuration
    config.apps.tls.certificates.load_files = loadFiles;
  }

  writeConfig(config);
  return true;
}

/**
 * Removes a proxy configuration
 * @param {string} domain - Domain to remove
 * @returns {boolean} True if proxy was found and removed
 */
export function removeProxy(domain) {
  const config = readConfig();
  const routes = config.apps.http.servers.main.routes;
  const initialLength = routes.length;

  const filteredRoutes = routes.filter(
    (route) => route.match[0].host[0] !== domain
  );

  let domainRemoved = filteredRoutes.length !== initialLength;

  if (domainRemoved) {
    // Update the routes
    config.apps.http.servers.main.routes = filteredRoutes;

    // Also remove any TLS certificate entries for this domain
    if (config.apps?.tls?.certificates?.load_files) {
      const loadFiles = config.apps.tls.certificates.load_files;

      if (Array.isArray(loadFiles) && loadFiles.length > 0) {
        // Filter out any certificate entries that contain this domain in their tags
        config.apps.tls.certificates.load_files = loadFiles.filter(
          (cert) =>
            !cert.tags ||
            !Array.isArray(cert.tags) ||
            !cert.tags.includes(domain)
        );
      }
    }

    writeConfig(config);
  }

  return domainRemoved;
}

/**
 * Enables logging for a domain
 * @param {string} domain - Domain name
 * @returns {boolean} Whether the domain was found and updated
 */
export function enableDomainLogging(domain) {
  const config = readConfig();
  const routes = config.apps.http.servers.main.routes;
  let found = false;

  routes.forEach((route) => {
    const hosts = route.match?.[0]?.host || [];
    if (hosts.includes(domain)) {
      if (!route.handle.some((h) => h.handler === 'logging')) {
        route.handle.unshift({
          handler: 'logging',
          writer: {
            output: 'file',
            filename: path.join(
              process.env.HOME,
              '.caddy',
              domain,
              'logs',
              'access.log'
            ),
          },
          format: 'console',
        });
        found = true;
      }
    }
  });

  if (found) {
    writeConfig(config);
  }
  return found;
}

/**
 * Disables logging for a domain
 * @param {string} domain - Domain name
 * @returns {boolean} Whether the domain was found and updated
 */
export function disableDomainLogging(domain) {
  const config = readConfig();
  const routes = config.apps.http.servers.main.routes;
  let found = false;

  routes.forEach((route) => {
    const hosts = route.match?.[0]?.host || [];
    if (hosts.includes(domain)) {
      const loggingIndex = route.handle.findIndex(
        (h) => h.handler === 'logging'
      );
      if (loggingIndex !== -1) {
        route.handle.splice(loggingIndex, 1);
        found = true;
      }
    }
  });

  if (found) {
    writeConfig(config);
  }
  return found;
}

/**
 * Updates or adds a TLS certificate configuration for an existing domain
 * @param {string} domain - The domain to update
 * @param {string} certPath - Path to the certificate file
 * @param {string} keyPath - Path to the certificate key file
 * @returns {boolean} Whether the domain was found and updated
 */
export function updateDomainCert(domain, certPath, keyPath) {
  const config = readConfig();
  const routes = config.apps.http.servers.main.routes;
  let found = false;

  // Check if the domain exists in any route
  routes.forEach((route) => {
    const hosts = route.match?.[0]?.host || [];
    if (hosts.includes(domain)) {
      found = true;
    }
  });

  if (found) {
    // Ensure the TLS app configuration exists
    if (!config.apps.tls) {
      config.apps.tls = {};
    }

    if (!config.apps.tls.certificates) {
      config.apps.tls.certificates = {};
    }

    // Create our certificate configuration
    const certConfig = {
      certificate: certPath,
      key: keyPath,
      tags: [domain],
    };

    // Get existing certificates
    let loadFiles = config.apps.tls.certificates.load_files || [];

    // If load_files isn't an array, initialize it
    if (!Array.isArray(loadFiles)) {
      loadFiles = [];
    }

    // Filter out any existing certificates for this domain
    loadFiles = loadFiles.filter(
      (cert) => !cert.tags || !cert.tags.includes(domain)
    );

    // Add the new certificate
    loadFiles.push(certConfig);

    // Update the configuration
    config.apps.tls.certificates.load_files = loadFiles;

    writeConfig(config);
  }

  return found;
}
