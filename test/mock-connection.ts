import { ApiError, DeferralCheckResponse } from "@fxmanager/types";

const BASE_URL = 'localhost:4000';
const API_TOKEN = 'your-session-token';

const mockIdentifiers = {
  license: 'license:80c583a09ed49bf8e22117f0253a0fa1fc106cd9',
};

async function QueryManager<T>(
  {
    endpoint,
    method,
    body = null,
    headers = {},
  }: {
    endpoint: string;
    method: 'GET' | 'POST';
    body?: unknown;
    headers?: Record<string, string>;
  },
  showError: boolean = false,
): Promise<T> {
  const url = `http://${BASE_URL}/internal${endpoint}`;

  try {
    const response = await fetch(url, {
      method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-resource-token': API_TOKEN,
        ...headers,
      },
      body: body ? JSON.stringify(body) : null,
    });

    if (!response.ok) {
      let errorData: { message: string };
      try {
        errorData = (await response.json()) as { message: string };
      } catch {
        errorData = { message: response.statusText };
      }

      throw new ApiError(
        errorData.message || `Request failed with status ${response.status}`,
        response.status,
        errorData,
      );
    }

    return (await response.json()) as T;
  } catch (err) {
    if (showError) {
      console.error('QueryService Error:', err);
    } else {
      DEV: console.error('QueryService Error:', err, 'data:', {
        endpoint,
        method,
        body,
        headers,
        url,
      });
    }

    throw err;
  }
}

async function testDeferrals() {
  console.log('\n── POST /deferrals ──────────────────────');

  // Valid identifiers
  const apiChecks = await QueryManager<DeferralCheckResponse>({
    endpoint: '/players/deferrals',
    method: 'POST',
    body: { identifiers: mockIdentifiers },
  });
  console.log('✓ valid identifiers:', apiChecks);

  // Missing license — expect 422
  try {
    const apiChecks = await QueryManager<DeferralCheckResponse>({
      endpoint: '/players/deferrals',
      method: 'POST',
      body: { identifiers: { fivem: 'fivem:123456'  }, },
    });
    console.error('✗ missing license should have failed', apiChecks);
  } catch (e) {
    console.log('✓ missing license rejected:', (e as Error).message);
  }
}

async function testJoin() {
  console.log('\n── POST /join ───────────────────────────');

  const name = 'MaximusPrime';
  const src = 5;
  const body = {
    name,
    identifiers: mockIdentifiers,
    serverId: src,
  };
  QueryManager<{ ack: true }>({
    endpoint: '/players/join',
    method: 'POST',
    body,
  })
  .then(() => console.log('✓ valid join'))
  .catch((err) => {
    console.error(`[API Error] Failed to process join for ${name} (${src}):`, err.message);
  });
}

async function run() {
  try {
    await testDeferrals();
    await testJoin();
    console.log('\n✓ All tests passed\n');
  } catch (e) {
    console.error('\n✗ Unexpected error:', e);
    process.exit(1);
  }
}

run();
