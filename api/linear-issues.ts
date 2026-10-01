import { VercelRequest, VercelResponse } from '@vercel/node';

const LINEAR_API_URL = 'https://api.linear.app/graphql';

// Linear caps a single page at 250. Nobody's screen shows more than 30.
const MAX_ISSUES_FETCHED = 100;

type CycleStatus = 'current' | 'past';

interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  priority: number;
  priorityLabel: string;
  status: string;
  statusType: string;
  url: string;
  teamKey: string;
  cycleNumber: number;
  cycleStatus: CycleStatus;
  dueDate?: string;
  labels: string[];
}

interface TRMNLResponse {
  issues: LinearIssue[];
  total_count: number;
  current_count: number;
  past_count: number;
  urgent_count: number;
  in_progress_count: number;
  current_cycle?: number;
  updated_at: string;
  user_name: string;
}

interface GraphQLIssueNode {
  id: string;
  identifier: string;
  title: string;
  priority: number;
  priorityLabel: string;
  url: string;
  dueDate: string | null;
  state: { name: string; type: string } | null;
  labels: { nodes: { name: string }[] };
  team: { key: string; activeCycle: { number: number } | null };
  cycle: { number: number } | null;
}

interface GraphQLResponse {
  data?: {
    viewer: {
      name: string;
      assignedIssues: { nodes: GraphQLIssueNode[] };
    };
  };
  errors?: { message: string }[];
}

// One round trip for everything. The old version made 4 extra calls per issue
// plus a full cycle list per team, which ran into the 10s function limit.
const ISSUES_QUERY = `
  query TrmnlLinearIssues($first: Int!) {
    viewer {
      name
      assignedIssues(
        first: $first
        filter: {
          state: { type: { nin: ["completed", "canceled", "duplicate"] } }
          cycle: { null: false, isFuture: { eq: false } }
        }
      ) {
        nodes {
          id
          identifier
          title
          priority
          priorityLabel
          url
          dueDate
          state { name type }
          labels(first: 5) { nodes { name } }
          team { key activeCycle { number } }
          cycle { number }
        }
      }
    }
  }
`;

/**
 * Polling endpoint for the TRMNL Linear plugin.
 * Returns open issues assigned to the API key owner in the current or past cycles.
 *
 * Authentication (first match wins):
 * 1. X-Linear-API-Key header (recommended, set via TRMNL polling headers)
 * 2. Authorization header, with or without "Bearer "
 * 3. linear_api_key query param (legacy, kept so existing installs keep working)
 * 4. LINEAR_API_KEY env var (local dev)
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const linearApiKey = readApiKey(req);
  if (!linearApiKey) {
    res.status(401).json({
      error: 'Linear API key required',
      message: 'Send your Linear API key in the X-Linear-API-Key header',
    });
    return;
  }

  try {
    const response = await fetch(LINEAR_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Linear personal API keys go in raw, no "Bearer" prefix
        Authorization: linearApiKey,
      },
      body: JSON.stringify({
        query: ISSUES_QUERY,
        variables: { first: MAX_ISSUES_FETCHED },
      }),
    });

    const payload = (await response.json()) as GraphQLResponse;

    if (!response.ok || payload.errors?.length || !payload.data) {
      const message = payload.errors?.map((e) => e.message).join('; ') || response.statusText;
      const status = response.status === 401 || response.status === 403 ? 401 : 502;
      res.status(status).json({ error: 'Linear API request failed', details: message });
      return;
    }

    const { viewer } = payload.data;
    const issues = viewer.assignedIssues.nodes
      .map(toTrmnlIssue)
      .filter((issue): issue is LinearIssue => issue !== null)
      .sort(compareIssues);

    const body: TRMNLResponse = {
      issues,
      total_count: issues.length,
      current_count: issues.filter((i) => i.cycleStatus === 'current').length,
      past_count: issues.filter((i) => i.cycleStatus === 'past').length,
      urgent_count: issues.filter((i) => i.priority === 1).length,
      in_progress_count: issues.filter((i) => i.statusType === 'started').length,
      current_cycle: mostCommonActiveCycle(viewer.assignedIssues.nodes),
      updated_at: new Date().toISOString(),
      user_name: viewer.name,
    };

    // Keys differ per user, so never share a cached response between them
    res.setHeader('Cache-Control', 'private, no-store');
    res.status(200).json(body);
  } catch (error) {
    console.error('Error fetching Linear issues:', error);
    res.status(500).json({
      error: 'Failed to fetch Linear issues',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

function readApiKey(req: VercelRequest): string | undefined {
  const header = req.headers['x-linear-api-key'];
  const auth = req.headers['authorization'];
  const query = req.query.linear_api_key;

  const raw =
    (Array.isArray(header) ? header[0] : header) ||
    auth?.replace(/^Bearer\s+/i, '') ||
    (Array.isArray(query) ? query[0] : query) ||
    process.env.LINEAR_API_KEY;

  return raw?.trim() || undefined;
}

function toTrmnlIssue(node: GraphQLIssueNode): LinearIssue | null {
  if (!node.cycle) return null;

  const activeNumber = node.team.activeCycle?.number;
  // Belt and braces: the query already drops future cycles
  if (activeNumber !== undefined && node.cycle.number > activeNumber) return null;

  // A team with no active cycle right now means every cycle is behind us
  const cycleStatus: CycleStatus = node.cycle.number === activeNumber ? 'current' : 'past';

  return {
    id: node.id,
    identifier: node.identifier,
    title: stripEmoji(node.title),
    priority: node.priority,
    priorityLabel: node.priorityLabel,
    status: node.state?.name || 'No Status',
    statusType: node.state?.type || 'unstarted',
    url: node.url,
    teamKey: node.team.key,
    cycleNumber: node.cycle.number,
    cycleStatus,
    dueDate: node.dueDate || undefined,
    labels: node.labels.nodes.map((label) => label.name),
  };
}

// E-ink has no emoji font, so "⚡️ Request" would render as a box plus "Request"
function stripEmoji(text: string): string {
  return text
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Oldest cycle first (overdue work floats up), then Urgent > High > Normal > Low > None
function compareIssues(a: LinearIssue, b: LinearIssue): number {
  if (a.cycleNumber !== b.cycleNumber) return a.cycleNumber - b.cycleNumber;
  const rank = (p: number) => (p === 0 ? 99 : p);
  return rank(a.priority) - rank(b.priority);
}

// Issues can span teams with different cycle numbers. Show the one most of them share.
function mostCommonActiveCycle(nodes: GraphQLIssueNode[]): number | undefined {
  const counts = new Map<number, number>();
  for (const node of nodes) {
    const n = node.team.activeCycle?.number;
    if (n !== undefined) counts.set(n, (counts.get(n) || 0) + 1);
  }
  let best: number | undefined;
  let bestCount = 0;
  for (const [n, count] of counts) {
    if (count > bestCount) {
      best = n;
      bestCount = count;
    }
  }
  return best;
}
