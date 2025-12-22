import shell from 'shelljs';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { CERTS_PATH } from '../config/constants.js';

/**
 * Checks if mkcert is installed
 * @throws {Error} If mkcert is not installed
 */
export function checkMkcert() {
  if (!shell.which('mkcert')) {
    throw new Error('mkcert is not installed');
  }
}

/**
 * Ensures mkcert's local CA is installed
 * @throws {Error} If local CA is not installed
 */
export function ensureLocalCA() {
  const certPath = path.join(
    shell.env.HOME,
    'Library/Application Support/mkcert'
  );
  if (!fs.existsSync(certPath)) {
    throw new Error('mkcert local CA is not installed. Run: mkcert -install');
  }
}

/**
 * Generates SSL certificates for a domain using mkcert
 * @param {string} domain - The domain to generate certificates for
 * @returns {Object} Object containing paths to the certificate and key files
 */
export function generateCertificates(domain) {
  try {
    checkMkcert();
    ensureLocalCA();

    const certPath = path.join(CERTS_PATH, `${domain}.pem`);
    const certKeyPath = path.join(CERTS_PATH, `${domain}-key.pem`);

    // Create certs directory if it doesn't exist
    if (!fs.existsSync(CERTS_PATH)) {
      shell.mkdir('-p', CERTS_PATH);
    }

    // Generate certificates if they don't exist
    if (!fs.existsSync(certPath) || !fs.existsSync(certKeyPath)) {
      console.log(chalk.yellow(`Generating certificate for ${domain}...`));
      const result = shell.exec(
        `mkcert -cert-file ${certPath} -key-file ${certKeyPath} ${domain}`
      );

      if (result.code !== 0) {
        throw new Error(`Failed to generate certificates: ${result.stderr}`);
      }
    }

    return {
      cert: certPath,
      key: certKeyPath,
    };
  } catch (error) {
    throw new Error(`SSL Certificate generation failed: ${error.message}`);
  }
}

/**
 * Removes SSL certificates for a domain
 * @param {string} domain - The domain to remove certificates for
 */
export function removeCertificates(domain) {
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
}

/**
 * Validates all certificates referenced in a Caddyfile
 * @param {string} caddyfileContent - Content of the Caddyfile
 * @returns {boolean} True if all certificates exist, false otherwise
 */
export function validateCertificates(caddyfileContent) {
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
