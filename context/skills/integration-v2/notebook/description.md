# Mirror the report into a PostHog notebook

Mirror the setup report into a shareable PostHog notebook, so the user has an
in-app copy to link and comment on. No report file is written to the project.
The `publish_handoff` call and the notebook are how the report reaches the user.

The notebook is best effort. The report already reached the user through
`publish_handoff`, so a notebook that can't be created never fails your task.
Say in your handoff that it wasn't created and why, then finish.

## `publish_handoff` creates it

Your one `publish_handoff` call creates the notebook from the same markdown.
You don't pass anything extra. Its result tells you what happened:

- **The result names a notebook URL.** The mirror is done. Don't create
  another notebook, and don't emit the `[NOTEBOOK_URL]` marker. The wizard
  already shows the link.
- **The result says the notebook was not created.** Don't retry through
  `posthog_exec`, because the same login fails the same way. Put the reason
  in your handoff.
- **The result doesn't mention a notebook.** This wizard predates the
  built-in notebook. Mirror the report yourself, as below.

## Mirror it yourself on older wizards

Which notebook tool the PostHog MCP offers depends on a feature flag, so check
the catalog once:

```
search notebooks-create
```

Then use the tool the catalog lists, with the exact report markdown you passed
to `publish_handoff`, verbatim:

- **`notebooks-create-markdown` is listed.** Create the notebook with it,
  passing a `title` and the report as `markdown`. The title becomes the
  notebook's leading `# heading`, so start the `markdown` at the first section
  below it.
- **Only `notebooks-create` is listed.** Create the notebook with it, passing
  a `title` and the whole report, H1 included, inside one markdown notebook
  node as `content`. Don't translate the report into other rich-text nodes.
  This path has no `notebooks-add-cell`.
- **Neither is listed.** Skip the notebook.

The exec command is `call <tool>` followed by the bare JSON argument, with no
quotes around it. The whole argument goes on one line, with the report's
newlines and quotes escaped as normal JSON string encoding (`\n`, `\"`, `\\`):

```
call notebooks-create-markdown {"title": "PostHog setup (wizard) – acme-shop", "markdown": "## Events captured\n\n| Event | Where |\n|---|---|\n| `user_signed_up` | `src/auth.ts` |\n"}
call notebooks-create {"title": "PostHog setup (wizard) – acme-shop", "content": {"type": "doc", "content": [{"type": "ph-markdown-notebook", "attrs": {"nodeId": "markdown-notebook-v2", "markdown": "# PostHog setup (wizard) – acme-shop\n\n## Events captured\n\n| Event | Where |\n|---|---|\n| `user_signed_up` | `src/auth.ts` |\n"}}]}}
```

Wrong, and their exact errors:

```
call notebooks-create-markdown '{"title": ...}'   → "Unexpected token" (quotes reach the JSON parser)
call notebooks-create-markdown {"...": "line one
line two"}                                        → "Bad control character" (literal newline in a JSON string)
```

A full multi-page report goes through in one call when encoded this way. Never
trim the report just to make it parse. If a correctly encoded
`notebooks-create-markdown` payload still fails, split the transport: create
the notebook with the first sections, then append each remaining section as a
markdown cell with `notebooks-add-cell`, passing the `notebook_id` from the
create response:

```
call notebooks-add-cell {"notebook_id": "AbCdEfGh", "cell_type": "markdown", "markdown": "## Next steps\n\n- Replace the `DISTINCT_ID` placeholder in `src/auth.ts`\n"}
```

The create response carries the notebook's `short_id` and its URL. Build the
link as `<posthog host>/project/<project id>/notebooks/<short_id>` and print it
in your final message as one plain line, marker first, so the wizard can show
it on the end screen. A markdown link is not picked up:

```
[NOTEBOOK_URL] https://us.posthog.com/project/12345/notebooks/AbCdEfGh
```
