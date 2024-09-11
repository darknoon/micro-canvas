import { CanvasObject } from "./canvas"
import { Artboard } from "./objects/artboard"
import { PathLayer } from "./objects/bezier"
import { RedCircle } from "./objects/redCircle"

export function exportSVG(objects: CanvasObject[], width: number, height: number): string {
  const svgNS = "http://www.w3.org/2000/svg"
  const svg = document.createElementNS(svgNS, "svg")
  svg.setAttribute("width", width.toString())
  svg.setAttribute("height", height.toString())
  const currentArtboard = objects.find(obj => obj instanceof Artboard)
  if (currentArtboard) {
    const { x, y, width, height } = currentArtboard.boundingBox
    svg.setAttribute("viewBox", `${x} ${y} ${width} ${height}`)
  } else {
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`)
  }

  for (const object of objects) {
    if ("toSVG" in object && typeof object.toSVG === "function") {
      const path = object.toSVG()
      svg.appendChild(path)
    }
  }

  const serializer = new XMLSerializer()
  return serializer.serializeToString(svg)
}

interface IdAllocator {
  nextId(): number
}

export function importSVG(svg: string, idAllocator: IdAllocator): CanvasObject[] {
  const parser = new DOMParser()
  const svgDoc = parser.parseFromString(svg, "image/svg+xml")
  const svgElement = svgDoc.documentElement

  if (svgElement.tagName !== "svg") {
    throw new Error("Invalid SVG: Root element is not <svg>")
  }

  // Clear existing objects
  const objects: CanvasObject[] = []

  // Process path elements and groups
  const processElement = (element: Element) => {
    if (element.tagName === "path") {
      const pathLayer = PathLayer.fromSVGPath(element as SVGPathElement, idAllocator.nextId())
      objects.push(pathLayer)
    } else if (element.tagName === "g") {
      // TODO: handle groups properly
      Array.from(element.children).forEach(processElement)
    } else if (element.tagName === "circle") {
      const circle = RedCircle.fromSVG(element as SVGCircleElement, idAllocator.nextId())
      objects.push(circle)
    }
  }

  Array.from(svgElement.children).forEach(processElement)
  return objects
}
