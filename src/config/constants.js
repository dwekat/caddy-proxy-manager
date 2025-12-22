import path from 'path';

// Core paths
export const CADDY_CONFIG_PATH = path.join(
  process.env.HOME,
  '.caddy',
  'Caddyfile.json'
);
export const HOSTS_FILE = '/etc/hosts';
export const CERTS_PATH = path.join(process.env.HOME, '.caddy', 'certs');
export const LOGS_PATH = path.join(process.env.HOME, '.caddy', 'logs');

// Default paths
export const DEFAULT_BACKUP_PATH = './cpm-backup.yml';
export const DEFAULT_LOG_FILE = path.join(LOGS_PATH, 'access.log');

// Host block markers
export const HOSTS_BLOCK_START = '# cpm-managed block - start';
export const HOSTS_BLOCK_END = '# cpm-managed block - end';

// Default Caddy JSON configuration
export const DEFAULT_CONFIG = {
  logging: {
    logs: {
      default: {
        encoder: {
          format: 'console',
        },
        writer: {
          output: 'file',
          filename: path.join(LOGS_PATH, 'access.log'),
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

// Table configurations
export const TABLE_CONFIG = {
  chars: {
    top: '',
    'top-mid': '',
    'top-left': '',
    'top-right': '',
    bottom: '',
    'bottom-mid': '',
    'bottom-left': '',
    'bottom-right': '',
    left: '',
    'left-mid': '',
    mid: '',
    'mid-mid': '',
    right: '',
    'right-mid': '',
    middle: ' ',
  },
  style: {
    'padding-left': 0,
    'padding-right': 2,
  },
};
