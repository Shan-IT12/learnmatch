export default function AssessmentSaveStatus({ progress }) {
  if (progress?.status !== 'error') return null
  return <div className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-center text-xs text-gray-600 sm:px-8">
    <span role="alert" className="text-red-700">
      Unable to save. Please retry.
    </span>
    <button type="button" onClick={() => progress.retry()?.catch(() => {})} className="ml-3 rounded px-2 py-1 font-semibold text-orange-700 underline focus-visible:outline-2 focus-visible:outline-orange-500">Retry saving</button>
  </div>
}
