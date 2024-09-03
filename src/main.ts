import './style.css';
import { CanvasEditor } from './canvas.ts';

const parent = document.querySelector<HTMLDivElement>('#app')!;

parent.innerHTML = `
  <div id="topBar"></div>
  <div id="canvasWrapper" class="flex justify-center items-center h-[calc(100vh-50px)]">
    <div id="canvas" class="w-[512px] h-[512px] bg-slate-50"></div>
  </div>
`;

class Toolbar {
  constructor(private topBar: HTMLElement) {
    this.topBar.innerHTML = '';
    this.topBar.className =
      'h-[50px] w-full bg-gray-100 flex items-center justify-between px-4 bg-gray-100 text-sm';

    const title = document.createElement('h1');
    title.textContent = 'Canvas Editor';
    title.className = 'text-m font-bold m-0';

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'flex space-x-2';

    // Add buttons here, for example:
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.className =
      'bg-white text-black px-4 rounded opacity-50 cursor-not-allowed disabled:opacity-50 disabled:cursor-not-allowed border-2 border-black';
    saveButton.disabled = true;
    saveButton.addEventListener('click', () => {
      // Implement save functionality
    });

    buttonContainer.appendChild(saveButton);
    this.topBar.appendChild(title);
    this.topBar.appendChild(buttonContainer);
  }
}

const canvasContainer = document.querySelector<HTMLDivElement>('#canvas')!;
const topBar = document.querySelector<HTMLDivElement>('#topBar')!;

// Install the Toolbar
new Toolbar(topBar);

const _editor = new CanvasEditor(canvasContainer);

// Make the canvas responsive
// window.addEventListener('resize', () => {
//   const size = Math.min(512, canvasContainer.clientWidth, canvasContainer.clientHeight);
//   editor.resize(size, size);
// });

// Initial resize
// window.dispatchEvent(new Event('resize'));
