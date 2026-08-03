export function initStats(onCountUpdate) {
  // Fetch initial stats from secure backend API
  fetch('/api/stats')
    .then((res) => res.json())
    .then((data) => {
      if (typeof data.gamesPlayed === 'number') {
        onCountUpdate(data.gamesPlayed);
      }
    })
    .catch((err) => console.error('Error loading initial stats:', err));

  // Connect to real-time backend EventSource stream
  if (typeof window !== 'undefined' && 'EventSource' in window) {
    const eventSource = new EventSource('/api/stats/stream');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (typeof data.gamesPlayed === 'number') {
          onCountUpdate(data.gamesPlayed);
        }
      } catch (err) {
        console.error('Error parsing SSE stats data:', err);
      }
    };

    eventSource.onerror = () => {
      // EventSource auto-reconnects on disconnection
    };
  }
}

export async function incrementGamesPlayed() {
  try {
    const res = await fetch('/api/stats/increment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return await res.json();
  } catch (err) {
    console.error('Error incrementing games played:', err);
  }
}

export async function runFirebaseConnectionTest() {
  const res = await fetch('/api/healthcheck');
  if (!res.ok) {
    throw new Error(`Healthcheck failed with HTTP status ${res.status}`);
  }
  const data = await res.json();
  if (data.status !== 'ok') {
    throw new Error(`Healthcheck returned status error: ${data.message || 'Unknown error'}`);
  }
  return data.data;
}
