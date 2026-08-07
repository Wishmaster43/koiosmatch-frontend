/**
 * Probe: Check for page-level horizontal overflow in map view with drawer open.
 * Tests at 1024px viewport width as described in the finding.
 */
import { boot, go } from './lib.mjs'

async function probe() {
  // Boot with default viewport (1280px), then resize to test at 1024px
  const { page, browser, errors } = await boot()

  // Resize viewport to 1024px to test the critical width mentioned in the finding
  await page.setViewportSize({ width: 1024, height: 768 })

  // Boot already navigates to the home page and logs in
  // Navigate to candidates via the sidebar (the real UX path, per lib.mjs comment)
  const candidatesBtn = page.locator('button', { hasText: /^\s*Kandidaten\s*$/ })
  if (await candidatesBtn.count() > 0) {
    await candidatesBtn.first().click()
    await page.waitForLoadState('networkidle')
    console.log('Navigated to candidates page via sidebar')
  } else {
    // Fallback: direct navigation
    await page.goto('http://localhost:5173/candidates', { waitUntil: 'networkidle' })
    console.log('Navigated to candidates page via URL')
  }

  await page.waitForTimeout(1000)  // Wait for UI to settle

  // Take screenshot after loading candidates page
  await page.screenshot({ path: '/tmp/probe-after-nav.png' })
  console.log('Screenshot saved: /tmp/probe-after-nav.png')

  // Wait for table to be visible first
  await page.waitForSelector('table', { timeout: 5000 }).catch(() => {
    console.log('Table not found, but continuing...')
  })

  // Switch to map view
  // The map toggle is a QuickViewToggle — in Dutch it's "Kaart"
  // Look for the button with the Map icon or text "Kaart"
  const mapToggleByText = page.locator('button:has-text("Kaart")')
  const mapToggleCount = await mapToggleByText.count()

  if (mapToggleCount > 0) {
    console.log('Found map toggle button "Kaart", clicking it...')
    await mapToggleByText.first().click()
    await page.waitForLoadState('networkidle')
    console.log('Map view should be active now')
  } else {
    console.log('Map toggle button "Kaart" not found')
    // Debug: list all visible buttons in toolbar area
    const allButtons = await page.locator('button').allTextContents()
    console.log('All buttons on page:', allButtons.slice(-10))  // Last 10 buttons
  }

  await page.waitForTimeout(800)

  // Open the drawer by clicking a candidate row in the right pane table
  // In map view, there's a table on the right side with candidates
  const firstRow = page.locator('table tbody tr').first()
  const firstRowExists = await firstRow.count()
  if (firstRowExists > 0) {
    console.log('Clicking first candidate row to open drawer...')
    await firstRow.click()
    await page.waitForLoadState('networkidle')
    console.log('Drawer should be open now')
  } else {
    console.log('No table rows found')
  }

  await page.waitForTimeout(800)

  // Take screenshot of map view with drawer open
  await page.screenshot({ path: '/tmp/probe-mapview-drawer-1024px.png' })
  console.log('Screenshot saved: /tmp/probe-mapview-drawer-1024px.png')

  // Check the specific layout at line 164
  const mapPaneInfo = await page.evaluate(() => {
    // Find the left pane div with minWidth: 400
    const divs = Array.from(document.querySelectorAll('div'))
    const mapPane = divs.find(d => {
      const style = window.getComputedStyle(d)
      return style.minWidth === '400px' && style.display === 'flex'
    })

    if (mapPane) {
      const rect = mapPane.getBoundingClientRect()
      const parent = mapPane.parentElement
      const parentRect = parent?.getBoundingClientRect() ?? {}
      const parentStyle = parent ? window.getComputedStyle(parent) : {}

      return {
        mapPaneWidth: rect.width,
        mapPaneMinWidth: window.getComputedStyle(mapPane).minWidth,
        mapPaneFlexBasis: window.getComputedStyle(mapPane).flexBasis,
        mapPaneFlexGrow: window.getComputedStyle(mapPane).flexGrow,
        mapPaneFlexShrink: window.getComputedStyle(mapPane).flexShrink,
        parentWidth: parentRect.width,
        parentPaddingLeft: parentStyle.paddingLeft,
        parentPaddingRight: parentStyle.paddingRight,
        parentGap: parentStyle.gap,
        hasParentHorizontalScroll: parent?.scrollWidth > parent?.clientWidth,
      }
    }
    return null
  })

  if (mapPaneInfo) {
    console.log('Map pane dimensions:')
    console.log(JSON.stringify(mapPaneInfo, null, 2))

    // Check if parent has scrollable overflow
    if (mapPaneInfo.hasParentHorizontalScroll) {
      console.log('\n[ISSUE FOUND] Parent flex container HAS horizontal scroll:')
      console.log(`  Parent width: ${mapPaneInfo.parentWidth}px`)
      console.log(`  Map pane min-width: ${mapPaneInfo.mapPaneMinWidth}`)
      console.log(`  Parent padding-left + padding-right: ${mapPaneInfo.parentPaddingLeft} + ${mapPaneInfo.parentPaddingRight}`)
      console.log(`  Content space available: ${mapPaneInfo.parentWidth - 48}px (after padding)`)
      console.log(`  Space needed by map pane: >= 400px`)
      console.log(`  Result: Overflow within the flex container (but hidden by CandidatesListPanel overflow:hidden)')`)
    }
  } else {
    console.log('Map pane with minWidth: 400 not found via JS query')
  }

  // Check the viewport dimensions
  const viewportSize = page.viewportSize()
  console.log('Viewport width:', viewportSize.width)

  // Check for horizontal overflow on body/html
  const bodyWidth = await page.evaluate(() => {
    const body = document.body
    const html = document.documentElement
    return {
      scrollWidth: body.scrollWidth,
      clientWidth: body.clientWidth,
      htmlScrollWidth: html.scrollWidth,
      htmlClientWidth: html.clientWidth,
      bodyOverflowX: getComputedStyle(body).overflowX,
      htmlOverflowX: getComputedStyle(html).overflowX,
    }
  })

  console.log('Body/HTML dimensions:', bodyWidth)

  const hasHorizontalScroll = bodyWidth.scrollWidth > bodyWidth.clientWidth

  if (hasHorizontalScroll) {
    console.log('FAIL: Page-level horizontal scroll detected')
    console.log(`  scrollWidth (${bodyWidth.scrollWidth}) > clientWidth (${bodyWidth.clientWidth})`)
    console.log(`  Overflow X: ${bodyWidth.bodyOverflowX}`)
  } else {
    console.log('PASS: No page-level horizontal scroll')
  }

  await browser.close()
}

probe().catch(err => {
  console.error('Probe failed:', err)
  process.exit(1)
})
