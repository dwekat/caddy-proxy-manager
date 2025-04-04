#!/usr/bin/env node

import { execSudo } from './utils/sudo.js';
import chalk from 'chalk';

async function testSudoExec() {
  console.log(chalk.blue('Testing sudo execution with credential caching...'));
  
  try {
    // First command - will prompt for auth
    console.log(chalk.yellow('First sudo command (will prompt for auth):'));
    await execSudo('echo "First command executed with sudo"');
    
    // Wait a moment
    console.log(chalk.cyan('\nWaiting 2 seconds...'));
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Second command - should NOT prompt again
    console.log(chalk.yellow('\nSecond sudo command (should NOT prompt again):'));
    await execSudo('echo "Second command executed with sudo"');
    
    console.log(chalk.green('\nTest completed!'));
    console.log(chalk.cyan('If you were prompted only once, our fix worked correctly.'));
  } catch (error) {
    console.error(chalk.red(`Test failed: ${error.message}`));
  }
}

testSudoExec();