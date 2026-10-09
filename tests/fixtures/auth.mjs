// Realistic synthetic Auth records shared by isolated PGlite and PostgreSQL fixtures.
// These helpers never replace production authorization functions or create real accounts.
import { createHash } from 'node:crypto';

const uuid = (kind, user) => {
  const hex = createHash('sha256').update(`${kind}:${user}`).digest('hex').slice(0,32);
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
};
const exec = (db, sql) => db.exec ? db.exec(sql) : db.query(sql);

export async function prepareAuthSchema(db) {
  await exec(db, `alter table auth.users add column if not exists deleted_at timestamptz;
    alter table auth.users add column if not exists banned_until timestamptz;
    alter table auth.users add column if not exists is_anonymous boolean not null default false;
    create table if not exists auth.mfa_factors (
      id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
      factor_type text not null, status text not null, created_at timestamptz not null default now(),
      updated_at timestamptz not null default now());
    create table if not exists auth.sessions (
      id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
      factor_id uuid references auth.mfa_factors(id) on delete set null, aal text not null default 'aal1',
      not_after timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());`);
}

/** Account creation and authentication are separate; revoked sessions are never resurrected. */
export async function seedAuthFixture(db,user) {
  await db.query("insert into auth.sessions(id,user_id,aal,not_after) values($1,$2,'aal1',now()+interval '24 hours') on conflict(id) do nothing",[uuid('session',user),user]);
}

export async function authenticateFixture(db, user, {local = false, scopes = true} = {}) {
  const sessionId=uuid('session',user), factorId=uuid('totp',user);
  const current=(await db.query("select current_setting('request.jwt.claims',true) claims")).rows[0]?.claims;
  let overrides={};try{const parsed=JSON.parse(current||'{}');if(parsed.is_anonymous===true)overrides=parsed;}catch{}
  const exists=(await db.query('select id from auth.users where id=$1',[user])).rows.length>0;
  let privileged={admin:false,business:false};
  let session;
  if(exists){
    session=(await db.query('select aal,updated_at from auth.sessions where id=$1',[sessionId])).rows[0];
    privileged=(await db.query(`select exists(select 1 from public.staff where user_id=$1) admin,
      exists(select 1 from public.partner_members m where m.user_id=$1 and m.active) business`,[user])).rows[0];
    if(session&&session.aal==='aal1'&&scopes&&(privileged.admin||privileged.business)){
      await db.query("insert into auth.mfa_factors(id,user_id,factor_type,status) values($1,$2,'totp','verified') on conflict(id) do nothing",[factorId,user]);
      await db.query("update auth.sessions set factor_id=$2,aal='aal2',updated_at=now() where id=$1 and aal<>'aal2'",[sessionId,factorId]);
    }
    session=(await db.query('select aal,updated_at from auth.sessions where id=$1',[sessionId])).rows[0];
  }
  const aal=session?.aal??'aal1';
  const claims={sub:user,session_id:sessionId,role:'authenticated',is_anonymous:false,aal,
    amr:aal==='aal2'?[{method:'totp',timestamp:Math.floor(new Date(session.updated_at).getTime()/1000)}]:[{method:'otp',timestamp:Math.floor(Date.now()/1000)}],...overrides};
  await db.query("select set_config('request.jwt.claim.sub',$1,$3),set_config('request.jwt.claims',$2,$3)",[user,JSON.stringify(claims),local]);
  if(scopes&&!claims.is_anonymous){
    for(const scope of ['admin','business'])if(privileged[scope]){
      const available=(await db.query("select to_regprocedure('public.secure_session_open(text)') present")).rows[0]?.present;
      if(!available)continue;
      // Only initial access is opened. Closed/expired scopes stay closed for security tests.
      await exec(db,local?'set local role authenticated':'set role authenticated');
      try {
        const status=(await db.query('select public.secure_session_status($1) state',[scope])).rows[0].state;
        if(status.reason==='not_open')await db.query('select public.secure_session_open($1)',[scope]);
      } finally {await exec(db,'reset role');}
    }
  }
  return claims;
}
