import { Children, cloneElement, useId } from 'react'
import { IconAlertCircle, IconCircleCheck, IconLoader2 } from '@tabler/icons-react'
import { FieldError, RequiredMark } from './FormValidation'

export const workflowInput = 'mt-1.5 min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-base text-slate-900 outline-none transition hover:border-orange-300 focus:border-orange-500 focus:ring-4 focus:ring-orange-100 read-only:bg-stone-50 disabled:bg-stone-100 sm:text-sm'
export const workflowCard = 'min-w-0 space-y-5 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7'
export const workflowFile = `${workflowInput} px-2 py-1.5 file:mr-3 file:rounded-lg file:border-0 file:bg-orange-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-orange-900`
const checkStyle = 'mt-0.5 size-4 shrink-0 accent-orange-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600'

export function WorkflowFeedback({ loading, busy, error, message }) {
  return <>
    {(loading || busy) && <p role="status" className="flex items-center gap-2 text-sm text-slate-600"><IconLoader2 size={16} className="motion-safe:animate-spin" aria-hidden="true" />{busy ? 'Working…' : 'Loading…'}</p>}
    {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900"><IconAlertCircle size={18} className="shrink-0" aria-hidden="true" />{error.message || error}</p>}
    {message && <p role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950"><IconCircleCheck size={18} className="shrink-0" aria-hidden="true" />{message}</p>}
  </>
}

export function WorkflowField({ label, children, required, className = '' }) {
  const generatedId = useId()
  const [control, ...help] = Children.toArray(children)
  const id = control.props.id || generatedId
  const description = [control.props['aria-describedby'], help.length ? `${id}-help` : null].filter(Boolean).join(' ')
  return <div className={`min-w-0 text-sm text-slate-800 ${className}`}>
    <label htmlFor={id} className="block font-semibold">{label}{(required ?? control.props.required) && <> <RequiredMark /></>}</label>
    {cloneElement(control, { id, 'aria-describedby': description || undefined })}
    {help.length > 0 && <div id={`${id}-help`} className="mt-1.5 text-xs leading-5 text-slate-600">{help}</div>}
  </div>
}

export function WorkflowCheck({ name, children }) {
  return <label className="flex items-start gap-3 rounded-xl border border-stone-200 bg-stone-50 p-3.5 text-sm leading-5 text-slate-700">
    <input type="checkbox" name={name} className={checkStyle} required />
    <span>{children} <RequiredMark /></span>
  </label>
}

export function RequiredFieldsNote() {
  return <p className="text-xs text-slate-600"><span aria-hidden="true"><RequiredMark /></span> Required fields</p>
}

export function WorkflowStatus({ status, children }) {
  const tones = {
    approved: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    validated: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    accepted: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    under_review: 'border-sky-200 bg-sky-50 text-sky-900',
    open: 'border-sky-200 bg-sky-50 text-sky-900',
    correction: 'border-amber-200 bg-amber-50 text-amber-950',
    needs_changes: 'border-amber-200 bg-amber-50 text-amber-950',
    rejected: 'border-rose-200 bg-rose-50 text-rose-900',
    deactivated: 'border-rose-200 bg-rose-50 text-rose-900',
  }
  return <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${tones[status] || 'border-stone-200 bg-stone-100 text-slate-700'}`}>
    <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />{children}
  </span>
}

export function PasswordFields() {
  return <div className="space-y-2">
    <div className="grid gap-4 sm:grid-cols-2">
      <WorkflowField label="Password"><input type="password" name="password" autoComplete="new-password" minLength={8} className={workflowInput} required /></WorkflowField>
      <WorkflowField label="Confirm password"><input type="password" name="confirmPassword" autoComplete="new-password" minLength={8} className={workflowInput} required /></WorkflowField>
    </div>
    <p className="text-xs leading-5 text-slate-600">Use at least eight characters, including an uppercase letter and a number.</p>
  </div>
}

export function ClusterChoices({ clusters, defaults = [], error, onChange }) {
  const helpId = useId()
  const errorId = `${helpId}-error`
  return <fieldset className="min-w-0" aria-describedby={error ? `${helpId} ${errorId}` : helpId} onChange={onChange}>
    <legend className="text-sm font-semibold text-slate-800">Expertise clusters <RequiredMark /></legend>
    <p id={helpId} className="mb-2 mt-1 text-xs text-slate-600">Select at least one cluster.</p>
    <div className="grid gap-2 sm:grid-cols-2">
      {clusters.map(cluster => <label key={cluster} className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-orange-300 has-checked:border-orange-400 has-checked:bg-orange-50">
        <input type="checkbox" name="clusters" className={checkStyle} value={cluster} defaultChecked={defaults.includes(cluster)} />
        <span>{cluster.replace(/ CLUSTER$/, '').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase()).replace(/\bStem\b/, 'STEM')}</span>
      </label>)}
    </div>
    <FieldError id={errorId}>{error}</FieldError>
  </fieldset>
}

export function CredentialInput() {
  return <WorkflowField label="Supporting credential">
    <input type="file" name="credential" accept="image/png,.png" className={workflowFile} required />
    <span>Upload one diploma, license, or employment certificate as a PNG up to 1 MB.</span>
  </WorkflowField>
}
