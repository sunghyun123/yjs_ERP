/**
 * Cancel same-document history traversal when the platform allows it. Do not
 * rewrite Next's history state or trap a user's repeated attempt to leave.
 * https://html.spec.whatwg.org/multipage/nav-history-apis.html#the-navigate-event
 */
export function installTraversalGuard(navigation: EventTarget | undefined, confirmLeave: () => boolean) {
  if (!navigation) return () => {}
  const onNavigate = (event: Event) => {
    const navigationEvent = event as Event & { navigationType?: string; hashChange?: boolean }
    if (navigationEvent.navigationType !== 'traverse' || navigationEvent.hashChange || !event.cancelable) return
    if (!confirmLeave()) event.preventDefault()
  }
  navigation.addEventListener('navigate', onNavigate)
  return () => navigation.removeEventListener('navigate', onNavigate)
}
