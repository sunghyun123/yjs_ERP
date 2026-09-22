import { describe, expect, it, vi } from 'vitest'
import { installTraversalGuard } from './navigation-guard'

function traverse(cancelable = true, hashChange = false) {
  return Object.assign(new Event('navigate', { cancelable }), { navigationType: 'traverse', hashChange })
}
describe('equipment navigation guard', () => {
  it('retains edits when a user cancels a back or forward traversal', () => {
    const navigation = new EventTarget()
    const confirmLeave = vi.fn(() => false)
    const remove = installTraversalGuard(navigation, confirmLeave)
    expect(navigation.dispatchEvent(traverse())).toBe(false)
    expect(confirmLeave).toHaveBeenCalledOnce()
    remove()
    expect(navigation.dispatchEvent(traverse())).toBe(true)
  })
  it('allows leaving after confirmation and does not block fragment changes', () => {
    const navigation = new EventTarget()
    const confirmLeave = vi.fn(() => true)
    installTraversalGuard(navigation, confirmLeave)
    expect(navigation.dispatchEvent(traverse())).toBe(true)
    navigation.dispatchEvent(traverse(true, true))
    expect(confirmLeave).toHaveBeenCalledOnce()
  })
  it('respects non-cancelable browser traversals and unsupported browsers', () => {
    const navigation = new EventTarget()
    const confirmLeave = vi.fn(() => false)
    installTraversalGuard(navigation, confirmLeave)
    expect(navigation.dispatchEvent(traverse(false))).toBe(true)
    expect(confirmLeave).not.toHaveBeenCalled()
    expect(() => installTraversalGuard(undefined, confirmLeave)()).not.toThrow()
  })
})
