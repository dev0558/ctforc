import { Router } from 'express';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve, extname } from 'path';
import config from '../../config.js';

const router = Router();

/**
 * GET /api/challenge-files/:jobId
 * Returns the actual content of all generated files for review.
 */
router.get('/:jobId', (req, res) => {
  try {
    const storagePath = config.storagePath;
    const challengeDir = join(storagePath, 'challenges', req.params.jobId);

    if (!existsSync(challengeDir)) {
      return res.status(404).json({ error: 'Challenge files not found. Builder may still be processing.' });
    }

    const files = {};
    readDirRecursive(challengeDir, challengeDir, files);

    res.json({
      jobId: req.params.jobId,
      totalFiles: Object.keys(files).length,
      files,
    });
  } catch (err) {
    console.error('[ChallengeFiles] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/challenge-files/:jobId/:filepath(*)
 * Returns a single file's content.
 */
router.get('/:jobId/*', (req, res) => {
  try {
    const filePath = req.params[0]; // everything after /:jobId/
    const storagePath = config.storagePath;
    const fullPath = join(storagePath, 'challenges', req.params.jobId, filePath);

    // Security: prevent path traversal
    const resolvedPath = resolve(fullPath);
    const baseDir = resolve(storagePath, 'challenges', req.params.jobId);
    if (!resolvedPath.startsWith(baseDir)) {
      return res.status(403).json({ error: 'Path traversal not allowed' });
    }

    if (!existsSync(fullPath)) {
      return res.status(404).json({ error: `File not found: ${filePath}` });
    }

    const content = readFileSync(fullPath, 'utf-8');
    const ext = extname(filePath).slice(1);

    res.json({
      path: filePath,
      content,
      size: Buffer.byteLength(content),
      language: detectLanguage(ext, filePath),
    });
  } catch (err) {
    console.error('[ChallengeFiles] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function readDirRecursive(dir, baseDir, result) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relativePath = relative(baseDir, fullPath);
    if (entry.isDirectory()) {
      readDirRecursive(fullPath, baseDir, result);
    } else {
      const content = readFileSync(fullPath, 'utf-8');
      const ext = extname(entry.name).slice(1);
      result[relativePath] = {
        content,
        size: Buffer.byteLength(content),
        language: detectLanguage(ext, entry.name),
      };
    }
  }
}

function detectLanguage(ext, filename = '') {
  if (filename.toLowerCase() === 'dockerfile') return 'dockerfile';
  if (filename.toLowerCase() === 'makefile') return 'makefile';
  const map = {
    py: 'python', js: 'javascript', jsx: 'jsx', ts: 'typescript',
    c: 'c', cpp: 'cpp', h: 'c', java: 'java', rb: 'ruby', php: 'php',
    html: 'html', css: 'css', sql: 'sql', sh: 'bash', bash: 'bash',
    yml: 'yaml', yaml: 'yaml', json: 'json', md: 'markdown',
    txt: 'text', conf: 'text', cfg: 'text', pem: 'text', key: 'text',
  };
  return map[ext.toLowerCase()] || 'text';
}

export default router;
