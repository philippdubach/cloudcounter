/**
 * Login page handler
 *
 * GET /login - Show login form
 * POST /login - Process login
 */

import type { Env } from '../src/types';

const SESSION_COOKIE = 'gc_session';
const SESSION_TTL = 7 * 24 * 60 * 60;

/**
 * GET /login - Show login form
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request } = context;
  const url = new URL(request.url);
  const error = url.searchParams.get('error');

  const html = renderLoginPage(error);

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
};

/**
 * POST /login - Process login
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const formData = await request.formData();
    const password = formData.get('password') as string;

    if (!password || password !== env.DASHBOARD_PASSWORD) {
      return Response.redirect(new URL('/login?error=invalid', request.url).toString(), 302);
    }

    // Create session
    const token = generateToken();
    await env.SESSIONS.put(`auth:${token}`, Date.now().toString(), { expirationTtl: SESSION_TTL });

    // Redirect to dashboard with session cookie
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/',
        'Set-Cookie': `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL}`
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return Response.redirect(new URL('/login?error=server', request.url).toString(), 302);
  }
};

/**
 * Generate a random session token
 */
function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Render login page HTML
 */
function renderLoginPage(error: string | null): string {
  const errorMessage = error === 'invalid'
    ? '<p class="error">Invalid password. Please try again.</p>'
    : error === 'server'
    ? '<p class="error">Server error. Please try again.</p>'
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login - CloudCounter</title>
  <link rel="stylesheet" href="/dashboard.css">
  <style>
    body {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: #f5f5f5;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .login-container {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      width: 100%;
      max-width: 400px;
    }
    h1 {
      margin: 0 0 1.5rem 0;
      font-size: 1.5rem;
      text-align: center;
    }
    .form-group {
      margin-bottom: 1rem;
    }
    label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
    }
    input[type="password"] {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 1rem;
      box-sizing: border-box;
    }
    input[type="password"]:focus {
      outline: none;
      border-color: #0066cc;
      box-shadow: 0 0 0 3px rgba(0,102,204,0.1);
    }
    button {
      width: 100%;
      padding: 0.75rem;
      background: #0066cc;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 1rem;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover {
      background: #0052a3;
    }
    .error {
      color: #cc0000;
      background: #fff0f0;
      padding: 0.75rem;
      border-radius: 4px;
      margin-bottom: 1rem;
      text-align: center;
    }
    .logo {
      text-align: center;
      margin-bottom: 1rem;
      font-size: 2rem;
    }
  </style>
</head>
<body>
  <div class="login-container">
    <div class="logo">☁️</div>
    <h1>CloudCounter</h1>
    ${errorMessage}
    <form method="POST" action="/login">
      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" name="password" required autofocus>
      </div>
      <button type="submit">Login</button>
    </form>
  </div>
</body>
</html>`;
}
