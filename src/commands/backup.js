import { program } from 'commander';
import chalk from 'chalk';
import { DEFAULT_BACKUP_PATH } from '../config/constants.js';
import { saveProxyConfigs } from '../utils/file.js';

program
  .command('backup')
  .description('Backup proxies to a YAML file')
  .option('-o, --out <file>', 'Output file path', DEFAULT_BACKUP_PATH)
  .action(async (options) => {
    try {
      await saveProxyConfigs(options.out);
    } catch (error) {
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  }); 