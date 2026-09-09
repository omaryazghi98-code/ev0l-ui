import { useEffect } from 'react'

const STRAY = /^(?:`n|'n)$/

export default function StatusTextCleanup() {
  useEffect(() => {
    const clean = () => {
      document.querySelectorAll('.status-page').forEach((root) => {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
        const nodes: Text[] = []
        let current = walker.nextNode()
        while (current) {
          const node = current as Text
          if (STRAY.test(node.nodeValue?.trim() || '')) nodes.push(node)
          current = walker.nextNode()
        }
        nodes.forEach((node) => node.remove())
      })
    }

    clean()
    const observer = new MutationObserver(clean)
    observer.observe(document.body, { subtree: true, childList: true, characterData: true })
    return () => observer.disconnect()
  }, [])

  return null
}
