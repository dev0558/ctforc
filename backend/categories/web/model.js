export default {
  id: 'web',
  name: 'Web Exploitation',
  description: 'SQL injection, XSS, SSTI, SSRF, authentication bypass, file upload, deserialization, and other web application vulnerabilities.',
  icon: 'globe',
  color: '#57cbff',
  defaultTechStack: ['Docker', 'Python', 'Flask', 'Nginx'],
  difficulties: [
    { level: 'easy', points: [100, 200], estimatedMinutes: 20, description: 'Basic injection or auth bypass' },
    { level: 'medium', points: [300, 400], estimatedMinutes: 45, description: 'Chained exploits, WAF bypass, SSTI' },
    { level: 'hard', points: [500], estimatedMinutes: 90, description: 'Complex deserialization, multi-step RCE' },
  ],
  outputFiles: ['Dockerfile', 'docker-compose.yml', 'app.py', 'requirements.txt', 'exploit.py', 'writeup.md'],
  formFields: [
    { name: 'vulnType', label: 'Vulnerability Type', type: 'select', options: ['SQL Injection', 'XSS', 'SSTI', 'SSRF', 'File Upload', 'Auth Bypass', 'Deserialization', 'Path Traversal', 'Command Injection', 'IDOR', 'XXE', 'Prototype Pollution', 'Other'] },
    { name: 'framework', label: 'Target Framework', type: 'select', options: ['Flask', 'Express.js', 'Django', 'Spring', 'Laravel', 'WordPress', 'Custom'] },
    { name: 'hasWAF', label: 'Include WAF', type: 'checkbox', default: false },
    { name: 'hasAuth', label: 'Requires Authentication', type: 'checkbox', default: false },
  ],
  exampleIdeas: [
    'SQL injection in a login form with WAF bypass using double encoding',
    'Server-side template injection in a Jinja2 email template generator',
    'Insecure deserialization in a Java Spring session cookie',
  ],
  promptHints: 'Focus on realistic web application scenarios. Include Dockerfile for isolated deployment. Vulnerable endpoints should be discoverable through enumeration.',
};
