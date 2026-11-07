import { createHash, createHmac, randomUUID } from 'node:crypto'
import { cleanupLockedStudentAccount, STUDENT_TABLES } from './accountDeletionService.js'

const DAY = 86400000
const utc = value => typeof value === 'string' ? Date.parse(`${value.replace(' ', 'T')}Z`) : NaN
const reference = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$/.test(value)

export function inactivityDeletionConfig(env = process.env) {
  const mode = env.INACTIVITY_DELETION_MODE || 'disabled'
  if (!['disabled', 'enabled'].includes(mode)) throw new Error('Invalid inactivity deletion mode')
  const batchSize = Number(env.INACTIVITY_DELETION_BATCH_SIZE || 10)
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) throw new Error('Invalid deletion batch size')
  if (mode === 'enabled' && (env.INACTIVITY_EMAIL_MODE !== 'live'
    || !reference(env.INACTIVITY_DELETION_APPROVAL)
    || env.INACTIVITY_DELIVERY_EVIDENCE_READY !== 'true'
    || !env.INACTIVITY_AUDIT_KEY || Buffer.byteLength(env.INACTIVITY_AUDIT_KEY) < 32)) {
    throw new Error('Deletion authorization configuration incomplete')
  }
  return { mode, batchSize, approval: env.INACTIVITY_DELETION_APPROVAL, auditKey: env.INACTIVITY_AUDIT_KEY }
}

export function deletionPolicyApproved(control, config, now) {
  return Boolean(control && Number(control.deletion_enabled) === 1
    && reference(control.policy_version) && reference(control.scope_version)
    && reference(control.approval_reference) && control.approval_reference === config.approval
    && reference(control.backup_review_reference) && utc(control.approved_until) > now)
}

// An approved scope is tied to the actual FK graph. Schema drift, unknown
// non-cascading children, and non-transactional tables block system cleanup.
export async function studentDeletionScope(db) {
  const [rawKeys]=await db.query(`SELECT k.TABLE_NAME AS child,k.COLUMN_NAME AS column_name,
    k.REFERENCED_TABLE_NAME AS parent,k.REFERENCED_COLUMN_NAME AS parent_column,
    r.DELETE_RULE AS delete_rule FROM information_schema.KEY_COLUMN_USAGE k
    JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA
      AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME AND r.TABLE_NAME=k.TABLE_NAME
    WHERE k.TABLE_SCHEMA=DATABASE() AND k.REFERENCED_TABLE_SCHEMA=DATABASE()`)
  const keys=rawKeys.map(edge=>({...edge,child:edge.child.toUpperCase(),parent:edge.parent.toUpperCase()}))
  const tables=new Set(['USER_ACCOUNT']),edges=[]
  let changed=true
  while(changed) {
    changed=false
    for(const edge of keys) if(tables.has(edge.parent) && !tables.has(edge.child)) {tables.add(edge.child);changed=true}
  }
  const explicit=new Set([...STUDENT_TABLES,'RECOMMENDATION_ITEM','CHECKIN_ALIGNMENT_RESPONSE','AI_MISMATCH_ANALYSIS'])
  for(const edge of keys) if(tables.has(edge.parent)) {
    if(edge.delete_rule!=='CASCADE' && !explicit.has(edge.child)) throw new Error('Unreviewed cleanup dependency')
    edges.push(edge)
  }
  const [engines]=await db.query('SELECT TABLE_NAME AS name,ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()')
  if([...tables].some(name=>!engines.some(t=>t.name.toUpperCase()===name && t.engine==='InnoDB'))) throw new Error('Transactional cleanup required')
  edges.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))
  return {tables:[...tables].sort(),digest:createHash('sha256').update(JSON.stringify({cleanup:STUDENT_TABLES,edges})).digest('hex')}
}

// Pure eligibility rules, evaluated again using a database UTC clock under all
// relevant locks immediately before cleanup. Missing information always denies.
export function inactivityDeletionEligible(account, clearance, control, notices, now) {
  if (!account || !control || !Number.isFinite(now) || Number(account.is_active) !== 1 || !clearance
    || Number(clearance.student_confirmed) !== 1 || Number(clearance.excluded) !== 0
    || Number(clearance.legal_hold) !== 0 || Number(clearance.retention_hold) !== 0
    || String(clearance.generation) !== String(account.inactivity_generation)
    || clearance.policy_version !== control.policy_version || clearance.scope_version !== control.scope_version
    || !reference(clearance.review_reference) || utc(clearance.approved_until) <= now
    || !Number.isFinite(utc(clearance.approved_until))) return false
  const baseline = utc(account.last_successful_login_at ?? account.inactivity_tracking_started_at)
  const warning = utc(account.inactivity_warning_sent_at)
  const final = utc(account.inactivity_final_sent_at)
  const deadline = utc(account.inactivity_delete_after)
  const eligible = utc(account.inactivity_eligible_at)
  if (![baseline,warning,final,deadline,eligible].every(Number.isFinite)
    || warning - baseline < 365 * DAY || now - baseline < 365 * DAY
    || final < warning || deadline < warning + 30 * DAY || deadline < final + 7 * DAY
    || eligible < deadline || now < eligible || now < deadline || notices.length !== 2) return false
  const evidence = {}
  for (const notice of notices) {
    if (!['warning','final'].includes(notice.stage) || evidence[notice.stage]
      || notice.email_status !== 'sent' || !notice.provider_id
      || String(notice.generation) !== String(account.inactivity_generation)
      || !notice.delivered_at || Number(notice.blocked_events) !== 0) return false
    let payload
    try { payload = typeof notice.payload === 'string' ? JSON.parse(notice.payload) : notice.payload }
    catch { return false }
    if (payload?.to?.length !== 1 || payload.to[0] !== account.email) return false
    const tags=Object.fromEntries((Array.isArray(payload.tags) ? payload.tags : []).map(tag=>[tag.name,tag.value]))
    if (tags.inactivity_policy !== control.policy_version || tags.inactivity_scope !== control.scope_version) return false
    const delivered = utc(notice.delivered_at)
    const attempt = utc(notice.first_attempt_at)
    const accepted = notice.stage === 'warning' ? warning : final
    if (!Number.isFinite(delivered) || !Number.isFinite(attempt) || delivered < attempt
      || attempt > accepted || delivered > now) return false
    evidence[notice.stage] = delivered
  }
  return evidence.final >= evidence.warning && now >= evidence.warning + 30 * DAY && now >= evidence.final + 7 * DAY
}

async function deleteClearedAccount(db, userId, config) {
  let committing = false
  const operationId = randomUUID()
  try {
    await db.beginTransaction()
    // Shared control lock makes a DB kill-switch update take effect before the
    // next account starts; it cannot revoke a transaction already committing.
    const [[control]] = await db.query({sql:'SELECT * FROM ACCOUNT_INACTIVITY_CONTROL WHERE control_id=1 FOR SHARE',dateStrings:true})
    const [[account]] = await db.query({sql:'SELECT * FROM USER_ACCOUNT WHERE user_id=? FOR UPDATE',dateStrings:true},[userId])
    if (!account) { await db.rollback(); return 'blocked' }
    const [[clearance]] = await db.query({sql:'SELECT * FROM ACCOUNT_INACTIVITY_CLEARANCE WHERE user_id=? FOR UPDATE',dateStrings:true},[userId])
    const [admins] = await db.execute('SELECT admin_id FROM ADMIN WHERE username=? FOR SHARE',[account.username])
    if (admins.length || !clearance) { await db.rollback(); return 'blocked' }
    const [emails] = await db.query({sql:`SELECT * FROM ACCOUNT_INACTIVITY_EMAIL
      WHERE user_id=? AND generation=? ORDER BY stage FOR UPDATE`,dateStrings:true},[userId,account.inactivity_generation])
    const notices=[]
    for (const email of emails) {
      const [events] = await db.query({sql:`SELECT event_id,event_type,occurred_at FROM ACCOUNT_INACTIVITY_DELIVERY
        WHERE email_id=? FOR UPDATE`,dateStrings:true},[email.email_id])
      const delivered=events.filter(e=>e.event_type==='email.delivered').map(e=>e.occurred_at).sort()[0]
      notices.push({...email,delivered_at:delivered,
        blocked_events:events.filter(e=>e.event_type!=='email.delivered').length,
        events:events.map(e=>({id:e.event_id,type:e.event_type,at:e.occurred_at})).sort((a,b)=>a.id.localeCompare(b.id))})
    }
    const [[clock]] = await db.query({sql:'SELECT UTC_TIMESTAMP(3) AS now',dateStrings:true})
    const now=utc(clock.now)
    if (!deletionPolicyApproved(control,config,now)
      || !inactivityDeletionEligible(account,clearance,control,notices,now)) { await db.rollback(); return 'blocked' }
    if ((await studentDeletionScope(db)).digest!==control.schema_digest) {await db.rollback();return 'blocked'}
    const token=createHmac('sha256',config.auditKey).update(`${userId}:${account.inactivity_generation}`).digest('hex')
    const digest=createHash('sha256').update(JSON.stringify(notices.map(n=>({stage:n.stage,provider:n.provider_id,events:n.events})))).digest('hex')
    await db.execute(`INSERT INTO ACCOUNT_INACTIVITY_DELETION_AUDIT
      (operation_id,account_token,policy_version,scope_version,approval_reference,review_reference,backup_review_reference,notice_evidence_digest,deleted_at)
      VALUES (?,?,?,?,?,?,?,?,UTC_TIMESTAMP(3))`,[operationId,token,control.policy_version,control.scope_version,control.approval_reference,
      clearance.review_reference,control.backup_review_reference,digest])
    await cleanupLockedStudentAccount(db,userId)
    committing=true
    await db.commit()
    return 'deleted'
  } catch (error) {
    if (committing) {
      // The transaction and its audit receipt may already be durable. Destroy
      // the connection, stop this run, and disable future runs for review.
      db.destroy()
      const unknown=new Error('Inactivity deletion outcome unknown')
      unknown.code='DELETION_OUTCOME_UNKNOWN'; unknown.operationId=operationId
      throw unknown
    }
    await db.rollback()
    throw error
  }
}

export async function runInactivityDeletions(pool, {env=process.env} = {}) {
  const config=inactivityDeletionConfig(env)
  const counts={considered:0,deleted:0,blocked:0,failed:0,disabled:config.mode==='disabled'}
  if (counts.disabled) return counts // No schema access or writes while disabled.
  const db=await pool.getConnection()
  let locked=false, destroyed=false
  try {
    const [[lock]]=await db.query("SELECT GET_LOCK('learnmatch-inactivity-deletion',0) AS acquired")
    locked=Number(lock.acquired)===1
    if (!locked) return {...counts,busy:true}
    const [[clock]]=await db.query({sql:'SELECT *,UTC_TIMESTAMP(3) AS now FROM ACCOUNT_INACTIVITY_CONTROL WHERE control_id=1',dateStrings:true})
    if (!deletionPolicyApproved(clock,config,utc(clock?.now))) return {...counts,policyBlocked:true}
    const [users]=await db.query(`SELECT u.user_id FROM USER_ACCOUNT u JOIN ACCOUNT_INACTIVITY_CLEARANCE c ON c.user_id=u.user_id
      WHERE u.inactivity_eligible_at IS NOT NULL AND u.inactivity_delete_after<=UTC_TIMESTAMP(3)
      AND u.is_active=1 AND c.generation=u.inactivity_generation AND c.student_confirmed=1
      AND c.excluded=0 AND c.legal_hold=0 AND c.retention_hold=0 AND c.approved_until>UTC_TIMESTAMP(3)
      ORDER BY u.inactivity_eligible_at,u.user_id LIMIT ${config.batchSize}`)
    for (const {user_id:userId} of users) {
      counts.considered++
      try { counts[await deleteClearedAccount(db,userId,config)]++ }
      catch(error) {
        counts.failed++
        console.error(JSON.stringify({job:'inactivity-deletion',code:error.code==='DELETION_OUTCOME_UNKNOWN' ? error.code : 'DELETION_FAILED',
          ...(error.operationId ? {operationId:error.operationId} : {})}))
        if (error.code==='DELETION_OUTCOME_UNKNOWN') {
          destroyed=true
          // Use an independent connection after destroying the ambiguous one.
          await pool.query('UPDATE ACCOUNT_INACTIVITY_CONTROL SET deletion_enabled=0 WHERE control_id=1')
          throw error
        }
      }
    }
    return counts
  } finally {
    if (!destroyed) {
      try {if(locked) await db.query("SELECT RELEASE_LOCK('learnmatch-inactivity-deletion')")}
      finally {db.release()}
    }
  }
}
