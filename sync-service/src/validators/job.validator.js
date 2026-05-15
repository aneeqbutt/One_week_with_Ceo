// ─── Validation layer ─────────────────────────────────────────────────────────
// Validates raw DB1 rows before they enter the sync pipeline.
// Returns { valid: true } or { valid: false, reason: string }.
// Invalid records are skipped and logged — they do NOT crash the cycle.

export function validateJob(job) {
  if (!job || typeof job !== 'object') {
    return { valid: false, reason: 'Job is null or not an object' };
  }
  if (!Number.isInteger(job.id) || job.id <= 0) {
    return { valid: false, reason: `Invalid job id: ${JSON.stringify(job.id)}` };
  }
  if (!job.title || typeof job.title !== 'string' || job.title.trim().length === 0) {
    return { valid: false, reason: `Job ${job.id}: empty title` };
  }
  if (!job.campaign_id || typeof job.campaign_id !== 'string') {
    return { valid: false, reason: `Job ${job.id}: missing campaign_id` };
  }
  return { valid: true };
}

export function validateProduct(product, jobId) {
  if (!Number.isInteger(product.id) || product.id <= 0) {
    return { valid: false, reason: `Product has invalid id (job ${jobId})` };
  }
  return { valid: true };
}

export function validateBlog(blog, jobId) {
  if (!Number.isInteger(blog.id) || blog.id <= 0) {
    return { valid: false, reason: `Blog has invalid id (job ${jobId})` };
  }
  return { valid: true };
}

export function validateService(service, jobId) {
  if (!Number.isInteger(service.id) || service.id <= 0) {
    return { valid: false, reason: `Service has invalid id (job ${jobId})` };
  }
  return { valid: true };
}
