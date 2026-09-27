import type { Map as MapLibreMap } from 'maplibre-gl'

export interface SkyBackdrop {
  draw: (map: MapLibreMap) => void
  dispose: () => void
}

const vertexSource = `
attribute vec2 a_position;
varying vec2 v_position;
void main() {
  v_position = a_position;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`

// NASA's celestial plate carrée map is centered on right ascension 0h,
// with right ascension increasing toward the left edge of the image.
const fragmentSource = `
precision highp float;
varying vec2 v_position;
uniform sampler2D u_stars;
uniform vec3 u_forward;
uniform vec3 u_right;
uniform vec3 u_up;
uniform float u_aspect;
uniform float u_focal;
const float PI = 3.141592653589793;
void main() {
  vec3 direction = normalize(u_forward * u_focal +
    u_right * v_position.x * u_aspect + u_up * v_position.y);
  float ra = atan(direction.y, direction.x);
  float dec = asin(clamp(direction.z, -1.0, 1.0));
  vec2 uv = vec2(fract(0.5 - ra / (2.0 * PI)), 0.5 + dec / PI);
  vec3 stars = texture2D(u_stars, uv).rgb;
  gl_FragColor = vec4(min(pow(stars, vec3(0.78)) * 1.4, vec3(1.0)), 1.0);
}`

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('Could not create sky shader')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`Sky shader failed: ${message}`)
  }
  return shader
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Star map could not load'))
    image.src = url
  })
}

export async function createSkyBackdrop(canvas: HTMLCanvasElement, url: string): Promise<SkyBackdrop> {
  const image = await loadImage(url)
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false })
  if (!gl) throw new Error('WebGL is unavailable for the sky backdrop')

  const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource)
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource)
  const program = gl.createProgram()
  if (!program) throw new Error('Could not create sky program')
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  gl.deleteShader(vertex)
  gl.deleteShader(fragment)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Sky program failed: ${gl.getProgramInfoLog(program)}`)
  }

  const buffer = gl.createBuffer()
  const texture = gl.createTexture()
  if (!buffer || !texture) throw new Error('Could not create sky buffers')
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

  const position = gl.getAttribLocation(program, 'a_position')
  const uniform = (name: string) => gl.getUniformLocation(program, name)
  const forwardLocation = uniform('u_forward')
  const rightLocation = uniform('u_right')
  const upLocation = uniform('u_up')
  const aspectLocation = uniform('u_aspect')
  const focalLocation = uniform('u_focal')
  const starsLocation = uniform('u_stars')
  const rad = Math.PI / 180
  const combine = (a: number[], b: number[], aScale: number, bScale: number) =>
    a.map((value, index) => value * aScale + b[index]! * bScale) as [number, number, number]

  return {
    draw(map) {
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
      const width = Math.max(1, Math.round(canvas.clientWidth * pixelRatio))
      const height = Math.max(1, Math.round(canvas.clientHeight * pixelRatio))
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
      const center = map.getCenter()
      // Zero phase fixes a reference Earth rotation against the J2000 sky;
      // it does not imply a time of day for the historical timeline.
      const longitude = center.lng * rad
      const latitude = center.lat * rad
      const bearing = map.getBearing() * rad
      const pitch = map.getPitch() * rad
      const outward = [Math.cos(latitude) * Math.cos(longitude), Math.cos(latitude) * Math.sin(longitude), Math.sin(latitude)]
      const east = [-Math.sin(longitude), Math.cos(longitude), 0]
      const north = [-Math.sin(latitude) * Math.cos(longitude), -Math.sin(latitude) * Math.sin(longitude), Math.cos(latitude)]
      const screenRight = combine(east, north, Math.cos(bearing), -Math.sin(bearing))
      const screenUp = combine(north, east, Math.cos(bearing), Math.sin(bearing))
      // The camera looks through Earth toward the far-side celestial sphere.
      const forward = combine(outward, screenUp, -Math.cos(pitch), Math.sin(pitch))
      const up = combine(screenUp, outward, Math.cos(pitch), Math.sin(pitch))

      gl.viewport(0, 0, width, height)
      gl.useProgram(program)
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.enableVertexAttribArray(position)
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.uniform1i(starsLocation, 0)
      gl.uniform3fv(forwardLocation, forward)
      gl.uniform3fv(rightLocation, screenRight)
      gl.uniform3fv(upLocation, up)
      gl.uniform1f(aspectLocation, width / height)
      gl.uniform1f(focalLocation, 1 / Math.tan(map.getVerticalFieldOfView() * rad / 2))
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    },
    dispose() {
      gl.deleteTexture(texture)
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
    }
  }
}
