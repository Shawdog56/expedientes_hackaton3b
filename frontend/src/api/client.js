const BASE = import.meta.env.VITE_API_URL ?? '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return res.json()
}

export const api = {
  health: () => request('/health'),
  listAgents: () => request('/agents'),
  runAgent: (name, input, context) =>
    request(`/agents/${name}/run`, {
      method: 'POST',
      body: JSON.stringify({ input, context }),
    }),
}
