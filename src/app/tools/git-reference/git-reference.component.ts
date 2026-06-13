import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';
import { FormsModule } from '@angular/forms';

export type GitCategory = 'all' | 'basics' | 'branching' | 'remote' | 'stash' | 'log' | 'diff' | 'reset' | 'rebase' | 'config';

export interface GitCommandEntry {
  command: string;
  description: string;
  example: string;
  flags: { flag: string; desc: string }[];
  category: Exclude<GitCategory, 'all'>;
}

@Component({
    selector: 'app-git-reference',
    templateUrl: './git-reference.component.html',
    styleUrls: ['./git-reference.component.css'],
    imports: [ToolsSharedModule, FormsModule]
})
export class GitReferenceComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Git Command Reference — 100+ searchable commands with examples, flags & cheatsheet mode. No sign-up required!')}&url=${encodeURIComponent(SITE_URL + '/tools/git-reference')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/git-reference')}`;

  // Search & filter
  searchQuery = '';
  activeCategory: GitCategory = 'all';

  // View modes
  cheatsheetMode = false;

  // Detail view
  selectedCommand: GitCommandEntry | null = null;

  // Copy state
  copied = false;
  copiedCommand = '';

  // Category metadata
  readonly categories: { key: GitCategory; label: string; color: string }[] = [
    { key: 'all', label: 'All', color: 'var(--text-muted)' },
    { key: 'basics', label: 'Basics', color: '#34d399' },
    { key: 'branching', label: 'Branching', color: '#60a5fa' },
    { key: 'remote', label: 'Remote', color: '#c084fc' },
    { key: 'stash', label: 'Stash', color: '#fbbf24' },
    { key: 'log', label: 'Log', color: '#f472b6' },
    { key: 'diff', label: 'Diff', color: '#fb923c' },
    { key: 'reset', label: 'Reset', color: '#f87171' },
    { key: 'rebase', label: 'Rebase', color: '#2dd4bf' },
    { key: 'config', label: 'Config', color: '#a78bfa' },
  ];

  // ── Full Git command database ──────────────────────────────────────────
  readonly gitCommands: GitCommandEntry[] = [
    // ── Basics ──
    { command: 'git init', description: 'Initialize a new Git repository in the current directory.', example: 'git init my-project', category: 'basics', flags: [{ flag: '--bare', desc: 'Create a bare repository (no working tree)' }, { flag: '--initial-branch=<name>', desc: 'Set the name of the initial branch' }] },
    { command: 'git clone', description: 'Clone a remote repository to your local machine.', example: 'git clone https://github.com/user/repo.git', category: 'basics', flags: [{ flag: '--depth <n>', desc: 'Shallow clone with limited history' }, { flag: '--branch <name>', desc: 'Clone a specific branch' }, { flag: '--single-branch', desc: 'Clone only one branch' }, { flag: '--recurse-submodules', desc: 'Initialize submodules after clone' }] },
    { command: 'git add', description: 'Stage changes for the next commit.', example: 'git add . or git add file.txt', category: 'basics', flags: [{ flag: '-A', desc: 'Stage all changes (new, modified, deleted)' }, { flag: '-p', desc: 'Interactively stage hunks' }, { flag: '-u', desc: 'Stage modified and deleted files only' }] },
    { command: 'git commit', description: 'Record staged changes in the repository history.', example: 'git commit -m "feat: add login page"', category: 'basics', flags: [{ flag: '-m "<msg>"', desc: 'Provide commit message inline' }, { flag: '-a', desc: 'Automatically stage tracked modified files' }, { flag: '--amend', desc: 'Modify the last commit' }, { flag: '--no-edit', desc: 'Amend without changing the message' }, { flag: '-S', desc: 'GPG-sign the commit' }] },
    { command: 'git status', description: 'Show the working tree status and staged changes.', example: 'git status -s', category: 'basics', flags: [{ flag: '-s', desc: 'Short format output' }, { flag: '-b', desc: 'Show branch info in short format' }, { flag: '--ignored', desc: 'Show ignored files' }] },
    { command: 'git rm', description: 'Remove files from the working tree and the index.', example: 'git rm --cached secrets.env', category: 'basics', flags: [{ flag: '--cached', desc: 'Remove from index only, keep in working tree' }, { flag: '-r', desc: 'Recursive removal' }, { flag: '-f', desc: 'Force removal of modified files' }] },
    { command: 'git mv', description: 'Move or rename a file, directory, or symlink.', example: 'git mv old-name.ts new-name.ts', category: 'basics', flags: [{ flag: '-f', desc: 'Force rename even if target exists' }, { flag: '-k', desc: 'Skip moves that would cause errors' }] },
    { command: 'git restore', description: 'Restore working tree files from a source.', example: 'git restore --staged file.txt', category: 'basics', flags: [{ flag: '--staged', desc: 'Unstage a file (remove from index)' }, { flag: '--source=<ref>', desc: 'Restore from a specific commit/branch' }, { flag: '-W', desc: 'Restore working tree (default)' }] },
    { command: 'git clean', description: 'Remove untracked files from the working tree.', example: 'git clean -fd', category: 'basics', flags: [{ flag: '-f', desc: 'Force (required unless configured otherwise)' }, { flag: '-d', desc: 'Remove untracked directories too' }, { flag: '-n', desc: 'Dry run, show what would be deleted' }, { flag: '-x', desc: 'Also remove ignored files' }] },
    { command: 'git show', description: 'Show details of a commit, tag, or other object.', example: 'git show HEAD~3', category: 'basics', flags: [{ flag: '--stat', desc: 'Show diffstat only' }, { flag: '--name-only', desc: 'Show only file names' }, { flag: '--format=<fmt>', desc: 'Pretty-print with a custom format' }] },
    { command: 'git tag', description: 'Create, list, delete, or verify tags.', example: 'git tag -a v1.0.0 -m "Release 1.0"', category: 'basics', flags: [{ flag: '-a', desc: 'Create an annotated tag' }, { flag: '-d <tag>', desc: 'Delete a tag' }, { flag: '-l "<pattern>"', desc: 'List tags matching a pattern' }, { flag: '-m "<msg>"', desc: 'Tag message for annotated tags' }] },
    { command: 'git archive', description: 'Create an archive of files from a named tree.', example: 'git archive --format=zip HEAD > project.zip', category: 'basics', flags: [{ flag: '--format=<fmt>', desc: 'Archive format (tar, zip, etc.)' }, { flag: '--prefix=<dir>/', desc: 'Prepend prefix to each filename' }, { flag: '-o <file>', desc: 'Write to file instead of stdout' }] },
    { command: 'git shortlog', description: 'Summarize git log output grouped by author.', example: 'git shortlog -sn', category: 'basics', flags: [{ flag: '-s', desc: 'Show commit count only' }, { flag: '-n', desc: 'Sort by number of commits' }, { flag: '-e', desc: 'Show email addresses' }] },

    // ── Branching ──
    { command: 'git branch', description: 'List, create, or delete branches.', example: 'git branch feature/auth', category: 'branching', flags: [{ flag: '-a', desc: 'List local and remote branches' }, { flag: '-d <branch>', desc: 'Delete a merged branch' }, { flag: '-D <branch>', desc: 'Force-delete a branch' }, { flag: '-m <old> <new>', desc: 'Rename a branch' }, { flag: '-r', desc: 'List remote-tracking branches' }, { flag: '--merged', desc: 'Only list branches merged into HEAD' }] },
    { command: 'git checkout', description: 'Switch branches or restore working tree files.', example: 'git checkout -b feature/new', category: 'branching', flags: [{ flag: '-b <branch>', desc: 'Create and switch to a new branch' }, { flag: '-B <branch>', desc: 'Create/reset and switch to branch' }, { flag: '--orphan <branch>', desc: 'Create a branch with no history' }, { flag: '--track', desc: 'Set up upstream tracking' }] },
    { command: 'git switch', description: 'Switch branches (modern alternative to checkout).', example: 'git switch -c feature/dashboard', category: 'branching', flags: [{ flag: '-c <branch>', desc: 'Create and switch to a new branch' }, { flag: '-C <branch>', desc: 'Create/reset and switch' }, { flag: '--detach', desc: 'Switch to a commit in detached HEAD' }, { flag: '--orphan <branch>', desc: 'Create branch with no history' }] },
    { command: 'git merge', description: 'Join two or more development histories together.', example: 'git merge feature/auth --no-ff', category: 'branching', flags: [{ flag: '--no-ff', desc: 'Always create a merge commit' }, { flag: '--squash', desc: 'Squash all commits into one' }, { flag: '--abort', desc: 'Abort the current merge' }, { flag: '--continue', desc: 'Continue after resolving conflicts' }, { flag: '-m "<msg>"', desc: 'Set the merge commit message' }] },
    { command: 'git cherry-pick', description: 'Apply changes from specific commits onto the current branch.', example: 'git cherry-pick abc1234', category: 'branching', flags: [{ flag: '-n', desc: 'Apply changes without committing' }, { flag: '--abort', desc: 'Abort the cherry-pick' }, { flag: '--continue', desc: 'Continue after resolving conflicts' }, { flag: '-x', desc: 'Append source commit hash to message' }] },
    { command: 'git worktree', description: 'Manage multiple working trees for the same repo.', example: 'git worktree add ../hotfix hotfix/urgent', category: 'branching', flags: [{ flag: 'add <path> <branch>', desc: 'Create a new worktree' }, { flag: 'list', desc: 'List all worktrees' }, { flag: 'remove <path>', desc: 'Remove a worktree' }, { flag: 'prune', desc: 'Remove stale worktree info' }] },
    { command: 'git branch --set-upstream-to', description: 'Set the upstream tracking branch for the current branch.', example: 'git branch --set-upstream-to=origin/main', category: 'branching', flags: [{ flag: '-u <upstream>', desc: 'Shorthand for --set-upstream-to' }] },
    { command: 'git merge-base', description: 'Find the best common ancestor between commits.', example: 'git merge-base main feature/auth', category: 'branching', flags: [{ flag: '--all', desc: 'Show all common ancestors' }, { flag: '--octopus', desc: 'Find merge base for octopus merge' }] },

    // ── Remote ──
    { command: 'git remote', description: 'Manage the set of tracked remote repositories.', example: 'git remote add origin https://github.com/user/repo.git', category: 'remote', flags: [{ flag: '-v', desc: 'Show remote URLs' }, { flag: 'add <name> <url>', desc: 'Add a new remote' }, { flag: 'remove <name>', desc: 'Remove a remote' }, { flag: 'rename <old> <new>', desc: 'Rename a remote' }, { flag: 'set-url <name> <url>', desc: 'Change a remote URL' }] },
    { command: 'git fetch', description: 'Download objects and refs from a remote repository.', example: 'git fetch origin main', category: 'remote', flags: [{ flag: '--all', desc: 'Fetch from all remotes' }, { flag: '--prune', desc: 'Remove stale remote-tracking refs' }, { flag: '--tags', desc: 'Fetch all tags' }, { flag: '--depth <n>', desc: 'Limit fetching to specified depth' }] },
    { command: 'git pull', description: 'Fetch from remote and integrate with local branch.', example: 'git pull origin main --rebase', category: 'remote', flags: [{ flag: '--rebase', desc: 'Rebase instead of merge' }, { flag: '--no-rebase', desc: 'Merge (default behavior)' }, { flag: '--ff-only', desc: 'Only fast-forward, fail otherwise' }, { flag: '--autostash', desc: 'Stash/unstash around pull automatically' }] },
    { command: 'git push', description: 'Upload local commits to a remote repository.', example: 'git push origin main', category: 'remote', flags: [{ flag: '-u', desc: 'Set upstream tracking reference' }, { flag: '--force', desc: 'Force push (overwrites remote history)' }, { flag: '--force-with-lease', desc: 'Safer force push (checks remote state)' }, { flag: '--tags', desc: 'Push all tags' }, { flag: '--delete <branch>', desc: 'Delete a remote branch' }, { flag: '--dry-run', desc: 'Simulate the push' }] },
    { command: 'git push --force', description: 'Force push local branch overwriting remote history. Use with extreme caution.', example: 'git push --force origin feature/risky', category: 'remote', flags: [{ flag: '--force-with-lease', desc: 'Safer alternative that checks remote state first' }] },
    { command: 'git remote prune', description: 'Remove stale remote-tracking branches.', example: 'git remote prune origin', category: 'remote', flags: [{ flag: '--dry-run', desc: 'Show what would be pruned without removing' }] },
    { command: 'git ls-remote', description: 'List references in a remote repository.', example: 'git ls-remote --heads origin', category: 'remote', flags: [{ flag: '--heads', desc: 'Show only branch refs' }, { flag: '--tags', desc: 'Show only tag refs' }, { flag: '--refs', desc: 'Do not show peeled tags' }] },
    { command: 'git submodule', description: 'Initialize, update, or inspect submodules.', example: 'git submodule update --init --recursive', category: 'remote', flags: [{ flag: 'add <url> <path>', desc: 'Add a submodule' }, { flag: 'init', desc: 'Initialize submodule config' }, { flag: 'update', desc: 'Update submodules to recorded commits' }, { flag: '--recursive', desc: 'Process nested submodules' }] },
    { command: 'git bundle', description: 'Move objects and refs by archive for offline transfer.', example: 'git bundle create repo.bundle --all', category: 'remote', flags: [{ flag: 'create <file>', desc: 'Create a bundle file' }, { flag: 'verify <file>', desc: 'Verify a bundle' }, { flag: '--all', desc: 'Include all refs' }] },

    // ── Stash ──
    { command: 'git stash', description: 'Temporarily save uncommitted changes and clean working directory.', example: 'git stash', category: 'stash', flags: [{ flag: '-u', desc: 'Include untracked files' }, { flag: '-a', desc: 'Include untracked and ignored files' }, { flag: '-m "<msg>"', desc: 'Add a stash message' }, { flag: '-p', desc: 'Interactively select hunks to stash' }] },
    { command: 'git stash pop', description: 'Apply the most recent stash and remove it from the stash list.', example: 'git stash pop stash@{2}', category: 'stash', flags: [{ flag: '--index', desc: 'Try to restore staged state too' }, { flag: 'stash@{n}', desc: 'Pop a specific stash entry' }] },
    { command: 'git stash apply', description: 'Apply a stash without removing it from the stash list.', example: 'git stash apply stash@{0}', category: 'stash', flags: [{ flag: '--index', desc: 'Try to restore staged state too' }, { flag: 'stash@{n}', desc: 'Apply a specific stash entry' }] },
    { command: 'git stash list', description: 'List all stashed changesets.', example: 'git stash list', category: 'stash', flags: [{ flag: '--format=<fmt>', desc: 'Custom output format' }] },
    { command: 'git stash drop', description: 'Remove a specific stash entry from the list.', example: 'git stash drop stash@{1}', category: 'stash', flags: [{ flag: 'stash@{n}', desc: 'Specify which stash to drop' }] },
    { command: 'git stash clear', description: 'Remove all stash entries. Cannot be undone.', example: 'git stash clear', category: 'stash', flags: [] },
    { command: 'git stash show', description: 'Show the diff of a stash entry.', example: 'git stash show -p stash@{0}', category: 'stash', flags: [{ flag: '-p', desc: 'Show full diff (patch format)' }, { flag: '--stat', desc: 'Show diffstat summary' }, { flag: 'stash@{n}', desc: 'Specify which stash to show' }] },
    { command: 'git stash branch', description: 'Create a new branch from a stash and apply it.', example: 'git stash branch fix/wip-work stash@{0}', category: 'stash', flags: [{ flag: 'stash@{n}', desc: 'Specify which stash to branch from' }] },
    { command: 'git stash push', description: 'Stash specific files or paths (modern syntax).', example: 'git stash push -m "wip: auth" src/auth/', category: 'stash', flags: [{ flag: '-m "<msg>"', desc: 'Add a descriptive message' }, { flag: '-u', desc: 'Include untracked files' }, { flag: '--', desc: 'Separate pathspecs from options' }] },

    // ── Log ──
    { command: 'git log', description: 'Show the commit history for the current branch.', example: 'git log --oneline --graph -20', category: 'log', flags: [{ flag: '--oneline', desc: 'Compact one-line format' }, { flag: '--graph', desc: 'Draw branch/merge graph' }, { flag: '-n <N>', desc: 'Limit to last N commits' }, { flag: '--all', desc: 'Show all branches' }, { flag: '--stat', desc: 'Show file change statistics' }, { flag: '--author="<name>"', desc: 'Filter by author' }] },
    { command: 'git log --pretty', description: 'Format log output with custom format strings.', example: 'git log --pretty=format:"%h %an %s" -10', category: 'log', flags: [{ flag: '%H', desc: 'Full commit hash' }, { flag: '%h', desc: 'Abbreviated commit hash' }, { flag: '%an', desc: 'Author name' }, { flag: '%s', desc: 'Subject (first line of message)' }, { flag: '%ar', desc: 'Relative author date' }, { flag: '%d', desc: 'Ref names (branches, tags)' }] },
    { command: 'git log --since', description: 'Show commits from a specific date range.', example: 'git log --since="2024-01-01" --until="2024-06-30"', category: 'log', flags: [{ flag: '--since="<date>"', desc: 'Show commits after date' }, { flag: '--until="<date>"', desc: 'Show commits before date' }, { flag: '--after', desc: 'Alias for --since' }, { flag: '--before', desc: 'Alias for --until' }] },
    { command: 'git log -p', description: 'Show commit history with full diffs (patches).', example: 'git log -p -2 -- src/app/', category: 'log', flags: [{ flag: '-p', desc: 'Show patch (diff) for each commit' }, { flag: '--follow', desc: 'Follow file renames' }, { flag: '-- <path>', desc: 'Filter by file path' }] },
    { command: 'git log --grep', description: 'Search commit messages for a pattern.', example: 'git log --grep="fix" --oneline', category: 'log', flags: [{ flag: '--grep="<pattern>"', desc: 'Filter by commit message' }, { flag: '-i', desc: 'Case-insensitive search' }, { flag: '--all-match', desc: 'Require all patterns to match' }] },
    { command: 'git reflog', description: 'Show history of HEAD changes including resets and rebases.', example: 'git reflog -20', category: 'log', flags: [{ flag: '-n <N>', desc: 'Limit to last N entries' }, { flag: '--date=relative', desc: 'Show relative dates' }, { flag: 'expire', desc: 'Prune old reflog entries' }] },
    { command: 'git blame', description: 'Show who last modified each line of a file.', example: 'git blame src/app/app.component.ts', category: 'log', flags: [{ flag: '-L <start>,<end>', desc: 'Blame only a range of lines' }, { flag: '-w', desc: 'Ignore whitespace changes' }, { flag: '-M', desc: 'Detect moved lines within a file' }, { flag: '-C', desc: 'Detect lines moved between files' }] },
    { command: 'git bisect', description: 'Use binary search to find the commit that introduced a bug.', example: 'git bisect start && git bisect bad && git bisect good v1.0', category: 'log', flags: [{ flag: 'start', desc: 'Begin a bisect session' }, { flag: 'bad', desc: 'Mark current commit as bad' }, { flag: 'good <ref>', desc: 'Mark a known good commit' }, { flag: 'reset', desc: 'End bisect and return to original HEAD' }, { flag: 'run <cmd>', desc: 'Automate bisect with a test script' }] },
    { command: 'git log -S', description: 'Search for commits that added or removed a string (pickaxe).', example: 'git log -S "functionName" --oneline', category: 'log', flags: [{ flag: '-S "<string>"', desc: 'Find commits changing occurrences of string' }, { flag: '-G "<regex>"', desc: 'Find commits matching regex in diffs' }] },
    { command: 'git whatchanged', description: 'Show commit logs with raw diff output per commit.', example: 'git whatchanged --since="1 week ago"', category: 'log', flags: [{ flag: '--since="<date>"', desc: 'Limit to recent commits' }, { flag: '-p', desc: 'Show patches' }] },
    { command: 'git rev-list', description: 'List commit objects in reverse chronological order.', example: 'git rev-list --count HEAD', category: 'log', flags: [{ flag: '--count', desc: 'Output the count of commits' }, { flag: '--all', desc: 'Include all refs' }, { flag: '--max-count=<n>', desc: 'Limit number of commits' }] },

    // ── Diff ──
    { command: 'git diff', description: 'Show unstaged changes between working tree and index.', example: 'git diff src/app/', category: 'diff', flags: [{ flag: '--staged', desc: 'Show staged changes (same as --cached)' }, { flag: '--cached', desc: 'Show staged changes' }, { flag: '--name-only', desc: 'Show only changed file names' }, { flag: '--stat', desc: 'Show diffstat summary' }, { flag: '--color-words', desc: 'Word-level diff with color' }] },
    { command: 'git diff --staged', description: 'Show changes staged for the next commit.', example: 'git diff --staged', category: 'diff', flags: [{ flag: '--name-only', desc: 'Show only filenames' }, { flag: '--stat', desc: 'Summary statistics' }] },
    { command: 'git diff HEAD', description: 'Show all changes (staged + unstaged) vs last commit.', example: 'git diff HEAD -- src/', category: 'diff', flags: [{ flag: '-- <path>', desc: 'Limit diff to specific paths' }, { flag: '--stat', desc: 'Show diffstat only' }] },
    { command: 'git diff <branch1>..<branch2>', description: 'Show differences between two branches.', example: 'git diff main..feature/auth', category: 'diff', flags: [{ flag: '--name-only', desc: 'List changed files only' }, { flag: '--stat', desc: 'Show diffstat summary' }, { flag: '-- <path>', desc: 'Filter by path' }] },
    { command: 'git diff <commit1> <commit2>', description: 'Show differences between two specific commits.', example: 'git diff abc1234 def5678', category: 'diff', flags: [{ flag: '--name-status', desc: 'Show file name and change type' }, { flag: '-w', desc: 'Ignore all whitespace' }] },
    { command: 'git difftool', description: 'Launch an external diff tool for visual comparison.', example: 'git difftool --tool=vscode HEAD~1', category: 'diff', flags: [{ flag: '--tool=<tool>', desc: 'Specify the diff tool' }, { flag: '-d', desc: 'Directory diff mode' }, { flag: '--no-prompt', desc: 'Skip confirmation prompt' }] },
    { command: 'git diff --word-diff', description: 'Show word-level differences instead of line-level.', example: 'git diff --word-diff=color', category: 'diff', flags: [{ flag: '--word-diff=color', desc: 'Use color for word diffs' }, { flag: '--word-diff=plain', desc: 'Use [-removed-]{+added+} markers' }] },
    { command: 'git diff --check', description: 'Warn about whitespace errors (trailing spaces, mixed indent).', example: 'git diff --check HEAD~3', category: 'diff', flags: [{ flag: '--check', desc: 'Highlight whitespace issues' }] },
    { command: 'git diff --shortstat', description: 'Show only the summary line of a diff.', example: 'git diff --shortstat HEAD~5', category: 'diff', flags: [{ flag: '--shortstat', desc: 'Show only insertions/deletions summary' }] },
    { command: 'git diff --name-status', description: 'Show file names with change type (A/M/D/R).', example: 'git diff --name-status main..HEAD', category: 'diff', flags: [{ flag: 'A', desc: 'Added' }, { flag: 'M', desc: 'Modified' }, { flag: 'D', desc: 'Deleted' }, { flag: 'R', desc: 'Renamed' }] },
    { command: 'git range-diff', description: 'Compare two commit ranges (e.g., before/after rebase).', example: 'git range-diff main..feature@{1} main..feature', category: 'diff', flags: [{ flag: '--stat', desc: 'Show diffstat' }, { flag: '--no-color', desc: 'Disable color output' }] },

    // ── Reset ──
    { command: 'git reset', description: 'Reset current HEAD to a specified state.', example: 'git reset HEAD~1', category: 'reset', flags: [{ flag: '--soft', desc: 'Keep changes staged' }, { flag: '--mixed', desc: 'Keep changes unstaged (default)' }, { flag: '--hard', desc: 'Discard all changes (destructive!)' }] },
    { command: 'git reset --soft', description: 'Move HEAD back but keep all changes staged for recommit.', example: 'git reset --soft HEAD~3', category: 'reset', flags: [{ flag: 'HEAD~<n>', desc: 'Go back N commits' }, { flag: '<commit>', desc: 'Reset to a specific commit hash' }] },
    { command: 'git reset --hard', description: 'Completely discard all changes and reset to a commit. DESTRUCTIVE.', example: 'git reset --hard origin/main', category: 'reset', flags: [{ flag: 'HEAD', desc: 'Discard all uncommitted changes' }, { flag: 'origin/<branch>', desc: 'Match remote branch exactly' }] },
    { command: 'git reset --mixed', description: 'Unstage changes but keep them in working directory (default).', example: 'git reset HEAD~1', category: 'reset', flags: [{ flag: 'HEAD~<n>', desc: 'Go back N commits' }] },
    { command: 'git revert', description: 'Create a new commit that undoes changes from a previous commit.', example: 'git revert abc1234', category: 'reset', flags: [{ flag: '-n', desc: 'Revert without auto-committing' }, { flag: '--no-edit', desc: 'Use default revert commit message' }, { flag: '--abort', desc: 'Abort the revert operation' }, { flag: '-m 1', desc: 'Revert a merge commit (mainline parent)' }] },
    { command: 'git checkout -- <file>', description: 'Discard unstaged changes to a specific file.', example: 'git checkout -- src/app/app.component.ts', category: 'reset', flags: [{ flag: '.', desc: 'Discard all unstaged changes' }] },
    { command: 'git restore --staged', description: 'Unstage a file without discarding changes.', example: 'git restore --staged file.txt', category: 'reset', flags: [{ flag: '--staged', desc: 'Remove from staging area' }, { flag: '--worktree', desc: 'Discard working tree changes' }] },
    { command: 'git reset HEAD <file>', description: 'Unstage a specific file (legacy way).', example: 'git reset HEAD package.json', category: 'reset', flags: [] },
    { command: 'git reflog + reset', description: 'Recover lost commits using reflog history.', example: 'git reflog && git reset --hard HEAD@{2}', category: 'reset', flags: [{ flag: 'HEAD@{n}', desc: 'Reference a reflog entry' }] },
    { command: 'git update-ref', description: 'Safely update a ref to a new value.', example: 'git update-ref -d HEAD', category: 'reset', flags: [{ flag: '-d', desc: 'Delete the ref' }, { flag: '-m "<msg>"', desc: 'Record reason in reflog' }] },

    // ── Rebase ──
    { command: 'git rebase', description: 'Reapply commits on top of another base commit.', example: 'git rebase main', category: 'rebase', flags: [{ flag: '-i', desc: 'Interactive rebase (pick, squash, edit, etc.)' }, { flag: '--onto <base>', desc: 'Rebase onto a different base' }, { flag: '--abort', desc: 'Abort and return to pre-rebase state' }, { flag: '--continue', desc: 'Continue after resolving conflicts' }, { flag: '--skip', desc: 'Skip the current conflicting commit' }] },
    { command: 'git rebase -i', description: 'Interactive rebase to squash, reorder, or edit commits.', example: 'git rebase -i HEAD~5', category: 'rebase', flags: [{ flag: 'pick', desc: 'Use commit as-is' }, { flag: 'squash (s)', desc: 'Meld into previous commit' }, { flag: 'fixup (f)', desc: 'Like squash but discard message' }, { flag: 'reword (r)', desc: 'Edit the commit message' }, { flag: 'edit (e)', desc: 'Pause for amending' }, { flag: 'drop (d)', desc: 'Remove the commit' }] },
    { command: 'git rebase --onto', description: 'Transplant a branch onto a different base.', example: 'git rebase --onto main feature/old feature/new', category: 'rebase', flags: [{ flag: '--onto <newbase>', desc: 'New base for the rebased commits' }] },
    { command: 'git rebase --autosquash', description: 'Automatically reorder fixup!/squash! commits during interactive rebase.', example: 'git rebase -i --autosquash main', category: 'rebase', flags: [{ flag: '--autosquash', desc: 'Auto-arrange fixup/squash commits' }] },
    { command: 'git rebase --autostash', description: 'Automatically stash and unstash changes around rebase.', example: 'git rebase --autostash main', category: 'rebase', flags: [{ flag: '--autostash', desc: 'Stash before rebase, apply after' }] },
    { command: 'git commit --fixup', description: 'Create a fixup commit for use with rebase --autosquash.', example: 'git commit --fixup abc1234', category: 'rebase', flags: [{ flag: '--fixup=<commit>', desc: 'Mark as fixup for a commit' }, { flag: '--squash=<commit>', desc: 'Mark as squash for a commit' }] },
    { command: 'git rebase --exec', description: 'Run a command after each rebased commit (e.g., run tests).', example: 'git rebase -i --exec "npm test" main', category: 'rebase', flags: [{ flag: '--exec "<cmd>"', desc: 'Shell command to run after each commit' }] },
    { command: 'git pull --rebase', description: 'Fetch and rebase local commits on top of upstream changes.', example: 'git pull --rebase origin main', category: 'rebase', flags: [{ flag: '--autostash', desc: 'Auto-stash local changes' }, { flag: '--rebase=merges', desc: 'Preserve merge commits during rebase' }] },

    // ── Config ──
    { command: 'git config', description: 'Get and set repository or global options.', example: 'git config --global user.name "Your Name"', category: 'config', flags: [{ flag: '--global', desc: 'Set for all repos (user-level)' }, { flag: '--local', desc: 'Set for current repo only' }, { flag: '--system', desc: 'Set for all users on the system' }, { flag: '--list', desc: 'List all configured settings' }, { flag: '--unset <key>', desc: 'Remove a setting' }] },
    { command: 'git config user.name', description: 'Set or get the author name for commits.', example: 'git config --global user.name "John Doe"', category: 'config', flags: [{ flag: '--global', desc: 'Set globally for the user' }] },
    { command: 'git config user.email', description: 'Set or get the author email for commits.', example: 'git config --global user.email "john@example.com"', category: 'config', flags: [{ flag: '--global', desc: 'Set globally for the user' }] },
    { command: 'git config core.editor', description: 'Set the default text editor for Git.', example: 'git config --global core.editor "code --wait"', category: 'config', flags: [{ flag: '"vim"', desc: 'Use Vim' }, { flag: '"code --wait"', desc: 'Use VS Code' }, { flag: '"nano"', desc: 'Use Nano' }] },
    { command: 'git config core.autocrlf', description: 'Configure line ending conversion behavior.', example: 'git config --global core.autocrlf input', category: 'config', flags: [{ flag: 'true', desc: 'Convert LF to CRLF on checkout (Windows)' }, { flag: 'input', desc: 'Convert CRLF to LF on commit (Mac/Linux)' }, { flag: 'false', desc: 'No conversion' }] },
    { command: 'git config alias', description: 'Create custom Git command shortcuts.', example: 'git config --global alias.co checkout', category: 'config', flags: [{ flag: 'alias.<name> "<cmd>"', desc: 'Create an alias' }] },
    { command: 'git config pull.rebase', description: 'Set default pull strategy to rebase instead of merge.', example: 'git config --global pull.rebase true', category: 'config', flags: [{ flag: 'true', desc: 'Rebase on pull' }, { flag: 'false', desc: 'Merge on pull (default)' }] },
    { command: 'git config --list', description: 'Show all Git configuration settings in effect.', example: 'git config --list --show-origin', category: 'config', flags: [{ flag: '--show-origin', desc: 'Show which file each setting comes from' }, { flag: '--show-scope', desc: 'Show whether local, global, or system' }] },
    { command: 'git config init.defaultBranch', description: 'Set the default branch name for new repositories.', example: 'git config --global init.defaultBranch main', category: 'config', flags: [] },
    { command: 'git config credential.helper', description: 'Configure credential storage for authentication.', example: 'git config --global credential.helper osxkeychain', category: 'config', flags: [{ flag: 'cache', desc: 'Cache in memory for 15 minutes' }, { flag: 'store', desc: 'Store plain text on disk (less secure)' }, { flag: 'osxkeychain', desc: 'Use macOS Keychain' }, { flag: 'manager', desc: 'Use Git Credential Manager' }] },
    { command: 'git config diff.tool', description: 'Set the default external diff tool.', example: 'git config --global diff.tool vscode', category: 'config', flags: [{ flag: 'vscode', desc: 'Visual Studio Code' }, { flag: 'meld', desc: 'Meld diff viewer' }, { flag: 'beyond-compare', desc: 'Beyond Compare' }] },
    { command: 'git config merge.conflictstyle', description: 'Change how merge conflicts are displayed.', example: 'git config --global merge.conflictstyle diff3', category: 'config', flags: [{ flag: 'merge', desc: 'Default two-way style' }, { flag: 'diff3', desc: 'Three-way showing common ancestor' }, { flag: 'zdiff3', desc: 'Improved three-way (Git 2.35+)' }] },
    { command: 'git config rerere.enabled', description: 'Enable recorded resolutions to auto-resolve repeated conflicts.', example: 'git config --global rerere.enabled true', category: 'config', flags: [{ flag: 'true', desc: 'Remember and replay conflict resolutions' }] },
  ];

  constructor(private router: Router) {}

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Filtering ───────────────────────────────────────────────────────────────

  get filteredCommands(): GitCommandEntry[] {
    let results = this.gitCommands;

    if (this.activeCategory !== 'all') {
      results = results.filter(c => c.category === this.activeCategory);
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      results = results.filter(c =>
        c.command.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.example.toLowerCase().includes(q) ||
        c.flags.some(f => f.flag.toLowerCase().includes(q) || f.desc.toLowerCase().includes(q))
      );
    }

    return results;
  }

  get resultCount(): number {
    return this.filteredCommands.length;
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
    if (q === 'force push' || q === 'force-push' || q === '--force push') {
      this.eggs.trigger('git-yolo');
    }
  }

  setCategory(cat: GitCategory) {
    this.activeCategory = cat;
  }

  toggleCheatsheet() {
    this.cheatsheetMode = !this.cheatsheetMode;
    if (this.cheatsheetMode) {
      this.selectedCommand = null;
    }
  }

  // ── Detail view ─────────────────────────────────────────────────────────────

  selectCommand(entry: GitCommandEntry) {
    if (this.cheatsheetMode) return;
    this.selectedCommand = this.selectedCommand?.command === entry.command ? null : entry;
  }

  closeDetail() {
    this.selectedCommand = null;
  }

  // ── Copy ────────────────────────────────────────────────────────────────────

  async copyCommand(cmd: string, event?: Event) {
    if (event) event.stopPropagation();
    if (!this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(cmd);
      this.copied = true;
      this.copiedCommand = cmd;
      setTimeout(() => { this.copied = false; this.copiedCommand = ''; }, 2000);
    } catch {
      this.fallbackCopy(cmd);
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
    this.copiedCommand = text;
    setTimeout(() => { this.copied = false; this.copiedCommand = ''; }, 2000);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  getCategoryColor(category: string): string {
    const match = this.categories.find(c => c.key === category);
    return match ? match.color : 'var(--text-muted)';
  }

  getCategoryLabel(category: string): string {
    const match = this.categories.find(c => c.key === category);
    return match ? match.label : '';
  }

  isCopied(cmd: string): boolean {
    return this.copied && this.copiedCommand === cmd;
  }
}
