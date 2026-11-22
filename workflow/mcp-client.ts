import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { fileURLToPath } from 'node:url';
import { readSchema, probeSchema, resultSchema } from './tools.ts';
export async function connectContext() {
  const client=new Client({name:'detour-loop',version:'0.1.0'});
  const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('./mcp-server.ts',import.meta.url))],stderr:'pipe'});
  try {
    await client.connect(transport);
    const discovered=await client.listTools();
    const names=discovered.tools.map(t=>t.name).sort();
    if (JSON.stringify(names)!==JSON.stringify(['read_context','run_probe'])) throw new Error('Unexpected MCP tool inventory');
    return {discovered,execute:async(name:string,args:unknown)=>{
      if(name==='read_context') readSchema.parse(args); else if(name==='run_probe') probeSchema.parse(args); else throw new Error('Tool is not allowed');
      const result=await client.callTool({name,arguments:args as Record<string,unknown>});
      if(result.isError) throw new Error('MCP tool returned an error');
      const content=result.content as {type:string;text?:string}[];
      if(content.length!==1 || content[0]?.type!=='text' || !content[0].text || content[0].text.length>8000) throw new Error('Unexpected MCP result');
      return resultSchema.parse(JSON.parse(content[0].text));
    },close:()=>client.close()};
  } catch(error) {await client.close();throw error;}
}
