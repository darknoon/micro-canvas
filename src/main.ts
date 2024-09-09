import "./style.css"
import { CanvasEditor, Events } from "./canvas"
import { TopBar } from "./topBar"
import { ToolShelf } from "./toolShelf"

// style html elem
document.body.classList.add("bg-white", "dark:bg-black", "text-black", "dark:text-white")

const parent = document.querySelector<HTMLDivElement>("#app")!
parent.innerHTML = `
  <div id="topBar"></div>
  <div id="canvasWrapper" class="flex justify-center items-center h-[calc(100vh-50px)]">
    <div id="canvasEditor" class="w-[512px] h-[512px] bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-clip relative">
      <div id="preview" class="absolute top-2 right-2 w-32 h-32 bg-white dark:bg-gray-800 rounded-lg shadow-lg border-2 border-gray-300 dark:border-gray-600 overflow-hidden">
      </div>
      <div id="toolbar" class="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 rounded-lg shadow-sm p-2 flex space-x-2"></div>
    </div>
  </div>
`

const canvasContainerElem = parent.querySelector<HTMLDivElement>("#canvasEditor")!
const topBarElem = parent.querySelector<HTMLDivElement>("#topBar")!
const toolbarElem = parent.querySelector<HTMLDivElement>("#toolbar")!

// initialize the app and connect the components

// topBar not really doing anything yet
const topBar = new TopBar(topBarElem)

topBar.addEventListener("copy", () => {
  const text = editor.exportSVG()
  navigator.clipboard
    .writeText(text)
    .then(() => {
      console.log("SVG content copied to clipboard")
    })
    .catch(err => {
      console.error("Failed to copy SVG content: ", err)
    })
})
const tools = new ToolShelf(toolbarElem)
let editor = new CanvasEditor(canvasContainerElem)

// Listen to preview changes
editor.addEventListener(Events.CONTENT_CHANGED, updatePreview)

function updatePreview() {
  const text = editor.exportSVG()
  const preview = canvasContainerElem.querySelector<HTMLDivElement>("#preview")!
  preview.innerHTML = text // Clear previous content and add new SVG
  const svg = preview.querySelector("svg")
  if (svg) {
    svg.setAttribute("width", "100%")
    svg.setAttribute("height", "100%")
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet")
  }
}
updatePreview()

tools.addEventListener("toolSelected", () => {
  editor.activeToolId = tools.activeToolId
})

topBar.addEventListener("save", () => {
  const text = editor.exportSVG()
  const blob = new Blob([text], { type: "image/svg+xml" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "canvas_export.svg"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
})

if (import.meta.hot) {
  import.meta.hot.accept("./canvas", m => {
    console.log("canvas module updated, disposing old editor and creating new one, copying state…")
    editor.dispose()
    if (m?.CanvasEditor) {
      const e = new m.CanvasEditor(canvasContainerElem)
      e.copyFrom(editor)
      editor = e
    }
  })
}
