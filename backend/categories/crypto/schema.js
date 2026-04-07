import { z } from 'zod';

const fileSchema = z.object({
  path: z.string().min(1),
  language: z.string().min(1),
  content: z.string().min(1),
});

export const cryptoBuildOutputSchema = z.array(fileSchema).refine(
  (files) => {
    const paths = files.map((f) => f.path);
    return paths.includes('encrypt.py') && paths.includes('writeup.md');
  },
  { message: 'Crypto build must include encrypt.py and writeup.md' }
);

export default cryptoBuildOutputSchema;
