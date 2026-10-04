import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

test('shared Personal Factors validation retains required and conditional rules', async () => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true } })
  const { validatePersonalFactors } = await vite.ssrLoadModule('/src/components/PersonalFactorsForm.jsx')
  const profile = {
    physical_accessibility_areas: [], physical_accessibility_difficulties: {},
    factor_physical_impact: '', factor_health_impact: 1, factor_financial_impact: 1,
    factor_family_impact: 1, factor_work_impact: 1,
  }
  const applicability = { physical: 'yes', health: 'no', financial: 'no', family: 'no', work: 'no' }
  try {
    assert.deepEqual(validatePersonalFactors(profile, applicability), {
      factor_physical_impact: 'Please select an impact level.',
      physical_accessibility_areas: 'Please select at least one area.',
    })
  } finally { await vite.close() }
})
