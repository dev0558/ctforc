import { z } from 'zod';

const fileSchema = z.object({
  path: z.string().min(1),
  language: z.string().min(1),
  content: z.string().min(1),
});

export const osintBuildOutputSchema = z.array(fileSchema).refine(
  (files) => {
    const paths = files.map((f) => f.path);
    return paths.includes('writeup.md');
  },
  { message: 'OSINT build must include writeup.md' }
);

export default osintBuildOutputSchema;
