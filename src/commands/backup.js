import { program } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import yaml from 'js-yaml';
import { DEFAULT_BACKUP_PATH } from '../config/constants.js';
import { getProxies } from '../utils/config.js';

program
  .command('backup')
  .description('Backup proxies to a YAML file')
  .option('-o, --out <file>', 'Output file path', DEFAULT_BACKUP_PATH)
  .action((options) => {
    try {
      const proxies = getProxies();

      if (proxies.length === 0) {
        console.log(chalk.yellow('No proxies found to backup.'));
        return;
      }

      const backupData = {
        timestamp: new Date().toISOString(),
        proxies,
      };

      const yamlStr = yaml.dump(backupData);
      fs.writeFileSync(options.out, yamlStr, 'utf8');
      console.log(
        chalk.green(
          `Successfully backed up ${proxies.length} proxies to ${options.out}`
        )
      );
    } catch (error) {
      console.error(chalk.red(`Failed to backup proxies: ${error.message}`));
      process.exit(1);
    }
  });
