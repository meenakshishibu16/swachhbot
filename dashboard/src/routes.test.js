import { resolveRoute } from './routes'

describe('resolveRoute', () => {
  it('shows the landing page for the site root and landing path', () => {
    expect(resolveRoute('/')).toBe('/landing')
    expect(resolveRoute('/landing')).toBe('/landing')
  })

  it('routes /dashboard to the dashboard experience', () => {
    expect(resolveRoute('/dashboard')).toBe('/dashboard')
  })
})
