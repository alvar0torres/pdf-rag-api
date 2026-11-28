import { useState } from 'react'
import type { Citation } from '../../api/ask'

type UserTurn = { role: 'user'; content: string }
type AssistantTurn = { role: 'assistant'; content: string; citations: Citation[] }
type Turn = UserTurn | AssistantTurn

export function useChatState() {
  const [turns, setTurns] = useState<Turn[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  return { turns, setTurns, error, setError, loading, setLoading }
}
