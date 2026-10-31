// Optional read adapter. No upload endpoint and no browser-visible API key.
import {emptySnapshot,validateSnapshot,MAX_CSV_BYTES,validDate,prepareSnapshot} from '../mystery-core.js';
export default {
  async fetch(request,env) {
    const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=60','X-Content-Type-Options':'nosniff'};
    const origin=request.headers.get('Origin');
    if(origin&&origin===env.PUBLIC_ORIGIN) { headers['Access-Control-Allow-Origin']=origin; headers.Vary='Origin'; }
    const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
    if(new URL(request.url).pathname!=='/v1/mystery/snapshot') return reply({error:'not_found'},404);
    if(request.method!=='GET') { headers.Allow='GET'; return reply({error:'method_not_allowed'},405); }
    const date=new URL(request.url).searchParams.get('date');
    if(date&&!validDate(date)) return reply({error:'invalid_date'},400);
    try {
      const current=date?await env.DB.prepare("SELECT id,metadata FROM mystery_snapshots WHERE json_extract(metadata,'$.coverage.data_date')=? ORDER BY json_extract(metadata,'$.updated_at') DESC LIMIT 1").bind(date).first():await env.DB.prepare('SELECT s.id, s.metadata FROM mystery_snapshots s JOIN mystery_publication p ON p.snapshot_id=s.id WHERE p.id=1').first();
      if(!current) return reply(date?prepareSnapshot([],{date}):emptySnapshot());
      const {results}=await env.DB.prepare('SELECT payload FROM mystery_characters WHERE snapshot_id=? ORDER BY row_no LIMIT 50001').bind(current.id).all();
      const snapshot=validateSnapshot({...JSON.parse(current.metadata),characters:results.map(r=>JSON.parse(r.payload))});
      if(snapshot.characters.some(row=>row.ocid&&!/^mt_[a-f0-9]{64}$/.test(row.ocid))) throw Error('private_identifier');
      if(new TextEncoder().encode(JSON.stringify(snapshot)).length>MAX_CSV_BYTES) throw Error('size');
      return reply(snapshot);
    } catch { headers['Cache-Control']='no-store'; return reply({error:'snapshot_unavailable'},503); }
  },
};
