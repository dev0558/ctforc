import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import config from '../config.js';

let connection = null;
let researchQueue = null;
let architectQueue = null;
let developerQueue = null;

export function getConnection() {
  if (!connection) {
    connection = new IORedis(config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
    });
    connection.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
    });
  }
  return connection;
}

export function getResearchQueue() {
  if (!researchQueue) {
    researchQueue = new Queue('research-queue', { connection: getConnection() });
  }
  return researchQueue;
}

export function getArchitectQueue() {
  if (!architectQueue) {
    architectQueue = new Queue('architect-queue', { connection: getConnection() });
  }
  return architectQueue;
}

export function getDeveloperQueue() {
  if (!developerQueue) {
    developerQueue = new Queue('developer-queue', { connection: getConnection() });
  }
  return developerQueue;
}

// Backwards compat alias
export function getBuildQueue() {
  return getDeveloperQueue();
}

export async function addResearchJob(jobId) {
  const queue = getResearchQueue();
  await queue.add('research', { jobId }, { jobId });
}

export async function addArchitectJob(jobId) {
  const queue = getArchitectQueue();
  await queue.add('architect', { jobId }, { jobId: `architect-${jobId}-${Date.now()}` });
}

export async function addDeveloperJob(jobId) {
  const queue = getDeveloperQueue();
  await queue.add('develop', { jobId }, { jobId: `develop-${jobId}-${Date.now()}` });
}

// Backwards compat alias
export async function addBuildJob(jobId) {
  return addDeveloperJob(jobId);
}

export async function addReworkSpecJob(jobId, feedback) {
  const queue = getArchitectQueue();
  await queue.add('rework-spec', { jobId, feedback, type: 'rework-spec' }, { jobId: `rework-spec-${jobId}-${Date.now()}` });
}

export async function addReworkBuildJob(jobId, feedback) {
  const queue = getDeveloperQueue();
  await queue.add('rework-build', { jobId, feedback, type: 'rework-build' }, { jobId: `rework-build-${jobId}-${Date.now()}` });
}
