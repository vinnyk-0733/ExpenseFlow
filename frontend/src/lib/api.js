const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

// Single-flight Mutex & Queue variables to prevent token refresh race conditions
let isRefreshing = false;
let refreshSubscribers = [];

function subscribeTokenRefresh(cb) {
  refreshSubscribers.push(cb);
}

function onRefreshed(newToken) {
  refreshSubscribers.forEach((cb) => cb(newToken));
  refreshSubscribers = [];
}

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

  // Handle Token Expiry & Automatic Refresh (Mutex / Single-Flight Queue Pattern)
  if (response.status === 401 && !options._isRetry) {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      return response;
    }

    if (isRefreshing) {
      // Follower request: Wait in queue for the leader request to finish refreshing
      return new Promise((resolve) => {
        subscribeTokenRefresh(async (newToken) => {
          if (!newToken) {
            resolve(response);
            return;
          }
          headers['Authorization'] = `Bearer ${newToken}`;
          const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            _isRetry: true,
            headers,
          });
          resolve(retryResponse);
        });
      });
    }

    // Leader request: Acquire lock & initiate refresh
    isRefreshing = true;

    try {
      const refreshResponse = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        localStorage.setItem('access_token', data.access_token);
        
        isRefreshing = false;
        onRefreshed(data.access_token);

        // Retry leader request with new token
        headers['Authorization'] = `Bearer ${data.access_token}`;
        response = await fetch(`${API_BASE_URL}${endpoint}`, {
          ...options,
          _isRetry: true,
          headers,
        });
      } else {
        // Refresh token expired or invalid -> Clear local storage & notify subscribers
        isRefreshing = false;
        onRefreshed(null);

        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_name');
        window.dispatchEvent(new Event('auth:session-expired'));
      }
    } catch (err) {
      isRefreshing = false;
      onRefreshed(null);
      console.error('Refresh token error:', err);
    }
  }

  return response;
}

// Auth API Calls
export async function signupUser(name, phone_number, pin) {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/signup`, {
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
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/signin`, {
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
  const response = await apiRequest('/api/v1/auth/me');
  if (!response.ok) {
    throw new Error('Failed to fetch user');
  }
  return response.json();
}
