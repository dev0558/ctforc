const NVD_BASE = 'https://services.nvd.nist.gov/rest/json/cves/2.0';

// Rate limit: NVD allows 5 requests per 30 seconds without API key
const RETRY_DELAYS = [2000, 5000, 15000];

/**
 * Fetch CVE data from NVD REST API v2.0
 * Returns structured CVE object or throws on failure.
 */
export async function fetchCVE(cveId) {
  let lastError = null;

  for (let attempt = 0; attempt < RETRY_DELAYS.length + 1; attempt++) {
    try {
      const url = `${NVD_BASE}?cveId=${encodeURIComponent(cveId)}`;
      console.log(`[NVD] Fetching ${cveId} (attempt ${attempt + 1})`);

      const res = await fetch(url, {
        headers: { 'User-Agent': 'CTF-Orchestrator/1.0' },
      });

      if (res.status === 403 || res.status === 429) {
        const delay = RETRY_DELAYS[attempt] || 15000;
        console.log(`[NVD] Rate limited. Waiting ${delay / 1000}s...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      if (!res.ok) {
        throw new Error(`NVD API returned ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();

      if (!data.vulnerabilities || data.vulnerabilities.length === 0) {
        throw new Error(`CVE ${cveId} not found in NVD`);
      }

      const cve = data.vulnerabilities[0].cve;
      return parseCVEResponse(cveId, cve);
    } catch (err) {
      lastError = err;
      if (attempt < RETRY_DELAYS.length) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
      }
    }
  }

  throw new Error(`Failed to fetch ${cveId} from NVD: ${lastError?.message}`);
}

/**
 * Parse raw NVD response into a clean structure
 */
function parseCVEResponse(cveId, cve) {
  // Extract CVSS v3.1 (preferred) or v3.0
  const cvssData =
    cve.metrics?.cvssMetricV31?.[0]?.cvssData ||
    cve.metrics?.cvssMetricV30?.[0]?.cvssData ||
    null;

  // Extract CWE
  const weaknesses = cve.weaknesses || [];
  const cweList = [];
  for (const w of weaknesses) {
    for (const desc of w.description || []) {
      if (desc.value && desc.value !== 'NVD-CWE-noinfo' && desc.value !== 'NVD-CWE-Other') {
        cweList.push(desc.value);
      }
    }
  }

  // Extract affected products (CPE)
  const affected = [];
  const configs = cve.configurations || [];
  for (const cfg of configs) {
    for (const node of cfg.nodes || []) {
      for (const match of node.cpeMatch || []) {
        if (match.vulnerable) {
          const parts = (match.criteria || '').split(':');
          if (parts.length >= 5) {
            affected.push({
              vendor: parts[3] || 'unknown',
              product: parts[4] || 'unknown',
              versionStart: match.versionStartIncluding || null,
              versionEnd: match.versionEndExcluding || match.versionEndIncluding || null,
              cpe: match.criteria,
            });
          }
        }
      }
    }
  }

  // Extract reference URLs
  const references = (cve.references || []).map((ref) => ({
    url: ref.url,
    source: ref.source || 'unknown',
    tags: ref.tags || [],
  }));

  // Description (English)
  const description =
    cve.descriptions?.find((d) => d.lang === 'en')?.value || 'No description available';

  return {
    cveId,
    description,
    published: cve.published || null,
    lastModified: cve.lastModified || null,
    cvss: cvssData
      ? {
          score: cvssData.baseScore,
          severity: cvssData.baseSeverity,
          vector: cvssData.attackVector,
          complexity: cvssData.attackComplexity,
          privilegesRequired: cvssData.privilegesRequired,
          userInteraction: cvssData.userInteraction,
          scope: cvssData.scope,
          vectorString: cvssData.vectorString,
        }
      : { score: 0, severity: 'UNKNOWN', vector: 'UNKNOWN', complexity: 'UNKNOWN' },
    cwes: cweList,
    affected,
    references,
  };
}
