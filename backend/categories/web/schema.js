/**
 * Web Exploitation — Zod schema for validating builder output.
 */
import { z } from 'zod';

const fileSchema = z.object({
  path: z.string().min(1),
  language: z.string().min(1),
  content: z.string().min(1),
});

export const webBuildOutputSchema = z.array(fileSchema).refine(
  (files) => {
    const paths = files.map((f) => f.path);
    return paths.includes('Dockerfile') && paths.includes('writeup.md');
  },
  { message: 'Web build must include Dockerfile and writeup.md' }
);

export default webBuildOutputSchema;
