import test from 'node:test'
import assert from 'node:assert/strict'
import { inactivityDeletionConfig, inactivityDeletionEligible, deletionPolicyApproved, runInactivityDeletions } from '../services/inactivityDeletionService.js'

const DAY=86400000, now=Date.UTC(2028,0,1)
const stamp=ms=>new Date(ms).toISOString().slice(0,-1).replace('T',' ')
export function clearedFixture() {
  const control={deletion_enabled:1,policy_version:'policy-qa',scope_version:'scope-qa',approval_reference:'approval-qa',
    backup_review_reference:'backup-qa',approved_until:stamp(now+DAY)}
  const account={is_active:1,email:'delivered+deletion-qa@resend.dev',inactivity_generation:4,
    last_successful_login_at:stamp(now-400*DAY),inactivity_warning_sent_at:stamp(now-35*DAY),
    inactivity_final_sent_at:stamp(now-8*DAY),inactivity_delete_after:stamp(now-DAY),inactivity_eligible_at:stamp(now-DAY)}
  const clearance={generation:4,student_confirmed:1,excluded:0,legal_hold:0,retention_hold:0,
    policy_version:'policy-qa',scope_version:'scope-qa',review_reference:'review-qa',approved_until:stamp(now+DAY)}
  const notices=['warning','final'].map((stage,index)=>({stage,generation:4,email_status:'sent',provider_id:`provider-${stage}`,
    first_attempt_at:stamp(now-(index ? 8 : 35)*DAY-1000),delivered_at:stamp(now-(index ? 8 : 35)*DAY+1000),blocked_events:0,
    payload:{to:[account.email],tags:[{name:'inactivity_policy',value:'policy-qa'},{name:'inactivity_scope',value:'scope-qa'}]}}))
  return {account,clearance,control,notices,now}
}
const eligible=f=>inactivityDeletionEligible(f.account,f.clearance,f.control,f.notices,f.now)

test('system deletion defaults off, rejects incomplete enablement and bounds batches',async()=>{
  assert.equal(inactivityDeletionConfig({}).mode,'disabled')
  assert.equal((await runInactivityDeletions({getConnection(){assert.fail('disabled must not access database')}},{env:{}})).disabled,true)
  for(const batch of ['0','101','1.5','no']) assert.throws(()=>inactivityDeletionConfig({INACTIVITY_DELETION_BATCH_SIZE:batch}))
  assert.throws(()=>inactivityDeletionConfig({INACTIVITY_DELETION_MODE:'enabled'}))
  assert.throws(()=>inactivityDeletionConfig({INACTIVITY_DELETION_MODE:'live'}))
})

test('eligibility requires full inactivity, both notices, delivery and per-generation clearance',()=>{
  assert.equal(eligible(clearedFixture()),true)
  for(const mutate of [
    f=>{f.account.is_active=0}, f=>{f.account.last_successful_login_at=stamp(now)},
    f=>{f.account.inactivity_warning_sent_at=null},f=>{f.account.inactivity_final_sent_at=null},
    f=>{f.account.inactivity_eligible_at=null},f=>{f.account.inactivity_delete_after=stamp(now+1)},
    f=>{f.account.inactivity_warning_sent_at=stamp(now-29*DAY)},
    f=>{f.account.inactivity_final_sent_at=stamp(now-6*DAY)},f=>{f.clearance=null},
    f=>{f.clearance.student_confirmed=0},f=>{f.clearance.excluded=1},f=>{f.clearance.legal_hold=1},
    f=>{f.clearance.retention_hold=1},f=>{f.clearance.generation=3},f=>{f.clearance.policy_version='other'},
    f=>{f.clearance.scope_version='other'},f=>{f.clearance.approved_until=stamp(now)},
    f=>{f.clearance.approved_until='bad'},f=>{f.notices.pop()},
    f=>{f.notices[0].email_status='sending'},f=>{f.notices[0].provider_id=null},
    f=>{f.notices[0].delivered_at=null},f=>{f.notices[0].blocked_events=1},
    f=>{f.notices[0].payload.to=['someone-else@resend.dev']},f=>{f.notices[0].payload.tags=[]},
    f=>{f.notices[0].delivered_at=stamp(now-29*DAY)},f=>{f.notices[1].delivered_at=stamp(now-6*DAY)},
    f=>{f.notices[1].stage='warning'},f=>{f.notices[0].generation=3},
    f=>{f.notices[0].first_attempt_at=stamp(now)},f=>{f.control=null},
  ]) {const f=clearedFixture();mutate(f);assert.equal(eligible(f),false,mutate.toString())}
})

test('global policy and backup approval must be current and match explicit authorization',()=>{
  const f=clearedFixture(),config={approval:'approval-qa'}
  assert.equal(deletionPolicyApproved(f.control,config,now),true)
  for(const property of ['policy_version','scope_version','approval_reference','backup_review_reference','approved_until']) {
    assert.equal(deletionPolicyApproved({...f.control,[property]:null},config,now),false)
  }
  assert.equal(deletionPolicyApproved({...f.control,deletion_enabled:0},config,now),false)
  assert.equal(deletionPolicyApproved(f.control,{approval:'other'},now),false)
})
