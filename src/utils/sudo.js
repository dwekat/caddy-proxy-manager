import { spawn } from 'child_process';
import chalk from 'chalk';
import readline from 'readline';

// Track if we've authenticated with sudo recently
let sudoAuthenticated = false;

/**
 * Execute a command with sudo privileges using native Node.js
 * 
 * @param {string} command - Command to execute
 * @returns {Promise<{exitCode: number, stdout: string, stderr: string}>}
 */
export async function execSudo(command) {
  return new Promise((resolve, reject) => {
    // Use the shell option to support complex commands with pipes, redirects, etc.
    const sudoProcess = spawn('sudo', ['-S', 'sh', '-c', command], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    // Collect stdout
    sudoProcess.stdout.on('data', (data) => {
      const str = data.toString();
      stdout += str;
      // Log stdout in real-time for debugging
      process.stdout.write(str);
    });
    
    // Collect stderr
    sudoProcess.stderr.on('data', (data) => {
      const str = data.toString();
      stderr += str;
      
      // If the process is asking for a password and we haven't authenticated
      if (str.toLowerCase().includes('password') && !sudoAuthenticated) {
        // Create interface to prompt user for password
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        // Use a more secure password prompt
        rl.question('Enter sudo password: ', (password) => {
          sudoProcess.stdin.write(password + '\n');
          sudoAuthenticated = true;
          rl.close();
        });
      } else {
        // Log other stderr messages
        process.stderr.write(str);
      }
    });
    
    // Handle process completion
    sudoProcess.on('close', (code) => {
      resolve({
        exitCode: code,
        stdout,
        stderr
      });
    });
    
    // Handle process errors
    sudoProcess.on('error', (error) => {
      console.error(chalk.red(`Sudo execution failed: ${error.message}`));
      reject(error);
    });
  });
} 