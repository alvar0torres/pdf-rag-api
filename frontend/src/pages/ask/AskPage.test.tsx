// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { askQuestion } from '../../api/ask'
import AskPage from './AskPage'

vi.mock('../../api/ask', () => ({ askQuestion: vi.fn() }))

beforeEach(() => vi.resetAllMocks())
afterEach(cleanup)

describe('AskPage', () => {
  it('submits a question and opens a citation in the source drawer', async () => {
    vi.mocked(askQuestion).mockResolvedValue({
      answer: 'Plants use sunlight to make food.',
      citations: [{ file_name: 'botany.pdf', page_number: 4, quote: 'Plants convert sunlight into energy.' }],
    })
    render(<AskPage />)

    fireEvent.change(screen.getByLabelText('YOUR QUESTION'), { target: { value: '  How do plants make food?  ' } })
    fireEvent.change(screen.getByLabelText('SOURCES'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ask question' }))

    expect(await screen.findByText('Plants use sunlight to make food.')).toBeTruthy()
    expect(askQuestion).toHaveBeenCalledWith('How do plants make food?', 3)
    fireEvent.click(screen.getByRole('button', { name: /botany.pdf/ }))
    expect(screen.getByRole('dialog').textContent).toContain('Plants convert sunlight into energy.')
    fireEvent.click(screen.getByRole('button', { name: 'Close source details' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows provider errors and permits another question', async () => {
    vi.mocked(askQuestion).mockRejectedValueOnce(new Error('Answer provider unavailable.')).mockResolvedValueOnce({
      answer: 'No matching evidence was found.',
      citations: [],
    })
    render(<AskPage />)

    fireEvent.change(screen.getByLabelText('YOUR QUESTION'), { target: { value: 'What is in this document?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ask question' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Answer provider unavailable.')

    fireEvent.click(screen.getByRole('button', { name: 'Ask question' }))
    expect(await screen.findByText('No matching evidence was found.')).toBeTruthy()
    expect(screen.getByText('No supporting sources were returned.')).toBeTruthy()
  })
})
