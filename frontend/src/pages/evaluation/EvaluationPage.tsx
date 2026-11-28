import { useEffect, useRef, useState } from 'react'
import { getEvaluationInfo, runEvaluation } from '../../api/evaluations'
import type { EvaluationInfo, EvaluationResult } from '../../api/evaluations'
import styles from './EvaluationPage.module.css'

const metricLabels = ['hit@1', 'hit@3', 'hit@5', 'mrr@5'] as const

function EvaluationPage() {
  const [info, setInfo] = useState<EvaluationInfo | null>(null)
  const [result, setResult] = useState<EvaluationResult | null>(null)
  const [infoError, setInfoError] = useState('')
  const [runError, setRunError] = useState('')
  const [loading, setLoading] = useState(false)
  const [reload, setReload] = useState(0)
  const runController = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    getEvaluationInfo(controller.signal)
      .then((data) => { if (!controller.signal.aborted) setInfo(data) })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setInfoError(error instanceof Error ? error.message : 'Could not load benchmark.')
      })
    return () => controller.abort()
  }, [reload])

  useEffect(() => () => runController.current?.abort(), [])

  async function run() {
    if (loading) return
    const controller = new AbortController()
    runController.current = controller
    setRunError('')
    setResult(null)
    setLoading(true)
    try {
      const data = await runEvaluation(controller.signal)
      if (!controller.signal.aborted) setResult(data)
    } catch (error) {
      if (!controller.signal.aborted) setRunError(error instanceof Error ? error.message : 'Evaluation failed.')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  return (
    <div className={styles.content}>
      <div className={styles.eyebrow}><span /> RAG-LAB</div>
      <div className={styles.heading}>
        <div><h1>Evaluation</h1><p>Compare retrieval methods against a labeled benchmark.</p></div>
        <span aria-hidden="true">✳</span>
      </div>
      <section className={styles.benchmark} aria-labelledby="benchmark-title">
        <div className={styles.sectionLabel}>RETRIEVAL BENCHMARK</div>
        {infoError ? (
          <div className={styles.error} role="alert">
            {infoError}
            <button type="button" className={styles.retry} onClick={() => { setInfoError(''); setReload((value) => value + 1) }}>Retry</button>
          </div>
        ) : !info ? <p className={styles.muted} role="status">Loading benchmark…</p> : (
          <>
            <h2 id="benchmark-title">{info.title}</h2>
            <p className={styles.description}>Index <strong>{info.source_file}</strong> before running. The benchmark compares dense, hybrid, and Cohere-reranked retrieval against labeled passages.</p>
            <div className={styles.facts}>
              <span><strong>{info.question_count}</strong> questions</span>
              <span><strong>Top {info.top_k}</strong> results</span>
              <span><strong>{info.candidate_limit}</strong> candidates</span>
            </div>
            <div className={styles.runRow}>
              <p>Uses OpenAI embeddings and Cohere reranking; provider charges may apply.</p>
              <button type="button" onClick={() => void run()} disabled={loading}>{loading ? 'Running…' : 'Run evaluation'} <span aria-hidden="true">↗</span></button>
            </div>
          </>
        )}
      </section>

      {loading && <div className={styles.notice} role="status">Running the benchmark. This can take a while; keep this page open.</div>}
      {runError && <div className={styles.error} role="alert">{runError}</div>}
      {result && (
        <>
          <section className={styles.results} aria-labelledby="results-title">
            <div className={styles.resultsHeader}><div><div className={styles.sectionLabel}>RETRIEVAL QUALITY</div><h2 id="results-title">Results</h2></div><span>{result.question_count} QUESTIONS · TOP {result.top_k}</span></div>
            <p className={styles.description}>Higher is better. Hit@k is the share of questions with labeled evidence in the top k; MRR@5 rewards a higher first relevant rank.</p>
            <div className={styles.tableWrap}>
              <table>
                <thead><tr><th scope="col">Method</th>{metricLabels.map((metric) => <th scope="col" key={metric}>{metric.toUpperCase()}</th>)}</tr></thead>
                <tbody>{result.modes.map(({ mode, metrics }) => (
                  <tr key={mode}><th scope="row">{mode}</th>{metricLabels.map((metric) => <td key={metric}>{metric === 'mrr@5' ? metrics[metric].toFixed(3) : `${Math.round(metrics[metric] * 100)}%`}</td>)}</tr>
                ))}</tbody>
              </table>
            </div>
          </section>
          <section className={styles.results} aria-labelledby="questions-title">
            <div className={styles.resultsHeader}><div><div className={styles.sectionLabel}>QUESTION BREAKDOWN</div><h2 id="questions-title">First relevant rank</h2></div></div>
            <p className={styles.description}>A dash means no labeled passage was found in the top {result.top_k} results. Exact passage matching can miss valid unlabeled evidence.</p>
            <div className={styles.tableWrap}>
              <table>
                <thead><tr><th scope="col">Question</th>{result.modes.map(({ mode }) => <th scope="col" key={mode}>{mode}</th>)}</tr></thead>
                <tbody>{result.questions.map((question) => (
                  <tr key={question.id}><th scope="row"><span className={styles.questionId}>{question.id}</span>{question.question}</th>{result.modes.map(({ mode }) => <td key={mode}>{question.ranks[mode] ?? '—'}</td>)}</tr>
                ))}</tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

export default EvaluationPage
