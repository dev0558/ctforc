import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '..', '.env') });

export default {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  authToken: process.env.AUTH_TOKEN || 'dev-token-change-me',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  storagePath: resolve(__dirname, process.env.STORAGE_PATH || './storage'),
};
