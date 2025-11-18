# TRMNL Submission Counts Plugin

A private TRMNL plugin that displays submission counts from Supabase for `prf_general_submissions` and `prf_project_submissions` tables.

## Features

- 📊 Shows submission counts for Today, This Week, and This Month
- 🔢 Displays counts for both General Submissions and Project Submissions
- ⚡ Auto-refreshes every 5 minutes
- ✨ Clean, modern UI optimized for e-ink displays
- 📱 Responsive layouts for full-screen, half-screen, and quadrant views

## Setup

### Deploy to Vercel

```bash
# Install dependencies
npm install

# Login to Vercel (if not already logged in)
npx vercel login

# Deploy to Vercel
npx vercel --prod
```

### Get Your Polling URL

After deployment, Vercel will give you a URL like:

```text
https://your-project.vercel.app/api/submissions
```

This is your polling URL for TRMNL.

### Create Plugin on TRMNL

1. Go to [TRMNL Plugins](https://usetrmnl.com/plugins)
2. Click "Create Private Plugin"
3. Fill in the details:
   - **Name**: Submission Counts
   - **Strategy**: Polling
   - **Polling URL**: `https://your-project.vercel.app/api/submissions?supabase_url={{ supabase_url }}&supabase_key={{ supabase_key }}`
   - **Refresh Interval**: 5 minutes (or your preference)
4. Upload the `submissions.liquid` file as the markup template
5. Upload the `form-fields.yaml` file to configure the plugin form fields
6. Save the plugin
7. When adding the plugin, you'll be prompted to enter your Supabase URL and API key

## Configuration

The plugin requires two form fields:

1. **Supabase Project URL**: Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
2. **Supabase API Key**: Your Supabase anon or service role key

These are passed as query parameters to the API endpoint.

## Data Structure

The API endpoint returns data in this format:

```json
{
  "counts": {
    "general_submissions": {
      "today": 5,
      "this_week": 23,
      "this_month": 87
    },
    "project_submissions": {
      "today": 3,
      "this_week": 15,
      "this_month": 52
    },
    "updated_at": "2025-11-17T10:00:00Z"
  }
}
```

## Database Tables

The plugin queries these Supabase tables:

- `prf_general_submissions` - General submission records
- `prf_project_submissions` - Project submission records

Both tables must have a `created_at` timestamp column for the date filtering to work.

## Date Ranges

- **Today**: Submissions created from midnight UTC today
- **This Week**: Submissions created from Sunday (start of week) UTC
- **This Month**: Submissions created from the 1st of the current month UTC

All dates are calculated in UTC to match Supabase timestamp storage.

## Project Structure

```text
private-trml_plugins/
├── api/
│   └── submissions.ts      # Vercel serverless function (API endpoint)
├── submissions.liquid      # TRMNL markup template
├── form-fields.yaml         # Plugin form field definitions
├── package.json             # Node.js dependencies
├── tsconfig.json           # TypeScript configuration
├── vercel.json             # Vercel configuration
└── README.md               # This file
```

## License

Private - Internal use only

