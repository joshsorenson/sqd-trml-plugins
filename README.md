# TRMNL Linear Issues Plugin

A TRMNL plugin that displays Linear issues assigned to you that are due in the current cycle or earlier.

## Features

- 📋 Shows issues from current cycle
- 🔴 Priority-based color coding
- 🏷️ Displays labels and status
- 📅 Shows cycle numbers and due dates
- ♻️ Auto-refreshes every 15 minutes
- ✨ Clean, modern UI optimized for e-ink displays

## Setup

### For Plugin Users (Easiest Method)

If someone has already deployed this plugin, you just need your Linear API key:

1. **Get Your Linear API Key**
   - Go to [Linear Settings > API](https://linear.app/settings/api)
   - Create a new Personal API Key
   - Copy the key

2. **Add Plugin to TRMNL**
   - Go to [TRMNL Plugins](https://usetrmnl.com/plugins)
   - Find "Linear Issues - Current Cycle" (or use the shared plugin URL)
   - Click "Add to my TRMNL"
   - In the plugin settings, add a custom header:
     - Header Name: `X-Linear-API-Key`
     - Header Value: Your Linear API key from step 1
   - Save and activate!

### For Plugin Developers (Deploy Your Own)

If you want to host your own instance:

#### 1. Get Your Linear API Key

1. Go to [Linear Settings > API](https://linear.app/settings/api)
2. Create a new Personal API Key  
3. Copy the key (you'll configure it in TRMNL, not in Vercel)

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
```
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
4. Upload the `markup.liquid` file
5. **Important**: In the plugin configuration, add a custom header:
   - Header Name: `X-Linear-API-Key`
   - Header Value: `{user_provided}` (TRMNL will prompt each user to enter their key)
6. Save the plugin
7. When users add your plugin, they'll be prompted to enter their Linear API key

## Data Structure

The API endpoint returns data in this format:

```json
{
  "merge_variables": {
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
        "dueDate": "2025-11-20",
        "labels": ["Bug", "Feature"]
      }
    ],
    "total_count": 5,
    "updated_at": "2025-11-17T10:00:00Z",
    "user_name": "Your Name"
  }
}
```

## Customization

### Modify Issue Filtering

Edit `api/linear-issues.ts` to change which issues are included:

- Currently includes: Issues in current cycle
- Excludes: Completed and cancelled issues, backlog items

### Adjust Display Count

The `markup.liquid` file shows up to 10 issues. Change the limit:

```liquid
{% for issue in issues limit: 10 %}
```

### Change Priority Colors

Edit the CSS in `markup.liquid`:

```css
.issue-item.priority-1 { border-left: 4px solid #ff0000; } /* Urgent - Red */
.issue-item.priority-2 { border-left: 4px solid #ff9500; } /* High - Orange */
.issue-item.priority-3 { border-left: 4px solid #007aff; } /* Normal - Blue */
.issue-item.priority-4 { border-left: 4px solid #999; }    /* Low - Gray */
```

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
2. Verify issues are in the current cycle (not backlog or future cycles)
3. Make sure issues aren't marked as completed/cancelled

### API errors

1. Verify your Linear API key is correct (test it in Linear's API console)
2. Make sure the `X-Linear-API-Key` header is configured in your TRMNL plugin settings
3. Check the Vercel function logs for detailed error messages
4. Test the API endpoint directly:
   ```bash
   curl -H "X-Linear-API-Key: YOUR_KEY" https://your-project.vercel.app/api/linear-issues
   ```

### Display issues

1. Make sure the TRMNL plugin is activated
2. Check that the polling URL is correct
3. Verify the refresh interval settings

## License

MIT

## Support

For issues or questions:
- Check the [TRMNL Documentation](https://usetrmnl.com/docs)
- Review [Linear API Docs](https://developers.linear.app/)

