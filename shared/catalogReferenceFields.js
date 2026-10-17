// Display-only historical links. This never authorizes fetching or draft source review.
export function catalogReferenceHref(value) {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value) || /[\u0000-\u0020\u007f\\]/u.test(value)) return null
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && url.hostname && !url.username && !url.password && !url.port ? url.href : null
  } catch { return null }
}
