import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import './ASCIIText.css'

const vertexShader = `
varying vec2 vUv;
uniform float uTime;
uniform float mouse;
uniform float uEnableWaves;
void main() {
  vUv = uv;
  float time = uTime * 5.0;
  float waveFactor = uEnableWaves;
  vec3 transformed = position;
  transformed.x += sin(time + position.y) * 0.5 * waveFactor;
  transformed.y += cos(time + position.z) * 0.15 * waveFactor;
  transformed.z += sin(time + position.x) * waveFactor;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
}
`

const fragmentShader = `
varying vec2 vUv;
uniform float mouse;
uniform float uTime;
uniform sampler2D uTexture;
void main() {
  float time = uTime;
  vec2 pos = vUv;
  float move = sin(time + mouse) * 0.01;
  float r = texture2D(uTexture, pos + cos(time * 2.0 - time + pos.x) * 0.01).r;
  float g = texture2D(uTexture, pos + tan(time * 0.5 + pos.x - time) * 0.01).g;
  float b = texture2D(uTexture, pos - cos(time * 2.0 + time + pos.y) * 0.01).b;
  float a = texture2D(uTexture, pos).a;
  gl_FragColor = vec4(r, g, b, a);
}
`

Math.map = function (n: number, start: number, stop: number, start2: number, stop2: number) {
  return ((n - start) / (stop - start)) * (stop2 - start2) + start2
}

class AsciiFilter {
  renderer: THREE.WebGLRenderer
  domElement: HTMLDivElement
  pre: HTMLPreElement
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
  fontSize: number
  fontFamily: string
  charset: string
  invert: boolean
  deg = 0
  width = 0
  height = 0
  cols = 0
  rows = 0
  center = { x: 0, y: 0 }
  mouse = { x: 0, y: 0 }
  pxRatio = typeof window !== 'undefined' ? window.devicePixelRatio : 1
  onMouseMove: (e: MouseEvent) => void

  constructor(renderer: THREE.WebGLRenderer, options: { fontSize?: number; fontFamily?: string; charset?: string; invert?: boolean } = {}) {
    this.renderer = renderer
    this.domElement = document.createElement('div')
    this.domElement.className = 'ascii-filter'
    this.pre = document.createElement('pre')
    this.canvas = document.createElement('canvas')
    const context = this.canvas.getContext('2d')
    if (!context) throw new Error('ASCIIText requires a 2D canvas context.')
    this.context = context
    this.domElement.appendChild(this.pre)
    this.domElement.appendChild(this.canvas)
    this.invert = options.invert ?? true
    this.fontSize = options.fontSize ?? 12
    this.fontFamily = options.fontFamily ?? "'Courier New', monospace"
    this.charset = options.charset ?? " .'`^\",:;Il!i~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$"
    this.context.imageSmoothingEnabled = false
    this.onMouseMove = this.handleMouseMove.bind(this)
    document.addEventListener('mousemove', this.onMouseMove)
  }

  setSize(width: number, height: number) {
    this.width = width
    this.height = height
    this.renderer.setSize(width, height)
    this.reset()
    this.center = { x: width / 2, y: height / 2 }
    this.mouse = { x: this.center.x, y: this.center.y }
  }

  reset() {
    this.context.font = `${this.fontSize}px ${this.fontFamily}`
    const charWidth = this.context.measureText('A').width
    this.cols = Math.max(1, Math.floor(this.width / (this.fontSize * (charWidth / this.fontSize))))
    this.rows = Math.max(1, Math.floor(this.height / this.fontSize))
    this.canvas.width = this.cols
    this.canvas.height = this.rows
    this.pre.style.fontFamily = this.fontFamily
    this.pre.style.fontSize = `${this.fontSize}px`
    this.pre.style.margin = '0'
    this.pre.style.padding = '0'
    this.pre.style.lineHeight = '1em'
    this.pre.style.position = 'absolute'
    this.pre.style.left = '0'
    this.pre.style.top = '0'
    this.pre.style.zIndex = '9'
    this.pre.style.backgroundAttachment = 'fixed'
    this.pre.style.mixBlendMode = 'difference'
  }

  render(scene: THREE.Scene, camera: THREE.Camera) {
    this.renderer.render(scene, camera)
    const w = this.canvas.width
    const h = this.canvas.height
    this.context.clearRect(0, 0, w, h)
    if (w && h) this.context.drawImage(this.renderer.domElement, 0, 0, w, h)
    this.asciify(this.context, w, h)
    this.hue()
  }

  handleMouseMove(e: MouseEvent) {
    this.mouse = { x: e.clientX * this.pxRatio, y: e.clientY * this.pxRatio }
  }

  get dx() { return this.mouse.x - this.center.x }
  get dy() { return this.mouse.y - this.center.y }

  hue() {
    const deg = (Math.atan2(this.dy, this.dx) * 180) / Math.PI
    this.deg += (deg - this.deg) * 0.075
    this.domElement.style.filter = `hue-rotate(${this.deg.toFixed(1)}deg)`
  }

  asciify(ctx: CanvasRenderingContext2D, w: number, h: number) {
    if (!w || !h) return
    const imgData = ctx.getImageData(0, 0, w, h).data
    let text = ''
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = x * 4 + y * 4 * w
        const r = imgData[i]
        const g = imgData[i + 1]
        const b = imgData[i + 2]
        const a = imgData[i + 3]
        if (a === 0) {
          text += ' '
          continue
        }
        let gray = (0.3 * r + 0.6 * g + 0.1 * b) / 255
        let index = Math.floor((1 - gray) * (this.charset.length - 1))
        if (this.invert) index = this.charset.length - index - 1
        text += this.charset[index]
      }
      text += '\n'
    }
    this.pre.textContent = text
  }

  dispose() {
    document.removeEventListener('mousemove', this.onMouseMove)
  }
}

class CanvasTxt {
  canvas = document.createElement('canvas')
  context: CanvasRenderingContext2D
  txt: string
  fontSize: number
  fontFamily: string
  color: string
  font: string

  constructor(txt: string, options: { fontSize?: number; fontFamily?: string; color?: string } = {}) {
    const context = this.canvas.getContext('2d')
    if (!context) throw new Error('ASCIIText requires a 2D canvas context.')
    this.context = context
    this.txt = txt
    this.fontSize = options.fontSize ?? 200
    this.fontFamily = options.fontFamily ?? 'Arial'
    this.color = options.color ?? '#fdf9f3'
    this.font = `600 ${this.fontSize}px ${this.fontFamily}`
  }

  resize() {
    this.context.font = this.font
    const metrics = this.context.measureText(this.txt)
    this.canvas.width = Math.ceil(metrics.width) + 20
    this.canvas.height = Math.ceil(metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent) + 20
  }

  render() {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.context.fillStyle = this.color
    this.context.font = this.font
    const metrics = this.context.measureText(this.txt)
    this.context.fillText(this.txt, 10, 10 + metrics.actualBoundingBoxAscent)
  }

  get width() { return this.canvas.width }
  get height() { return this.canvas.height }
  get texture() { return this.canvas }
}

class CanvAscii {
  textString: string
  asciiFontSize: number
  textFontSize: number
  textColor: string
  planeBaseHeight: number
  container: HTMLDivElement
  width: number
  height: number
  enableWaves: boolean
  camera: THREE.PerspectiveCamera
  scene: THREE.Scene
  mouse = { x: 0, y: 0 }
  geometry!: THREE.PlaneGeometry
  material!: THREE.ShaderMaterial
  mesh!: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>
  renderer!: THREE.WebGLRenderer
  filter!: AsciiFilter
  textCanvas!: CanvasTxt
  texture!: THREE.CanvasTexture
  animationFrameId = 0

  constructor(options: { text: string; asciiFontSize: number; textFontSize: number; textColor: string; planeBaseHeight: number; enableWaves: boolean }, container: HTMLDivElement, width: number, height: number) {
    this.textString = options.text
    this.asciiFontSize = options.asciiFontSize
    this.textFontSize = options.textFontSize
    this.textColor = options.textColor
    this.planeBaseHeight = options.planeBaseHeight
    this.container = container
    this.width = width
    this.height = height
    this.enableWaves = options.enableWaves
    this.camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000)
    this.camera.position.z = 30
    this.scene = new THREE.Scene()
  }

  async init() {
    try {
      await document.fonts.load('600 200px "IBM Plex Mono"')
      await document.fonts.load('500 12px "IBM Plex Mono"')
    } catch {
      // fallback font is fine
    }
    await document.fonts.ready
    this.setMesh()
    this.setRenderer()
  }

  setMesh() {
    this.textCanvas = new CanvasTxt(this.textString, {
      fontSize: this.textFontSize,
      fontFamily: 'IBM Plex Mono',
      color: this.textColor,
    })
    this.textCanvas.resize()
    this.textCanvas.render()
    this.texture = new THREE.CanvasTexture(this.textCanvas.texture)
    this.texture.minFilter = THREE.NearestFilter
    const textAspect = this.textCanvas.width / this.textCanvas.height
    const baseH = this.planeBaseHeight
    const planeW = baseH * textAspect
    this.geometry = new THREE.PlaneGeometry(planeW, baseH, 36, 36)
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        mouse: { value: 1.0 },
        uTexture: { value: this.texture },
        uEnableWaves: { value: this.enableWaves ? 1.0 : 0.0 },
      },
    })
    this.mesh = new THREE.Mesh(this.geometry, this.material)
    this.scene.add(this.mesh)
  }

  setRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true })
    this.renderer.setPixelRatio(1)
    this.renderer.setClearColor(0x000000, 0)
    this.filter = new AsciiFilter(this.renderer, {
      fontFamily: 'IBM Plex Mono',
      fontSize: this.asciiFontSize,
      invert: true,
    })
    this.container.appendChild(this.filter.domElement)
    this.setSize(this.width, this.height)
  }

  setSize(w: number, h: number) {
    this.width = w
    this.height = h
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.filter.setSize(w, h)
  }

  load() { this.animate() }

  onMouseMove(evt: MouseEvent | TouchEvent) {
    const event = 'touches' in evt ? evt.touches[0] : evt
    if (!event) return
    const bounds = this.container.getBoundingClientRect()
    this.mouse = { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
  }

  animate() {
    const animateFrame = () => {
      this.animationFrameId = requestAnimationFrame(animateFrame)
      this.render()
    }
    animateFrame()
  }

  render() {
    const time = Date.now() * 0.001
    this.textCanvas.render()
    this.texture.needsUpdate = true
    this.material.uniforms.uTime.value = Math.sin(time)
    this.updateRotation()
    this.filter.render(this.scene, this.camera)
  }

  updateRotation() {
    const x = Math.map(this.mouse.y, 0, this.height, 0.5, -0.5)
    const y = Math.map(this.mouse.x, 0, this.width, -0.5, 0.5)
    this.mesh.rotation.x += (x - this.mesh.rotation.x) * 0.05
    this.mesh.rotation.y += (y - this.mesh.rotation.y) * 0.05
  }

  clear() {
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      object.material.dispose()
      object.geometry.dispose()
    })
    this.scene.clear()
  }

  dispose() {
    cancelAnimationFrame(this.animationFrameId)
    if (this.filter) {
      this.filter.dispose()
      if (this.filter.domElement.parentNode) this.container.removeChild(this.filter.domElement)
    }
    this.clear()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
  }
}

export default function ASCIIText({
  text = 'David!',
  asciiFontSize = 8,
  textFontSize = 200,
  textColor = '#fdf9f3',
  planeBaseHeight = 8,
  enableWaves = true,
}: {
  text?: string
  asciiFontSize?: number
  textFontSize?: number
  textColor?: string
  planeBaseHeight?: number
  enableWaves?: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const asciiRef = useRef<CanvAscii | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let cancelled = false
    let observer: IntersectionObserver | null = null
    let resizeObserver: ResizeObserver | null = null

    const create = async (width: number, height: number) => {
      const instance = new CanvAscii({ text, asciiFontSize, textFontSize, textColor, planeBaseHeight, enableWaves }, container, width, height)
      await instance.init()
      if (cancelled) { instance.dispose(); return }
      asciiRef.current = instance
      instance.load()
      resizeObserver = new ResizeObserver((entries) => {
        const rect = entries[0]?.contentRect
        if (rect && rect.width > 0 && rect.height > 0) instance.setSize(rect.width, rect.height)
      })
      resizeObserver.observe(container)
    }

    const setup = () => {
      const rect = container.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) {
        observer = new IntersectionObserver(([entry]) => {
          if (!entry?.isIntersecting || cancelled) return
          const width = entry.boundingClientRect.width
          const height = entry.boundingClientRect.height
          if (width > 0 && height > 0) {
            observer?.disconnect()
            observer = null
            void create(width, height)
          }
        }, { threshold: 0.1 })
        observer.observe(container)
      } else {
        void create(rect.width, rect.height)
      }
    }

    setup()
    return () => {
      cancelled = true
      observer?.disconnect()
      resizeObserver?.disconnect()
      asciiRef.current?.dispose()
      asciiRef.current = null
    }
  }, [text, asciiFontSize, textFontSize, textColor, planeBaseHeight, enableWaves])

  return <div ref={containerRef} className="ascii-text-container" aria-label={text} />
}
