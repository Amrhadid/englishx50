// Helper to surface *why* a Supabase Edge Function call failed.
//
// supabase.functions.invoke() collapses every failure into a generic error
// object, which made AI-grading errors show only "تعذّر تقييم الإجابة" with no
// clue whether the function is missing (404), rejecting the JWT (401), rate
// limited (429), missing its API key (500), or erroring upstream (502). This
// reads the underlying Response so the real status + body land in the console.

/** A Supabase FunctionsHttpError carries the failed Response on `.context`. */
function hasResponseContext(err: unknown): err is { context: Response } {
  return (
    !!err &&
    typeof err === 'object' &&
    'context' in err &&
    typeof (err as { context?: unknown }).context === 'object' &&
    (err as { context?: { status?: unknown } }).context !== null &&
    'status' in (err as { context: object }).context
  )
}

/**
 * Logs the real cause of a failed Edge Function invocation and returns a short
 * description. `label` identifies the call site (e.g. "level test").
 */
export async function reportFunctionError(label: string, error: unknown): Promise<string> {
  // Network / CORS / function-unreachable failures have no Response.
  if (!hasResponseContext(error)) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`[EnglishX50] ${label} grading failed (network/unreachable):`, msg, error)
    return msg
  }

  const res = error.context
  let bodyText = ''
  try {
    bodyText = await res.clone().text()
  } catch {
    /* body already consumed or unreadable */
  }

  console.error(
    `[EnglishX50] ${label} grading failed: HTTP ${res.status} ${res.statusText}`,
    bodyText || '(empty body)',
  )

  if (res.status === 404) {
    console.error(
      '[EnglishX50] 404 means the "EnglishX50feedback" Edge Function was not ' +
        'found. Check the function name/deploy in the Supabase project.',
    )
  } else if (res.status === 401) {
    console.error(
      '[EnglishX50] 401 means the function requires a verified JWT. Deploy it ' +
        'with --no-verify-jwt (or set verify_jwt = false).',
    )
  } else if (res.status >= 500) {
    console.error(
      '[EnglishX50] 5xx is an error inside the function — most often a missing/ ' +
        'invalid ANTHROPIC_API_KEY, a bad model id, or rate limiting.',
    )
  }

  return `HTTP ${res.status}: ${bodyText || res.statusText}`
}
