# Add PostHog distributed tracing

Use this skill to add PostHog distributed tracing for new or changed code. Use it after implementing features or reviewing PRs to ensure request entry points, outbound calls, and background jobs produce spans, when the user asks to add tracing or spans, or to point existing OpenTelemetry tracing at PostHog. Supports any platform or language.

Supported platforms: Node.js, Next.js, Python (including Django, FastAPI, and Flask), Go, Java, .NET, PHP, Ruby, and any language via OpenTelemetry (OTLP).

## Instructions

Follow these steps IN ORDER:

STEP 1: Analyze the codebase and detect the platform.
  - Detect the language, framework, and existing tracing setup.
  - Look for dependency files and project files (package.json, requirements.txt, pyproject.toml, go.mod, pom.xml, build.gradle, *.csproj, Gemfile, composer.json, etc.).
  - Look for lockfiles (pnpm-lock.yaml, package-lock.json, yarn.lock, bun.lockb, poetry.lock, uv.lock, go.sum, Gemfile.lock, etc.) to determine the package manager.
  - Look for existing tracing: an OpenTelemetry tracer provider, an `instrumentation.ts` file, an OpenTelemetry Collector config, a Java agent flag, or another vendor's tracing agent.
  - Check whether a PostHog SDK (posthog-node, posthog-python) is already installed, and which version.

STEP 2: Choose the capture path.
  - If the codebase already exports OpenTelemetry traces, point the existing OTLP trace exporter (or Collector) at PostHog. If it exports to another tracing backend, ask the user before you add PostHog as a second destination.
  - Otherwise, use the OpenTelemetry SDK with auto-instrumentation. It is the only path that creates spans for HTTP servers, frameworks, and database drivers without code changes.
  - On Node.js (`posthog-node` >= 5.52.0) and Python (`posthog` >= 7.58.0), the PostHog SDK can create and export spans with no OpenTelemetry dependency. Use it only if the user wants a few manual spans and no new packages. It has no auto-instrumentation.
  - Read the platform reference that matches the detected stack now. If no reference matches, use the general installation reference.

STEP 3: Install dependencies.
  - Install the OpenTelemetry SDK, the OTLP HTTP/protobuf trace exporter, and the auto-instrumentation for the detected stack. Examples: `@opentelemetry/auto-instrumentations-node` for Node.js, the framework instrumentor (`opentelemetry-instrumentation-django`, `-fastapi`, `-flask`) for Python, `otelhttp` from `go.opentelemetry.io/contrib` for Go, the zero-code Java agent jar, `OpenTelemetry.Instrumentation.AspNetCore` and `.Http` for .NET, and `opentelemetry-instrumentation-all` for Ruby.
  - Do not manually edit dependency files — use the package manager's install command.

STEP 4: Configure the OTLP trace exporter.
  - Send spans over OTLP HTTP to `/i/v1/traces` on the PostHog host, with the project token in an `Authorization: Bearer` header. Do not use `/i/v0/ai/otel`. That endpoint accepts only LLM spans.
  - With environment variables, set the full path in `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`. Do not set the base `OTEL_EXPORTER_OTLP_ENDPOINT` for PostHog. It appends its own `/v1/traces` path.
  - Set a service name (`service.name`, or `OTEL_SERVICE_NAME`) so spans are easy to find in the Tracing UI.
  - Start the provider before the application loads its frameworks, so auto-instrumentation can patch them. In Next.js, register the provider in `instrumentation.ts` behind the `NEXT_RUNTIME === 'nodejs'` check.
  - Follow the platform-specific reference for the exact configuration.
  - You must read a file immediately before attempting to write it.

STEP 5: Add spans where they belong.
  - Auto-instrumentation covers request entry points and most outbound calls. Add manual spans only where it has no coverage: background job handlers, queue consumers, and slow internal steps the user cares about.
  - Use low-cardinality span names like `GET /users/:id`, not `GET /users/123`. Put variable values in attributes.
  - Pass the W3C `traceparent` header on calls between services, so spans from each service join one trace.
  - Do not alter the fundamental architecture of existing files. Make additions minimal and targeted.

STEP 6: Link spans to people and sessions. (Optional.)
  - A span joins a person and a Session Replay recording through the `posthogDistinctId` and `sessionId` attributes.
  - If the app uses posthog-js, enable `tracing_headers` for your API hosts. The browser then sends `X-POSTHOG-DISTINCT-ID` and `X-POSTHOG-SESSION-ID` headers on each request.
  - With the PostHog SDK path, spans in a PostHog request context get these attributes automatically. With OpenTelemetry, copy the header values onto the request span yourself. If the installed `posthog` Python package provides `PostHogContextSpanProcessor`, you can add it to the provider instead.

STEP 7: Set up environment variables.
  - Check if the project already has PostHog environment variables configured (e.g. in `.env`, `.env.local`, or framework-specific env files). If valid values already exist, skip this step.
  - If the PostHog project token is missing, use the PostHog MCP server's `projects-get` tool to retrieve the project's `api_token`. If multiple projects are returned, ask the user which project to use. If the MCP server is not connected or not authenticated, ask the user for their PostHog project token instead.
  - For the PostHog host URL: check the `projects-get` MCP response for a `region` field — `US` maps to `https://us.i.posthog.com`, `EU` maps to `https://eu.i.posthog.com`. If the region is not available from the MCP response or from existing project configuration, ask the user: "Are you on PostHog US Cloud or EU Cloud?" Do not assume US Cloud.
  - For the OTLP traces endpoint, use `https://us.i.posthog.com/i/v1/traces` (US) or `https://eu.i.posthog.com/i/v1/traces` (EU), matching the region determined above, with the project token as an `Authorization: Bearer` header.
  - Write these values to the appropriate env file using the framework's naming convention.
  - Reference these environment variables in code instead of hardcoding them.

STEP 8: Flush spans in short-lived processes.
  - The batch processor exports spans on an interval. A script, cron job, or serverless function can stop before the batch is sent.
  - On Vercel and other serverless platforms, call the provider's `forceFlush()` before the function returns. In Next.js 15.1 and later, call it inside `after()` from `next/server`.
  - On AWS Lambda, call `forceFlush()` at the end of each invocation. Do not call `shutdown()` there, because the runtime reuses the container. Call `shutdown()` only when the process exits.

STEP 9: Verify spans arrive.
  - Run the application and trigger the instrumented code.
  - Open Tracing in the PostHog sidebar and filter by the service name. Spans should appear within a minute of sending.
  - If no spans appear, check the endpoint path, the `Bearer` token, and the flush step.

## Reference files

{references}

Each platform reference contains specific OpenTelemetry setup, OTLP configuration, and integration patterns. Find the one matching the user's stack.

## Key principles

- **Environment variables**: Always use environment variables for PostHog keys and OpenTelemetry endpoints. Never hardcode them.
- **Minimal changes**: Add PostHog trace export alongside existing code. Don't replace or restructure existing tracing.
- **OpenTelemetry first**: PostHog traces use the OpenTelemetry protocol. Prefer the OpenTelemetry SDK with auto-instrumentation, and reuse an existing tracer provider when there is one.
- **Boundaries, not every function**: A few spans at request entry, outbound calls, and background jobs are better than a span around every function.
- **No secrets in attributes**: Never put tokens, passwords, or other secrets in span names or attributes.
