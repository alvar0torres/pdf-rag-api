export type EvaluationInfo = {
  title: string
  source_file: string
  question_count: number
  top_k: number
  candidate_limit: number
  modes: string[]
}

export type EvaluationResult = Omit<EvaluationInfo, 'modes'> & {
  modes: { mode: string; metrics: Record<string, number> }[]
  questions: { id: string; question: string; ranks: Record<string, number | null> }[]
}

async function request<T>(method: 'GET' | 'POST', signal: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch('/api/evaluations/retrieval', { method, signal })
  } catch (error) {
    if (signal.aborted) throw error
    throw new Error('Could not reach the API. Make sure the backend is running.')
  }
  if (!response.ok) {
    let detail: unknown
    try {
      detail = (await response.json()).detail
    } catch {
      throw new Error(`Evaluation request failed (${response.status}).`)
    }
    throw new Error(typeof detail === 'string' ? detail : `Evaluation request failed (${response.status}).`)
  }
  return response.json() as Promise<T>
}

export function getEvaluationInfo(signal: AbortSignal) {
  return request<EvaluationInfo>('GET', signal)
}

export function runEvaluation(signal: AbortSignal) {
  return request<EvaluationResult>('POST', signal)
}
