import { createElement } from 'react'

const listeners = new Set()
const pending = new Set()
let version = 0

function notify() {
  version += 1
  // A route starts importing during render. Notify mounted chrome afterwards.
  queueMicrotask(() => listeners.forEach(listener => listener()))
}

export function subscribeNavigation(listener) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  window.addEventListener('learnmatch:auth-change', listener)
  window.addEventListener('popstate', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
    window.removeEventListener('learnmatch:auth-change', listener)
    window.removeEventListener('popstate', listener)
  }
}

export const navigationSnapshot = () => version

export function hasSlowRoute(pathname) {
  return [...pending].some(request => request.pathname === pathname && request.slow)
}

// This snapshot only invalidates displayed UI when stored credentials change.
// Authentication and permission checks remain in the existing route/session guards.
export function navigationIdentity() {
  try { return `${localStorage.getItem('token') || ''}:${localStorage.getItem('adminToken') || ''}` }
  catch { return '' }
}

export function createLazyPage(importPage) {
  let component, promise, failure
  function preload() {
    if (!promise) {
      const request = { pathname: typeof window === 'undefined' ? '' : window.location.pathname, slow: false }
      pending.add(request)
      const timer = setTimeout(() => { request.slow = true; notify() }, 8000)
      notify()
      promise = Promise.resolve().then(importPage).then(module => {
        component = module.default
      }).catch(error => {
        failure = error
        throw error
      }).finally(() => {
        clearTimeout(timer)
        pending.delete(request)
        notify()
      })
    }
    return promise
  }
  function LazyPage(props) {
    if (failure) throw failure
    if (!component) throw preload()
    return createElement(component, props)
  }
  LazyPage.preload = preload
  return LazyPage
}

export const publicPages = {
  '/about': createLazyPage(() => import('../pages/About')),
  '/help': createLazyPage(() => import('../pages/Help')),
  '/privacy': createLazyPage(() => import('../pages/PrivacyNotice')),
  '/terms': createLazyPage(() => import('../pages/Terms')),
}
