// MCP server data for the interactive diagram visualization.
// Models the client ↔ server architecture with tools, requests, and responses.

// ── Types ──────────────────────────────────────────────────────────

export interface MCPTool {
  id: string;
  name: string;
  description: string;
  inputSchema: Record<string, { type: string; required: boolean }>;
  exampleRequest: string;
  exampleResponse: string;
}

export interface MCPServer {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string; // emoji
  tools: MCPTool[];
}

export interface MCPConnection {
  source: string; // client id
  target: string; // server id
  label: string;
}

// ── MCP Servers ────────────────────────────────────────────────────

export const MCP_SERVERS: MCPServer[] = [
  {
    id: 'filesystem',
    name: 'Filesystem',
    description: 'Read, write, and search files on disk.',
    category: 'Data Access',
    icon: '📁',
    tools: [
      {
        id: 'read_file',
        name: 'read_file',
        description: 'Read the contents of a file.',
        inputSchema: {
          path: { type: 'string', required: true },
        },
        exampleRequest: JSON.stringify({ path: 'README.md' }, null, 2),
        exampleResponse: JSON.stringify({ content: '# Project Title\n\nDescription here...' }, null, 2),
      },
      {
        id: 'list_directory',
        name: 'list_directory',
        description: 'List files in a directory.',
        inputSchema: {
          path: { type: 'string', required: true },
          recursive: { type: 'boolean', required: false },
        },
        exampleRequest: JSON.stringify({ path: 'src', recursive: false }, null, 2),
        exampleResponse: JSON.stringify({ entries: ['components', 'lib', 'pages', 'styles'] }, null, 2),
      },
      {
        id: 'search_files',
        name: 'search_files',
        description: 'Search for files matching a pattern.',
        inputSchema: {
          pattern: { type: 'string', required: true },
          path: { type: 'string', required: false },
        },
        exampleRequest: JSON.stringify({ pattern: '*.ts', path: 'src' }, null, 2),
        exampleResponse: JSON.stringify({ matches: ['src/lib/mcp-data.ts', 'src/lib/tool-call-flow.ts'] }, null, 2),
      },
    ],
  },
  {
    id: 'postgres',
    name: 'Postgres',
    description: 'Query a PostgreSQL database.',
    category: 'Data Access',
    icon: '🗄️',
    tools: [
      {
        id: 'query',
        name: 'query',
        description: 'Execute a SQL query and return results.',
        inputSchema: {
          query: { type: 'string', required: true },
        },
        exampleRequest: JSON.stringify({ query: 'SELECT id, name FROM users WHERE active = true LIMIT 5' }, null, 2),
        exampleResponse: JSON.stringify({ rows: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }] }, null, 2),
      },
      {
        id: 'list_tables',
        name: 'list_tables',
        description: 'List all tables in the database.',
        inputSchema: {},
        exampleRequest: JSON.stringify({}),
        exampleResponse: JSON.stringify({ tables: ['users', 'posts', 'comments', 'sessions'] }, null, 2),
      },
    ],
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Interact with GitHub repositories.',
    category: 'Service Integration',
    icon: '🐙',
    tools: [
      {
        id: 'list_repos',
        name: 'list_repos',
        description: 'List repositories for a user or org.',
        inputSchema: {
          owner: { type: 'string', required: true },
        },
        exampleRequest: JSON.stringify({ owner: 'anthropics' }, null, 2),
        exampleResponse: JSON.stringify({ repos: ['claude-code', 'mcp', 'prompting-guide'] }, null, 2),
      },
      {
        id: 'get_issues',
        name: 'get_issues',
        description: 'Get issues from a repository.',
        inputSchema: {
          owner: { type: 'string', required: true },
          repo: { type: 'string', required: true },
          state: { type: 'string', required: false },
        },
        exampleRequest: JSON.stringify({ owner: 'anthropics', repo: 'mcp', state: 'open' }, null, 2),
        exampleResponse: JSON.stringify({ issues: [{ id: 42, title: 'Add SSE transport' }, { id: 43, title: 'Stdio transport improvements' }] }, null, 2),
      },
      {
        id: 'search_code',
        name: 'search_code',
        description: 'Search repositories for code.',
        inputSchema: {
          query: { type: 'string', required: true },
          owner: { type: 'string', required: false },
        },
        exampleRequest: JSON.stringify({ query: 'MCP transport', owner: 'anthropics' }, null, 2),
        exampleResponse: JSON.stringify({ results: [{ repo: 'mcp', path: 'src/transport/sse.ts' }] }, null, 2),
      },
    ],
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Send messages and search channels.',
    category: 'Service Integration',
    icon: '💬',
    tools: [
      {
        id: 'send_message',
        name: 'send_message',
        description: 'Send a message to a channel or user.',
        inputSchema: {
          channel: { type: 'string', required: true },
          text: { type: 'string', required: true },
        },
        exampleRequest: JSON.stringify({ channel: '#eng-updates', text: 'Deployment complete: v2.4.1' }, null, 2),
        exampleResponse: JSON.stringify({ ts: '1718000000.123456', channel: '#eng-updates' }, null, 2),
      },
      {
        id: 'search_messages',
        name: 'search_messages',
        description: 'Search messages across channels.',
        inputSchema: {
          query: { type: 'string', required: true },
          channel: { type: 'string', required: false },
        },
        exampleRequest: JSON.stringify({ query: 'deployment', channel: '#eng-updates' }, null, 2),
        exampleResponse: JSON.stringify({ messages: [{ text: 'Deploying v2.4.0...', ts: '1717900000.111111' }] }, null, 2),
      },
    ],
  },
];

// ── Client (the AI agent / LLM host) ───────────────────────────────

export const MCP_CLIENT = {
  id: 'client',
  name: 'AI Agent',
  description: 'The LLM host that connects to MCP servers.',
  icon: '🤖',
};

// ── Connections (client → each server) ─────────────────────────────

export const MCP_CONNECTIONS: MCPConnection[] = MCP_SERVERS.map(server => ({
  source: 'client',
  target: server.id,
  label: 'stdio / SSE',
}));

// ── Protocol message examples ──────────────────────────────────────

export const PROTOCOL_MESSAGES = {
  initialize: {
    request: JSON.stringify({
      jsonrpc: '2.0',
      id: '1',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-01',
        capabilities: {},
        clientInfo: { name: 'ai-concepts-viz', version: '1.0.0' },
      },
    }, null, 2),
    response: JSON.stringify({
      jsonrpc: '2.0',
      id: '1',
      result: {
        protocolVersion: '2024-11-01',
        capabilities: { tools: {} },
        serverInfo: { name: 'mcp-filesystem', version: '1.0.0' },
      },
    }, null, 2),
  },
  listTools: {
    request: JSON.stringify({
      jsonrpc: '2.0',
      id: '2',
      method: 'tools/list',
      params: {},
    }, null, 2),
    response: JSON.stringify({
      jsonrpc: '2.0',
      id: '2',
      result: {
        tools: [
          { name: 'read_file', description: 'Read the contents of a file.' },
          { name: 'list_directory', description: 'List files in a directory.' },
          { name: 'search_files', description: 'Search for files matching a pattern.' },
        ],
      },
    }, null, 2),
  },
  callTool: {
    request: JSON.stringify({
      jsonrpc: '2.0',
      id: '3',
      method: 'tools/call',
      params: {
        name: 'read_file',
        arguments: { path: 'README.md' },
      },
    }, null, 2),
    response: JSON.stringify({
      jsonrpc: '2.0',
      id: '3',
      result: {
        content: [
          { type: 'text', text: '# Project Title\n\nDescription here...' },
        ],
      },
    }, null, 2),
  },
};
