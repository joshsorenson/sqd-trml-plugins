# TRMNL Linear Issues Plugin

A TRMNL plugin that displays Linear issues assigned to you that are due in the current cycle or earlier.

## Features

- 📋 Shows issues from current cycle and earlier cycles
- 🔴 Priority-based color coding (Urgent/High priority badges)
- 🏷️ Displays status and cycle information
- 📅 Shows cycle numbers with status indicators (current/past/future)
- ♻️ Auto-refreshes every 15 minutes
- ✨ Clean, modern UI optimized for e-ink displays
- 📊 Responsive layouts for full-screen, half-screen, and quadrant views
- ⚙️ Configurable maximum number of issues to display

## Setup

### For Plugin Users (Easiest Method)

If someone has already deployed this plugin, you just need your Linear API key:

1. **Get Your Linear API Key**
   - Go to [Linear Settings > API](https://linear.app/settings/api)
   - Create a new Personal API Key
   - Copy the key

2. **Add Plugin to TRMNL**
   - Go to [TRMNL Plugins](https://usetrmnl.com/plugins) or use the [Linear Issues Recipe](https://usetrmnl.com/recipes/182427)
   - Find "Linear Issues - Current Cycle" (or use the shared plugin URL)
   - Click "Add to my TRMNL"
   - Enter your Linear API key in the plugin settings form field
   - Optionally configure the maximum number of issues to display (default: 15)
   - Save and activate!

### For Plugin Developers (Deploy Your Own)

If you want to host your own instance:

#### 1. Get Your Linear API Key

1. Go to [Linear Settings > API](https://linear.app/settings/api)
2. Create a new Personal API Key  
3. Copy the key (users will configure it in TRMNL, not in Vercel)

#### 2. Deploy to Vercel

```bash
# Install dependencies
npm install

# Login to Vercel (if not already logged in)
npx vercel login

# Deploy to Vercel
npx vercel --prod
```

#### 3. Get Your Polling URL

After deployment, Vercel will give you a URL like:

```text
https://your-project.vercel.app/api/linear-issues
```

This is your polling URL for TRMNL.

#### 4. Create Plugin on TRMNL

1. Go to [TRMNL Plugins](https://usetrmnl.com/plugins)
2. Click "Create Private Plugin" (or "Create Public Plugin" to share)
3. Fill in the details:
   - **Name**: Linear Issues - Current Cycle
   - **Strategy**: Polling
   - **Polling URL**: Your Vercel URL from step 3
   - **Refresh Interval**: 15 minutes (or your preference)
4. Upload the `linear.liquid` file as the markup template
5. Upload the `form-fields.yaml` file to configure the plugin form fields
6. Save the plugin
7. When users add your plugin, they'll be prompted to enter their Linear API key and optionally configure the maximum number of issues

## Data Structure

The API endpoint returns data in this format:

```json
{
  "issues": [
    {
      "id": "issue-id",
      "identifier": "SIS-810",
      "title": "Issue title",
      "priority": 1,
      "priorityLabel": "Urgent",
      "status": "In Progress",
      "url": "https://linear.app/...",
      "cycleNumber": 4,
      "cycleStatus": "current",
      "dueDate": "2025-11-20",
      "labels": ["Bug", "Feature"]
    }
  ],
  "total_count": 5,
  "current_cycle": 4,
  "updated_at": "2025-11-17T10:00:00Z",
  "user_name": "Your Name"
}
```

### Issue Priority Values

- `0`: No priority
- `1`: Urgent (displayed with black badge)
- `2`: High (displayed with gray badge)
- `3`: Normal
- `4`: Low

### Cycle Status Values

- `current`: Issue is in the current active cycle
- `past`: Issue is in a cycle that has ended
- `future`: Issue is in a future cycle

## Customization

### Modify Issue Filtering

Edit `api/linear-issues.ts` to change which issues are included:

- Currently includes: Issues assigned to you that have a cycle (current, past, or future)
- Excludes: Completed and cancelled issues, backlog items without cycles
- Issues are sorted by cycle number (earlier cycles first), then by priority (urgent first)

### Adjust Display Count

The plugin supports a configurable maximum number of issues via the `max_issues` form field (default: 15). Users can set this between 5-30 issues in the plugin settings.

The `linear.liquid` template uses this value:

- Full-screen view: Shows up to `max_issues` (default 15)
- Compact views (half-screen/quadrant): Shows fewer items based on view size

To change the default, edit `form-fields.yaml`:

```yaml
- keyname: max_issues
  default: 15  # Change this value
```

### Change Priority Colors

Edit the CSS in `linear.liquid`:

```css
.priority-1 { 
  background: #000;  /* Urgent - Black */
  box-shadow: 0 0 0 2px rgba(0,0,0,0.2);
}
.priority-2 { 
  background: #666;  /* High - Dark Gray */
  box-shadow: 0 0 0 2px rgba(0,0,0,0.1);
}
.priority-3 { background: #999; }  /* Normal - Medium Gray */
.priority-4 { background: #ccc; }   /* Low - Light Gray */
```

### View-Specific Display Limits

The template automatically limits items based on view size:

- Quadrant view: Shows up to 2 issues
- Half-screen views: Shows up to 5 issues
- Full-screen view: Shows up to `max_issues` (default 15)

## Development

```bash
# Install dependencies
npm install

# Run locally with Vercel CLI
npx vercel dev

# Test the endpoint (replace YOUR_LINEAR_API_KEY with your actual key)
curl -H "X-Linear-API-Key: YOUR_LINEAR_API_KEY" http://localhost:3000/api/linear-issues
```

## Troubleshooting

### No issues showing up

1. Check that you have issues assigned to you in Linear
2. Verify issues have a cycle assigned (backlog items without cycles are excluded)
3. Make sure issues aren't marked as completed/cancelled
4. Ensure issues are assigned to you (not just watching them)

### API errors

1. Verify your Linear API key is correct (test it in Linear's API console)
2. Make sure your Linear API key is entered correctly in the TRMNL plugin form fields
3. Check the Vercel function logs for detailed error messages
4. Test the API endpoint directly:

   ```bash
   # Using query parameter
   curl "https://your-project.vercel.app/api/linear-issues?linear_api_key=YOUR_KEY"
   
   # Using header
   curl -H "X-Linear-API-Key: YOUR_KEY" https://your-project.vercel.app/api/linear-issues
   ```

### Display issues

1. Make sure the TRMNL plugin is activated
2. Check that the polling URL is correct
3. Verify the refresh interval settings

## License

MIT

## Project Structure

```text
trml plugins/
├── api/
│   └── linear-issues.ts      # Vercel serverless function (API endpoint)
├── linear.liquid             # TRMNL markup template
├── form-fields.yaml          # Plugin form field definitions
├── package.json              # Node.js dependencies
├── vercel.json              # Vercel configuration
└── README.md                # This file
```

## API Authentication

The API endpoint accepts Linear API keys via multiple methods (in order of precedence):

1. Query parameter: `?linear_api_key=YOUR_KEY`
2. Header: `X-Linear-API-Key: YOUR_KEY`
3. Authorization header: `Authorization: Bearer YOUR_KEY`
4. Environment variable: `LINEAR_API_KEY` (for development only)

## Support

For issues or questions:

- [Linear Issues Recipe on TRMNL](https://usetrmnl.com/recipes/182427) - Direct link to add the plugin
- Check the [TRMNL Documentation](https://usetrmnl.com/docs)
- Review [Linear API Docs](https://developers.linear.app/)
- Plugin repository: [GitHub](https://github.com/joshsorenson/trml-plugins)
