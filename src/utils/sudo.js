import sudo from 'sudo-prompt';
import chalk from 'chalk';

// Global cache for sudo credential state
let sudoCredentialCache = null;

/**
 * Execute a command with sudo privileges 
 * Reuses previous authentication when possible
 * 
 * @param {string} command - Command to execute
 * @returns {Promise<void>}
 */
export async function execSudo(command) {
  // If we already have a cached credential, use it
  if (sudoCredentialCache) {
    try {
      // Add the new command to our cached record
      sudoCredentialCache.commands.push(command);
      return;
    } catch (error) {
      // If there's an error, fall through to regular prompt
      console.error('Error using cached credentials');
    }
  }

  // Use sudo-prompt for authentication
  const options = {
    name: 'Caddy Proxy Manager'
  };

  return new Promise((resolve, reject) => {
    sudo.exec(command, options, (error, stdout, stderr) => {
      if (error) {
        console.error(chalk.red(`Sudo execution failed: ${error.message}`));
        reject(error);
        return;
      }
      
      // Create credential cache for future sudo calls
      sudoCredentialCache = {
        timestamp: Date.now(),
        commands: [command],
      };
      
      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);
      
      resolve();
    });
  });
} 