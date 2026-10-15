import { describe, it, expect } from 'vitest';

import { createDecisionProvider, DECISION_MODEL } from '../decision-provider.js';

const request = { state: 'some content', questions: { '0.threat': { type: 'noul', instructions: 'x', criteria: { true: 'a', false: 'b' } } } };
const json = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

describe('createDecisionProvider', () => {
    // CATCHES: calling the wrong route, model, or auth header.
    it('posts warlock\'s request to /v1/systemone with the decision model and the bearer token', async () => {
        const sent = [];
        const fetch = async (url, init) => {
            sent.push({ url, init });
            return json(200, { answers: { '0.threat': { type: 'noul', noul: 0.9 } } });
        };
        const decide = createDecisionProvider({ baseURL: 'https://gw.example', token: 'tok', fetch });

        const response = await decide(request);

        expect(response.answers['0.threat'].noul).toBe(0.9);
        expect(sent[0].url).toBe('https://gw.example/v1/systemone');
        expect(sent[0].init.headers.Authorization).toBe('Bearer tok');
        expect(JSON.parse(sent[0].init.body)).toEqual({ model: DECISION_MODEL, ...request });
        expect(DECISION_MODEL).toBe('openai/gpt-6-luna');
    });

    // CATCHES: a rate-limited burst turning into false blocks.
    it('waits out a 429 and retries, up to 3 attempts', async () => {
        let calls = 0;
        const fetch = async () => (++calls < 3 ? json(429, {}, { 'retry-after': '0' }) : json(200, { answers: {} }));
        const decide = createDecisionProvider({ baseURL: 'https://gw.example', token: 'tok', fetch });

        await decide(request);

        expect(calls).toBe(3);
    });

    // CATCHES: a failed call swallowed instead of reaching warlock, which blocks on it.
    it('throws on a 429 after 3 attempts and on any other error status', async () => {
        const always429 = createDecisionProvider({ baseURL: 'https://gw.example', token: 'tok', fetch: async () => json(429, {}, { 'retry-after': '0' }) });
        const bad502 = createDecisionProvider({ baseURL: 'https://gw.example', token: 'tok', fetch: async () => json(502, {}) });

        await expect(always429(request)).rejects.toThrow('429');
        await expect(bad502(request)).rejects.toThrow('502');
    });
});
