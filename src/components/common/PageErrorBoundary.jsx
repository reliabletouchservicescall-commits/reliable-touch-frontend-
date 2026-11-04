import { Component } from 'react'
import { AlertTriangle, RotateCw } from 'lucide-react'

// Catches a page that fails to draw, so the menu and top bar stay and the person sees what
// to do — never a blank white screen. Give it `key={pathname}` so a new page starts fresh.
export default class PageErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Page failed to draw', error, info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-full items-center justify-center p-8 text-center">
        <div className="max-w-sm">
          <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[#F95C4B]/10 text-[#F95C4B]"><AlertTriangle className="h-7 w-7" /></span>
          <h2 className="text-lg font-bold text-[#111111] dark:text-white">This page didn’t load</h2>
          <p className="mt-1 text-sm text-[#6B7280] dark:text-[#A1A1AA]">Tap Reload to try again. If it keeps happening, tell your manager.</p>
          <button type="button" onClick={() => window.location.reload()}
            className="mx-auto mt-5 flex items-center gap-2 rounded-xl bg-[#F95C4B] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#E84B3A]">
            <RotateCw className="h-4 w-4" /> Reload
          </button>
        </div>
      </div>
    )
  }
}
