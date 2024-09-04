import { Disposable } from './interface/disposable';
import arrow from './icons/tools/arrow.svg';
import pen from './icons/tools/pen.svg';
import pencil from './icons/tools/pencil.svg';
import hand from './icons/tools/hand.svg';

export interface ToolbarItem {
  iconSVG?: string;
  id: Tool;
  label: string;
  shortcut?: string;
}

export enum Tool {
  MOVE = 'move',
  HAND = 'hand',
  PENCIL = 'pencil',
  PEN = 'pen',
}

/**
 * Bottom toolbar that contains the main actions of the app.
 * You can add listeners to the toolSelected event to know when a tool is selected.
 * dispatches 'toolSelected' event when the selected tool id changes.
 */
export class ToolShelf extends EventTarget implements Disposable {
  private items: ToolbarItem[] = [];

  private _activeTool: Tool = Tool.MOVE;

  private disposers: (() => void)[] = [];

  constructor(public container: HTMLDivElement) {
    super();
    this.items = [
      { id: Tool.MOVE, label: 'move', iconSVG: arrow, shortcut: 'v' },
      { id: Tool.HAND, label: 'Hand', iconSVG: hand, shortcut: 'h' },
      { id: Tool.PEN, label: 'Pen', iconSVG: pen, shortcut: 'p' },
      { id: Tool.PENCIL, label: 'Pencil', iconSVG: pencil, shortcut: 'P' },
    ];

    console.log('ToolShelf', arrow);
    this.updateDOM();

    const handleKeyDown = this.handleKeyDown.bind(this);
    window.addEventListener('keydown', handleKeyDown);
    this.disposers.push(() => window.removeEventListener('keydown', handleKeyDown));
  }

  private handleKeyDown(event: KeyboardEvent) {
    if (Array.isArray(this.items)) {
      for (const item of this.items) {
        if (item.shortcut && event.key === item.shortcut) {
          this.handleSelectTool(item.id, false);
          event.preventDefault();
          return;
        } else if (event.key === item.shortcut?.toLowerCase()) {
          this.handleSelectTool(item.id, false);
          event.preventDefault();
          return;
        }
      }
    }
  }

  dispose(): void {
    this.disposers.forEach(dispose => dispose());
  }

  set activeToolId(id: Tool) {
    this._activeTool = id;
    this.updateDOM();
  }

  get activeToolId(): Tool {
    return this._activeTool;
  }

  private handleSelectTool = (id: Tool, cancelled: boolean) => {
    console.log('handleSelectTool', id, cancelled);
    if (!cancelled) {
      this._activeTool = id;
      this.updateDOM();
    }
    this.dispatchEvent(new CustomEvent('toolSelected', { detail: { tool: id } }));
  };

  private updateDOM() {
    this.container.innerHTML = '';
    const fieldset = document.createElement('fieldset');
    fieldset.setAttribute('role', 'toolbar');
    fieldset.className = 'flex gap-1';

    this.items.forEach(item => {
      const label = document.createElement('label');
      label.className = 'flex items-center justify-center w-8 h-8 rounded-sm cursor-pointer';
      label.title = item.label;

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'tool';
      input.value = item.id;
      input.className = 'sr-only'; // visually hidden
      input.checked = item.id === this._activeTool;

      input.onchange = () => this.handleSelectTool(item.id, false);

      if (item.iconSVG) {
        const svg = document.createElement('span');
        svg.innerHTML = item.iconSVG;
        svg.className = 'text-lg';
        label.appendChild(svg);
      } else {
        const span = document.createElement('span');
        span.innerHTML = item.label;
        span.className = 'text-lg';
        label.appendChild(span);
      }

      label.appendChild(input);
      fieldset.appendChild(label);

      // Apply styles based on selection state
      if (item.id === this._activeTool) {
        label.classList.add('bg-blue-500', 'text-white', 'dark:bg-blue-600');
      } else {
        label.classList.add(
          'bg-white',
          'dark:bg-gray-800',
          'hover:bg-gray-100',
          'dark:hover:bg-gray-700'
        );
      }
    });

    this.container.appendChild(fieldset);
  }
}
