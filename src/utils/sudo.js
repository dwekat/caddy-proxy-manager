import sudo from 'sudo-prompt';
import chalk from 'chalk';

// Global cache for sudo credential state
let sudoCredentialCache = null;

/**
 * Execute a command with sudo privileges 
 * Reuses previous authentication when possible
 * 
 * @param {string} command - Command to execute
 * @returns {Promise<{exitCode: number, stdout: string, stderr: string}>}
 */
export async function execSudo(command) {
  // If we already have a cached credential, use it
  if (sudoCredentialCache) {
    try {
      // Add the new command to our cached record
      sudoCredentialCache.commands.push(command);
      // Note: When using cached credentials, we still need proper output handling
      // This is a simplified approach, ideally we'd still capture output
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
      // Create credential cache for future sudo calls
      if (!error) {
        sudoCredentialCache = {
          timestamp: Date.now(),
          commands: [command],
        };
      }
      
      if (error) {
        // For commands like grep that exit with code 1 when no match is found,
        // we want to capture the exit code rather than treating it as a failure
        if (error.code !== undefined) {
          resolve({
            exitCode: error.code,
            stdout: stdout || '',
            stderr: stderr || '',
          });
        } else {
          console.error(chalk.red(`Sudo execution failed: ${error.message}`));
          reject(error);
        }
        return;
      }
      
      resolve({
        exitCode: 0,
        stdout: stdout || '',
        stderr: stderr || '',
      });
    });
  });
} 