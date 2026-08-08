import { describe, it, expect, beforeEach, vi } from 'vitest'
import { apiRequest, signupUser, signinUser } from '../lib/api'

describe('Frontend API Client (api.js)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('attaches Authorization Bearer token when stored in localStorage', async () => {
    localStorage.setItem('access_token', 'mock_access_token_123')
    
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'success' })
    })

    await apiRequest('/api/v1/days')

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/days'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer mock_access_token_123',
          'Content-Type': 'application/json'
        })
      })
    )
  })

  it('triggers session expired event when refresh token fails', async () => {
    localStorage.setItem('access_token', 'expired_token')
    localStorage.setItem('refresh_token', 'invalid_refresh')

    const eventSpy = vi.fn()
    window.addEventListener('auth:session-expired', eventSpy)

    // First fetch fails with 401
    // Second fetch to /refresh fails with 401
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ status: 401, ok: false })
      .mockResolvedValueOnce({ status: 401, ok: false })

    await apiRequest('/api/v1/days')

    expect(eventSpy).toHaveBeenCalled()
    expect(localStorage.getItem('access_token')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()
  })
})
