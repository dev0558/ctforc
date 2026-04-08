// CWE to readable category + CTF category mapping

const CWE_MAP = {
  'CWE-79':   { name: 'Cross-site Scripting (XSS)', category: 'web' },
  'CWE-89':   { name: 'SQL Injection', category: 'web' },
  'CWE-94':   { name: 'Code Injection', category: 'web' },
  'CWE-78':   { name: 'OS Command Injection', category: 'web' },
  'CWE-77':   { name: 'Command Injection', category: 'web' },
  'CWE-22':   { name: 'Path Traversal', category: 'web' },
  'CWE-23':   { name: 'Relative Path Traversal', category: 'web' },
  'CWE-434':  { name: 'Unrestricted File Upload', category: 'web' },
  'CWE-918':  { name: 'Server-Side Request Forgery (SSRF)', category: 'web' },
  'CWE-611':  { name: 'XML External Entity (XXE)', category: 'web' },
  'CWE-502':  { name: 'Deserialization of Untrusted Data', category: 'web' },
  'CWE-287':  { name: 'Improper Authentication', category: 'web' },
  'CWE-284':  { name: 'Improper Access Control', category: 'web' },
  'CWE-862':  { name: 'Missing Authorization', category: 'web' },
  'CWE-863':  { name: 'Incorrect Authorization', category: 'web' },
  'CWE-352':  { name: 'Cross-Site Request Forgery (CSRF)', category: 'web' },
  'CWE-1321': { name: 'Prototype Pollution', category: 'web' },
  'CWE-917':  { name: 'Expression Language Injection', category: 'web' },
  'CWE-400':  { name: 'Uncontrolled Resource Consumption', category: 'web' },
  'CWE-200':  { name: 'Information Disclosure', category: 'web' },
  'CWE-209':  { name: 'Error Information Leak', category: 'web' },
  'CWE-522':  { name: 'Insufficiently Protected Credentials', category: 'web' },
  'CWE-798':  { name: 'Hardcoded Credentials', category: 'web' },
  'CWE-120':  { name: 'Buffer Overflow', category: 'pwn' },
  'CWE-121':  { name: 'Stack Buffer Overflow', category: 'pwn' },
  'CWE-122':  { name: 'Heap Buffer Overflow', category: 'pwn' },
  'CWE-125':  { name: 'Out-of-bounds Read', category: 'pwn' },
  'CWE-787':  { name: 'Out-of-bounds Write', category: 'pwn' },
  'CWE-416':  { name: 'Use After Free', category: 'pwn' },
  'CWE-190':  { name: 'Integer Overflow', category: 'pwn' },
  'CWE-134':  { name: 'Format String Vulnerability', category: 'pwn' },
  'CWE-327':  { name: 'Use of Broken Crypto Algorithm', category: 'crypto' },
  'CWE-326':  { name: 'Inadequate Encryption Strength', category: 'crypto' },
  'CWE-330':  { name: 'Insufficient Randomness', category: 'crypto' },
  'CWE-328':  { name: 'Reversible One-Way Hash', category: 'crypto' },
  'CWE-295':  { name: 'Improper Certificate Validation', category: 'network' },
  'CWE-319':  { name: 'Cleartext Transmission', category: 'network' },
  'CWE-300':  { name: 'Channel Accessible by Non-Endpoint', category: 'network' },
};

// MITRE ATT&CK mapping (simplified)

const MITRE_MAP = {
  web:       { technique: 'T1190', name: 'Exploit Public-Facing Application', tactic: 'Initial Access' },
  pwn:       { technique: 'T1203', name: 'Exploitation for Client Execution', tactic: 'Execution' },
  crypto:    { technique: 'T1573', name: 'Encrypted Channel', tactic: 'Command and Control' },
  network:   { technique: 'T1557', name: 'Adversary-in-the-Middle', tactic: 'Collection' },
  forensics: { technique: 'T1070', name: 'Indicator Removal', tactic: 'Defense Evasion' },
  osint:     { technique: 'T1589', name: 'Gather Victim Identity Information', tactic: 'Reconnaissance' },
};

// Tech stack detection from CPE strings

const CPE_TECH_MAP = {
  apache: 'Apache', tomcat: 'Tomcat', nginx: 'Nginx',
  flask: 'Flask', django: 'Django', express: 'Express.js',
  node: 'Node.js', nodejs: 'Node.js', python: 'Python',
  java: 'Java', php: 'PHP', wordpress: 'WordPress',
  drupal: 'Drupal', joomla: 'Joomla', spring: 'Spring',
  struts: 'Apache Struts', confluence: 'Confluence', jira: 'Jira',
  jenkins: 'Jenkins', gitlab: 'GitLab', grafana: 'Grafana',
  redis: 'Redis', mysql: 'MySQL', postgresql: 'PostgreSQL',
  mongodb: 'MongoDB', docker: 'Docker', kubernetes: 'Kubernetes',
  linux: 'Linux', windows: 'Windows', laravel: 'Laravel',
  rails: 'Ruby on Rails', ruby: 'Ruby', dotnet: '.NET', iis: 'IIS',
};

/**
 * Enrich raw NVD data with category, MITRE, tech stack, and difficulty
 */
export function enrichContext(nvdData, categorizedRefs) {
  // 1. Map CWEs to categories
  let detectedCategory = 'web'; // default
  const cweDetails = [];

  for (const cweId of nvdData.cwes) {
    const mapped = CWE_MAP[cweId];
    if (mapped) {
      cweDetails.push({ id: cweId, ...mapped });
      detectedCategory = mapped.category;
    } else {
      cweDetails.push({ id: cweId, name: cweId, category: 'web' });
    }
  }

  // 2. MITRE ATT&CK
  const mitre = MITRE_MAP[detectedCategory] || MITRE_MAP.web;

  // 3. Detect tech stack from CPE strings
  const techStack = new Set();
  for (const product of nvdData.affected) {
    const cpeStr = (product.cpe || '').toLowerCase();
    for (const [keyword, tech] of Object.entries(CPE_TECH_MAP)) {
      if (cpeStr.includes(keyword)) techStack.add(tech);
    }
    if (product.product && product.product !== 'unknown') {
      techStack.add(product.product.charAt(0).toUpperCase() + product.product.slice(1));
    }
  }

  // 4. Suggest difficulty
  const difficulty = suggestDifficulty(nvdData.cvss, categorizedRefs);

  // 5. Suggest points
  const pointsMap = { warm_up: 50, easy: 150, medium: 350, hard: 700 };
  const points = pointsMap[difficulty] || 350;

  return {
    cveId: nvdData.cveId,
    description: nvdData.description,
    published: nvdData.published,
    cvss: nvdData.cvss,
    cwes: cweDetails,
    mitre,
    affected: nvdData.affected,
    techStack: [...techStack],
    detectedCategory,
    references: categorizedRefs,
    exploitExists: categorizedRefs.pocs.length > 0,
    suggestedDifficulty: difficulty,
    suggestedPoints: points,
  };
}

/**
 * Difficulty heuristic based on CVSS metrics and exploit availability
 */
function suggestDifficulty(cvss, refs) {
  let score = 0;

  if (cvss.complexity === 'LOW') score += 0;
  else if (cvss.complexity === 'HIGH') score += 2;
  else score += 1;

  if (cvss.privilegesRequired === 'NONE') score += 0;
  else if (cvss.privilegesRequired === 'LOW') score += 1;
  else score += 2;

  if (cvss.userInteraction === 'NONE') score += 0;
  else score += 1;

  if (refs.pocs.length > 0) score -= 1;
  if (refs.writeups.length > 0) score -= 1;

  if (score <= 0) return 'warm_up';
  if (score <= 1) return 'easy';
  if (score <= 3) return 'medium';
  return 'hard';
}
