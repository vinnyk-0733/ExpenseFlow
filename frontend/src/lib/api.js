const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('access_token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle Token Expiry & Automatic Refresh
  if (response.status === 401 && !options._isRetry) {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      try {
        const refreshResponse = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          localStorage.setItem('access_token', data.access_token);

          // Retry the original request with the new access token
          headers['Authorization'] = `Bearer ${data.access_token}`;
          response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            _isRetry: true,
            headers,
          });
        } else {
          // Refresh token expired -> clear local storage
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user_name');
          window.dispatchEvent(new Event('auth:session-expired'));
        }
      } catch (err) {
        console.error('Refresh token error:', err);
      }
    }
  }

  return response;
}

// Auth API Calls
export async function signupUser(name, phone_number, pin) {
  const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, phone_number, pin }),
  });
  
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Sign up failed');
  }
  return data;
}

export async function signinUser(phone_number, pin) {
  const response = await fetch(`${API_BASE_URL}/api/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone_number, pin }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Sign in failed');
  }
  return data;
}

export async function fetchCurrentUser() {
  const response = await apiRequest('/api/auth/me');
  if (!response.ok) {
    throw new Error('Failed to fetch user');
  }
  return response.json();
}
