import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import config from '../config.js';

let connection = null;
let researchQueue = null;
let buildQueue = null;

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

export function getBuildQueue() {
  if (!buildQueue) {
    buildQueue = new Queue('build-queue', { connection: getConnection() });
  }
  return buildQueue;
}

export async function addResearchJob(jobId) {
  const queue = getResearchQueue();
  await queue.add('research', { jobId }, { jobId });
}

export async function addBuildJob(jobId) {
  const queue = getBuildQueue();
  await queue.add('build', { jobId }, { jobId });
}
