import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
import bcrypt from 'bcrypt'
import { Webhook } from 'svix'
import { deleteStudentAccount, STUDENT_TABLES } from '../services/accountDeletionService.js'
import { runInactivityDeletions, studentDeletionScope } from '../services/inactivityDeletionService.js'
import { recordSuccessfulLogin } from '../services/accountInactivityService.js'
import { recordInactivityDelivery, verifyInactivityDelivery } from '../services/inactivityDeliveryService.js'
import { buildInactivityEmail } from '../services/inactivityEmailService.js'

const schema=process.env.INACTIVITY_TEST_SCHEMA
test('isolated real-MySQL system deletion, integrity, delivery, concurrency and recovery',{skip:!schema},async t=>{
  const local=dotenv.parse(await readFile(new URL('../.env',import.meta.url)))
  assert.match(schema,/^learnmatch_inactivity_qa_\d+$/)
  assert.ok(['localhost','127.0.0.1','::1'].includes(local.DB_HOST))
  assert.notEqual(schema,local.DB_NAME)
  const pool=mysql.createPool({host:local.DB_HOST,port:Number(local.DB_PORT)||3306,user:local.DB_USER,
    password:local.DB_PASSWORD,database:schema,connectionLimit:8,timezone:'Z'})
  const secret=`whsec_${randomBytes(32).toString('base64')}`
  const env={INACTIVITY_DELETION_MODE:'enabled',INACTIVITY_EMAIL_MODE:'live',INACTIVITY_DELETION_APPROVAL:'approval-qa',
    INACTIVITY_AUDIT_KEY:randomBytes(32).toString('hex'),INACTIVITY_DELIVERY_EVIDENCE_READY:'true',
    LEARNMATCH_PUBLIC_URL:'https://www.learnmatch.online',RESEND_FROM_EMAIL:'noreply@learnmatch.online',
    INACTIVITY_NOTICE_POLICY_VERSION:'policy-qa',INACTIVITY_NOTICE_SCOPE_VERSION:'scope-qa'}
  const password='Controlled-QA-password'
  const hash=await bcrypt.hash(password,4)
  let seq=0
  const columns=new Map(),edges=new Map()
  async function metadata(table) {
    assert.match(table,/^[A-Z_]+$/)
    if(!columns.has(table)) {
      const [cols]=await pool.query(`SHOW COLUMNS FROM ${table}`)
      columns.set(table,cols)
      const [fks]=await pool.execute(`SELECT COLUMN_NAME AS col,REFERENCED_TABLE_NAME AS parent,REFERENCED_COLUMN_NAME AS pk
        FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND REFERENCED_TABLE_NAME IS NOT NULL`,[table])
      edges.set(table,fks.map(f=>({...f,parent:f.parent.toUpperCase()})))
    }
    return columns.get(table)
  }
  function sample(col) {
    if(col.Type.startsWith('enum(')) return col.Type.match(/'([^']*)'/)[1]
    if(/json/.test(col.Type)) return '{}'
    if(/date|timestamp/.test(col.Type)) return col.Type==='date' ? '2024-01-01' : '2024-01-01 00:00:00'
    if(/int|decimal|float|double/.test(col.Type)) return 1
    if(col.Field==='academic_year') return '2025-2026'
    if(col.Field==='mbti_type') return 'INTJ'
    return `qa-${seq}-${col.Field}`.slice(0,Number(col.Type.match(/\((\d+)\)/)?.[1]||100))
  }
  async function populate(table,ctx) {
    if(ctx.rows.has(table)) return ctx.rows.get(table)
    if(ctx.visiting.has(table)) return null
    ctx.visiting.add(table)
    const cols=await metadata(table), values={}
    for(const fk of edges.get(table)) {
      const parent=await populate(fk.parent,ctx)
      if(parent!=null) values[fk.col]=parent
    }
    for(const col of cols) if(values[col.Field]===undefined && col.Null==='NO' && col.Default===null && !/auto_increment|GENERATED/.test(col.Extra)) values[col.Field]=sample(col)
    const fields=Object.keys(values)
    const [result]=await pool.execute(`INSERT INTO ${table} (${fields.map(f=>`\`${f}\``).join(',')}) VALUES (${fields.map(()=>'?').join(',')})`,fields.map(f=>values[f]))
    const pk=cols.find(c=>c.Key==='PRI')?.Field
    const id=Number(result.insertId)||values[pk]
    ctx.rows.set(table,id);ctx.visiting.delete(table)
    return id
  }
  async function fixture({children=false}={}) {
    seq++
    const name=`inactivity-qa-${seq}-${randomUUID().slice(0,8)}`
    const [result]=await pool.execute(`INSERT INTO USER_ACCOUNT (username,email,password,is_active,inactivity_tracking_started_at,
      inactivity_warning_sent_at,inactivity_final_sent_at,inactivity_delete_after,inactivity_eligible_at)
      VALUES (?,?,?,1,UTC_TIMESTAMP(3)-INTERVAL 400 DAY,UTC_TIMESTAMP(3)-INTERVAL 35 DAY,
      UTC_TIMESTAMP(3)-INTERVAL 8 DAY,UTC_TIMESTAMP(3)-INTERVAL 1 DAY,UTC_TIMESTAMP(3)-INTERVAL 1 DAY)`,
    [name,`delivered+${name}@resend.dev`,hash])
    const userId=Number(result.insertId)
    const ctx={rows:new Map([['USER_ACCOUNT',userId]]),visiting:new Set()}
    if(children) for(const table of scope.tables) {
      if(!['USER_ACCOUNT','ACCOUNT_INACTIVITY_EMAIL','ACCOUNT_INACTIVITY_CLEARANCE','ACCOUNT_INACTIVITY_DELIVERY'].includes(table)) await populate(table,ctx)
    }
    await pool.execute(`INSERT INTO ACCOUNT_INACTIVITY_CLEARANCE
      (user_id,generation,student_confirmed,excluded,legal_hold,retention_hold,policy_version,scope_version,review_reference,approved_until)
      VALUES (?,0,1,0,0,0,'policy-qa','scope-qa','review-qa',UTC_TIMESTAMP(3)+INTERVAL 1 DAY)`,[userId])
    const emailIds=[]
    for(const [stage,days] of [['warning',35],['final',8]]) {
      const [[account]]=await pool.execute('SELECT email FROM USER_ACCOUNT WHERE user_id=?',[userId])
      const payload=buildInactivityEmail(account,stage,env)
      const providerId=randomUUID()
      const [email]=await pool.execute(`INSERT INTO ACCOUNT_INACTIVITY_EMAIL
        (user_id,generation,stage,email_status,attempts,first_attempt_at,last_attempt_at,provider_id,payload)
        VALUES (?,0,?,'sent',1,UTC_TIMESTAMP(3)-INTERVAL ${days} DAY-INTERVAL 1 SECOND,
        UTC_TIMESTAMP(3)-INTERVAL ${days} DAY-INTERVAL 1 SECOND,?,?)`,[userId,stage,providerId,JSON.stringify(payload)])
      const [[clock]]=await pool.query({sql:`SELECT UTC_TIMESTAMP(3)-INTERVAL ${days} DAY+INTERVAL 1 SECOND AS occurred`,dateStrings:true})
      const event={type:'email.delivered',created_at:clock.occurred.replace(' ','T')+'Z',data:{email_id:providerId,to:[account.email]}}
      const raw=Buffer.from(JSON.stringify(event)),id=`msg_${randomUUID()}`,date=new Date()
      const verified=verifyInactivityDelivery(raw,{'svix-id':id,'svix-timestamp':String(Math.floor(date.getTime()/1000)),
        'svix-signature':new Webhook(secret).sign(id,date,raw)},secret)
      await recordInactivityDelivery(pool,verified)
      await recordInactivityDelivery(pool,verified)
      emailIds.push(Number(email.insertId))
    }
    return {userId,name,ctx,emailIds}
  }
  const run=overrides=>runInactivityDeletions(pool,{env:{...env,...overrides}})
  const exists=async id=>Number((await pool.execute('SELECT COUNT(*) AS n FROM USER_ACCOUNT WHERE user_id=?',[id]))[0][0].n)
  let scope
  try {
    // This schema was created empty for controlled tests, never from user data.
    // Reset only that guarded local fixture database so reruns are independent.
    const reset=await pool.getConnection()
    try {
      const [tables]=await reset.query('SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()')
      await reset.query('SET FOREIGN_KEY_CHECKS=0')
      for(const {name} of tables) {
        assert.match(name,/^[A-Za-z_]+$/)
        await reset.query(`TRUNCATE TABLE \`${name}\``)
      }
    } finally {await reset.query('SET FOREIGN_KEY_CHECKS=1');reset.release()}
    await pool.query('INSERT INTO ACCOUNT_INACTIVITY_CONTROL(control_id) VALUES(1)')
    scope=await studentDeletionScope(pool)
    await pool.execute(`UPDATE ACCOUNT_INACTIVITY_CONTROL SET deletion_enabled=1,policy_version='policy-qa',scope_version='scope-qa',
      approval_reference='approval-qa',backup_review_reference='backup-qa',schema_digest=?,approved_until=UTC_TIMESTAMP(3)+INTERVAL 1 DAY WHERE control_id=1`,[scope.digest])
    await t.test('complete linked cleanup is atomic, audited, cascaded and idempotent',async()=>{
      const f=await fixture({children:true})
      for(const table of STUDENT_TABLES) assert.ok(f.ctx.rows.has(table),table)
      const result=await run()
      assert.equal(result.deleted,1);assert.equal(result.failed,0);assert.equal(await exists(f.userId),0)
      for(const table of scope.tables) {
        if(table==='ACCOUNT_INACTIVITY_DELIVERY') continue
        const cols=await metadata(table)
        if(cols.some(c=>c.Field==='user_id')) assert.equal(Number((await pool.execute(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id=?`,[f.userId]))[0][0].n),0,table)
      }
      assert.equal((await pool.query('SELECT COUNT(*) AS n FROM ACCOUNT_INACTIVITY_DELIVERY'))[0][0].n,0)
      assert.equal((await pool.query('SELECT COUNT(*) AS n FROM ACCOUNT_INACTIVITY_DELETION_AUDIT'))[0][0].n,1)
      const [[audit]]=await pool.query('SELECT * FROM ACCOUNT_INACTIVITY_DELETION_AUDIT')
      assert.ok(!JSON.stringify(audit).includes(f.name));assert.equal(audit.user_id,undefined)
      assert.equal((await run()).deleted,0)
    })
    await t.test('missing clearance, holds, admin matches, schema drift and failed delivery all deny deletion',async()=>{
      for(const mutation of [
        f=>pool.execute('DELETE FROM ACCOUNT_INACTIVITY_CLEARANCE WHERE user_id=?',[f.userId]),
        f=>pool.execute('UPDATE ACCOUNT_INACTIVITY_CLEARANCE SET legal_hold=1 WHERE user_id=?',[f.userId]),
        f=>pool.execute('UPDATE ACCOUNT_INACTIVITY_CLEARANCE SET retention_hold=1 WHERE user_id=?',[f.userId]),
        f=>pool.execute('UPDATE ACCOUNT_INACTIVITY_CLEARANCE SET excluded=1 WHERE user_id=?',[f.userId]),
        f=>pool.execute('INSERT INTO ADMIN(full_name,username,password_hash) VALUES (?,?,?)',['Controlled QA',f.name,hash]),
        f=>pool.execute("INSERT INTO ACCOUNT_INACTIVITY_DELIVERY(event_id,email_id,event_type,occurred_at) VALUES (?,?,'email.bounced',UTC_TIMESTAMP(3))",[`msg_${randomUUID()}`,f.emailIds[0]]),
        f=>pool.execute("UPDATE ACCOUNT_INACTIVITY_DELIVERY SET event_type='email.failed' WHERE email_id=?",[f.emailIds[1]]),
        f=>pool.execute('DELETE FROM ACCOUNT_INACTIVITY_DELIVERY WHERE email_id=?',[f.emailIds[0]]),
        f=>pool.execute('UPDATE ACCOUNT_INACTIVITY_EMAIL SET provider_id=NULL WHERE email_id=?',[f.emailIds[0]]),
      ]) {
        const f=await fixture();await mutation(f)
        assert.equal((await run()).deleted,0);assert.equal(await exists(f.userId),1)
        await pool.execute('UPDATE ACCOUNT_INACTIVITY_CLEARANCE SET excluded=1 WHERE user_id=?',[f.userId])
      }
      const f=await fixture()
      await pool.execute("UPDATE ACCOUNT_INACTIVITY_CONTROL SET schema_digest=REPEAT('0',64) WHERE control_id=1")
      assert.equal((await run()).deleted,0)
      await pool.execute('UPDATE ACCOUNT_INACTIVITY_CONTROL SET schema_digest=? WHERE control_id=1',[scope.digest])
      await pool.execute('UPDATE ACCOUNT_INACTIVITY_CLEARANCE SET excluded=1 WHERE user_id=?',[f.userId])
    })
    await t.test('kill switches and batch bounds operate against real MySQL',async()=>{
      await fixture();await fixture()
      assert.equal((await run({INACTIVITY_DELETION_MODE:'disabled'})).deleted,0)
      await pool.execute('UPDATE ACCOUNT_INACTIVITY_CONTROL SET deletion_enabled=0 WHERE control_id=1')
      assert.equal((await run()).policyBlocked,true)
      await pool.execute('UPDATE ACCOUNT_INACTIVITY_CONTROL SET deletion_enabled=1 WHERE control_id=1')
      assert.equal((await run({INACTIVITY_DELETION_BATCH_SIZE:'1'})).deleted,1)
      assert.equal((await run({INACTIVITY_DELETION_BATCH_SIZE:'1'})).deleted,1)
    })
    await t.test('delivery evidence is replay-safe, recipient-bound, and recoverable before receipt persistence',async()=>{
      const f=await fixture()
      const [[notice]]=await pool.execute('SELECT * FROM ACCOUNT_INACTIVITY_EMAIL WHERE email_id=?',[f.emailIds[0]])
      const [[stored]]=await pool.query({sql:'SELECT * FROM ACCOUNT_INACTIVITY_DELIVERY WHERE email_id=?',dateStrings:true},[notice.email_id])
      const recipient=(typeof notice.payload==='string' ? JSON.parse(notice.payload) : notice.payload).to[0]
      const event={id:stored.event_id,providerId:notice.provider_id,type:'email.delivered',recipient,
        occurredAt:new Date(stored.occurred_at.replace(' ','T')+'Z')}
      await assert.rejects(recordInactivityDelivery(pool,{...event,recipient:'bounced+different@resend.dev'}),/Recipient mismatch/)
      await assert.rejects(recordInactivityDelivery(pool,{...event,type:'email.bounced'}),/Conflicting event/)
      assert.equal((await pool.execute('SELECT event_type FROM ACCOUNT_INACTIVITY_DELIVERY WHERE event_id=?',[event.id]))[0][0].event_type,'email.delivered')
      await pool.execute("UPDATE ACCOUNT_INACTIVITY_EMAIL SET provider_id=NULL,email_status='sending' WHERE email_id=?",[notice.email_id])
      assert.equal((await recordInactivityDelivery(pool,event)).retry,true)
      await pool.execute("UPDATE ACCOUNT_INACTIVITY_EMAIL SET provider_id=?,email_status='sent' WHERE email_id=?",[notice.provider_id,notice.email_id])
      assert.equal((await recordInactivityDelivery(pool,event)).recorded,true)
      assert.equal((await recordInactivityDelivery(pool,{...event,providerId:'unrelated-message',recipient:'delivered+other@resend.dev'})).ignored,true)
      await pool.execute('UPDATE ACCOUNT_INACTIVITY_CLEARANCE SET excluded=1 WHERE user_id=?',[f.userId])
    })
    await t.test('holds and the database kill switch are rechecked after candidate selection',async()=>{
      for(const stop of ['hold','kill']) {
        const f=await fixture()
        let selected,release
        const observed=new Promise(resolve=>{selected=resolve}),gate=new Promise(resolve=>{release=resolve})
        const instrumented={getConnection:async()=>{
          const db=await pool.getConnection(),original=db.query.bind(db),originalRelease=db.release.bind(db)
          db.query=async(input,...args)=>{
            const result=await original(input,...args)
            if(typeof input==='string' && input.startsWith('SELECT u.user_id FROM USER_ACCOUNT')) {selected();await gate}
            return result
          }
          db.release=()=>{db.query=original;db.release=originalRelease;originalRelease()}
          return db
        }}
        const deleting=runInactivityDeletions(instrumented,{env})
        await observed
        if(stop==='hold') await pool.execute('UPDATE ACCOUNT_INACTIVITY_CLEARANCE SET legal_hold=1 WHERE user_id=?',[f.userId])
        else await pool.execute('UPDATE ACCOUNT_INACTIVITY_CONTROL SET deletion_enabled=0 WHERE control_id=1')
        release()
        assert.equal((await deleting).deleted,0);assert.equal(await exists(f.userId),1)
        await pool.execute('UPDATE ACCOUNT_INACTIVITY_CLEARANCE SET excluded=1 WHERE user_id=?',[f.userId])
        await pool.execute('UPDATE ACCOUNT_INACTIVITY_CONTROL SET deletion_enabled=1 WHERE control_id=1')
      }
    })
    await t.test('successful login winning the account lock cancels a selected deletion',async()=>{
      const f=await fixture(),login=await pool.getConnection()
      await login.beginTransaction()
      await recordSuccessfulLogin(login,f.userId)
      const deleting=run()
      await new Promise(resolve=>setTimeout(resolve,50))
      await login.commit();login.release()
      assert.equal((await deleting).deleted,0);assert.equal(await exists(f.userId),1)
    })
    await t.test('deletion winning the account lock makes the waiting login fail safely',async()=>{
      const f=await fixture()
      let releaseDelete, locked
      const gate=new Promise(resolve=>{releaseDelete=resolve})
      const observed=new Promise(resolve=>{locked=resolve})
      const instrumented={...pool,getConnection:async()=>{
        const db=await pool.getConnection(),original=db.query.bind(db)
        db.query=async(input,...args)=>{
          const result=await original(input,...args)
          if(typeof input==='object' && input.sql==='SELECT * FROM USER_ACCOUNT WHERE user_id=? FOR UPDATE') {locked();await gate}
          return result
        }
        const release=db.release.bind(db)
        db.release=()=>{db.query=original;db.release=release;release()}
        return db
      }}
      const deleting=runInactivityDeletions(instrumented,{env})
      await observed
      const loggingIn=recordSuccessfulLogin(pool,f.userId)
      const rejected=assert.rejects(loggingIn,/Account unavailable/)
      releaseDelete()
      assert.equal((await deleting).deleted,1);await rejected;assert.equal(await exists(f.userId),0)
    })
    await t.test('cleanup failure rolls back records and audit; later recovery succeeds',async()=>{
      const f=await fixture(),before=(await pool.query('SELECT COUNT(*) AS n FROM ACCOUNT_INACTIVITY_DELETION_AUDIT'))[0][0].n
      const failing={getConnection:async()=>{
        const db=await pool.getConnection(),original=db.execute.bind(db)
        db.execute=async(sql,...args)=>{if(sql==='DELETE FROM USER_ACCOUNT WHERE user_id = ?') throw new Error('Controlled failure');return original(sql,...args)}
        const release=db.release.bind(db)
        db.release=()=>{db.execute=original;db.release=release;release()}
        return db
      }}
      const result=await runInactivityDeletions(failing,{env})
      assert.equal(result.failed,1);assert.equal(await exists(f.userId),1)
      assert.equal((await pool.query('SELECT COUNT(*) AS n FROM ACCOUNT_INACTIVITY_DELETION_AUDIT'))[0][0].n,before)
      assert.equal((await run()).deleted,1)
    })
    await t.test('user-initiated deletion still requires the correct password',async()=>{
      const f=await fixture()
      await assert.rejects(deleteStudentAccount(pool,f.userId,'wrong'),e=>e.code==='INVALID_PASSWORD')
      assert.equal(await exists(f.userId),1)
      assert.equal((await deleteStudentAccount(pool,f.userId,password)).deleted,true)
    })
    await t.test('ambiguous COMMIT preserves its audit receipt and disables further deletion',async()=>{
      const f=await fixture()
      const ambiguous={query:pool.query.bind(pool),getConnection:async()=>{
        const db=await pool.getConnection(),original=db.commit.bind(db)
        db.commit=async()=>{await original();throw new Error('Controlled lost commit acknowledgement')}
        return db
      }}
      await assert.rejects(runInactivityDeletions(ambiguous,{env}),e=>e.code==='DELETION_OUTCOME_UNKNOWN')
      assert.equal(await exists(f.userId),0)
      assert.equal((await run()).policyBlocked,true)
      const [[control]]=await pool.query('SELECT deletion_enabled FROM ACCOUNT_INACTIVITY_CONTROL WHERE control_id=1')
      assert.equal(control.deletion_enabled,0)
    })
  } finally {await pool.end()}
})
