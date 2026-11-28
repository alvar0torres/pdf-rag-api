// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getEvaluationInfo, runEvaluation } from '../../api/evaluations'
import EvaluationPage from './EvaluationPage'

vi.mock('../../api/evaluations', () => ({ getEvaluationInfo: vi.fn(), runEvaluation: vi.fn() }))
beforeEach(() => vi.resetAllMocks())
afterEach(cleanup)

const info = {
  title: 'Test benchmark', source_file: 'test.pdf', question_count: 2,
  top_k: 5, candidate_limit: 20, modes: ['dense', 'hybrid'],
}

describe('EvaluationPage', () => {
  it('runs only on request and displays metrics and question ranks', async () => {
    vi.mocked(getEvaluationInfo).mockResolvedValue(info)
    vi.mocked(runEvaluation).mockResolvedValue({
      ...info,
      modes: [
        { mode: 'dense', metrics: { 'hit@1': 0.5, 'hit@3': 0.5, 'hit@5': 1, 'mrr@5': 0.75 } },
        { mode: 'hybrid', metrics: { 'hit@1': 1, 'hit@3': 1, 'hit@5': 1, 'mrr@5': 1 } },
      ],
      questions: [{ id: 'q1', question: 'First question?', ranks: { dense: null, hybrid: 1 } }],
    })
    render(<EvaluationPage />)

    expect(await screen.findByText('Test benchmark')).toBeTruthy()
    expect(runEvaluation).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Run evaluation' }))

    const results = await screen.findByRole('region', { name: 'Results' })
    expect(within(results).getAllByText('50%')).toHaveLength(2)
    expect(within(results).getByText('0.750')).toBeTruthy()
    const questions = screen.getByRole('region', { name: 'First relevant rank' })
    expect(within(questions).getByText('First question?')).toBeTruthy()
    expect(within(questions).getByText('—')).toBeTruthy()
  })

  it('shows a precondition error and allows retry', async () => {
    vi.mocked(getEvaluationInfo).mockResolvedValue(info)
    vi.mocked(runEvaluation).mockRejectedValueOnce(new Error('Index test.pdf first.'))
    render(<EvaluationPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Run evaluation' }))

    expect((await screen.findByRole('alert')).textContent).toBe('Index test.pdf first.')
    expect((screen.getByRole('button', { name: 'Run evaluation' }) as HTMLButtonElement).disabled).toBe(false)
  })
})
