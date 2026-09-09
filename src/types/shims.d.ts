declare module '*.jsx' {
  const component: any
  export default component
}

declare global {
  interface Math {
    map(n: number, start: number, stop: number, start2: number, stop2: number): number
  }
}

export {}
