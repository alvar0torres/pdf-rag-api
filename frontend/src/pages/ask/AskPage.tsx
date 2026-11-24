import { useState } from 'react'
import type { FormEvent } from 'react'
import { askQuestion } from '../../api/ask'
import type { Answer, Citation } from '../../api/ask'
import styles from './AskPage.module.css'

function AskPage() {
  const [question, setQuestion] = useState('')
  const [limit, setLimit] = useState(5)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null)

  async function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedQuestion = question.trim()
    if (!trimmedQuestion || loading) return

    setError('')
    setAnswer(null)
    setSelectedCitation(null)
    setLoading(true)
    try {
      setAnswer(await askQuestion(trimmedQuestion, limit))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not get an answer.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.content}>
      <div className={styles.eyebrow}><span /> RETRIEVAL PLAYGROUND</div>
      <div className={styles['heading-row']}>
        <div><h1>Ask your documents</h1><p>Get answers grounded in your knowledge base.</p></div>
        <div className={styles['heading-icon']} aria-hidden="true">✳</div>
      </div>

      <form className={styles['question-form']} onSubmit={(event) => void submitQuestion(event)}>
        <label htmlFor="question">YOUR QUESTION</label>
        <textarea
          id="question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask something about your documents…"
          rows={3}
          required
        />
        <div className={styles['form-footer']}>
          <label className={styles['limit-label']} htmlFor="source-limit">SOURCES
            <select id="source-limit" value={limit} onChange={(event) => setLimit(Number(event.target.value))}>
              <option value={3}>3</option>
              <option value={5}>5</option>
              <option value={10}>10</option>
            </select>
          </label>
          <button type="submit" disabled={loading || !question.trim()}>
            {loading ? 'Thinking…' : 'Ask question'} <span aria-hidden="true">↗</span>
          </button>
        </div>
      </form>

      {error && <div className={styles.error} role="alert">{error}</div>}
      {loading && <div className={styles.loading} role="status">Searching sources and preparing an answer…</div>}
      {!answer && !loading && !error && (
        <div className={styles['empty-state']}><span aria-hidden="true">⌕</span><h2>Start with a question</h2><p>Your answer and supporting sources will appear here.</p></div>
      )}
      {answer && (
        <section className={styles['answer-card']} aria-labelledby="answer-title">
          <div className={styles['answer-header']}><span>ANSWER</span><span className={styles['answer-status']}><i /> GROUNDED IN YOUR SOURCES</span></div>
          <h2 id="answer-title">{answer.answer}</h2>
          {answer.citations.length > 0 ? (
            <div className={styles.citations}>
              <div className={styles['citations-heading']}><span>SUPPORTING SOURCES</span><span>{answer.citations.length}</span></div>
              {answer.citations.map((citation, index) => (
                <button className={styles['citation-button']} type="button" key={`${citation.file_name}-${citation.page_number}-${index}`} onClick={() => setSelectedCitation(citation)}>
                  <span className={styles['citation-number']}>{String(index + 1).padStart(2, '0')}</span>
                  <span className={styles['citation-info']}><strong>{citation.file_name}</strong><small>Page {citation.page_number}</small></span>
                  <span className={styles['citation-arrow']} aria-hidden="true">↗</span>
                </button>
              ))}
            </div>
          ) : <p className={styles['no-citations']}>No supporting sources were returned.</p>}
        </section>
      )}

      {selectedCitation && (
        <div className={styles['drawer-backdrop']} onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedCitation(null) }}>
          <aside className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="source-title">
            <div className={styles['drawer-header']}><div><span>SOURCE DETAIL</span><h2 id="source-title">{selectedCitation.file_name}</h2></div><button type="button" aria-label="Close source details" onClick={() => setSelectedCitation(null)}>×</button></div>
            <span className={styles['page-label']}>PAGE {selectedCitation.page_number}</span>
            <blockquote>{selectedCitation.quote}</blockquote>
          </aside>
        </div>
      )}
      <footer className={styles['page-footer']}><span>RAG LAB <span> / </span> ASK</span></footer>
    </div>
  )
}

export default AskPage
