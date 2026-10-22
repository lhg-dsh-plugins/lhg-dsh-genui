// @vitest-environment jsdom
// Regression (issue #352): the slider readout must be numerically consistent
// with the current range value and the field a sibling submit sends. The old
// readout hard-rounded to two decimals (Math.round(value * 100) / 100), so a
// fine-step slider showed 0 for 0.004 and 0.01 for 0.006 while the submit
// payload carried the true value.
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GenuiActionContext } from '../src/client/action-context.ts'
import { GenuiBlock, GENUI_ACTION_DEBOUNCE_MS } from '../src/client/GenuiBlock.tsx'
import { repairGenuiSpec } from '../src/client/guard.ts'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  localStorage.clear()
})
beforeEach(() => {
  vi.useFakeTimers()
})

function renderBlock(spec: unknown, actions: Array<[string, Record<string, unknown>]> = []) {
  return render(
    <GenuiActionContext.Provider value={(a, p) => actions.push([a, p])}>
      <GenuiBlock spec={repairGenuiSpec(spec)!} />
    </GenuiActionContext.Provider>,
  )
}

const readout = (container: HTMLElement): string =>
  container.querySelector('[class*="sliderValue"]')?.textContent ?? ''

describe('slider readout consistency (issue #352)', () => {
  it('shows the fine-step initial value instead of rounding it to 0', () => {
    const { container } = renderBlock({
      items: [
        { type: 'slider', id: 'learning_rate', label: 'Learning rate', min: 0, max: 0.01, step: 0.001, value: 0.004 },
        { type: 'submit', label: 'Use learning rate', action: 'apply_learning_rate', groups: ['learning_rate'] },
      ],
    })
    expect(readout(container)).toBe('0.004')
  })

  it('readout matches the submitted field after a fine-step change', () => {
    const actions: Array<[string, Record<string, unknown>]> = []
    const { container } = renderBlock({
      items: [
        { type: 'slider', id: 'learning_rate', label: 'Learning rate', min: 0, max: 0.01, step: 0.001, value: 0.004 },
        { type: 'submit', label: 'Use learning rate', action: 'apply_learning_rate', groups: ['learning_rate'] },
      ],
    }, actions)
    fireEvent.change(container.querySelector('input[type="range"]')!, { target: { value: '0.006' } })
    expect(readout(container)).toBe('0.006')
    fireEvent.click(container.querySelector('[class*="submitRow"] button')!)
    act(() => { vi.advanceTimersByTime(GENUI_ACTION_DEBOUNCE_MS) })
    const send = actions.find(([name]) => name === 'apply_learning_rate')!
    expect(send[1]).toMatchObject({ type: 'submit', fields: { learning_rate: '0.006' } })
    expect(Number(readout(container))).toBe(0.006)
  })

  it('shows negative fine-step values', () => {
    const { container } = renderBlock({
      items: [
        { type: 'slider', id: 'bias', label: 'Bias', min: -0.01, max: 0.01, step: 0.001, value: -0.004 },
      ],
    })
    expect(readout(container)).toBe('-0.004')
  })

  it('keeps a 1e-9 step readout numerically equal to the value', () => {
    const { container } = renderBlock({
      items: [
        { type: 'slider', id: 'eps', label: 'Epsilon', min: 0, max: 0.000001, step: 1e-9, value: 3e-9 },
      ],
    })
    expect(Number(readout(container))).toBe(3e-9)
    expect(readout(container)).not.toBe('0')
  })

  it('keeps integer and two-decimal readouts unchanged', () => {
    const intBlock = renderBlock({
      items: [{ type: 'slider', id: 'vol', label: 'Volume', min: 0, max: 10, value: 4 }],
    })
    expect(readout(intBlock.container)).toBe('4')
    const decBlock = renderBlock({
      items: [{ type: 'slider', id: 'ratio', label: 'Ratio', min: 0, max: 1, step: 0.01, value: 0.25 }],
    })
    expect(readout(decBlock.container)).toBe('0.25')
  })
})
