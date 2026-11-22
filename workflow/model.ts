import { decisionSchema, type Model } from './engine.ts';
import * as z from 'zod';
export function localModel(endpoint: string, model: string): Model {
  const url=new URL(endpoint);
  if (url.protocol!=='http:' || !['localhost','127.0.0.1','[::1]'].includes(url.hostname) || url.username || url.password || url.search) throw new Error('This teaching adapter accepts a loopback HTTP endpoint only');
  return async (messages,signal) => {
    const response=await fetch(url,{method:'POST',redirect:'error',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({model,messages,temperature:0,max_tokens:1000,chat_template_kwargs:{enable_thinking:false},response_format:{type:'json_schema',json_schema:{name:'decision',schema:z.toJSONSchema(decisionSchema)}}})});
    if (!response.ok) throw new Error(`Model HTTP ${response.status}`);
    const text=await response.text(); if (text.length>64000) throw new Error('Model envelope too large');
    const data=JSON.parse(text);
    if (data.choices?.[0]?.finish_reason!=='stop' || typeof data.choices?.[0]?.message?.content!=='string') throw new Error('Incomplete or malformed model response');
    return data.choices[0].message.content;
  };
}
