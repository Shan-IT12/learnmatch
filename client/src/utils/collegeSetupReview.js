export function shouldReviewCollegeSetup(lifecycleAction) {
  return lifecycleAction === 'setup'
}

export function getCollegeSetupEditNavigation(draft) {
  return { to: '/college/setup', options: { state: { setupDraft: draft } } }
}

export function createCollegePhaseConfirmer({ apiUrl, token, draft, fetchImpl = fetch, onSuccess }) {
  let inFlight = null
  let completed = false

  return function confirm() {
    if (completed) return Promise.resolve()
    if (inFlight) return inFlight

    inFlight = (async () => {
      const response = await fetchImpl(`${apiUrl}/api/college/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(draft.payload),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'College Phase could not be started.')
      completed = true
      await onSuccess?.(data)
      return data
    })().finally(() => {
      inFlight = null
    })

    return inFlight
  }
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function formatApproximateDate(value) {
  const month = MONTHS[Number(value?.month) - 1]
  if (!month || !value?.year || !value?.part) return 'Not provided'
  return `${value.part[0].toUpperCase()}${value.part.slice(1)} ${month} ${value.year}`
}

export function getCollegeSetupScheduleReview(draft) {
  if (draft.timingChoice === 'exact') {
    const formatter = new Intl.DateTimeFormat('en-PH', { dateStyle: 'long', timeZone: 'UTC' })
    return {
      label: 'Term Schedule',
      value: `${formatter.format(new Date(`${draft.semesterStartDate}T00:00:00Z`))} – ${formatter.format(new Date(`${draft.semesterEndDate}T00:00:00Z`))}`,
    }
  }
  if (draft.timingChoice === 'approximate') {
    return {
      label: 'Approximate Schedule',
      value: `${formatApproximateDate(draft.approximateStart)} – ${formatApproximateDate(draft.approximateEnd)} · Current position: ${draft.semesterPosition} phase`,
    }
  }
  return {
    label: 'Schedule Information',
    value: `Exact dates unknown · Current position: ${draft.semesterPosition} phase`,
  }
}
