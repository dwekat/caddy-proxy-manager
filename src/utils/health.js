import ora from 'ora';
import chalk from 'chalk';

/**
 * Performs a health check on a domain
 * @param {string} domain - The domain to check
 * @returns {Promise<boolean>} True if domain is healthy, false otherwise
 */
export async function checkDomainHealth(domain) {
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
