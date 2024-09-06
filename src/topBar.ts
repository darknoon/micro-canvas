/**
 * TopBar class extends EventTarget and manages the top bar of the application.
 * It includes a title and buttons for various actions.
 *
 * Events:
 * - 'save': Dispatched when the save button is clicked.
 */
export class TopBar extends EventTarget {
  constructor(private topBar: HTMLElement) {
    super();
    this.topBar.innerHTML = '';
    this.topBar.className =
      'h-[50px] w-full bg-gray-100 flex items-center justify-between px-4 bg-gray-50 text-sm';

    const title = document.createElement('h1');
    title.textContent = 'Canvas Editor';
    title.className = 'text-m font-bold m-0';

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'flex space-x-2';

    // Add buttons here, for example:
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.className =
      'bg-white text-black px-4 rounded opacity-50 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-black';

    buttonContainer.appendChild(saveButton);
    saveButton.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('save'));
    });

    const copyButton = document.createElement('button');
    copyButton.textContent = 'Copy';
    copyButton.className =
      'bg-white text-black px-4 rounded opacity-50 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-black';
    buttonContainer.appendChild(copyButton);

    copyButton.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('copy'));
    });
    this.topBar.appendChild(title);
    this.topBar.appendChild(buttonContainer);
  }
}
