/**
 * Categorize CVE reference URLs by type.
 * Does NOT fetch or clone anything - metadata only.
 */
export function categorizeReferences(references) {
  const result = {
    pocs: [],
    advisories: [],
    writeups: [],
    patches: [],
    other: [],
  };

  for (const ref of references) {
    const url = ref.url.toLowerCase();
    const tags = (ref.tags || []).map((t) => t.toLowerCase());

    // PoC / Exploit
    if (
      tags.includes('exploit') ||
      (tags.includes('third party advisory') && url.includes('exploit')) ||
      url.includes('exploit-db.com') ||
      url.includes('packetstormsecurity') ||
      url.includes('/poc') ||
      url.includes('proof-of-concept') ||
      (url.includes('github.com') && (url.includes('/poc') || url.includes('exploit') || url.includes('cve-')))
    ) {
      result.pocs.push({ url: ref.url, source: ref.source, tags: ref.tags });
      continue;
    }

    // Vendor advisory / Security bulletin
    if (
      tags.includes('vendor advisory') ||
      tags.includes('third party advisory') ||
      url.includes('/advisory') ||
      url.includes('/security') ||
      url.includes('security-advisories') ||
      url.includes('cisa.gov') ||
      url.includes('cert.org')
    ) {
      result.advisories.push({ url: ref.url, source: ref.source, tags: ref.tags });
      continue;
    }

    // Patch / Fix
    if (
      tags.includes('patch') ||
      url.includes('/commit/') ||
      url.includes('/pull/') ||
      url.includes('patch')
    ) {
      result.patches.push({ url: ref.url, source: ref.source, tags: ref.tags });
      continue;
    }

    // Blog / Writeup
    if (
      url.includes('blog') ||
      url.includes('medium.com') ||
      url.includes('writeup') ||
      url.includes('analysis') ||
      url.includes('research')
    ) {
      result.writeups.push({ url: ref.url, source: ref.source, tags: ref.tags });
      continue;
    }

    result.other.push({ url: ref.url, source: ref.source, tags: ref.tags });
  }

  return result;
}

/**
 * Check if any GitHub PoC repos exist in the references
 */
export function hasPublicExploit(categorized) {
  return categorized.pocs.length > 0;
}
