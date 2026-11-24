export type Citation = { file_name: string; page_number: number; quote: string }
export type Answer = { answer: string; citations: Citation[] }
export type ConversationMessage = { role: 'user' | 'assistant'; content: string }

export async function askQuestion(
  question: string,
  limit: number,
  history: ConversationMessage[],
): Promise<Answer> {
  let response: Response
  try {
    response = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, limit, history }),
    })
  } catch {
    throw new Error('Could not reach the API. Make sure the backend is running.')
  }
  if (!response.ok) {
    let detail: unknown
    try {
      detail = (await response.json()).detail
    } catch {
      throw new Error(`Request failed (${response.status}). Check that the backend is running.`)
    }
    throw new Error(typeof detail === 'string' ? detail : `Request failed (${response.status}).`)
  }
  return response.json() as Promise<Answer>
}
