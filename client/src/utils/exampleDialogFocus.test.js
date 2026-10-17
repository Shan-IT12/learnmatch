import test from 'node:test'
import assert from 'node:assert/strict'
import { setupExampleDialog } from './exampleDialogFocus.js'

test('example modal isolates focus, cycles Tab in both directions and restores original focus/scroll on close',()=>{
  const doc={body:{style:{overflow:'auto'}},activeElement:null}
  const control=()=>({isConnected:true,focus(){doc.activeElement=this}})
  const trigger=control(),close=control(),link=control(),footer=control()
  trigger.focus()
  const listeners=new Map()
  const dialog={ownerDocument:doc,open:false,showModal(){this.open=true},close(){this.open=false},querySelectorAll(){return [close,link,footer]},addEventListener(type,fn){listeners.set(type,fn)},removeEventListener(type,fn){assert.equal(listeners.get(type),fn);listeners.delete(type)}}
  const cleanup=setupExampleDialog(dialog,close,trigger)
  assert.equal(dialog.open,true)
  assert.equal(doc.activeElement,close)
  assert.equal(doc.body.style.overflow,'hidden')
  let prevented=0
  const tab=shiftKey=>listeners.get('keydown')({key:'Tab',shiftKey,preventDefault(){prevented++}})
  tab(true)
  assert.equal(doc.activeElement,footer)
  tab(false)
  assert.equal(doc.activeElement,close)
  link.focus();tab(false)
  assert.equal(prevented,2,'Middle links retain normal keyboard navigation')
  cleanup()
  assert.equal(dialog.open,false)
  assert.equal(doc.body.style.overflow,'auto')
  assert.equal(doc.activeElement,trigger)
  assert.equal(listeners.size,0)
})

test('unmount does not focus a removed form trigger',()=>{
  const trigger={isConnected:false,focus(){throw new Error('Removed trigger must not receive focus')}}
  const doc={body:{style:{overflow:''}},activeElement:null}
  const dialog={ownerDocument:doc,showModal(){},close(){},addEventListener(){},removeEventListener(){}}
  const cleanup=setupExampleDialog(dialog,{focus(){}},trigger)
  cleanup()
  assert.equal(doc.body.style.overflow,'')
})
