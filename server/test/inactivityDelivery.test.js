import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import express from 'express'
import { Webhook } from 'svix'
import { verifyInactivityDelivery } from '../services/inactivityDeliveryService.js'
import { createInactivityWebhookRouter } from '../routes/inactivityWebhookRoutes.js'

const secret=`whsec_${randomBytes(32).toString('base64')}`
const id='msg_controlled_qa'
const body=Buffer.from(JSON.stringify({type:'email.delivered',created_at:new Date(Date.now()-1000).toISOString(),
  data:{email_id:'provider-qa',to:['delivered+qa@resend.dev']}}))
const headers=(payload=body,date=new Date())=>({'svix-id':id,'svix-timestamp':String(Math.floor(date.getTime()/1000)),
  'svix-signature':new Webhook(secret).sign(id,date,payload)})

test('delivery evidence verifies raw signatures and rejects tampering, old timestamps and missing secrets',()=>{
  assert.equal(verifyInactivityDelivery(body,headers(),secret).type,'email.delivered')
  assert.throws(()=>verifyInactivityDelivery(Buffer.from(body.toString().replace('delivered','bounced')),headers(),secret))
  assert.throws(()=>verifyInactivityDelivery(body,headers(body,new Date(Date.now()-10*60000)),secret))
  assert.throws(()=>verifyInactivityDelivery(body,headers(),''))
  assert.throws(()=>verifyInactivityDelivery(JSON.parse(body),headers(),secret))
  assert.throws(()=>verifyInactivityDelivery(body,{},secret))
})

test('webhook fails closed before database access for missing configuration or invalid signatures',async()=>{
  for(const [env,status] of [[{},503],[{RESEND_INACTIVITY_WEBHOOK_SECRET:secret},400]]) {
    const app=express()
    app.use('/webhook',createInactivityWebhookRouter({getConnection(){assert.fail('unverified database access')}},env))
    const server=app.listen(0,'127.0.0.1')
    await new Promise(resolve=>server.once('listening',resolve))
    try {
      const response=await fetch(`http://127.0.0.1:${server.address().port}/webhook`,{method:'POST',headers:{'Content-Type':'application/json'},body})
      assert.equal(response.status,status)
    } finally {await new Promise(resolve=>server.close(resolve))}
  }
})
