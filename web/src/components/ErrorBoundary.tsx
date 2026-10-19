import { Component, ReactNode } from 'react';

const KEY = 'dg.recovered';

/** Reload once to recover; a second failure within a minute shows the fallback instead of looping. */
function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/**
 * Stops a crash on one page from blanking the whole site. A page that fails
 * to render (or a page chunk that fails to download after a new deploy) is
 * reloaded once, which is what fixes it by hand; otherwise a message with a
 * Reload button is shown. `resetKey` (the route) clears the error on navigation.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null; key?: string }> {
  state: { error: Error | null; key?: string } = { error: null, key: this.props.resetKey };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  static getDerivedStateFromProps(props: { resetKey?: string }, state: { error: Error | null; key?: string }) {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null;
  }

  componentDidCatch(error: Error) {
    console.error('Page crashed:', error);
    reloadOnce();
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="container empty" role="alert">
        <h2>Something went wrong on this page</h2>
        <p className="muted">Reloading usually fixes it.</p>
        <button className="btn" onClick={() => window.location.reload()}>Reload</button>
        <p className="muted small">Details: {this.state.error.message}</p>
      </div>
    );
  }
}
