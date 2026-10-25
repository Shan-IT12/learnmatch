import { test, expect } from '@playwright/test'

async function fixture(page, { authenticated = true, status = 200 } = {}) {
  if (authenticated) await page.addInitScript(() => {
    localStorage.setItem('token', 'local-student-fixture')
    localStorage.setItem('username', 'Student')
  })
  const requests = []
  await page.route('**/api/**', route => {
    requests.push({ method: route.request().method(), url: route.request().url() })
    return route.fulfill({ status, json: { hasProfile: true } })
  })
  await page.route('**/api/account', route => {
    requests.push({ method: route.request().method(), url: route.request().url() })
    return route.fulfill({ status, json: { username: 'RegisteredStudent', email: 'student@example.test' } })
  })
  // No test traffic may reach a remote backend or service.
  await page.route(url => !['127.0.0.1', 'localhost'].includes(url.hostname), route => route.abort())
  return requests
}

for (const width of [1280, 375]) {
  test(`settings, privacy, disabled deletion and existing header at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const requests = await fixture(page)
    await page.goto('/dashboard')
    await expect(page.getByRole('button', { name: 'Account menu for Student', exact: true })).toBeVisible()
    await expect(page.locator('nav').getByRole('button', { name: /View Profile|Setup Profile/ })).toHaveCount(0)
    await expect(page.getByText("Let's set up your profile first")).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Feedback', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Logout', exact: true }).click()
    await page.getByRole('button', { name: 'Stay signed in' }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
    await page.getByRole('button', { name: 'Account menu for Student', exact: true }).click()
    await expect(page.getByRole('link', { name: 'Settings', exact: true })).toBeVisible()
    const menuBounds = await page.getByRole('link', { name: 'Settings', exact: true }).boundingBox()
    expect(menuBounds.x).toBeGreaterThanOrEqual(0)
    expect(menuBounds.x + menuBounds.width).toBeLessThanOrEqual(width)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('link', { name: 'Settings', exact: true })).not.toBeVisible()
    await page.getByRole('button', { name: 'Account menu for Student', exact: true }).click()
    await page.getByRole('link', { name: 'Settings', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
    await expect(page.getByText('RegisteredStudent', { exact: true })).toBeVisible()
    await expect(page.getByText('student@example.test', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Account Information', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Change Password', exact: true })).toBeVisible()
    await expect(page.locator('a[href="/forgot-password"]')).toHaveCount(0)
    await expect(page.locator('main input')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByRole('link', { name: 'Privacy Notice', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'LearnMatch Privacy Notice' })).toBeVisible()
    await page.getByRole('button', { name: 'Back to Settings' }).click()
    await expect(page.getByRole('link', { name: 'Privacy Notice', exact: true })).toBeFocused()
    await page.getByRole('link', { name: 'Terms & Conditions', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Terms & Conditions', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Back to Settings' }).click()
    await expect(page.getByRole('link', { name: 'Terms & Conditions', exact: true })).toBeFocused()
    const before = requests.length
    const trigger = page.getByRole('button', { name: 'Delete Account', exact: true })
    await trigger.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('You cannot undo this.')
    await expect(dialog.getByRole('button', { name: 'Delete Account', exact: true })).toBeDisabled()
    await expect(dialog.getByRole('button', { name: 'Keep my account' })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(dialog.getByRole('button', { name: 'Close confirmation' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
    await expect(trigger).toBeFocused()
    await trigger.click()
    await dialog.getByRole('button', { name: 'Keep my account' }).click()
    expect(requests).toHaveLength(before)
    expect(requests.every(request => request.method === 'GET')).toBe(true)
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBe('local-student-fixture')
    await page.getByRole('link', { name: 'Back to Dashboard' }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
    await page.getByRole('button', { name: 'Account menu for Student', exact: true }).click()
    await page.getByRole('button', { name: 'Profile', exact: true }).click()
    await expect(page).toHaveURL(/\/profile/)
  })
}
test('password and confirmation are required; one request redirects only after confirmed success', async ({ page }) => {
  await fixture(page)
  await page.addInitScript(() => {
    localStorage.setItem('adminToken', 'untouched-admin-token')
    localStorage.setItem('learnmatch:assessment:synthetic-draft', 'draft')
    sessionStorage.setItem('learnmatch:assessment:synthetic-draft', 'draft')
  })
  let release
  const ready = new Promise(resolve => { release = resolve })
  let calls = 0
  await page.route('**/api/account', async route => {
    if (route.request().method() !== 'DELETE') return route.fallback()
    calls++
    expect(route.request().method()).toBe('DELETE')
    expect(route.request().headers().authorization).toBe('Bearer local-student-fixture')
    expect(route.request().postDataJSON()).toEqual({ currentPassword: 'SyntheticPassword1!', confirmation: 'DELETE' })
    await ready
    await route.fulfill({ json: { deleted: true } })
  })
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Delete Account', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const confirm = dialog.getByRole('button', { name: 'Delete Account', exact: true })
  await expect(confirm).toBeDisabled()
  await dialog.getByLabel('Current password').fill('SyntheticPassword1!')
  await expect(confirm).toBeDisabled()
  await dialog.getByRole('checkbox').check()
  await confirm.click()
  await expect(dialog.getByRole('button', { name: 'Processing...' })).toBeDisabled()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/settings$/)
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeTruthy()
  await expect.poll(() => calls).toBe(1)
  release()
  await expect(page.getByRole('status')).toContainText('deleted from the active LearnMatch database')
  await expect(page).toHaveURL(/\/login$/)
  expect(await page.evaluate(() => ({ token: localStorage.getItem('token'), draft: localStorage.getItem('learnmatch:assessment:synthetic-draft'), sessionDraft: sessionStorage.getItem('learnmatch:assessment:synthetic-draft'), admin: localStorage.getItem('adminToken') }))).toEqual({ token: null, draft: null, sessionDraft: null, admin: 'untouched-admin-token' })
  expect(calls).toBe(1)
})

for (const outcome of ['wrong-password', 'rollback', 'unknown', 'network', 'unconfirmed-success', 'account-rate-limit', 'service-rate-limit']) {
  test(`deletion ${outcome} never displays success or clears authentication`, async ({ page }) => {
    await fixture(page)
    let calls = 0
    await page.route('**/api/account', route => {
      if (route.request().method() !== 'DELETE') return route.fallback()
      calls++
      if (outcome === 'network') return route.abort()
      if (outcome === 'unconfirmed-success') return route.fulfill({ json: {} })
      const limited = outcome.endsWith('rate-limit')
      return route.fulfill({ status: limited ? 429 : outcome === 'wrong-password' ? 400 : 503, json: {
        code: limited ? 'RATE_LIMITED' : outcome === 'unknown' ? 'DELETION_OUTCOME_UNKNOWN' : 'DELETION_FAILED',
        message: limited ? outcome === 'account-rate-limit' ? 'Too many deletion attempts. Please wait 15 minutes before trying again.' : 'Account deletion is temporarily busy. Please wait one minute before trying again.' : outcome === 'wrong-password' ? 'Your current password is incorrect.' : 'Account deletion was not completed.',
      } })
    })
    await page.goto('/settings')
    await page.getByRole('button', { name: 'Delete Account', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Current password').fill('SyntheticPassword1!')
    await dialog.getByRole('checkbox').check()
    await dialog.getByRole('button', { name: 'Delete Account', exact: true }).click()
    await expect(dialog.getByRole('alert')).toBeVisible()
    await expect(page).toHaveURL(/\/settings$/)
    await expect(dialog.getByLabel('Current password')).toHaveValue('')
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBe('local-student-fixture')
    if (['unknown', 'network', 'unconfirmed-success'].includes(outcome)) {
      await expect(dialog.getByLabel('Current password')).toBeDisabled()
      await expect(dialog.getByRole('alert')).toContainText('could not confirm')
    } else await expect(dialog.getByLabel('Current password')).toBeEnabled()
    if (outcome.endsWith('rate-limit')) {
      await expect(dialog.getByRole('alert')).toContainText(outcome === 'account-rate-limit' ? '15 minutes' : 'one minute')
      await expect(dialog.getByRole('checkbox')).not.toBeChecked()
      await expect(dialog.getByRole('button', { name: 'Delete Account', exact: true })).toBeDisabled()
    }
    expect(calls).toBe(1)
  })
}

test('students without a profile keep the dashboard setup prompt', async ({ page }) => {
  await fixture(page)
  await page.route('**/api/dashboard/status', route => route.fulfill({ json: { hasProfile: false } }))
  await page.goto('/dashboard')
  await expect(page.getByText("Let's set up your profile first")).toBeVisible()
  await expect(page.getByRole('button', { name: 'Set Up Profile', exact: true })).toBeVisible()
  await expect(page.locator('nav').getByRole('button', { name: /View Profile|Setup Profile/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Account menu for Student' }).click()
  await expect(page.getByRole('button', { name: 'Profile', exact: true })).toBeVisible()
})

for (const identity of ['anonymous', 'admin', 'expired']) {
  test(`${identity} cannot access student settings`, async ({ page }) => {
    await fixture(page, { authenticated: identity === 'expired', status: 403 })
    if (identity === 'admin') await page.addInitScript(() => localStorage.setItem('adminToken', 'admin-fixture'))
    await page.goto('/settings')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: 'Danger Zone' })).not.toBeVisible()
  })
}

test('session verification fails closed and can be retried', async ({ page }) => {
  await fixture(page, { status: 500 })
  await page.goto('/settings')
  await expect(page.getByRole('alert')).toContainText("couldn't load your account information")
  await expect(page.getByRole('button', { name: 'Delete Account', exact: true })).not.toBeVisible()
  await page.route('**/api/account', route => route.fulfill({ json: { username: 'RegisteredStudent', email: 'student@example.test' } }))
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
})

for (const [context, path] of [['summary', '/dashboard/summary'], ['college', '/college']]) {
  test(`settings returns to ${context}`, async ({ page }) => {
    await fixture(page)
    await page.goto(`/settings?returnTo=${context}`)
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back to Dashboard' })).toHaveAttribute('href', path)
  })
}

for (const width of [320, 375, 768, 1280]) {
  test(`account details remain readable without editing or overflow at ${width}px`, async ({ page }, testInfo) => {
    await fixture(page)
    await page.setViewportSize({ width, height: 900 })
    const username = 'student'.repeat(12)
    const email = `${'longregisteredaddress'.repeat(3)}@example.test`
    await page.route('**/api/account', route => route.fulfill({ json: { username, email } }))
    await page.goto('/settings')
    await expect(page.getByText(username, { exact: true })).toBeVisible()
    await expect(page.getByText(email, { exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    for (const name of ['Account Information', 'Change Password', 'Privacy & Terms', 'Danger Zone']) await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
    await expect(page.locator('main input, main select, main textarea')).toHaveCount(0)
    await expect(page.getByText(/Appearance|Email Preferences|Download My Data/)).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath(`settings-${width}.png`), fullPage: true, animations: 'disabled' })
  })
}

test('incomplete account responses fail closed without showing cached identity', async ({ page }) => {
  await fixture(page)
  await page.route('**/api/account', route => route.fulfill({ json: { username: 'Partial' } }))
  await page.goto('/settings')
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Account Information' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Delete Account', exact: true })).toHaveCount(0)
})

for (const width of [375, 1280]) {
  test(`Change Password reuses the existing verification and reset flow at ${width}px`, async ({ page }, testInfo) => {
    await fixture(page)
    await page.setViewportSize({ width, height: 900 })
    let resetCalls = 0
    await page.route('**/api/auth/forgot-password', route => {
      expect(route.request().postDataJSON()).toEqual({ email: 'student@example.test' })
      return route.fulfill({ json: { message: 'A verification code has been sent if your account exists.' } })
    })
    await page.route('**/api/auth/forgot-password/verify', route => {
      const { email, otpCode } = route.request().postDataJSON()
      expect(email).toBe('student@example.test')
      return otpCode === '123456' ? route.fulfill({ json: { resetToken: 'synthetic-one-time-reset' } }) : route.fulfill({ status: 400, json: { message: 'Invalid verification code.' } })
    })
    await page.route('**/api/auth/forgot-password/reset', route => {
      resetCalls++
      expect(route.request().postDataJSON()).toEqual({ resetToken: 'synthetic-one-time-reset', password: 'NewPassword1!', confirmPassword: 'NewPassword1!' })
      return route.fulfill({ json: { message: 'Password reset successfully.' } })
    })
    await page.goto('/settings')
    await page.getByRole('button', { name: 'Change Password', exact: true }).click()
    await expect(page).toHaveURL(/\/settings$/)
    await page.getByRole('button', { name: 'Send Verification Code', exact: true }).click()
    await page.getByPlaceholder('000000').fill('000000')
    await page.getByRole('button', { name: 'Verify Code', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Invalid verification code.')
    await page.getByPlaceholder('000000').fill('123456')
    await page.getByRole('button', { name: 'Verify Code', exact: true }).click()
    await expect(page.getByLabel(/^New password/)).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath(`settings-inline-password-${width}.png`), fullPage: true, animations: 'disabled' })
    await page.getByLabel(/^New password/).fill('weak')
    await page.getByLabel(/^Confirm password/).fill('different')
    await page.getByRole('button', { name: 'Update Password', exact: true }).click()
    await expect(page.getByText('Password must be at least 8 characters', { exact: true })).toBeVisible()
    expect(resetCalls).toBe(0)
    await page.getByLabel(/^New password/).fill('NewPassword1!')
    await page.getByLabel(/^Confirm password/).fill('NewPassword1!')
    await page.getByRole('button', { name: 'Update Password', exact: true }).click()
    await expect(page.getByRole('status')).toHaveText('Your password has been changed successfully.')
    await expect(page).toHaveURL(/\/settings$/)
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Change Password', exact: true })).toBeVisible()
    expect(resetCalls).toBe(1)
  })
}

test('inline password change can be cancelled and reopened without retaining code or password', async ({ page }) => {
  await fixture(page)
  await page.route('**/api/auth/forgot-password', route => route.fulfill({ json: { message: 'Check your email.' } }))
  await page.goto('/settings?returnTo=college')
  await page.getByRole('button', { name: 'Change Password', exact: true }).click()
  await page.getByRole('button', { name: 'Send Verification Code', exact: true }).click()
  await page.getByLabel(/^Verification code/).fill('123456')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByRole('button', { name: 'Change Password', exact: true }).click()
  await expect(page.getByLabel(/^Verification code/)).toHaveValue('')
  await expect(page.getByRole('button', { name: /Resend code in/ })).toBeDisabled()
  await expect(page).toHaveURL(/\/settings\?returnTo=college$/)
})

test('Settings uses friendly verification copy and a 60-second resend countdown', async ({ page }, testInfo) => {
  await fixture(page)
  await page.setViewportSize({ width: 375, height: 900 })
  await page.clock.install()
  let requests = 0
  await page.route('**/api/auth/forgot-password', route => {
    requests++
    return route.fulfill({ json: { message: 'If an account exists for that email, a verification code has been sent.' } })
  })
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Change Password', exact: true }).click()
  await page.getByRole('button', { name: 'Send Verification Code', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Check your registered email for the verification code.')
  await expect(page.getByText(/If an account exists/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Resend code in 60s/ })).toBeDisabled()
  await page.clock.fastForward(30000)
  await expect(page.getByRole('button', { name: /Resend code in 30s/ })).toBeDisabled()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByRole('button', { name: 'Change Password', exact: true }).click()
  await expect(page.getByRole('button', { name: /Resend code in/ })).toBeDisabled()
  expect(requests).toBe(1)
  await page.clock.fastForward(30000)
  await page.getByRole('button', { name: 'Resend code', exact: true }).click()
  await expect(page.getByRole('button', { name: /Resend code in 60s/ })).toBeDisabled()
  expect(requests).toBe(2)
  await page.screenshot({ path: testInfo.outputPath('settings-code-countdown-mobile.png'), fullPage: true, animations: 'disabled' })
})

test('public Forgot Password still uses the shared flow and returns to Login', async ({ page }) => {
  await fixture(page, { authenticated: false })
  await page.route('**/api/auth/forgot-password', route => route.fulfill({ json: { message: 'Check your email.' } }))
  await page.route('**/api/auth/forgot-password/verify', route => route.fulfill({ json: { resetToken: 'synthetic-reset' } }))
  await page.route('**/api/auth/forgot-password/reset', route => {
    expect(route.request().postDataJSON()).toEqual({ resetToken: 'synthetic-reset', password: 'NewPassword1!', confirmPassword: 'NewPassword1!' })
    return route.fulfill({ json: { message: 'Password reset successfully.' } })
  })
  await page.goto('/forgot-password')
  await page.locator('input[type="email"]').fill('student@example.test')
  await page.getByRole('button', { name: 'Send Verification Code', exact: true }).click()
  await page.getByPlaceholder('000000').fill('123456')
  await page.getByRole('button', { name: 'Verify Code', exact: true }).click()
  await page.locator('[data-validation-field="forgotPassword"] input').fill('NewPassword1!')
  await page.locator('[data-validation-field="forgotConfirmPassword"] input').fill('NewPassword1!')
  await page.getByRole('button', { name: 'Reset Password', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Password reset!', exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
})
