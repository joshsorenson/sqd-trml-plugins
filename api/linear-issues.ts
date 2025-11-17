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
  cycleStatus?: 'current' | 'past' | 'future';
  dueDate?: string;
  labels: string[];
}

interface TRMNLResponse {
  issues: LinearIssue[];
  total_count: number;
  current_cycle?: number;
  updated_at: string;
  user_name: string;
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

    // Map to store cycle IDs and their info (number and current status)
    const cycleInfoMap = new Map<string, { number: number; isCurrent: boolean }>();
    const currentCycleNumbers = new Map<string, number>(); // team ID -> current cycle number

    // Fetch cycles for all teams
    for (const team of teamsList) {
      // Get active (current) cycle
      const activeCycles = await team.cycles({
        filter: {
          isActive: { eq: true },
        },
      });
      const activeCyclesList = await activeCycles.nodes;
      
      if (activeCyclesList.length > 0) {
        const currentCycle = activeCyclesList[0];
        currentCycleNumbers.set(team.id, currentCycle.number);
      }

      // Get all cycles to map them
      const allCycles = await team.cycles();
      const allCyclesList = await allCycles.nodes;

      for (const cycle of allCyclesList) {
        const isCurrent = activeCyclesList.some(ac => ac.id === cycle.id);
        cycleInfoMap.set(cycle.id, { 
          number: cycle.number, 
          isCurrent 
        });
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
    });

    const issuesList = await issues.nodes;

    // Filter and format issues
    const filteredIssues: LinearIssue[] = [];

    for (const issue of issuesList) {
      const cycle = await issue.cycle;
      const cycleId = cycle?.id;
      const cycleInfo = cycleId ? cycleInfoMap.get(cycleId) : undefined;

      // Include issues that:
      // 1. Have a cycle and it's current or earlier
      // 2. Exclude backlog items without cycles
      const shouldInclude = cycleInfo !== undefined;

      if (shouldInclude && cycleInfo) {
        const state = await issue.state;
        const labels = await issue.labels();
        const labelsList = await labels.nodes;
        const team = await issue.team;
        const currentCycleNumber = currentCycleNumbers.get(team.id);

        // Determine cycle status
        let cycleStatus: 'current' | 'past' | 'future' = 'current';
        if (cycleInfo.isCurrent) {
          cycleStatus = 'current';
        } else if (currentCycleNumber && cycleInfo.number > currentCycleNumber) {
          cycleStatus = 'future';
        } else if (currentCycleNumber && cycleInfo.number < currentCycleNumber) {
          cycleStatus = 'past';
        }

        filteredIssues.push({
          id: issue.id,
          identifier: issue.identifier,
          title: issue.title,
          priority: issue.priority,
          priorityLabel: issue.priorityLabel,
          status: state?.name || 'No Status',
          url: issue.url,
          cycleNumber: cycleInfo.number,
          cycleStatus: cycleStatus,
          dueDate: issue.dueDate?.toString(),
          labels: labelsList.map((label: { name: string }) => label.name),
        });
      }
    }

    // Sort by cycle number (lower/earlier first), then by priority (urgent first)
    filteredIssues.sort((a, b) => {
      // First, sort by cycle number (lower cycles first)
      const cycleA = a.cycleNumber || 999; // Issues without cycles go to bottom
      const cycleB = b.cycleNumber || 999;
      
      if (cycleA !== cycleB) {
        return cycleA - cycleB;
      }
      
      // If same cycle, sort by priority
      // Priority 0 = No priority (should be last)
      // Priority 1 = Urgent (should be first)
      // Priority 2 = High, 3 = Normal, 4 = Low
      const priorityA = a.priority === 0 ? 999 : a.priority;
      const priorityB = b.priority === 0 ? 999 : b.priority;
      
      return priorityA - priorityB;
    });

    // Get current cycle number (from first team for simplicity)
    const currentCycleNum = currentCycleNumbers.size > 0 
      ? Array.from(currentCycleNumbers.values())[0] 
      : undefined;

    // Return data at root level for TRMNL (not wrapped in merge_variables)
    const response = {
      issues: filteredIssues,
      total_count: filteredIssues.length,
      current_cycle: currentCycleNum,
      updated_at: new Date().toISOString(),
      user_name: userName,
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

