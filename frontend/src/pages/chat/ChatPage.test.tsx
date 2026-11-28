// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { askQuestion } from '../../api/ask'
import ChatPage from './ChatPage'

vi.mock('../../api/ask', () => ({ askQuestion: vi.fn() }))

beforeEach(() => vi.resetAllMocks())
afterEach(cleanup)

describe('ChatPage', () => {
  it('sends prior turns with follow-ups and opens cited source details', async () => {
    vi.mocked(askQuestion)
      .mockResolvedValueOnce({
        answer: 'Photosynthesis uses sunlight.',
        citations: [{ file_name: 'botany.pdf', page_number: 4, quote: 'Plants convert sunlight into energy.' }],
      })
      .mockResolvedValueOnce({ answer: 'Roots absorb water and minerals.', citations: [] })
    render(<ChatPage />)

    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'What is photosynthesis?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
    expect(await screen.findByText('Photosynthesis uses sunlight.')).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Message')))
    fireEvent.click(screen.getByRole('button', { name: /botany.pdf/ }))
    expect(screen.getByRole('dialog').textContent).toContain('Plants convert sunlight into energy.')
    fireEvent.click(screen.getByRole('button', { name: 'Close source details' }))

    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'What about its roots?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
    expect(await screen.findByText('Roots absorb water and minerals.')).toBeTruthy()
    expect(askQuestion).toHaveBeenNthCalledWith(2, 'What about its roots?', 5, [
      { role: 'user', content: 'What is photosynthesis?' },
      { role: 'assistant', content: 'Photosynthesis uses sunlight.' },
    ])
  })

  it('keeps the conversation and allows retry after an API error', async () => {
    vi.mocked(askQuestion)
      .mockRejectedValueOnce(new Error('Answer provider unavailable.'))
      .mockResolvedValueOnce({ answer: 'A grounded answer.', citations: [] })
    render(<ChatPage />)

    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Ask a question' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Answer provider unavailable.')
    expect(screen.getByText('Ask a question')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Try again' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
    expect(await screen.findByText('A grounded answer.')).toBeTruthy()
  })
})
