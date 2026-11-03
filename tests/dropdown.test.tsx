import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { Dropdown, readOptions } from '../src/dropdown'

describe('dropdown options', () => {
  test('reads value attributes and text fallbacks the way a native select does', () => {
    const options = readOptions([
      <option key="a" value="1">
        Season 1
      </option>,
      <option key="b">Measured defaults</option>,
      <option key="c" value={3}>
        Season 3 (current)
      </option>,
    ])
    expect(options).toEqual([
      { value: '1', label: 'Season 1' },
      { value: 'Measured defaults', label: 'Measured defaults' },
      { value: '3', label: 'Season 3 (current)' },
    ])
  })

  test('keeps rich labels as React nodes', () => {
    const options = readOptions([
      <option key="m" value="m1">
        W2 · {'TEAM'} 1-0 {'OTHER'}
      </option>,
    ])
    expect(options[0].value).toBe('m1')
    expect(options[0].label).not.toBeNull()
  })
})

describe('dropdown markup', () => {
  test('shows the selected label, sizes the trigger to every option, and renders no list while closed', () => {
    const html = renderToStaticMarkup(
      <Dropdown aria-label="Season" value="2" onChange={() => {}} className="series-select">
        <option value="1">Season 1</option>
        <option value="2">Season 2 (current)</option>
      </Dropdown>,
    )
    expect(html).toContain('class="dropdown series-select"')
    expect(html).toContain('aria-label="Season"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('data-option="1"')
    expect(html).toContain('data-option="2"')
    expect(html).toContain('class="dropdown-sizer"')
    expect(html).not.toContain('role="listbox"')
    expect(html).not.toContain('<select')
  })

  test('falls back to the raw value when it matches no option', () => {
    const html = renderToStaticMarkup(
      <Dropdown value="ghost" onChange={() => {}}>
        <option value="a">Alpha</option>
      </Dropdown>,
    )
    expect(html).toContain('ghost')
  })
})
