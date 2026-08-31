import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createDattoClient, type DattoClient } from 'datto-rmm-api';
import { type ServerConfig } from './config.js';
import { tools, getTool, LAZY_TOOL_GROUPS, CORE_TOOL_NAMES, getToolGroup } from './tools/index.js';
import { resources, resourceTemplates, readResource } from './resources/index.js';

/**
 * Create and configure the MCP server.
 */
export function createServer(config: ServerConfig): { server: Server; client: DattoClient } {
  // Create the Datto API client
  const client = createDattoClient({
    platform: config.platform,
    auth: {
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
    },
  });

  const loadedGroups = new Set<string>();

  // Create MCP server
  const server = new Server(
    {
      name: 'datto-rmm',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // Register tool handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const activeTools = tools.filter((t) => {
      if (CORE_TOOL_NAMES.has(t.name)) return true;
      const group = getToolGroup(t.name);
      return group !== null && loadedGroups.has(group);
    });
    return {
      tools: activeTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Handle rmm_load_tools meta-tool
    if (name === 'rmm_load_tools') {
      const group = (args as Record<string, unknown>)?.['group'] as string | undefined;
      if (!group || !LAZY_TOOL_GROUPS[group]) {
        const validGroups = Object.keys(LAZY_TOOL_GROUPS).join(', ');
        return {
          content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'validation_error', detail: `Unknown group "${group}". Valid groups: ${validGroups}`, code: 400 }) }],
          isError: true,
        };
      }
      loadedGroups.add(group);
      const toolNames = LAZY_TOOL_GROUPS[group];
      return {
        content: [{ type: 'text', text: JSON.stringify({ ok: true, data: { group, loaded: true, toolCount: toolNames!.length, tools: toolNames } }) }],
      };
    }

    const tool = getTool(name);

    if (!tool) {
      // Check if it's a lazy tool that hasn't been loaded yet
      const group = getToolGroup(name);
      if (group) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'tool_not_loaded', detail: `Tool "${name}" requires the "${group}" group. Call rmm_load_tools({"group":"${group}"}) first.`, code: 400 }) }],
          isError: true,
        };
      }
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    // Check if tool is lazy and its group hasn't been loaded
    const group = getToolGroup(name);
    if (group && !loadedGroups.has(group)) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'tool_not_loaded', detail: `Tool "${name}" requires the "${group}" group. Call rmm_load_tools({"group":"${group}"}) first.`, code: 400 }) }],
        isError: true,
      };
    }

    try {
      const result = await tool.handler(client, args ?? {});
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Error executing ${name}: ${message}` }],
        isError: true,
      };
    }
  });

  // Register resource handlers
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return { resources };
  });

  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
    return { resourceTemplates };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    return readResource(client, uri);
  });

  return { server, client };
}

/**
 * Run the server with stdio transport.
 */
export async function runServer(config: ServerConfig): Promise<void> {
  const { server } = createServer(config);
  const transport = new StdioServerTransport();

  await server.connect(transport);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await server.close();
    process.exit(0);
  });
}
