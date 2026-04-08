import { z } from 'zod';

const FLAG_REGEX = /^Exploit3rs\{[a-zA-Z0-9_]+\}$/;
const CATEGORIES = ['web', 'forensics', 'crypto', 'osint', 'network', 'pwn'];
const DIFFICULTIES = ['warm_up', 'easy', 'medium', 'hard'];
const POINT_VALUES = [50, 150, 350, 700];

export const challengeSpecSchema = z.object({
  challengeName: z
    .string()
    .min(3, 'Challenge name too short')
    .max(100, 'Challenge name too long'),

  narrative: z
    .string()
    .min(50, 'Narrative too short, needs at least 50 characters')
    .max(2000, 'Narrative too long'),

  category: z.enum(CATEGORIES),

  difficulty: z.enum(DIFFICULTIES),

  points: z.number().refine((v) => POINT_VALUES.includes(v), {
    message: `Points must be one of: ${POINT_VALUES.join(', ')}`,
  }),

  cvss: z.object({
    score: z.number().min(0).max(10),
    severity: z.string(),
    vector: z.string(),
    complexity: z.string(),
  }).optional(),

  cwe: z.object({
    id: z.string(),
    name: z.string(),
  }).optional(),

  mitre: z.object({
    technique: z.string(),
    name: z.string(),
  }).optional(),

  techStack: z
    .array(z.string())
    .min(1, 'Tech stack must have at least one item'),

  exploitPath: z
    .array(z.string().min(5))
    .min(2, 'Exploit path needs at least 2 steps')
    .max(10, 'Exploit path too long'),

  flag: z
    .string()
    .regex(FLAG_REGEX, 'Flag must match Exploit3rs{...} format with alphanumeric and underscores'),

  honeypotFlag: z
    .string()
    .regex(FLAG_REGEX, 'Honeypot flag must match Exploit3rs{...} format')
    .nullable()
    .optional(),

  antiAiCountermeasures: z
    .array(z.string())
    .min(2, 'Need at least 2 anti-AI countermeasures'),

  reviewerNote: z
    .string()
    .min(20, 'Reviewer note too short')
    .max(500, 'Reviewer note too long'),

  estimatedBuildTimeMin: z.number().min(5).max(60).optional(),

  learningObjective: z.string().min(10).optional(),

  toolsRequired: z.array(z.string()).optional(),
});

/**
 * Validate a spec object against the schema.
 * Returns { success, data, errors }
 */
export function validateSpec(spec) {
  const result = challengeSpecSchema.safeParse(spec);
  if (result.success) {
    return { success: true, data: result.data, errors: [] };
  }
  return {
    success: false,
    data: null,
    errors: result.error.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    })),
  };
}
