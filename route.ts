import OpenAI from "openai";
import { NextResponse } from "next/server";
import { JIPITY_INSTRUCTIONS } from "../../../lib/jipity-prompt";
export const runtime="nodejs";
export async function POST(req:Request){try{if(!process.env.OPENAI_API_KEY)return NextResponse.json({error:"OPENAI_API_KEY is not configured"},{status:500});const body=await req.json();const messages=Array.isArray(body?.messages)?body.messages.slice(-20):[];const input=messages.map((m:any)=>`${m.role==="assistant"?"JIPITY":"CHRISTY"}: ${String(m.content||"")}`).join("\n\n");const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});const response=await client.responses.create({model:process.env.OPENAI_MODEL||"gpt-5",instructions:JIPITY_INSTRUCTIONS,input});return NextResponse.json({text:response.output_text||"I didn't get a usable response that time."});}catch(err:any){return NextResponse.json({error:err?.message||"Unknown error"},{status:500});}}
