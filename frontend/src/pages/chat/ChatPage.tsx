import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { askQuestion } from '../../api/ask'
import type { Citation, ConversationMessage } from '../../api/ask'
import styles from './ChatPage.module.css'

type UserTurn = { role: 'user'; content: string }
type AssistantTurn = { role: 'assistant'; content: string; citations: Citation[] }
type Turn = UserTurn | AssistantTurn

function ChatPage() {
  const [question, setQuestion] = useState('')
  const [limit, setLimit] = useState(5)
  const [turns, setTurns] = useState<Turn[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const questionRef = useRef<HTMLTextAreaElement>(null)
  const messageListRef = useRef<HTMLDivElement>(null)
  const hasSubmittedRef = useRef(false)

  useEffect(() => {
    const messageList = messageListRef.current
    if (messageList) messageList.scrollTop = messageList.scrollHeight
  }, [turns, loading])

  useEffect(() => {
    if (hasSubmittedRef.current && !loading) questionRef.current?.focus()
  }, [loading])

  async function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedQuestion = question.trim()
    if (!trimmedQuestion || loading) return

    hasSubmittedRef.current = true
    const completedTurns = turns.at(-1)?.role === 'user' ? turns.slice(0, -1) : turns
    const history: ConversationMessage[] = completedTurns.slice(-12).map(({ role, content }) => ({
      role,
      content: content.slice(0, 8000),
    }))
    setError('')
    setSelectedCitation(null)
    setTurns((current) => [...current, { role: 'user', content: trimmedQuestion }])
    setQuestion('')
    setLoading(true)
    try {
      const answer = await askQuestion(trimmedQuestion, limit, history)
      setTurns((current) => [
        ...current,
        { role: 'assistant', content: answer.answer, citations: answer.citations },
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not get an answer.')
    } finally {
      setLoading(false)
    }
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      formRef.current?.requestSubmit()
    }
  }

  function startNewChat() {
    setQuestion('')
    setTurns([])
    setError('')
    setSelectedCitation(null)
  }

  return (
    <div className={styles.content}>
      <div className={styles.eyebrow}><span /> RETRIEVAL PLAYGROUND</div>
      <div className={styles['heading-row']}>
        <div><h1>RAG chat</h1><p>Ask follow-ups and explore answers grounded in your knowledge base.</p></div>
        <div className={styles['heading-icon']} aria-hidden="true">✳</div>
      </div>

      <section className={styles['chat-panel']} aria-label="Conversation">
        <header className={styles['chat-header']}>
          <div><span className={styles['online-dot']} /> DOCUMENT CHAT</div>
          <button type="button" onClick={startNewChat} disabled={loading || turns.length === 0}>New chat <span aria-hidden="true">↻</span></button>
        </header>

        <div ref={messageListRef} className={styles['message-list']} aria-live="polite">
          {turns.length === 0 && !loading && (
            <div className={styles['empty-state']}>
              <span aria-hidden="true">✳</span>
              <h2>What would you like to know?</h2>
              <p>Ask about your documents. Follow up naturally to dig deeper.</p>
            </div>
          )}
          {turns.map((turn, turnIndex) => (
            <article className={turn.role === 'user' ? styles['user-turn'] : styles['assistant-turn']} key={`${turn.role}-${turnIndex}`}>
              <div className={styles['turn-label']}>{turn.role === 'user' ? 'YOU' : 'RAG-LAB'}</div>
              <p className={styles['turn-content']}>{turn.content}</p>
              {turn.role === 'assistant' && turn.citations.length > 0 && (
                <div className={styles['turn-citations']} aria-label="Answer citations">
                  {turn.citations.map((citation, index) => (
                    <button
                      type="button"
                      key={`${turnIndex}-${citation.file_name}-${citation.page_number}-${index}`}
                      onClick={() => setSelectedCitation(citation)}
                    >
                      <span>{index + 1}</span> {citation.file_name} · p. {citation.page_number}
                    </button>
                  ))}
                </div>
              )}
            </article>
          ))}
          {loading && (
            <article className={styles['assistant-turn']} role="status">
              <div className={styles['turn-label']}>RAG-LAB</div>
              <p className={styles['typing-indicator']}>Searching your sources<span>...</span></p>
            </article>
          )}
          {error && <div className={styles.error} role="alert">{error}</div>}
        </div>

        <form ref={formRef} className={styles.composer} onSubmit={(event) => void submitQuestion(event)}>
          <label className={styles['visually-hidden']} htmlFor="chat-question">Message</label>
          <textarea
            ref={questionRef}
            id="chat-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={onComposerKeyDown}
            placeholder="Message your documents…"
            rows={2}
            maxLength={4000}
            disabled={loading}
          />
          <div className={styles['composer-footer']}>
            <label htmlFor="source-limit">SOURCES
              <select id="source-limit" value={limit} onChange={(event) => setLimit(Number(event.target.value))} disabled={loading}>
                <option value={3}>3</option>
                <option value={5}>5</option>
                <option value={10}>10</option>
              </select>
            </label>
            <div><span className={styles['keyboard-hint']}>ENTER TO SEND · SHIFT + ENTER FOR NEW LINE</span>
              <button type="submit" disabled={loading || !question.trim()} aria-label="Send message">↑</button>
            </div>
          </div>
        </form>
      </section>

      {selectedCitation && (
        <div className={styles['drawer-backdrop']} onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedCitation(null) }}>
          <aside className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="source-title">
            <div className={styles['drawer-header']}><div><span>SOURCE DETAIL</span><h2 id="source-title">{selectedCitation.file_name}</h2></div><button type="button" aria-label="Close source details" onClick={() => setSelectedCitation(null)}>×</button></div>
            <span className={styles['page-label']}>PAGE {selectedCitation.page_number}</span>
            <blockquote>{selectedCitation.quote}</blockquote>
          </aside>
        </div>
      )}
    </div>
  )
}

export default ChatPage
