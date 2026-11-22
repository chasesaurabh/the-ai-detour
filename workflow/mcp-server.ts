import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { readSchema, probeSchema, executeTool } from './tools.ts';
serveStdio(() => {
  const server=new McpServer({name:'detour-synthetic-context',version:'0.1.0'});
  server.registerTool('read_context',{description:'Read a synthetic incident artifact; not a Jira or Confluence connection',inputSchema:readSchema}, async args=>({content:[{type:'text',text:JSON.stringify(executeTool('read_context',args))}]}));
  server.registerTool('run_probe',{description:'Execute a fixed, read-only comparison probe',inputSchema:probeSchema}, async args=>({content:[{type:'text',text:JSON.stringify(executeTool('run_probe',args))}]}));
  return server;
});
