export class TopBar {
  constructor(private topBar: HTMLElement) {
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
