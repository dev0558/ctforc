import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const DOCKER_CATEGORIES = ['web', 'pwn'];
const CONTAINER_START_WAIT = 5000;

/**
 * Test a generated challenge: build, run, solve, verify flag.
 */
export async function testChallenge(jobId, category, files, realFlag, storagePath) {
  const results = {
    tested: true,
    category,
    dockerBuild: null,
    containerHealth: null,
    artifactGeneration: null,
    solveScript: null,
    flagVerification: { realFlagFound: false, honeypotNotLeaked: true },
    overallPass: false,
    errors: [],
    duration: 0,
  };

  const startTime = Date.now();
  const challengeDir = join(storagePath, 'challenges', jobId);

  try {
    if (DOCKER_CATEGORIES.includes(category)) {
      const dockerAvailable = checkDocker();
      if (!dockerAvailable) {
        results.errors.push('Docker not available, skipping container tests');
        results.dockerBuild = { success: false, error: 'Docker not available' };
        results.solveScript = await runSolveScript(challengeDir, null);
      } else {
        results.dockerBuild = await buildDockerImage(jobId, challengeDir);
        if (results.dockerBuild.success) {
          const containerInfo = await startContainer(jobId);
          results.containerHealth = await checkHealth(containerInfo.port);
          results.solveScript = await runSolveScript(challengeDir, containerInfo.port);
          await cleanup(jobId);
        }
      }
    } else {
      results.artifactGeneration = await runArtifactGenerator(challengeDir);
      results.solveScript = await runSolveScript(challengeDir, null);
    }

    if (results.solveScript && results.solveScript.output) {
      results.flagVerification.realFlagFound = results.solveScript.output.includes(realFlag);
    }

    results.overallPass =
      results.flagVerification.realFlagFound &&
      (results.dockerBuild === null || results.dockerBuild.success) &&
      (results.artifactGeneration === null || results.artifactGeneration.success);
  } catch (err) {
    results.errors.push(err.message);
    try { await cleanup(jobId); } catch {}
  }

  results.duration = Date.now() - startTime;
  return results;
}

function checkDocker() {
  try {
    execSync('docker info', { stdio: 'pipe', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

async function buildDockerImage(jobId, challengeDir) {
  const sourceDir = join(challengeDir, 'source');
  const tag = `ctf-test-${jobId.substring(0, 8)}`;

  if (!existsSync(join(sourceDir, 'Dockerfile'))) {
    return { success: false, error: 'No Dockerfile found in source/' };
  }

  try {
    const start = Date.now();
    const output = execSync(`docker build -t ${tag} .`, {
      cwd: sourceDir,
      stdio: 'pipe',
      timeout: 120000,
    }).toString();

    return {
      success: true,
      tag,
      duration: `${Math.round((Date.now() - start) / 1000)}s`,
      output: output.slice(-500),
    };
  } catch (err) {
    return {
      success: false,
      error: err.stderr?.toString().slice(-500) || err.message,
    };
  }
}

async function startContainer(jobId) {
  const tag = `ctf-test-${jobId.substring(0, 8)}`;
  const name = `ctf-run-${jobId.substring(0, 8)}`;

  try {
    execSync(`docker run -d --name ${name} -p 127.0.0.1:0:80 ${tag}`, {
      stdio: 'pipe',
      timeout: 10000,
    });

    await new Promise((r) => setTimeout(r, CONTAINER_START_WAIT));

    const portOutput = execSync(`docker port ${name} 80`, { stdio: 'pipe' }).toString().trim();
    const port = portOutput.split(':').pop();

    return { name, port: parseInt(port) };
  } catch (err) {
    return { name, port: null, error: err.message };
  }
}

async function checkHealth(port) {
  if (!port) return { success: false, error: 'No port assigned' };

  try {
    const start = Date.now();
    const output = execSync(`curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${port}/`, {
      stdio: 'pipe',
      timeout: 10000,
    }).toString().trim();

    return {
      success: output === '200' || output === '302' || output === '301',
      statusCode: parseInt(output),
      responseTime: `${Date.now() - start}ms`,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function runArtifactGenerator(challengeDir) {
  const generatorPaths = [
    join(challengeDir, 'source', 'generate_artifacts.py'),
    join(challengeDir, 'source', 'generate.py'),
    join(challengeDir, 'source', 'generate_breadcrumbs.py'),
    join(challengeDir, 'source', 'generate_capture.py'),
    join(challengeDir, 'source', 'encrypt.py'),
  ];

  const generator = generatorPaths.find((p) => existsSync(p));
  if (!generator) return { success: false, error: 'No generator script found' };

  try {
    const output = execSync(`python3 "${generator}"`, {
      cwd: join(challengeDir, 'source'),
      stdio: 'pipe',
      timeout: 30000,
    }).toString();

    return { success: true, output: output.slice(-500) };
  } catch (err) {
    return { success: false, error: err.stderr?.toString().slice(-500) || err.message };
  }
}

async function runSolveScript(challengeDir, port) {
  const solvePaths = [
    join(challengeDir, 'writeup', 'solve.py'),
    join(challengeDir, 'writeup', 'solve.sh'),
    join(challengeDir, 'writeup', 'exploit.py'),
  ];

  const solver = solvePaths.find((p) => existsSync(p));
  if (!solver) return { success: false, error: 'No solve script found', output: '' };

  try {
    const env = { ...process.env };
    if (port) {
      env.TARGET_URL = `http://127.0.0.1:${port}`;
      env.TARGET_HOST = '127.0.0.1';
      env.TARGET_PORT = String(port);
    }

    const cmd = solver.endsWith('.py') ? `python3 "${solver}"` : `bash "${solver}"`;
    const output = execSync(cmd, {
      cwd: join(challengeDir, 'writeup'),
      stdio: 'pipe',
      timeout: 30000,
      env,
    }).toString();

    return { success: true, output: output.slice(-1000) };
  } catch (err) {
    const output = (err.stdout?.toString() || '') + (err.stderr?.toString() || '');
    return { success: false, error: err.message, output: output.slice(-1000) };
  }
}

async function cleanup(jobId) {
  const name = `ctf-run-${jobId.substring(0, 8)}`;
  const tag = `ctf-test-${jobId.substring(0, 8)}`;

  try { execSync(`docker stop ${name}`, { stdio: 'pipe', timeout: 10000 }); } catch {}
  try { execSync(`docker rm ${name}`, { stdio: 'pipe', timeout: 10000 }); } catch {}
  try { execSync(`docker rmi ${tag}`, { stdio: 'pipe', timeout: 10000 }); } catch {}
}
