import path from 'path';

// File paths
export const CADDYFILE_PATH = path.join(process.env.HOME, '.caddy', 'Caddyfile');
export const HOSTS_FILE = '/etc/hosts';
export const CERTS_PATH = path.join(process.env.HOME, '.caddy', 'certs');
export const LOGS_PATH = path.join(process.env.HOME, '.caddy', 'logs');
export const DEFAULT_BACKUP_PATH = './cpm-backup.yml';
export const DEFAULT_LOG_FILE = path.join(LOGS_PATH, 'access.log');

// Host block markers
export const HOSTS_BLOCK_START = '# cpm-managed block - start';
export const HOSTS_BLOCK_END = '# cpm-managed block - end';

// Table configurations
export const TABLE_CONFIG = {
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
}; 