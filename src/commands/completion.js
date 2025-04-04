import { program } from 'commander';

program
  .command('completion')
  .description('Generate shell completion script')
  .option('-s, --shell <type>', 'Shell type (bash, zsh)', 'bash')
  .action((options) => {
    const shell = options.shell.toLowerCase();
    
    if (shell === 'bash') {
      console.log(`
# cpm completion script
_cpm_completion() {
  local cur prev words cword
  _get_comp_words_by_ref -n : cur prev words cword

  local commands="add backup bulk completion logs ports remove restore start status stop"
  
  case $prev in
    cpm)
      COMPREPLY=( $(compgen -W "$commands" -- "$cur") )
      return 0
      ;;
    completion)
      COMPREPLY=( $(compgen -W "bash zsh" -- "$cur") )
      return 0
      ;;
  esac

  COMPREPLY=()
  return 0
}

complete -F _cpm_completion cpm
`);
    } else if (shell === 'zsh') {
      console.log(`
#compdef cpm

_cpm() {
  local -a commands
  commands=(
    'add:Add a new proxy'
    'backup:Backup current configuration'
    'bulk:Bulk import/export operations'
    'completion:Generate shell completion script'
    'logs:View proxy logs'
    'ports:Check port status'
    'remove:Remove a proxy'
    'restore:Restore configuration from backup'
    'start:Start Caddy server'
    'status:Check proxy status'
    'stop:Stop Caddy server'
  )

  _arguments -C \\
    '1: :->command' \\
    '*:: :->args'

  case $state in
    command)
      _describe 'command' commands
      ;;
    args)
      case $words[1] in
        completion)
          _values 'shell type' 'bash' 'zsh'
          ;;
      esac
      ;;
  esac
}

compdef _cpm cpm
`);
    } else {
      console.error(`Unsupported shell type: ${shell}`);
      console.error('Supported shells: bash, zsh');
      process.exit(1);
    }
  }); 