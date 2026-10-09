import { IconCheck } from '@tabler/icons-react'

function SuccessConfirmation({ message, className = '', compact = false }) {
  return (
    <div role="status" aria-live="polite" className={`success-confirmation motion-enter flex items-center ${compact ? 'gap-2' : 'flex-col gap-3 text-center'} ${className}`}>
      <span className={`success-confirmation-icon flex shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ${compact ? 'h-8 w-8' : 'h-14 w-14'}`}>
        <IconCheck size={compact ? 19 : 30} stroke={2.4} />
      </span>
      <span className={`${compact ? 'text-sm' : 'text-base'} font-semibold text-emerald-700`}>{message}</span>
    </div>
  )
}

export default SuccessConfirmation
