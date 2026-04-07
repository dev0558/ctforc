export default {
  id: 'osint',
  name: 'OSINT',
  description: 'Open-source intelligence gathering: social media analysis, EXIF metadata, geolocation, domain investigation, and digital footprint tracing.',
  icon: 'eye',
  color: '#4ade80',
  defaultTechStack: ['Python', 'ExifTool', 'HTML/CSS'],
  difficulties: [
    { level: 'easy', points: [100, 200], estimatedMinutes: 20, description: 'Single source, EXIF data, basic search' },
    { level: 'medium', points: [300, 400], estimatedMinutes: 45, description: 'Cross-platform correlation, hidden metadata' },
    { level: 'hard', points: [500], estimatedMinutes: 90, description: 'Multi-step investigation, geolocation chains' },
  ],
  outputFiles: ['setup_profiles.py', 'generate_artifacts.py', 'images/', 'writeup.md'],
  formFields: [
    { name: 'osintType', label: 'Investigation Type', type: 'select', options: ['Social Media', 'Geolocation', 'Image Analysis', 'Domain/DNS', 'Email Tracing', 'Username Search', 'Document Metadata', 'Other'] },
    { name: 'platforms', label: 'Platforms Involved', type: 'select', options: ['Fake Website', 'Social Profile', 'Image Set', 'Domain Records', 'Email Headers', 'Multiple Sources'] },
    { name: 'requiresGeolocation', label: 'Requires Geolocation', type: 'checkbox', default: false },
  ],
  exampleIdeas: [
    'Track a fake employee through social media breadcrumbs to find their secret project codename',
    'Analyze a set of photos with EXIF data to determine the location of a hidden server',
    'Investigate a suspicious domain registration chain to uncover a phishing infrastructure',
  ],
  promptHints: 'Create realistic fake profiles and digital breadcrumbs. Use real-looking but entirely fictional data. EXIF metadata should contain genuine GPS coordinates to fictional locations.',
};
