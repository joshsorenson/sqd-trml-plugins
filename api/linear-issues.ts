import { VercelRequest, VercelResponse } from '@vercel/node';
import { LinearClient } from '@linear/sdk';

interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  priority: number;
  priorityLabel: string;
  status: string;
  url: string;
  cycleNumber?: number;
  dueDate?: string;
  labels: string[];
}

interface TRMNLResponse {
  merge_variables: {
    issues: LinearIssue[];
    total_count: number;
    updated_at: string;
    user_name: string;
  };
}

/**
 * Vercel serverless function to fetch Linear issues due in current cycle or earlier
 * This endpoint serves as the polling strategy for TRMNL plugin
 * 
 * Authentication:
 * Provide your Linear API key via one of these methods:
 * 1. X-Linear-API-Key header (recommended)
 * 2. Authorization: Bearer {key} header
 * 3. LINEAR_API_KEY environment variable (fallback)
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
    // Read Linear API key from header (preferred) or environment variable (fallback)
    const linearApiKey = 
      (req.headers['x-linear-api-key'] as string) || 
      (req.headers['authorization']?.replace('Bearer ', '') as string) ||
      process.env.LINEAR_API_KEY;

    if (!linearApiKey) {
      res.status(401).json({ 
        error: 'Linear API key required',
        message: 'Please provide your Linear API key in the X-Linear-API-Key header or Authorization header'
      });
      return;
    }

    const client = new LinearClient({ apiKey: linearApiKey });

    // Get the current user
    const viewer = await client.viewer;
    const userName = viewer.name;

    // Get all teams to fetch current cycles
    const teams = await client.teams();
    const teamsList = await teams.nodes;

    // Map to store current cycle IDs and their cycle numbers
    const currentCycleMap = new Map<string, number>();

    // Fetch current cycles for all teams
    for (const team of teamsList) {
      const cycles = await team.cycles({
        filter: {
          isActive: { eq: true },
        },
      });
      const cyclesList = await cycles.nodes;

      for (const cycle of cyclesList) {
        currentCycleMap.set(cycle.id, cycle.number);
      }
    }

    // Fetch issues assigned to current user
    const issues = await client.issues({
      filter: {
        assignee: { id: { eq: viewer.id } },
        // Exclude completed/cancelled issues
        state: {
          type: { nin: ['completed', 'canceled'] },
        },
      },
      orderBy: 'priority',
    });

    const issuesList = await issues.nodes;

    // Filter and format issues
    const filteredIssues: LinearIssue[] = [];

    for (const issue of issuesList) {
      const cycleId = issue.cycleId;

      // Include issues that:
      // 1. Have a cycle and it's current or earlier (based on cycle number)
      // 2. OR have no cycle (backlog items)
      const shouldInclude =
        cycleId && currentCycleMap.has(cycleId)
          ? true // Include if in current cycle
          : !cycleId
          ? false // Exclude backlog items without cycles
          : true; // Include if in an earlier cycle

      if (shouldInclude) {
        const state = await issue.state;
        const labels = await issue.labels();
        const labelsList = await labels.nodes;

        filteredIssues.push({
          id: issue.id,
          identifier: issue.identifier,
          title: issue.title,
          priority: issue.priority,
          priorityLabel: issue.priorityLabel,
          status: state?.name || 'No Status',
          url: issue.url,
          cycleNumber: cycleId ? currentCycleMap.get(cycleId) : undefined,
          dueDate: issue.dueDate?.toString(),
          labels: labelsList.map((label: { name: string }) => label.name),
        });
      }
    }

    // Sort by priority (1 = Urgent, 4 = Low)
    filteredIssues.sort((a, b) => a.priority - b.priority);

    const response: TRMNLResponse = {
      merge_variables: {
        issues: filteredIssues,
        total_count: filteredIssues.length,
        updated_at: new Date().toISOString(),
        user_name: userName,
      },
    };

    // Set cache headers (refresh every 15 minutes)
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate');
    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching Linear issues:', error);
    res.status(500).json({
      error: 'Failed to fetch Linear issues',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

