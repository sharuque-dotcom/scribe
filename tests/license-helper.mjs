// Test helpers: a fake Polar license API, and activating a key through the
// editor's Settings dialog, so tests can check the Free and Pro plans.
export const TEST_KEY = 'STEPCRUMB-TEST-1234-ABCD'
// The real organization ID (the fake server below answers for it).
export const TEST_ORG = '74c0856f-0a68-4222-a3a4-800dffb0afac'

// Answers Polar's customer-portal license key endpoints. `server.revoke()` makes
// the key invalid from then on (a cancelled or lapsed subscription).
export async function fakeLicenseServer(ctx) {
  const calls = []
  let revoked = false
  await ctx.route('https://api.polar.sh/**', async (route) => {
    const req = route.request()
    const body = JSON.parse(req.postData() ?? '{}')
    const path = new URL(req.url()).pathname
    calls.push({ path, body })
    const key = { id: 'lk-1', key: TEST_KEY, display_key: '****-ABCD', status: 'granted', limit_activations: 2, expires_at: null, customer: { email: 'test@example.com' } }
    const good = body.key === TEST_KEY && body.organization_id === TEST_ORG && !revoked
    let status = 404
    let out = { error: 'ResourceNotFound', detail: 'License key not found' }
    if (good && path.endsWith('/activate')) [status, out] = [200, { id: 'act-test', license_key_id: 'lk-1', label: body.label, license_key: key }]
    if (good && path.endsWith('/validate') && body.activation_id === 'act-test') [status, out] = [200, key]
    await route.fulfill({ status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify(out) })
  })
  return { calls, revoke: () => (revoked = true) }
}

// Opens Settings from the plan badge, tries a wrong key, then the right one.
export async function activateInSettings(page, check) {
  await page.getByRole('button', { name: 'Free · Upgrade' }).click()
  check((await page.getByRole('button', { name: 'Upgrade to Pro' }).count()) >= 1, 'license screen offers Upgrade to Pro')
  await page.getByLabel('License key').fill('WRONG-KEY')
  await page.getByRole('button', { name: 'Activate' }).click()
  await page.getByRole('alert').filter({ hasText: 'start with STEPCRUMB' }).waitFor()
  await page.getByLabel('License key').fill('STEPCRUMB-NOPE')
  await page.getByRole('button', { name: 'Activate' }).click()
  await page.getByRole('alert').filter({ hasText: 'wasn’t found' }).waitFor()
  check(true, 'wrong license keys show a clear error')
  await page.getByLabel('License key').fill(TEST_KEY)
  await page.getByRole('button', { name: 'Activate' }).click()
  await page.getByText('StepCrumb Pro · active').waitFor()
  check(true, 'license activates and shows StepCrumb Pro')
  check((await page.getByText('Licensed to test@example.com').count()) === 1, 'shows who the license belongs to')
  check((await page.getByRole('link', { name: /Manage subscription/ }).getAttribute('href')) === 'https://polar.sh/stepcrumb/portal', 'Manage subscription links to the Polar portal')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Pro', exact: true }).first().waitFor()
}
