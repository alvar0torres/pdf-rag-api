// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import AppLayout from './AppLayout'

afterEach(cleanup)

it('renders page content within the workspace layout', () => {
  render(<AppLayout><h1>Page content</h1></AppLayout>)

  expect(within(screen.getByRole('main')).getByRole('heading', { name: 'Page content' })).toBeTruthy()
  expect(within(screen.getByRole('navigation', { name: 'Workspace' })).getByText('Documents')).toBeTruthy()
})
