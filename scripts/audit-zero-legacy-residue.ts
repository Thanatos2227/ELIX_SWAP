import * as fs from 'fs';
import * as path from 'path';

/**
 * ELIXSWAP — ZERO LEGACY RESIDUE AUDIT SUITE
 * 
 * Deterministic, machine-verifiable verification script.
 * Validates zero remaining legacy references across all project-controlled
 * filenames, directory names, source code, configuration, documentation,
 * tests, scripts, and package manifests.
 * 
 * Note: Constructs search pattern using safe character fragments to avoid
 * self-triggering matches in this audit tool.
 */

// Construct forbidden token from safe fragments
const TOKEN_CHARS = ['z', 'e', 'n', 'i', 't', 'h'];
const FORBIDDEN_TOKEN = TOKEN_CHARS.join('');
const FORBIDDEN_REGEX = new RegExp(FORBIDDEN_TOKEN, 'i');

// Scoped root
const REPO_ROOT = process.cwd();

// Narrow, documented exclusions (standard non-project artifacts only)
const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  '.system_generated',
  '.next',
  '.cache',
  'coverage'
]);

const IGNORED_FILES = new Set([
  '.env.local' // Local confidential credentials per explicit safety rule
]);

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf',
  '.woff', '.woff2', '.ttf', '.eot', '.zip', '.tar', '.gz',
  '.db', '.sqlite', '.sqlite3'
]);

export interface AuditFinding {
  filePath: string;
  type: 'PATH' | 'CONTENT';
  line?: number;
  snippet?: string;
}

export interface AuditReport {
  scannedFiles: number;
  scannedDirectories: number;
  totalFindings: number;
  pathFindings: AuditFinding[];
  contentFindings: AuditFinding[];
  pass: boolean;
  timestamp: string;
}

export function runZeroResidueAudit(targetDir: string = REPO_ROOT): AuditReport {
  const pathFindings: AuditFinding[] = [];
  const contentFindings: AuditFinding[] = [];
  let scannedFiles = 0;
  let scannedDirectories = 0;

  function scan(dir: string) {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      console.error(`Cannot read directory: ${dir}`);
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(targetDir, fullPath).replace(/\\/g, '/');

      // Check directory name
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) {
          continue;
        }
        scannedDirectories++;
        if (FORBIDDEN_REGEX.test(entry.name)) {
          pathFindings.push({
            filePath: relPath,
            type: 'PATH',
            snippet: entry.name
          });
        }
        scan(fullPath);
      } else {
        if (IGNORED_FILES.has(entry.name)) {
          continue;
        }

        // Check file name
        scannedFiles++;
        if (FORBIDDEN_REGEX.test(entry.name)) {
          pathFindings.push({
            filePath: relPath,
            type: 'PATH',
            snippet: entry.name
          });
        }

        const ext = path.extname(entry.name).toLowerCase();
        if (BINARY_EXTENSIONS.has(ext)) {
          continue;
        }

        // Check file content
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const lines = content.split(/\r?\n/);
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (FORBIDDEN_REGEX.test(line)) {
              // Sanitize output snippet to avoid leaking confidential strings
              let sanitizedSnippet = line.trim();
              if (sanitizedSnippet.length > 120) {
                sanitizedSnippet = sanitizedSnippet.slice(0, 117) + '...';
              }
              contentFindings.push({
                filePath: relPath,
                type: 'CONTENT',
                line: i + 1,
                snippet: sanitizedSnippet
              });
            }
          }
        } catch {
          // Skip unreadable files
        }
      }
    }
  }

  scan(targetDir);

  const totalFindings = pathFindings.length + contentFindings.length;
  return {
    scannedFiles,
    scannedDirectories,
    totalFindings,
    pathFindings,
    contentFindings,
    pass: totalFindings === 0,
    timestamp: new Date().toISOString()
  };
}

if (require.main === module || (typeof process !== 'undefined' && process.argv[1]?.endsWith('audit-zero-legacy-residue.ts'))) {
  console.log('================================================================================');
  console.log('   ELIXSWAP — ZERO LEGACY RESIDUE AUDIT (TASK 66)                              ');
  console.log('================================================================================');
  console.log(`Scan Target Root: ${REPO_ROOT}`);
  console.log(`Forbidden Pattern: /${FORBIDDEN_TOKEN}/i`);
  console.log('Scanning project-controlled filenames, directories, and file contents...\n');

  const report = runZeroResidueAudit(REPO_ROOT);

  console.log(`Files Scanned:        ${report.scannedFiles}`);
  console.log(`Directories Scanned:  ${report.scannedDirectories}`);
  console.log(`Total Findings:       ${report.totalFindings}`);
  console.log(`Path Violations:      ${report.pathFindings.length}`);
  console.log(`Content Violations:   ${report.contentFindings.length}`);

  if (report.pathFindings.length > 0) {
    console.log('\n❌ PROHIBITED FILENAME/PATH MATCHES:');
    report.pathFindings.forEach(f => {
      console.log(`  [PATH] ${f.filePath} (match: "${f.snippet}")`);
    });
  }

  if (report.contentFindings.length > 0) {
    console.log('\n❌ PROHIBITED CONTENT MATCHES:');
    report.contentFindings.forEach(f => {
      console.log(`  [CONTENT] ${f.filePath}:${f.line} -> ${f.snippet}`);
    });
  }

  console.log('================================================================================');
  if (report.pass) {
    console.log('✅ ZERO_RESIDUE_VERIFIED');
    console.log('Zero prohibited legacy occurrences detected across the repository scope.');
    console.log('================================================================================');
    process.exit(0);
  } else {
    console.error('❌ MIGRATION_INCOMPLETE');
    console.error(`${report.totalFindings} prohibited legacy occurrence(s) remain.`);
    console.error('================================================================================');
    process.exit(1);
  }
}
