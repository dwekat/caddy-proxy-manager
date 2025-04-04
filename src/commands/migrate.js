import { program } from 'commander';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { migrateToJson } from '../utils/config.js';

program
  .command('migrate')
  .description('Migrate from legacy Caddyfile format to JSON format')
  .argument('<caddyfile>', 'Path to the legacy Caddyfile')
  .action((caddyfile) => {
    try {
      // Read the legacy Caddyfile
      const caddyfileContent = fs.readFileSync(caddyfile, 'utf8');
      
      // Migrate to JSON format
      migrateToJson(caddyfileContent);
      
      console.log(chalk.green('✓ Successfully migrated Caddyfile to JSON format'));
    } catch (error) {
      console.error(chalk.red(`Failed to migrate Caddyfile: ${error.message}`));
      process.exit(1);
    }
  }); 