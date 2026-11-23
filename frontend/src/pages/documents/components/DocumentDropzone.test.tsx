// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DocumentDropzone from './DocumentDropzone'

afterEach(cleanup)

describe('DocumentDropzone', () => {
  it('passes a selected or dropped file to the page', () => {
    const onSelect = vi.fn()
    render(<DocumentDropzone busy={false} onSelect={onSelect} onError={vi.fn()} />)
    const file = new File(['content'], 'document.pdf', { type: 'application/pdf' })

    fireEvent.change(screen.getByLabelText('Choose a PDF file'), { target: { files: [file] } })
    expect(onSelect).toHaveBeenCalledWith(file)

    const dropzone = screen.getByRole('heading', { name: 'Drop your PDF here' }).parentElement!
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })
    expect(onSelect).toHaveBeenCalledTimes(2)
    expect(onSelect).toHaveBeenLastCalledWith(file)
  })

  it('rejects multiple dropped files and ignores drops while busy', () => {
    const onSelect = vi.fn()
    const onError = vi.fn()
    const { rerender } = render(<DocumentDropzone busy={false} onSelect={onSelect} onError={onError} />)
    const dropzone = screen.getByRole('heading', { name: 'Drop your PDF here' }).parentElement!
    const file = new File(['content'], 'document.pdf')

    fireEvent.drop(dropzone, { dataTransfer: { files: [file, file] } })
    expect(onError).toHaveBeenCalledWith('Please choose one PDF at a time.')
    expect(onSelect).not.toHaveBeenCalled()

    rerender(<DocumentDropzone busy onSelect={onSelect} onError={onError} />)
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })
    expect(onSelect).not.toHaveBeenCalled()
    expect((screen.getByRole('button', { name: 'browse files' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
