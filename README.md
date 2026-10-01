# TRMNL Linear Issues Plugin

Shows your open Linear issues on a TRMNL e-ink display. You get everything in the current cycle plus anything carried over from past cycles, oldest cycle first, then Urgent and High.

Built to TRMNL's own design rules ([usetrmnl/trmnl-agent-skills](https://github.com/usetrmnl/trmnl-agent-skills)): framework classes only, no custom CSS, a layout tailored to each screen size, and nothing that breaks up on 1-bit screens.

## Use it

1. Create a Linear personal API key in [Linear Settings, Security and access](https://linear.app/settings/account/security).
2. Add the [Linear Issues recipe](https://trmnl.com/recipes/182427) in TRMNL and paste the key into the form.

Setting it up by hand instead? The guide at [trml-plugins.vercel.app/linear](https://trml-plugins.vercel.app/linear) has every value to copy.

## How it works

```
TRMNL polls  GET /api/linear-issues  (header: x-linear-api-key)
             -> one Linear GraphQL query
             -> JSON below
             -> src/*.liquid renders it
```

| Path | What it is |
|---|---|
| `api/linear-issues.ts` | Vercel function TRMNL polls. One GraphQL round trip to Linear. |
| `src/full.liquid` | 800x480. Issue table plus open, carried over and urgent counts. |
| `src/half_horizontal.liquid` | 800x240. Open count plus top 4 issues in a 2x2 grid. |
| `src/half_vertical.liquid` | 400x480. Three counts on top, top 6 issues stacked. |
| `src/quadrant.liquid` | 400x240. Top 3 issues. |
| `src/shared.liquid` | Logo, title bar, empty state and label partials used by every size. |
| `src/settings.yml` | Polling config and form fields, in the format `trmnlp push` uploads. |
| `.trmnlp.yml` | Local preview config with sample data. Not uploaded. |
| `public/` | Landing page and setup guide served by Vercel. |
| `scripts/sync-guide.py` | Copies `src/` into the setup guide's copy blocks. |

### API response

```json
{
  "issues": [
    {
      "identifier": "ENG-412",
      "title": "Checkout form drops submissions",
      "priority": 1,
      "priorityLabel": "Urgent",
      "status": "In Progress",
      "statusType": "started",
      "cycleNumber": 40,
      "cycleStatus": "past",
      "teamKey": "ENG",
      "url": "https://linear.app/...",
      "dueDate": "2026-10-03",
      "labels": ["Bug"]
    }
  ],
  "total_count": 9,
  "current_count": 6,
  "past_count": 3,
  "urgent_count": 2,
  "in_progress_count": 3,
  "current_cycle": 42,
  "updated_at": "2026-10-01T15:00:00.000Z",
  "user_name": "Sample User"
}
```

Rules the API applies:

- Only issues assigned to the key's owner.
- Skips completed, canceled and duplicate states.
- Skips issues with no cycle, and issues in future cycles.
- Strips emoji from titles. E-ink has no emoji font, so they'd render as empty boxes.

### Auth

The API reads the Linear key from, in order: the `x-linear-api-key` header, the `Authorization` header (with or without `Bearer`), the `linear_api_key` query param, then the `LINEAR_API_KEY` env var.

Use the header. The query param only exists so older installs that put the key in the polling URL keep working.

## Develop

Preview the layouts locally with [trmnlp](https://github.com/usetrmnl/trmnlp), TRMNL's dev server. It needs Ruby 3.4 or newer.

```bash
brew install ruby
```

```bash
/opt/homebrew/opt/ruby/bin/gem install trmnl_preview
```

```bash
trmnlp serve
```

Open http://localhost:4567. It renders the sample data in `.trmnlp.yml` and reloads when `src/` changes. If trmnlp crashes with `invalid byte sequence in US-ASCII`, run it with `LANG=en_US.UTF-8`.

Check the templates against TRMNL's rules before pushing:

```bash
trmnlp lint
```

After changing anything in `src/`, refresh the setup guide:

```bash
python3 scripts/sync-guide.py
```

Run the API locally:

```bash
npm install
```

```bash
npx vercel dev
```

```bash
curl -H "x-linear-api-key: $LINEAR_API_KEY" http://localhost:3000/api/linear-issues
```

## Publish markup changes to TRMNL

Pushing to GitHub redeploys the API on Vercel. It does not update the markup in TRMNL. To push `src/` to the recipe:

1. Add the plugin's `id:` to the top of `src/settings.yml`. Without it, `trmnlp push` creates a new plugin.
2. Run `trmnlp login` once with your TRMNL API key.
3. Run `trmnlp push`.

## License

MIT
