import { z } from 'zod';

const fileSchema = z.object({
  path: z.string().min(1),
  language: z.string().min(1),
  content: z.string().min(1),
});

export const pwnBuildOutputSchema = z.array(fileSchema).refine(
  (files) => {
    const paths = files.map((f) => f.path);
    return paths.includes('vuln.c') && paths.includes('writeup.md');
  },
  { message: 'Pwn build must include vuln.c and writeup.md' }
);

export default pwnBuildOutputSchema;
