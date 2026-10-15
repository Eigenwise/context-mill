// The AI gateway's decision model. It answers warlock's triage questions with
// a calibrated probability, through POST /v1/systemone.
export const DECISION_MODEL = 'openai/gpt-6-luna';

const MAX_ATTEMPTS = 3;
const TIMEOUT_MS = 20_000;

/**
 * A warlock DecisionProvider: sends the request warlock built to the gateway's
 * decision route and returns its response. A 429 is retried after its
 * Retry-After, up to 3 attempts. Every other failure throws, and warlock then
 * treats the affected matches as threats.
 */
export function createDecisionProvider({ baseURL, token, fetch = globalThis.fetch }) {
    return async (request) => {
        for (let attempt = 1; ; attempt++) {
            const response = await fetch(`${baseURL}/v1/systemone`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: DECISION_MODEL, ...request }),
                signal: AbortSignal.timeout(TIMEOUT_MS),
            });
            if (response.ok) {
                return response.json();
            }
            if (response.status !== 429 || attempt === MAX_ATTEMPTS) {
                throw new Error(`Decision call failed: HTTP ${response.status}`);
            }
            const waitSeconds = Number(response.headers.get('retry-after')) || 1;
            await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
        }
    };
}
