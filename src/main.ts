import './style.css';
import { CanvasEditor } from './canvas';
import { TopBar } from './topBar';
import { ToolShelf } from './toolShelf';

const parent = document.querySelector<HTMLDivElement>('#app')!;
parent.innerHTML = `
  <div id="topBar"></div>
  <div id="canvasWrapper" class="flex justify-center items-center h-[calc(100vh-50px)]">
    <div id="canvasEditor" class="w-[512px] h-[512px] bg-white dark:bg-gray-400 rounded-lg border overflow-clip"></div>
  <div id="toolbar" class="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 rounded-lg shadow-sm p-2 flex space-x-2"></div>
  </div>
`;

const canvasContainerElem = parent.querySelector<HTMLDivElement>('#canvasEditor')!;
const topBarElem = parent.querySelector<HTMLDivElement>('#topBar')!;
const toolbarElem = parent.querySelector<HTMLDivElement>('#toolbar')!;

// initialize the app and connect the components

// topBar not really doing anything yet
// const topBar = new TopBar(topBarElem);
const tools = new ToolShelf(toolbarElem);
const editor = new CanvasEditor(canvasContainerElem);

tools.addEventListener('toolSelected', () => {
  editor.activeToolId = tools.activeToolId;
});
