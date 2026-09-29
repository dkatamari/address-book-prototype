const { test, expect } = require('@playwright/test')
async function fillPartyDetails(page) {
  await page
    .getByRole('combobox', { name: 'Relationship', exact: true })
    .click()
  await page.getByRole('option', { name: 'Supplier', exact: true }).click()
  await page.getByLabel('Street', { exact: false }).fill('Example Street')
  await page.getByLabel('Building Number', { exact: false }).fill('12')
  await page.getByLabel('City', { exact: false }).fill('Zug')
  await page.getByRole('combobox', { name: 'Country', exact: true }).click()
  await page.getByRole('option', { name: 'Switzerland', exact: true }).click()
  await page.getByLabel('Email', { exact: false }).fill('account@example.com')
  await page.getByLabel('Phone number', { exact: false }).fill('+65 12345678')
}
test('bank account create, persist, filter, view and delete without an API', async ({
  page,
}) => {
  const externalRequests = []
  page.on('request', (r) => {
    if (!r.url().startsWith('http://localhost:3002'))
      externalRequests.push(r.url())
  })
  await page.goto('/')
  await expect(
    page.getByRole('button', { name: 'Dashboard', exact: true }),
  ).toBeEnabled()
  await expect(
    page.getByRole('button', { name: 'History', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Settings', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Sign Out', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Address book', exact: true }),
  ).toBeEnabled()
  await expect(page.locator('.table-heading')).not.toContainText([
    'Status',
    'Status',
  ])
  const recipient = page.getByRole('button', {
    name: 'View Coastal Trading Ltd',
    exact: true,
  })
  await expect(recipient.locator('.recipient-address')).toHaveText(
    '8 Example Avenue, Accra, Ghana',
  )
  const flag = recipient.locator('.country-mark')
  await expect(flag.locator('img')).toHaveAttribute('src', '/flags/GH.svg')
  await expect(recipient.locator('.recipient-name')).toHaveCSS(
    'font-size',
    '14px',
  )
  await expect(recipient.locator('.recipient-address')).toHaveCSS(
    'font-size',
    '12px',
  )
  const addressBox = await recipient.locator('.recipient-address').boundingBox()
  const holderBox = await recipient.locator('.recipient-name').boundingBox()
  expect(addressBox.y).toBeGreaterThanOrEqual(holderBox.y + holderBox.height)
  expect(addressBox.x).toBe(holderBox.x)
  await expect(
    page.locator('.account-cell small').filter({ hasText: 'GIP code: 130100' }),
  ).toBeVisible()
  await expect(
    page.locator('.account-cell small').filter({ hasText: 'BIC: EXAMCNBJ' }),
  ).toBeVisible()
  const iconBox = await flag.boundingBox()
  const nameBox = await recipient.locator('.recipient-name').boundingBox()
  expect(
    Math.abs(iconBox.y + iconBox.height / 2 - nameBox.y - nameBox.height / 2),
  ).toBeLessThan(1)
  await page.screenshot({
    path: '/private/tmp/address-book-desktop.png',
    fullPage: true,
  })
  await page.getByRole('button', { name: 'Add account', exact: true }).click()
  await page
    .getByRole('button', { name: 'External Account', exact: true })
    .click()
  await page.getByLabel('Withdraw/send funds to', { exact: true }).check()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByLabel('Account Holder Name').fill('Test Harbour Ltd')
  await fillPartyDetails(page)
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('combobox', { name: 'Country', exact: true }).click()
  await page.getByRole('option', { name: 'Hong Kong', exact: true }).click()
  await page
    .getByLabel('Account Number/IBAN', { exact: false })
    .fill('00123456789')
  await page.getByLabel('Clearing code', { exact: false }).fill('4')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('Enter exactly 3 characters.')).toBeVisible()
  await page.getByLabel('Clearing code', { exact: false }).fill('004')
  await page.getByLabel('Bank Name').fill('Test Hong Kong Bank')
  await page.screenshot({
    path: '/private/tmp/address-book-form.png',
    fullPage: true,
  })
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page
    .getByRole('button', { name: 'Submit for review', exact: true })
    .click()
  await expect(
    page.getByRole('heading', {
      name: 'Account submitted for review',
      exact: true,
    }),
  ).toBeVisible()
  await page.reload()
  await page.getByLabel('Search accounts').fill('Test Harbour')
  await expect(
    page.getByRole('button', { name: 'View Test Harbour Ltd', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'View Axiym Hong Kong' }),
  ).toHaveCount(0)
  await page
    .getByRole('button', { name: 'View Test Harbour Ltd', exact: true })
    .click()
  const drawer = page.getByRole('dialog', {
    name: 'Test Harbour Ltd',
    exact: true,
  })
  await expect(drawer).toBeVisible()
  await expect(drawer.getByRole('button', { name: /Edit/ })).toHaveCount(0)
  await expect(drawer.locator('input, select, textarea')).toHaveCount(0)
  await drawer.evaluate(async (element) => {
    await Promise.all(
      element.getAnimations().map((animation) => animation.finished),
    )
  })
  const bounds = await drawer.boundingBox()
  expect(Math.round(bounds.x + bounds.width)).toBe(page.viewportSize().width)
  expect(Math.round(bounds.height)).toBe(page.viewportSize().height)
  await page.keyboard.press('Escape')
  await expect(drawer).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'View Test Harbour Ltd', exact: true }),
  ).toBeFocused()
  await page.getByRole('button', { name: 'Filters', exact: true }).click()
  await page
    .getByRole('combobox', { name: 'Filter ownership', exact: true })
    .click()
  await page
    .getByRole('option', { name: 'External accounts', exact: true })
    .click()
  await page
    .getByRole('combobox', { name: 'Filter country', exact: true })
    .click()
  await page.getByRole('option', { name: 'Hong Kong', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'View Test Harbour Ltd' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'View Axiym Hong Kong' }),
  ).toHaveCount(0)
  await page
    .getByRole('button', { name: 'View Test Harbour Ltd', exact: true })
    .click()
  await drawer
    .getByRole('button', { name: 'Delete account', exact: true })
    .click()
  await expect(drawer).toHaveCount(0)
  await expect(
    page.getByRole('dialog', { name: 'Delete account?', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Keep account' }).click()
  await expect(
    page.getByRole('button', { name: 'View Test Harbour Ltd' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Delete Test Harbour Ltd' }).click()
  await page
    .getByRole('button', { name: 'Delete account', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'View Test Harbour Ltd' }),
  ).toHaveCount(0)
  expect(externalRequests).toEqual([])
})
test('stablecoin creation and responsive navigation', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('tab', { name: /Stablecoin Accounts/ }).click()
  await page.screenshot({
    path: '/private/tmp/address-book-stablecoins.png',
    fullPage: true,
  })
  await page.getByRole('button', { name: 'Add account', exact: true }).click()
  await page
    .getByRole('button', { name: 'External Account', exact: true })
    .click()
  await page.getByLabel('Deposit funds from', { exact: true }).check()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByLabel('Account Holder Name').fill('Test Wallet')
  await fillPartyDetails(page)
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page
    .getByLabel('Wallet address', { exact: false })
    .fill('0x' + 'a'.repeat(40))
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page
    .getByRole('button', { name: 'Submit for review', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Back to address book', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'View Test Wallet' }),
  ).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('.sidebar')).toBeHidden()
  await page.evaluate(async () => {
    await document.fonts.ready
    window.scrollTo({ top: 0, behavior: 'instant' })
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    )
  })
  await page.screenshot({
    path: '/private/tmp/address-book-mobile.png',
    fullPage: true,
  })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await expect(
    page.getByRole('button', { name: 'Address book', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Address book', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Open navigation' }),
  ).toBeVisible()
})
