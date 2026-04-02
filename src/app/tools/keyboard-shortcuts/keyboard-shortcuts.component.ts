import { Component, OnInit, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

export type ShortcutCategory = 'all' | 'vscode' | 'chrome-devtools' | 'git' | 'terminal' | 'macos' | 'windows';

export interface KeyboardShortcut {
  keys: string[];          // e.g. ['Ctrl', 'Shift', 'P']
  keysMac?: string[];      // e.g. ['Cmd', 'Shift', 'P']
  description: string;
  category: Exclude<ShortcutCategory, 'all'>;
}

@Component({
  selector: 'app-keyboard-shortcuts',
  templateUrl: './keyboard-shortcuts.component.html',
  styleUrls: ['./keyboard-shortcuts.component.css'],
  standalone: false
})
export class KeyboardShortcutsComponent implements OnInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Keyboard Shortcuts Reference — searchable, categorized shortcuts for VS Code, Chrome DevTools, Git, Terminal & more!')}&url=${encodeURIComponent(SITE_URL + '/tools/keyboard-shortcuts')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/keyboard-shortcuts')}`;

  // OS detection
  isMac = false;

  // Search & filter
  searchQuery = '';
  activeCategory: ShortcutCategory = 'all';

  // Detail view
  selectedShortcut: KeyboardShortcut | null = null;

  // Copy state
  copied = false;

  // Category metadata
  readonly categories: { key: ShortcutCategory; label: string; color: string; icon: string }[] = [
    { key: 'all',             label: 'All',             color: 'var(--text-muted)',  icon: '' },
    { key: 'vscode',          label: 'VS Code',         color: '#007ACC',            icon: '' },
    { key: 'chrome-devtools', label: 'Chrome DevTools',  color: '#4285F4',            icon: '' },
    { key: 'git',             label: 'Git',             color: '#F05032',            icon: '' },
    { key: 'terminal',        label: 'Terminal / Bash', color: '#34d399',            icon: '' },
    { key: 'macos',           label: 'macOS',           color: '#A2AAAD',            icon: '' },
    { key: 'windows',         label: 'Windows',         color: '#0078D4',            icon: '' },
  ];

  // ── Full Keyboard Shortcuts Database (200+) ──────────────────────────────
  readonly shortcuts: KeyboardShortcut[] = [

    // ═══════════════════════════════════════════
    // VS CODE (50+)
    // ═══════════════════════════════════════════
    { keys: ['Ctrl', 'Shift', 'P'], keysMac: ['Cmd', 'Shift', 'P'], description: 'Open Command Palette', category: 'vscode' },
    { keys: ['Ctrl', 'P'], keysMac: ['Cmd', 'P'], description: 'Quick Open file by name', category: 'vscode' },
    { keys: ['Ctrl', 'Shift', 'N'], keysMac: ['Cmd', 'Shift', 'N'], description: 'New window / instance', category: 'vscode' },
    { keys: ['Ctrl', 'Shift', 'W'], keysMac: ['Cmd', 'Shift', 'W'], description: 'Close window / instance', category: 'vscode' },
    { keys: ['Ctrl', ','], keysMac: ['Cmd', ','], description: 'Open User Settings', category: 'vscode' },
    { keys: ['Ctrl', 'K', 'Ctrl', 'S'], keysMac: ['Cmd', 'K', 'Cmd', 'S'], description: 'Open Keyboard Shortcuts editor', category: 'vscode' },
    { keys: ['Ctrl', 'X'], keysMac: ['Cmd', 'X'], description: 'Cut line (when no selection)', category: 'vscode' },
    { keys: ['Ctrl', 'C'], keysMac: ['Cmd', 'C'], description: 'Copy line (when no selection)', category: 'vscode' },
    { keys: ['Alt', 'Up'], keysMac: ['Option', 'Up'], description: 'Move line up', category: 'vscode' },
    { keys: ['Alt', 'Down'], keysMac: ['Option', 'Down'], description: 'Move line down', category: 'vscode' },
    { keys: ['Shift', 'Alt', 'Down'], keysMac: ['Shift', 'Option', 'Down'], description: 'Copy line down', category: 'vscode' },
    { keys: ['Shift', 'Alt', 'Up'], keysMac: ['Shift', 'Option', 'Up'], description: 'Copy line up', category: 'vscode' },
    { keys: ['Ctrl', 'Shift', 'K'], keysMac: ['Cmd', 'Shift', 'K'], description: 'Delete line', category: 'vscode' },
    { keys: ['Ctrl', 'Enter'], keysMac: ['Cmd', 'Enter'], description: 'Insert line below', category: 'vscode' },
    { keys: ['Ctrl', 'Shift', 'Enter'], keysMac: ['Cmd', 'Shift', 'Enter'], description: 'Insert line above', category: 'vscode' },
    { keys: ['Ctrl', 'Shift', '\\'], keysMac: ['Cmd', 'Shift', '\\'], description: 'Jump to matching bracket', category: 'vscode' },
    { keys: ['Ctrl', ']'], keysMac: ['Cmd', ']'], description: 'Indent line', category: 'vscode' },
    { keys: ['Ctrl', '['], keysMac: ['Cmd', '['], description: 'Outdent line', category: 'vscode' },
    { keys: ['Ctrl', 'Shift', '['], keysMac: ['Cmd', 'Option', '['], description: 'Fold (collapse) region', category: 'vscode' },
    { keys: ['Ctrl', 'Shift', ']'], keysMac: ['Cmd', 'Option', ']'], description: 'Unfold (expand) region', category: 'vscode' },
    { keys: ['Ctrl', '/'], keysMac: ['Cmd', '/'], description: 'Toggle line comment', category: 'vscode' },
    { keys: ['Shift', 'Alt', 'A'], keysMac: ['Shift', 'Option', 'A'], description: 'Toggle block comment', category: 'vscode' },
    { keys: ['Ctrl', 'F'], keysMac: ['Cmd', 'F'], description: 'Find in file', category: 'vscode' },
    { keys: ['Ctrl', 'H'], keysMac: ['Cmd', 'Option', 'F'], description: 'Find and replace', category: 'vscode' },
    { keys: ['Ctrl', 'Shift', 'F'], keysMac: ['Cmd', 'Shift', 'F'], description: 'Search across files', category: 'vscode' },
    { keys: ['Ctrl', 'G'], keysMac: ['Ctrl', 'G'], description: 'Go to line number', category: 'vscode' },
    { keys: ['Ctrl', 'D'], keysMac: ['Cmd', 'D'], description: 'Select next occurrence of word', category: 'vscode' },
    { keys: ['Ctrl', 'Shift', 'L'], keysMac: ['Cmd', 'Shift', 'L'], description: 'Select all occurrences of word', category: 'vscode' },
    { keys: ['Alt', 'Click'], keysMac: ['Option', 'Click'], description: 'Add cursor at click position', category: 'vscode' },
    { keys: ['Ctrl', 'Alt', 'Up'], keysMac: ['Cmd', 'Option', 'Up'], description: 'Add cursor above', category: 'vscode' },
    { keys: ['Ctrl', 'Alt', 'Down'], keysMac: ['Cmd', 'Option', 'Down'], description: 'Add cursor below', category: 'vscode' },
    { keys: ['Ctrl', 'U'], keysMac: ['Cmd', 'U'], description: 'Undo last cursor operation', category: 'vscode' },
    { keys: ['Ctrl', 'L'], keysMac: ['Cmd', 'L'], description: 'Select current line', category: 'vscode' },
    { keys: ['Ctrl', 'Shift', 'O'], keysMac: ['Cmd', 'Shift', 'O'], description: 'Go to symbol in file', category: 'vscode' },
    { keys: ['Ctrl', 'T'], keysMac: ['Cmd', 'T'], description: 'Go to symbol in workspace', category: 'vscode' },
    { keys: ['F12'], keysMac: ['F12'], description: 'Go to definition', category: 'vscode' },
    { keys: ['Alt', 'F12'], keysMac: ['Option', 'F12'], description: 'Peek definition', category: 'vscode' },
    { keys: ['Shift', 'F12'], keysMac: ['Shift', 'F12'], description: 'Show all references', category: 'vscode' },
    { keys: ['F2'], keysMac: ['F2'], description: 'Rename symbol', category: 'vscode' },
    { keys: ['Ctrl', 'Shift', 'E'], keysMac: ['Cmd', 'Shift', 'E'], description: 'Show Explorer panel', category: 'vscode' },
    { keys: ['Ctrl', 'Shift', 'G'], keysMac: ['Ctrl', 'Shift', 'G'], description: 'Show Source Control panel', category: 'vscode' },
    { keys: ['Ctrl', 'Shift', 'X'], keysMac: ['Cmd', 'Shift', 'X'], description: 'Show Extensions panel', category: 'vscode' },
    { keys: ['Ctrl', 'Shift', 'D'], keysMac: ['Cmd', 'Shift', 'D'], description: 'Show Debug panel', category: 'vscode' },
    { keys: ['Ctrl', '`'], keysMac: ['Ctrl', '`'], description: 'Toggle integrated terminal', category: 'vscode' },
    { keys: ['Ctrl', 'B'], keysMac: ['Cmd', 'B'], description: 'Toggle sidebar visibility', category: 'vscode' },
    { keys: ['Ctrl', '\\'], keysMac: ['Cmd', '\\'], description: 'Split editor', category: 'vscode' },
    { keys: ['Ctrl', '1'], keysMac: ['Cmd', '1'], description: 'Focus first editor group', category: 'vscode' },
    { keys: ['Ctrl', '2'], keysMac: ['Cmd', '2'], description: 'Focus second editor group', category: 'vscode' },
    { keys: ['Ctrl', 'W'], keysMac: ['Cmd', 'W'], description: 'Close active editor tab', category: 'vscode' },
    { keys: ['Ctrl', 'K', 'Ctrl', 'W'], keysMac: ['Cmd', 'K', 'Cmd', 'W'], description: 'Close all editor tabs', category: 'vscode' },
    { keys: ['Ctrl', 'Tab'], keysMac: ['Ctrl', 'Tab'], description: 'Cycle through open tabs', category: 'vscode' },
    { keys: ['Ctrl', 'Shift', 'T'], keysMac: ['Cmd', 'Shift', 'T'], description: 'Reopen closed editor tab', category: 'vscode' },
    { keys: ['Ctrl', 'K', 'V'], keysMac: ['Cmd', 'K', 'V'], description: 'Open Markdown preview to side', category: 'vscode' },
    { keys: ['Ctrl', 'Space'], keysMac: ['Ctrl', 'Space'], description: 'Trigger IntelliSense suggestions', category: 'vscode' },
    { keys: ['Ctrl', 'Shift', 'I'], keysMac: ['Cmd', 'Shift', 'I'], description: 'Format entire document', category: 'vscode' },
    { keys: ['Ctrl', '.'], keysMac: ['Cmd', '.'], description: 'Quick Fix / Code Action', category: 'vscode' },

    // ═══════════════════════════════════════════
    // CHROME DEVTOOLS (40+)
    // ═══════════════════════════════════════════
    { keys: ['F12'], keysMac: ['Cmd', 'Option', 'I'], description: 'Open / close DevTools', category: 'chrome-devtools' },
    { keys: ['Ctrl', 'Shift', 'J'], keysMac: ['Cmd', 'Option', 'J'], description: 'Open DevTools Console panel', category: 'chrome-devtools' },
    { keys: ['Ctrl', 'Shift', 'C'], keysMac: ['Cmd', 'Shift', 'C'], description: 'Open DevTools Inspect Element mode', category: 'chrome-devtools' },
    { keys: ['Ctrl', 'Shift', 'M'], keysMac: ['Cmd', 'Shift', 'M'], description: 'Toggle device toolbar (responsive)', category: 'chrome-devtools' },
    { keys: ['Ctrl', 'P'], keysMac: ['Cmd', 'P'], description: 'Search file by name in Sources', category: 'chrome-devtools' },
    { keys: ['Ctrl', 'Shift', 'P'], keysMac: ['Cmd', 'Shift', 'P'], description: 'Run Command in DevTools', category: 'chrome-devtools' },
    { keys: ['Ctrl', 'F'], keysMac: ['Cmd', 'F'], description: 'Search within current panel', category: 'chrome-devtools' },
    { keys: ['Ctrl', 'Shift', 'F'], keysMac: ['Cmd', 'Option', 'F'], description: 'Search across all sources', category: 'chrome-devtools' },
    { keys: ['Ctrl', '['], keysMac: ['Cmd', '['], description: 'Go to previous panel', category: 'chrome-devtools' },
    { keys: ['Ctrl', ']'], keysMac: ['Cmd', ']'], description: 'Go to next panel', category: 'chrome-devtools' },
    { keys: ['Ctrl', 'G'], keysMac: ['Ctrl', 'G'], description: 'Go to line in Sources panel', category: 'chrome-devtools' },
    { keys: ['F8'], keysMac: ['F8'], description: 'Pause / resume script execution', category: 'chrome-devtools' },
    { keys: ['F10'], keysMac: ['F10'], description: 'Step over next function call', category: 'chrome-devtools' },
    { keys: ['F11'], keysMac: ['F11'], description: 'Step into next function call', category: 'chrome-devtools' },
    { keys: ['Shift', 'F11'], keysMac: ['Shift', 'F11'], description: 'Step out of current function', category: 'chrome-devtools' },
    { keys: ['Ctrl', 'B'], keysMac: ['Cmd', 'B'], description: 'Toggle breakpoint on current line', category: 'chrome-devtools' },
    { keys: ['Ctrl', 'Shift', 'E'], keysMac: ['Cmd', 'Shift', 'E'], description: 'Run selected text in Console', category: 'chrome-devtools' },
    { keys: ['Ctrl', 'L'], keysMac: ['Cmd', 'K'], description: 'Clear Console', category: 'chrome-devtools' },
    { keys: ['Ctrl', 'Shift', 'D'], keysMac: ['Cmd', 'Shift', 'D'], description: 'Toggle DevTools dock position', category: 'chrome-devtools' },
    { keys: ['Ctrl', 'Shift', 'O'], keysMac: ['Cmd', 'Shift', 'O'], description: 'Go to function/symbol in Sources', category: 'chrome-devtools' },
    { keys: ['H'], keysMac: ['H'], description: 'Toggle element visibility in Elements', category: 'chrome-devtools' },
    { keys: ['F2'], keysMac: ['F2'], description: 'Edit as HTML in Elements panel', category: 'chrome-devtools' },
    { keys: ['Ctrl', 'Z'], keysMac: ['Cmd', 'Z'], description: 'Undo style change in Elements', category: 'chrome-devtools' },
    { keys: ['Esc'], keysMac: ['Esc'], description: 'Toggle Console drawer', category: 'chrome-devtools' },
    { keys: ['Ctrl', 'Shift', 'I'], keysMac: ['Cmd', 'Option', 'I'], description: 'Open DevTools (Elements panel)', category: 'chrome-devtools' },
    { keys: ['Up'], keysMac: ['Up'], description: 'Increment CSS value by 1', category: 'chrome-devtools' },
    { keys: ['Shift', 'Up'], keysMac: ['Shift', 'Up'], description: 'Increment CSS value by 10', category: 'chrome-devtools' },
    { keys: ['Alt', 'Up'], keysMac: ['Option', 'Up'], description: 'Increment CSS value by 0.1', category: 'chrome-devtools' },
    { keys: ['Ctrl', 'Up'], keysMac: ['Cmd', 'Up'], description: 'Increment CSS value by 100', category: 'chrome-devtools' },
    { keys: ['Tab'], keysMac: ['Tab'], description: 'Next CSS property in Styles pane', category: 'chrome-devtools' },
    { keys: ['Shift', 'Tab'], keysMac: ['Shift', 'Tab'], description: 'Previous CSS property in Styles', category: 'chrome-devtools' },
    { keys: ['Ctrl', 'D'], keysMac: ['Cmd', 'D'], description: 'Select next occurrence in Sources', category: 'chrome-devtools' },
    { keys: ['Ctrl', 'U'], keysMac: ['Cmd', 'U'], description: 'Deselect occurrence in Sources', category: 'chrome-devtools' },
    { keys: ['Ctrl', 'M'], keysMac: ['Ctrl', 'M'], description: 'Go to matching bracket in Sources', category: 'chrome-devtools' },
    { keys: ['Ctrl', '/'], keysMac: ['Cmd', '/'], description: 'Toggle comment in Sources', category: 'chrome-devtools' },
    { keys: ['Ctrl', 'Shift', 'R'], keysMac: ['Cmd', 'Shift', 'R'], description: 'Hard reload (bypass cache)', category: 'chrome-devtools' },
    { keys: ['Ctrl', 'Shift', 'Delete'], keysMac: ['Cmd', 'Shift', 'Delete'], description: 'Clear browser data dialog', category: 'chrome-devtools' },

    // ═══════════════════════════════════════════
    // GIT (35+)
    // ═══════════════════════════════════════════
    { keys: ['g', 'i', 't', ' ', 'i', 'n', 'i', 't'], description: 'Initialize a new repository', category: 'git' },
    { keys: ['g', 'i', 't', ' ', 'c', 'l', 'o', 'n', 'e'], description: 'Clone a remote repository', category: 'git' },
    { keys: ['g', 'i', 't', ' ', 's', 't', 'a', 't', 'u', 's'], description: 'Show working tree status', category: 'git' },
    { keys: ['g', 'i', 't', ' ', 'a', 'd', 'd', ' ', '.'], description: 'Stage all changes', category: 'git' },
    { keys: ['g', 'i', 't', ' ', 'a', 'd', 'd', ' ', '-p'], description: 'Stage changes interactively (patch)', category: 'git' },
    { keys: ['g', 'i', 't', ' ', 'c', 'o', 'm', 'm', 'i', 't', ' ', '-m'], description: 'Commit with inline message', category: 'git' },
    { keys: ['g', 'i', 't', ' ', 'c', 'o', 'm', 'm', 'i', 't', ' ', '-', '-', 'a', 'm', 'e', 'n', 'd'], description: 'Amend last commit', category: 'git' },
    { keys: ['g', 'i', 't', ' ', 'p', 'u', 's', 'h'], description: 'Push commits to remote', category: 'git' },
    { keys: ['g', 'i', 't', ' ', 'p', 'u', 'l', 'l'], description: 'Fetch and merge from remote', category: 'git' },
    { keys: ['g', 'i', 't', ' ', 'f', 'e', 't', 'c', 'h'], description: 'Download objects from remote', category: 'git' },
    { keys: ['g', 'i', 't', ' ', 'b', 'r', 'a', 'n', 'c', 'h'], description: 'List all local branches', category: 'git' },
    { keys: ['g', 'i', 't', ' ', 'b', 'r', 'a', 'n', 'c', 'h', ' ', '-d'], description: 'Delete a merged branch', category: 'git' },
    { keys: ['g', 'i', 't', ' ', 'c', 'h', 'e', 'c', 'k', 'o', 'u', 't', ' ', '-b'], description: 'Create and switch to new branch', category: 'git' },
    { keys: ['g', 'i', 't', ' ', 's', 'w', 'i', 't', 'c', 'h'], description: 'Switch branches (modern)', category: 'git' },
    { keys: ['g', 'i', 't', ' ', 'm', 'e', 'r', 'g', 'e'], description: 'Merge branch into current', category: 'git' },
    { keys: ['g', 'i', 't', ' ', 'r', 'e', 'b', 'a', 's', 'e'], description: 'Reapply commits on top of base', category: 'git' },
    { keys: ['g', 'i', 't', ' ', 'l', 'o', 'g', ' ', '-', '-', 'o', 'n', 'e', 'l', 'i', 'n', 'e'], description: 'Show compact commit history', category: 'git' },
    { keys: ['g', 'i', 't', ' ', 'l', 'o', 'g', ' ', '-', '-', 'g', 'r', 'a', 'p', 'h'], description: 'Show commit history as graph', category: 'git' },
    { keys: ['g', 'i', 't', ' ', 'd', 'i', 'f', 'f'], description: 'Show unstaged changes', category: 'git' },
    { keys: ['g', 'i', 't', ' ', 'd', 'i', 'f', 'f', ' ', '-', '-', 's', 't', 'a', 'g', 'e', 'd'], description: 'Show staged changes', category: 'git' },
    { keys: ['g', 'i', 't', ' ', 's', 't', 'a', 's', 'h'], description: 'Stash uncommitted changes', category: 'git' },
    { keys: ['g', 'i', 't', ' ', 's', 't', 'a', 's', 'h', ' ', 'p', 'o', 'p'], description: 'Apply and remove last stash', category: 'git' },
    { keys: ['g', 'i', 't', ' ', 'r', 'e', 's', 'e', 't', ' ', 'H', 'E', 'A', 'D', '~', '1'], description: 'Undo last commit keeping changes', category: 'git' },
    { keys: ['g', 'i', 't', ' ', 'r', 'e', 's', 'e', 't', ' ', '-', '-', 'h', 'a', 'r', 'd'], description: 'Discard all local changes', category: 'git' },
    { keys: ['g', 'i', 't', ' ', 'c', 'h', 'e', 'r', 'r', 'y', '-', 'p', 'i', 'c', 'k'], description: 'Apply specific commit to branch', category: 'git' },
    { keys: ['g', 'i', 't', ' ', 't', 'a', 'g'], description: 'List or create tags', category: 'git' },
    { keys: ['g', 'i', 't', ' ', 'r', 'e', 'm', 'o', 't', 'e', ' ', '-v'], description: 'List remote repositories', category: 'git' },
    { keys: ['g', 'i', 't', ' ', 'b', 'l', 'a', 'm', 'e'], description: 'Show who changed each line', category: 'git' },
    { keys: ['g', 'i', 't', ' ', 'b', 'i', 's', 'e', 'c', 't'], description: 'Binary search for bad commit', category: 'git' },
    { keys: ['g', 'i', 't', ' ', 'r', 'e', 'v', 'e', 'r', 't'], description: 'Create commit undoing changes', category: 'git' },
    { keys: ['g', 'i', 't', ' ', 'c', 'l', 'e', 'a', 'n', ' ', '-f', 'd'], description: 'Remove untracked files and dirs', category: 'git' },
    { keys: ['g', 'i', 't', ' ', 'r', 'e', 'f', 'l', 'o', 'g'], description: 'Show reference log history', category: 'git' },
    { keys: ['g', 'i', 't', ' ', 's', 'u', 'b', 'm', 'o', 'd', 'u', 'l', 'e'], description: 'Manage submodule repositories', category: 'git' },
    { keys: ['g', 'i', 't', ' ', 'w', 'o', 'r', 'k', 't', 'r', 'e', 'e'], description: 'Manage multiple working trees', category: 'git' },
    { keys: ['g', 'i', 't', ' ', 'c', 'o', 'n', 'f', 'i', 'g', ' ', '-', '-', 'l', 'i', 's', 't'], description: 'Show all config settings', category: 'git' },

    // ═══════════════════════════════════════════
    // TERMINAL / BASH (40+)
    // ═══════════════════════════════════════════
    { keys: ['Ctrl', 'C'], description: 'Cancel current command / SIGINT', category: 'terminal' },
    { keys: ['Ctrl', 'Z'], description: 'Suspend current process (bg/fg)', category: 'terminal' },
    { keys: ['Ctrl', 'D'], description: 'Exit shell / send EOF', category: 'terminal' },
    { keys: ['Ctrl', 'L'], description: 'Clear terminal screen', category: 'terminal' },
    { keys: ['Ctrl', 'A'], description: 'Move cursor to start of line', category: 'terminal' },
    { keys: ['Ctrl', 'E'], description: 'Move cursor to end of line', category: 'terminal' },
    { keys: ['Ctrl', 'U'], description: 'Delete from cursor to line start', category: 'terminal' },
    { keys: ['Ctrl', 'K'], description: 'Delete from cursor to line end', category: 'terminal' },
    { keys: ['Ctrl', 'W'], description: 'Delete word before cursor', category: 'terminal' },
    { keys: ['Alt', 'D'], description: 'Delete word after cursor', category: 'terminal' },
    { keys: ['Ctrl', 'Y'], description: 'Paste last deleted text (yank)', category: 'terminal' },
    { keys: ['Ctrl', 'R'], description: 'Reverse search command history', category: 'terminal' },
    { keys: ['Ctrl', 'S'], description: 'Forward search command history', category: 'terminal' },
    { keys: ['Ctrl', 'G'], description: 'Cancel history search', category: 'terminal' },
    { keys: ['Up'], description: 'Previous command in history', category: 'terminal' },
    { keys: ['Down'], description: 'Next command in history', category: 'terminal' },
    { keys: ['Alt', 'B'], description: 'Move cursor back one word', category: 'terminal' },
    { keys: ['Alt', 'F'], description: 'Move cursor forward one word', category: 'terminal' },
    { keys: ['Ctrl', 'T'], description: 'Swap character with previous', category: 'terminal' },
    { keys: ['Alt', 'T'], description: 'Swap word with previous', category: 'terminal' },
    { keys: ['Ctrl', 'X', 'Ctrl', 'E'], description: 'Open command in $EDITOR', category: 'terminal' },
    { keys: ['!', '!'], description: 'Repeat last command (bang bang)', category: 'terminal' },
    { keys: ['!', '$'], description: 'Last argument of previous command', category: 'terminal' },
    { keys: ['!', '*'], description: 'All arguments of previous command', category: 'terminal' },
    { keys: ['!', 'n'], description: 'Repeat nth command from history', category: 'terminal' },
    { keys: ['Tab'], description: 'Auto-complete file/command name', category: 'terminal' },
    { keys: ['Tab', 'Tab'], description: 'Show all completion options', category: 'terminal' },
    { keys: ['Ctrl', '_'], description: 'Undo last edit action', category: 'terminal' },
    { keys: ['Alt', '.'], description: 'Insert last argument of prev cmd', category: 'terminal' },
    { keys: ['Ctrl', 'Shift', 'C'], description: 'Copy selected text in terminal', category: 'terminal' },
    { keys: ['Ctrl', 'Shift', 'V'], description: 'Paste into terminal', category: 'terminal' },
    { keys: ['Ctrl', 'Shift', 'T'], description: 'Open new terminal tab', category: 'terminal' },
    { keys: ['Ctrl', 'Shift', 'W'], description: 'Close terminal tab', category: 'terminal' },
    { keys: ['Ctrl', 'Page Up'], description: 'Switch to previous tab', category: 'terminal' },
    { keys: ['Ctrl', 'Page Down'], description: 'Switch to next tab', category: 'terminal' },
    { keys: ['Shift', 'Page Up'], description: 'Scroll terminal output up', category: 'terminal' },
    { keys: ['Shift', 'Page Down'], description: 'Scroll terminal output down', category: 'terminal' },
    { keys: ['Alt', 'Enter'], description: 'Toggle fullscreen terminal', category: 'terminal' },
    { keys: ['Ctrl', 'Shift', '+'], description: 'Increase terminal font size', category: 'terminal' },
    { keys: ['Ctrl', '-'], description: 'Decrease terminal font size', category: 'terminal' },

    // ═══════════════════════════════════════════
    // macOS (40+)
    // ═══════════════════════════════════════════
    { keys: ['Cmd', 'Space'], description: 'Open Spotlight search', category: 'macos' },
    { keys: ['Cmd', 'Tab'], description: 'Switch between applications', category: 'macos' },
    { keys: ['Cmd', '`'], description: 'Switch windows of current app', category: 'macos' },
    { keys: ['Cmd', 'Q'], description: 'Quit application', category: 'macos' },
    { keys: ['Cmd', 'W'], description: 'Close current window', category: 'macos' },
    { keys: ['Cmd', 'N'], description: 'Open new window', category: 'macos' },
    { keys: ['Cmd', 'T'], description: 'Open new tab', category: 'macos' },
    { keys: ['Cmd', 'M'], description: 'Minimize window to Dock', category: 'macos' },
    { keys: ['Cmd', 'H'], description: 'Hide current application', category: 'macos' },
    { keys: ['Cmd', 'Option', 'H'], description: 'Hide all other applications', category: 'macos' },
    { keys: ['Cmd', ','], description: 'Open application preferences', category: 'macos' },
    { keys: ['Cmd', 'C'], description: 'Copy selection', category: 'macos' },
    { keys: ['Cmd', 'V'], description: 'Paste from clipboard', category: 'macos' },
    { keys: ['Cmd', 'X'], description: 'Cut selection', category: 'macos' },
    { keys: ['Cmd', 'Z'], description: 'Undo last action', category: 'macos' },
    { keys: ['Cmd', 'Shift', 'Z'], description: 'Redo last action', category: 'macos' },
    { keys: ['Cmd', 'A'], description: 'Select all', category: 'macos' },
    { keys: ['Cmd', 'F'], description: 'Find in document', category: 'macos' },
    { keys: ['Cmd', 'S'], description: 'Save current document', category: 'macos' },
    { keys: ['Cmd', 'Shift', 'S'], description: 'Save As dialog', category: 'macos' },
    { keys: ['Cmd', 'P'], description: 'Print current document', category: 'macos' },
    { keys: ['Cmd', 'Shift', '3'], description: 'Screenshot entire screen', category: 'macos' },
    { keys: ['Cmd', 'Shift', '4'], description: 'Screenshot selected area', category: 'macos' },
    { keys: ['Cmd', 'Shift', '4', 'Space'], description: 'Screenshot specific window', category: 'macos' },
    { keys: ['Cmd', 'Shift', '5'], description: 'Screenshot and recording toolbar', category: 'macos' },
    { keys: ['Ctrl', 'Cmd', 'Space'], description: 'Open emoji and symbols picker', category: 'macos' },
    { keys: ['Cmd', 'Option', 'Esc'], description: 'Force Quit applications dialog', category: 'macos' },
    { keys: ['Cmd', 'Ctrl', 'Q'], description: 'Lock screen immediately', category: 'macos' },
    { keys: ['Cmd', 'Shift', 'Q'], description: 'Log out of macOS', category: 'macos' },
    { keys: ['Ctrl', 'Up'], description: 'Mission Control (overview)', category: 'macos' },
    { keys: ['Ctrl', 'Down'], description: 'Show windows of current app', category: 'macos' },
    { keys: ['Ctrl', 'Left'], description: 'Switch to left desktop space', category: 'macos' },
    { keys: ['Ctrl', 'Right'], description: 'Switch to right desktop space', category: 'macos' },
    { keys: ['Cmd', 'Delete'], description: 'Move to Trash', category: 'macos' },
    { keys: ['Cmd', 'Shift', 'Delete'], description: 'Empty Trash', category: 'macos' },
    { keys: ['Cmd', 'Option', 'D'], description: 'Toggle Dock auto-hide', category: 'macos' },
    { keys: ['Cmd', 'Ctrl', 'F'], description: 'Toggle fullscreen mode', category: 'macos' },
    { keys: ['Cmd', 'I'], description: 'Get Info on selected file', category: 'macos' },
    { keys: ['Cmd', 'Shift', '.'], description: 'Show/hide hidden files (Finder)', category: 'macos' },
    { keys: ['Cmd', 'Option', 'V'], description: 'Move (cut-paste) files in Finder', category: 'macos' },
    { keys: ['Cmd', 'Up'], description: 'Go to parent folder in Finder', category: 'macos' },
    { keys: ['Cmd', 'Down'], description: 'Open selected item in Finder', category: 'macos' },

    // ═══════════════════════════════════════════
    // WINDOWS (40+)
    // ═══════════════════════════════════════════
    { keys: ['Win'], description: 'Open/close Start menu', category: 'windows' },
    { keys: ['Win', 'D'], description: 'Show/hide desktop', category: 'windows' },
    { keys: ['Win', 'E'], description: 'Open File Explorer', category: 'windows' },
    { keys: ['Win', 'I'], description: 'Open Settings', category: 'windows' },
    { keys: ['Win', 'L'], description: 'Lock workstation', category: 'windows' },
    { keys: ['Win', 'R'], description: 'Open Run dialog', category: 'windows' },
    { keys: ['Win', 'S'], description: 'Open Search', category: 'windows' },
    { keys: ['Win', 'V'], description: 'Open clipboard history', category: 'windows' },
    { keys: ['Win', 'X'], description: 'Open Quick Link menu', category: 'windows' },
    { keys: ['Win', '.'], description: 'Open emoji panel', category: 'windows' },
    { keys: ['Win', 'Tab'], description: 'Open Task View', category: 'windows' },
    { keys: ['Win', 'Shift', 'S'], description: 'Snipping Tool screenshot', category: 'windows' },
    { keys: ['Win', 'P'], description: 'Project / display mode picker', category: 'windows' },
    { keys: ['Win', 'Left'], description: 'Snap window to left half', category: 'windows' },
    { keys: ['Win', 'Right'], description: 'Snap window to right half', category: 'windows' },
    { keys: ['Win', 'Up'], description: 'Maximize window', category: 'windows' },
    { keys: ['Win', 'Down'], description: 'Minimize / restore window', category: 'windows' },
    { keys: ['Win', 'Home'], description: 'Minimize all except active window', category: 'windows' },
    { keys: ['Win', 'M'], description: 'Minimize all windows', category: 'windows' },
    { keys: ['Win', 'Shift', 'M'], description: 'Restore all minimized windows', category: 'windows' },
    { keys: ['Win', '1'], description: 'Open 1st pinned taskbar app', category: 'windows' },
    { keys: ['Win', '2'], description: 'Open 2nd pinned taskbar app', category: 'windows' },
    { keys: ['Win', 'Ctrl', 'D'], description: 'Create new virtual desktop', category: 'windows' },
    { keys: ['Win', 'Ctrl', 'F4'], description: 'Close current virtual desktop', category: 'windows' },
    { keys: ['Win', 'Ctrl', 'Left'], description: 'Switch to previous virtual desktop', category: 'windows' },
    { keys: ['Win', 'Ctrl', 'Right'], description: 'Switch to next virtual desktop', category: 'windows' },
    { keys: ['Alt', 'Tab'], description: 'Switch between open windows', category: 'windows' },
    { keys: ['Alt', 'F4'], description: 'Close active window / shutdown', category: 'windows' },
    { keys: ['Ctrl', 'Shift', 'Esc'], description: 'Open Task Manager directly', category: 'windows' },
    { keys: ['Ctrl', 'Alt', 'Delete'], description: 'Security options screen', category: 'windows' },
    { keys: ['Ctrl', 'C'], description: 'Copy selected item', category: 'windows' },
    { keys: ['Ctrl', 'V'], description: 'Paste from clipboard', category: 'windows' },
    { keys: ['Ctrl', 'X'], description: 'Cut selected item', category: 'windows' },
    { keys: ['Ctrl', 'Z'], description: 'Undo last action', category: 'windows' },
    { keys: ['Ctrl', 'Y'], description: 'Redo last action', category: 'windows' },
    { keys: ['Ctrl', 'A'], description: 'Select all items', category: 'windows' },
    { keys: ['F2'], description: 'Rename selected file', category: 'windows' },
    { keys: ['F5'], description: 'Refresh active window', category: 'windows' },
    { keys: ['Alt', 'Enter'], description: 'Show file properties', category: 'windows' },
    { keys: ['Print Screen'], description: 'Screenshot to clipboard', category: 'windows' },
    { keys: ['Win', 'Print Screen'], description: 'Screenshot saved to Pictures', category: 'windows' },
    { keys: ['Ctrl', 'Shift', 'N'], description: 'Create new folder in Explorer', category: 'windows' },
  ];

  constructor(private router: Router) {}

  ngOnInit() {
    if (this.isBrowser) {
      this.isMac = navigator.platform?.toLowerCase().includes('mac') ||
                   (navigator as any).userAgentData?.platform?.toLowerCase().includes('mac') ||
                   false;
    }
  }

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Filtering ───────────────────────────────────────────────────────────────

  get filteredShortcuts(): KeyboardShortcut[] {
    let results = this.shortcuts;

    if (this.activeCategory !== 'all') {
      results = results.filter(s => s.category === this.activeCategory);
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      results = results.filter(s =>
        s.description.toLowerCase().includes(q) ||
        this.getDisplayKeys(s).join(' ').toLowerCase().includes(q) ||
        s.keys.join('+').toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
      );
    }

    return results;
  }

  get resultCount(): number {
    return this.filteredShortcuts.length;
  }

  // ── Search ──────────────────────────────────────────────────────────────────

  onSearchInput() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.checkEasterEgg();
    }, 300);
  }

  private checkEasterEgg() {
    const q = this.searchQuery.trim().toLowerCase();
    if (q === 'konami') {
      this.eggs.trigger('ks-konami');
    }
  }

  setCategory(cat: ShortcutCategory) {
    this.activeCategory = cat;
  }

  // ── Detail view ─────────────────────────────────────────────────────────────

  selectShortcut(entry: KeyboardShortcut) {
    this.selectedShortcut = this.selectedShortcut === entry ? null : entry;
  }

  closeDetail() {
    this.selectedShortcut = null;
  }

  // ── Key display helpers ─────────────────────────────────────────────────────

  getDisplayKeys(shortcut: KeyboardShortcut): string[] {
    if (this.isMac && shortcut.keysMac) {
      return shortcut.keysMac;
    }
    return shortcut.keys;
  }

  isGitCommand(shortcut: KeyboardShortcut): boolean {
    return shortcut.category === 'git';
  }

  getGitCommand(shortcut: KeyboardShortcut): string {
    return shortcut.keys.join('');
  }

  // ── Copy ────────────────────────────────────────────────────────────────────

  async copyShortcut(entry: KeyboardShortcut) {
    if (!this.isBrowser) return;
    const keys = this.isGitCommand(entry)
      ? this.getGitCommand(entry)
      : this.getDisplayKeys(entry).join(' + ');
    const text = `${keys} — ${entry.description}`;
    try {
      await navigator.clipboard.writeText(text);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {
      this.fallbackCopy(text);
    }
  }

  private fallbackCopy(text: string) {
    if (!this.isBrowser) return;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    this.copied = true;
    setTimeout(() => (this.copied = false), 2000);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  getCategoryColor(category: string): string {
    switch (category) {
      case 'vscode':          return '#007ACC';
      case 'chrome-devtools': return '#4285F4';
      case 'git':             return '#F05032';
      case 'terminal':        return '#34d399';
      case 'macos':           return '#A2AAAD';
      case 'windows':         return '#0078D4';
      default:                return 'var(--text-muted)';
    }
  }

  getCategoryLabel(category: string): string {
    switch (category) {
      case 'vscode':          return 'VS Code';
      case 'chrome-devtools': return 'Chrome DevTools';
      case 'git':             return 'Git';
      case 'terminal':        return 'Terminal / Bash';
      case 'macos':           return 'macOS';
      case 'windows':         return 'Windows';
      default:                return '';
    }
  }
}
