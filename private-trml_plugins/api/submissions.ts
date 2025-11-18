import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

interface SubmissionCountsResponse {
  counts: {
    general_submissions: {
      today: number;
      this_week: number;
      this_month: number;
    };
    project_submissions: {
      today: number;
      this_week: number;
      this_month: number;
    };
    updated_at: string;
  };
}

/**
 * Vercel serverless function to fetch submission counts from Supabase
 * Shows counts for Today, This Week, and This Month for both:
 * - prf_general_submissions
 * - prf_project_submissions
 * 
 * Authentication:
 * Provide Supabase URL and API key via query parameters:
 * - supabase_url: Your Supabase project URL
 * - supabase_key: Your Supabase anon/service role key
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Only allow GET requests
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Read Supabase credentials from query parameters
    const supabaseUrl = req.query.supabase_url as string;
    const supabaseKey = req.query.supabase_key as string;

    if (!supabaseUrl || !supabaseKey) {
      res.status(400).json({ 
        error: 'Missing required parameters',
        message: 'Please provide both supabase_url and supabase_key as query parameters'
      });
      return;
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Calculate date ranges in UTC to match Supabase timestamps
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const weekStart = new Date(todayStart);
    weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay()); // Start of week (Sunday)
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    // Format dates for PostgreSQL (already in UTC)
    const formatDate = (date: Date) => date.toISOString();

    // Query general submissions counts
    const [generalToday, generalWeek, generalMonth] = await Promise.all([
      supabase
        .from('prf_general_submissions')
        .select('submission_id', { count: 'exact', head: true })
        .gte('created_at', formatDate(todayStart)),
      supabase
        .from('prf_general_submissions')
        .select('submission_id', { count: 'exact', head: true })
        .gte('created_at', formatDate(weekStart)),
      supabase
        .from('prf_general_submissions')
        .select('submission_id', { count: 'exact', head: true })
        .gte('created_at', formatDate(monthStart)),
    ]);

    // Query project submissions counts
    const [projectToday, projectWeek, projectMonth] = await Promise.all([
      supabase
        .from('prf_project_submissions')
        .select('project_submission_id', { count: 'exact', head: true })
        .gte('created_at', formatDate(todayStart)),
      supabase
        .from('prf_project_submissions')
        .select('project_submission_id', { count: 'exact', head: true })
        .gte('created_at', formatDate(weekStart)),
      supabase
        .from('prf_project_submissions')
        .select('project_submission_id', { count: 'exact', head: true })
        .gte('created_at', formatDate(monthStart)),
    ]);

    // Check for errors
    if (generalToday.error || generalWeek.error || generalMonth.error ||
        projectToday.error || projectWeek.error || projectMonth.error) {
      const errors = [
        generalToday.error,
        generalWeek.error,
        generalMonth.error,
        projectToday.error,
        projectWeek.error,
        projectMonth.error
      ].filter(Boolean);

      res.status(500).json({
        error: 'Failed to fetch submission counts',
        details: errors.map(e => e?.message).join('; '),
      });
      return;
    }

    // Build response (wrapped in counts to match template expectations)
    const response: SubmissionCountsResponse = {
      counts: {
        general_submissions: {
          today: generalToday.count || 0,
          this_week: generalWeek.count || 0,
          this_month: generalMonth.count || 0,
        },
        project_submissions: {
          today: projectToday.count || 0,
          this_week: projectWeek.count || 0,
          this_month: projectMonth.count || 0,
        },
        updated_at: new Date().toISOString(),
      },
    };

    // Set cache headers (refresh every 5 minutes)
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching submission counts:', error);
    res.status(500).json({
      error: 'Failed to fetch submission counts',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

