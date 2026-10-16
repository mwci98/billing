import assert from 'node:assert/strict';
import test from 'node:test';
import handler, {resetFaqRateLimitForTests} from '../api/faq-assistant';

const response = () => ({statusCode: 200, body: undefined as any, headers: {} as Record<string,string>, status(code:number){this.statusCode=code;return this;}, json(body:any){this.body=body;return this;}, setHeader(key:string,value:string){this.headers[key]=value;}});

test('FAQ assistant restricts methods and validates question length', async () => {
  resetFaqRateLimitForTests();
  const method:any=response(); await handler({method:'GET'},method); assert.equal(method.statusCode,405);
  const short:any=response(); await handler({method:'POST',body:{question:' '}},short); assert.equal(short.statusCode,400);
  const long:any=response(); await handler({method:'POST',body:{question:'x'.repeat(181)}},long); assert.equal(long.statusCode,400);
});

test('FAQ assistant reports unavailable configuration without a network call', async () => {
  resetFaqRateLimitForTests();
  const previous=process.env.GEMINI_API_KEY; const oldFetch=globalThis.fetch; let called=false; delete process.env.GEMINI_API_KEY; globalThis.fetch=async()=>{called=true;throw new Error('unexpected');};
  try {const res:any=response(); await handler({method:'POST',body:{question:'What does QPOS cost?'}},res); assert.equal(res.statusCode,503); assert.equal(called,false);} finally {globalThis.fetch=oldFetch;if(previous===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=previous;}
});

test('FAQ assistant sends constrained verified context to mocked Gemini', async () => {
  resetFaqRateLimitForTests();
  const previous=process.env.GEMINI_API_KEY; const oldFetch=globalThis.fetch; process.env.GEMINI_API_KEY='test-secret'; let request:any;
  globalThis.fetch=async(_url:any,options:any)=>{request=options;return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'QPOS includes a 20-day free trial.'}]}}]}),{status:200,headers:{'Content-Type':'application/json'}});};
  try {const res:any=response(); await handler({method:'POST',body:{question:'How long is the trial?'}},res); assert.equal(res.statusCode,200); assert.equal(res.body.answer,'QPOS includes a 20-day free trial.'); const body=JSON.parse(request.body); assert.match(body.systemInstruction.parts[0].text,/20-day free trial/); assert.match(body.systemInstruction.parts[0].text,/Never reveal/); assert.doesNotMatch(request.body,/test-secret/);} finally {globalThis.fetch=oldFetch;if(previous===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=previous;}
});

test('FAQ assistant returns a safe error when mocked Gemini fails', async () => {
  resetFaqRateLimitForTests();
  const previous=process.env.GEMINI_API_KEY; const oldFetch=globalThis.fetch; process.env.GEMINI_API_KEY='test-secret'; globalThis.fetch=async()=>new Response('{}',{status:500});
  try {const res:any=response(); await handler({method:'POST',body:{question:'Tell me about reports'}},res); assert.equal(res.statusCode,502); assert.match(res.body.error,/temporarily unavailable/);} finally {globalThis.fetch=oldFetch;if(previous===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=previous;}
});

test('FAQ assistant rate limits repeated requests by forwarded client IP', async () => {
  resetFaqRateLimitForTests();
  const previous=process.env.GEMINI_API_KEY; const oldFetch=globalThis.fetch; delete process.env.GEMINI_API_KEY; globalThis.fetch=async()=>{throw new Error('unexpected');};
  try {
    for (let index=0; index<12; index+=1) {const allowed:any=response(); await handler({method:'POST',headers:{'x-forwarded-for':'203.0.113.9, 10.0.0.1'},body:{question:'What does QPOS cost?'}},allowed); assert.equal(allowed.statusCode,503);}
    const blocked:any=response(); await handler({method:'POST',headers:{'x-forwarded-for':'203.0.113.9'},body:{question:'What does QPOS cost?'}},blocked);
    assert.equal(blocked.statusCode,429); assert.match(blocked.body.error,/Too many questions/); assert.ok(Number(blocked.headers['Retry-After'])>=1);
    const other:any=response(); await handler({method:'POST',headers:{'x-forwarded-for':'203.0.113.10'},body:{question:'What does QPOS cost?'}},other); assert.equal(other.statusCode,503);
  } finally {globalThis.fetch=oldFetch;if(previous===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=previous;resetFaqRateLimitForTests();}
});
