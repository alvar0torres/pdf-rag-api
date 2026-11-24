// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, it } from 'vitest'
import AppLayout from './AppLayout'

afterEach(cleanup)

it('renders page content within the workspace layout', () => {
  render(
    <MemoryRouter initialEntries={['/documents']}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/documents" element={<h1>Page content</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )

  expect(within(screen.getByRole('main')).getByRole('heading', { name: 'Page content' })).toBeTruthy()
  expect(within(screen.getByRole('navigation', { name: 'Workspace' })).getByText('Documents')).toBeTruthy()
  expect(within(screen.getByRole('navigation', { name: 'Workspace' })).getByText('Chat')).toBeTruthy()
})
