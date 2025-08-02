let storageMode = chrome.storage.local;
let shortcutEventListeners = [];
let currentShortcutPanel = null;
let currentWidgetPanel = null;
let twelvehclock = true;
let widgetInstances = new Map();
let isWidgetDragging = false;

function cleanupEventListeners() {
    shortcutEventListeners.forEach(({ element, event, handler }) => {
        if (element && element.removeEventListener) {
            element.removeEventListener(event, handler);
        }
    });
    shortcutEventListeners = [];
}

function addTrackedEventListener(element, event, handler) {
    element.addEventListener(event, handler);
    shortcutEventListeners.push({ element, event, handler });
}

function buttonRippleEffect() {
    document.querySelectorAll('.button-style').forEach(button => {
        const rippleHandler = function(e) {
            const button = e.currentTarget;
            const circle = document.createElement('span');
            const diameter = Math.max(button.clientWidth, button.clientHeight);
            const radius = diameter / 2;
            circle.style.width = circle.style.height = `${diameter}px`;
            const buttonRect = button.getBoundingClientRect();
            circle.style.left = `${e.clientX - buttonRect.left - radius}px`;
            circle.style.top = `${e.clientY - buttonRect.top - radius}px`;
            circle.classList.add('ripple');
            const existingRipple = button.querySelector('.ripple');
            if (existingRipple) {
                existingRipple.remove();
            }
            button.appendChild(circle);
            circle.addEventListener('animationend', () => {
                circle.remove();
            });
        };
        addTrackedEventListener(button, 'click', rippleHandler);
    });
    
    document.querySelectorAll('.shortcut-circle').forEach(button => {
        const rippleHandler = function(e) {
            const button = e.currentTarget;
            const circle = document.createElement('span');
            const diameter = Math.max(button.clientWidth, button.clientHeight);
            const radius = diameter / 2;
            circle.style.width = circle.style.height = `${diameter}px`;
            const buttonRect = button.getBoundingClientRect();
            circle.style.left = `${e.clientX - buttonRect.left - radius}px`;
            circle.style.top = `${e.clientY - buttonRect.top - radius}px`;
            circle.classList.add('ripple');
            const existingRipple = button.querySelector('.ripple');
            if (existingRipple) {
                existingRipple.remove();
            }
            button.appendChild(circle);
            circle.addEventListener('animationend', () => {
                circle.remove();
            });
        };
        addTrackedEventListener(button, 'click', rippleHandler);
    });

    // Add ripple effect for widgets
    document.querySelectorAll('.widget-container, .time-container').forEach(button => {
        // Remove existing ripple listeners to avoid duplicates
        const existingRipple = button.querySelector('.ripple');
        if (existingRipple) {
            existingRipple.remove();
        }

        const rippleHandler = function(e) {
            // Only add ripple if not dragging
            if (e.currentTarget.classList.contains('dragging-source')) return;
            
            const button = e.currentTarget;
            const circle = document.createElement('span');
            const diameter = Math.max(button.clientWidth, button.clientHeight);
            const radius = diameter / 2;
            circle.style.width = circle.style.height = `${diameter}px`;
            const buttonRect = button.getBoundingClientRect();
            circle.style.left = `${e.clientX - buttonRect.left - radius}px`;
            circle.style.top = `${e.clientY - buttonRect.top - radius}px`;
            circle.classList.add('ripple');
            const existingRipple = button.querySelector('.ripple');
            if (existingRipple) {
                existingRipple.remove();
            }
            button.appendChild(circle);
            circle.addEventListener('animationend', () => {
                circle.remove();
            });
        };
        
        // Use widget's tracked event listener if it's a widget instance
        const widgetId = button.id;
        const widgetInstance = widgetInstances.get(widgetId);
        if (widgetInstance) {
            widgetInstance.addTrackedDragEventListener(button, 'click', rippleHandler);
        } else {
            // Fallback for non-widget elements
            button.addEventListener('click', rippleHandler);
        }
    });
}

function adjustFontSizeToFit(textElement, containerWidth, initialFontSize = 14, minFontSize = 8, step = 0.5) {
    if (!textElement || !containerWidth) {
        return;
    }

    let currentFontSize = initialFontSize;
    textElement.style.fontSize = `${currentFontSize}px`;

    const tempSpan = document.createElement('span');
    tempSpan.style.visibility = 'hidden';
    tempSpan.style.position = 'absolute';
    tempSpan.style.whiteSpace = 'nowrap';
    tempSpan.style.fontFamily = getComputedStyle(textElement).fontFamily;
    tempSpan.textContent = textElement.textContent;
    document.body.appendChild(tempSpan);

    while (currentFontSize > minFontSize) {
        tempSpan.style.fontSize = `${currentFontSize}px`;
        if (tempSpan.offsetWidth > containerWidth) {
            currentFontSize -= step;
        } else {
            textElement.style.fontSize = `${currentFontSize}px`;
            textElement.style.whiteSpace = 'normal';
            if (textElement.scrollHeight > textElement.clientHeight) {
                currentFontSize -= step;
            } else {
                break;
            }
        }
    }

    textElement.style.fontSize = `${currentFontSize}px`;
    textElement.style.whiteSpace = 'normal';
    document.body.removeChild(tempSpan);
}

async function initializeShortcuts() {
    try {
        cleanupEventListeners();
        
        // Clear widget instances when reinitializing to avoid conflicts
        widgetInstances.forEach(widget => widget.destroy());
        widgetInstances.clear();
        
        const gallery = document.getElementById('shortcut-gallery');
        if (!gallery) {
            console.error('Gallery element not found');
            return;
        }

        const shortcutsArea = document.getElementById('shortcuts-area');
        if (shortcutsArea) {
            shortcutsArea.classList.remove('dragging');
        }
        
        gallery.style.borderColor = 'transparent';

        while (gallery.firstElementChild) {
            gallery.removeChild(gallery.firstElementChild);
        }

        const data = await storageMode.get('shortcuts');
        const allShortcuts = data?.shortcuts;

        if (!Array.isArray(allShortcuts)) {
            console.log('Shortcuts data is not an array:', allShortcuts);
            makeShortcutsDynamic();
            return;
        }

        const shortcutsToDisplay = allShortcuts.slice(0, 25);

        shortcutsToDisplay.forEach((shortcut, index) => {
            if (shortcut && shortcut.href && shortcut.name) {
                console.log(`Shortcut ${index + 1}:`, shortcut);

                const shortcutContainer = document.createElement('div');
                shortcutContainer.classList.add('shortcut-container');
                shortcutContainer.id = `shortcutContainer${index}`;

                const newShortcut = document.createElement('div');
                newShortcut.dataset.href = shortcut.href;
                newShortcut.dataset.shortcutName = shortcut.name;
                newShortcut.dataset.shortcutIndex = index;
                newShortcut.id = `shortcut${index}`;
                newShortcut.classList.add('shortcut-circle');
                newShortcut.draggable = true;

                const shortcutIcon = document.createElement('img');
                shortcutIcon.id = `shortcutIcon${index}`;
                shortcutIcon.classList.add('shortcut-icon');
                shortcutIcon.draggable = false;
                shortcutIcon.src = shortcut.image || '../assets/unknown_icon.svg';
                shortcutIcon.alt = shortcut.name;
                shortcutIcon.onerror = () => {
                    shortcutIcon.src = '../assets/unknown_icon.svg';
                };

                newShortcut.appendChild(shortcutIcon);
                shortcutContainer.appendChild(newShortcut);

                const shortcutName = document.createElement('p');
                shortcutName.id = `shortcutName${index}`;
                shortcutName.classList.add('shortcut-title');
                shortcutName.textContent = shortcut.name;
                shortcutContainer.appendChild(shortcutName);

                gallery.appendChild(shortcutContainer);

                const containerWidthForText = shortcutContainer.clientWidth - 10;
                adjustFontSizeToFit(shortcutName, containerWidthForText, 14, 8, 0.5);
            }
        });
        makeShortcutsDynamic();
    } catch (error) {
        console.error('Error initializing shortcuts:', error);
    }
}

async function deleteShortcut(shortcutName, shortcutIndex) {
    const deleteConfirmation = confirm(`Are you sure you want to remove '${shortcutName}'?`);
    if (!deleteConfirmation) return;

    try {
        const data = await storageMode.get('shortcuts');
        const shortcuts = data.shortcuts || [];

        const indexToDelete = parseInt(shortcutIndex, 10);

        if (indexToDelete > -1 && indexToDelete < shortcuts.length) {
            shortcuts.splice(indexToDelete, 1);

            console.log('Updated shortcuts list:', shortcuts);
            await storageMode.set({'shortcuts': shortcuts});

            await initializeShortcuts();
        } else {
            console.warn(`Attempted to delete shortcut at invalid index: ${indexToDelete}. Array length: ${shortcuts.length}`);
        }
    } catch (error) {
        console.error('Error deleting shortcut:', error);
    }
}

function makeShortcutsDynamic() {
    const shortcutsArea = document.getElementById('shortcuts-area');
    const gallery = document.getElementById('shortcut-gallery');
    const shortcuts = document.querySelectorAll('.shortcut-circle');
    const actionButtons = document.querySelectorAll('.action-button');
    const actionIcons = document.querySelectorAll('.action-icon');

    let isDragging = false;

    if (shortcuts.length === 0) {
        console.log('No shortcut elements (.shortcut-circle) found.');
        return;
    }

    buttonRippleEffect();

    shortcuts.forEach((shortcut, index) => {
        shortcut.setAttribute('draggable', 'true');

        const clickHandler = () => {
            console.log('Shortcut clicked.');
            const shortcutURL = shortcut.dataset.href;
            if (!shortcutURL) {
                console.log('No shortcut URL found (data-href attribute missing).');
                return;
            }
            console.log(`Opening URL for Shortcut ${index + 1} (${shortcut.id || 'No ID'}):`, shortcutURL);
            try {
                if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.update) {
                    chrome.tabs.update({url: shortcutURL});
                } else {
                    console.warn('chrome.tabs.update is not available.');
                    window.open(shortcutURL, '_blank');
                }
            } catch (error) {
                console.error('Error in updating tab:', error);
            }
        };
        addTrackedEventListener(shortcut, 'click', clickHandler);

        const dragStartHandler = (e) => {
            console.log(`Shortcut with ID '${e.target.id}' started dragging.`);
            isDragging = true;
            e.dataTransfer.setData('text/plain', e.target.id);
            const shortcutNameFromData = e.target.dataset.shortcutName;
            const shortcutIndexFromData = e.target.dataset.shortcutIndex;
            const shortcutURLFromData = e.target.dataset.href;
            if (shortcutNameFromData) {
                e.dataTransfer.setData('text/shortcut-name', shortcutNameFromData);
            }
            if (shortcutIndexFromData) {
                e.dataTransfer.setData('text/shortcut-index', shortcutIndexFromData);
            }
            if (shortcutURLFromData) {
                e.dataTransfer.setData('text/shortcut-url', shortcutURLFromData);
            }
            e.dataTransfer.effectAllowed = 'move';

            if (shortcutsArea) {
                shortcutsArea.classList.add('dragging');
            }
            if (gallery) {
                gallery.style.border = '2px solid var(--primary-color)';
            }
            e.target.classList.add('dragging-source');
            setTimeout(() => {
                e.target.style.visibility = 'hidden';
            }, 0);
        };
        addTrackedEventListener(shortcut, 'dragstart', dragStartHandler);

        const dragEndHandler = (e) => {
            console.log(`Shortcut with ID '${e.target.id}' drag ended.`);
            isDragging = false;
            
            e.target.classList.remove('dragging-source');
            e.target.classList.add('returning');
            e.target.style.visibility = '';
            
            setTimeout(() => {
                e.target.classList.remove('returning');
            }, 500);

            actionButtons.forEach((button, btnIndex) => {
                button.classList.remove('dragover');
                if (actionIcons[btnIndex]) { 
                    actionIcons[btnIndex].style.color = 'var(--primary-color)';
                }
            });

            if (shortcutsArea) {
                shortcutsArea.classList.remove('dragging');
            }
            if (gallery) {
                gallery.style.borderColor = 'transparent';
            }
        };
        addTrackedEventListener(shortcut, 'dragend', dragEndHandler);
    });

    actionButtons.forEach((actionButton, index) => {
        const actionButtonId = actionButton.id;
        
        const dragEnterHandler = (e) => {
            e.preventDefault();
            if (isDragging) {
                console.log('Drag entered action button.');
                actionButton.classList.add('dragover');
                actionIcons[index].style.color = '#ffffff';
            }
        };
        addTrackedEventListener(actionButton, 'dragenter', dragEnterHandler);

        const dragOverHandler = (e) => {
            e.preventDefault();
            if (isDragging) {
                if (!actionButton.classList.contains('dragover')) {
                    actionButton.classList.add('dragover');
                    actionIcons[index].style.color = '#ffffff';
                }
            }
        };
        addTrackedEventListener(actionButton, 'dragover', dragOverHandler);

        const dragLeaveHandler = (e) => {
            if (!actionButton.contains(e.relatedTarget) && e.relatedTarget !== actionButton) {
                console.log('Drag left action button.');
                actionButton.classList.remove('dragover');
                actionIcons[index].style.color = 'var(--primary-color)';
            }
        };
        addTrackedEventListener(actionButton, 'dragleave', dragLeaveHandler);

        const dropHandler = (e) => {
            e.preventDefault();
            console.log('Item dropped on action button.');

            actionButton.classList.remove('dragover');
            actionIcons[index].style.color = 'var(--primary-color)';

            const draggedShortcutId = e.dataTransfer.getData('text/plain');
            const draggedShortcutName = e.dataTransfer.getData('text/shortcut-name');
            const draggedShortcutIndex = e.dataTransfer.getData('text/shortcut-index');
            const draggedShortcutURL = e.dataTransfer.getData('text/shortcut-url');

            if (draggedShortcutId) {
                console.log(`Dragged Shortcut ID: '${draggedShortcutId}'`);
                if (draggedShortcutName) {
                    console.log(`Dragged Shortcut Name: '${draggedShortcutName}'`);
                } else {
                    console.warn('Shortcut does not have a "data-shortcut-name" attribute.');
                }
                if (draggedShortcutIndex) {
                    console.log(`Dragged Shortcut Index: '${draggedShortcutIndex}'`);
                }

                const droppedShortcutElement = document.getElementById(draggedShortcutId);

                if (droppedShortcutElement) {
                    console.log('Actual dropped shortcut element:', droppedShortcutElement);
                    
                    const actionType = actionButton.dataset.action || `action-button-${index}`;
                    console.log(`Action "${actionType}" triggered for shortcut '${draggedShortcutId}'`);
                    if (draggedShortcutId && draggedShortcutName && droppedShortcutElement) {
                        if (actionButtonId === 'delete-shortcut') {
                            deleteShortcut(draggedShortcutName, draggedShortcutIndex);
                        }
                        if (actionButtonId === 'edit-shortcut') {
                            editShortcut(draggedShortcutName, draggedShortcutURL, draggedShortcutIndex, draggedShortcutId);
                        }
                    }
                } else {
                    console.error(`Error: Dropped shortcut element with ID '${draggedShortcutId}' not found.`);
                }
            } else {
                console.warn('No shortcut ID was transferred with the drag data.');
            }
        };
        addTrackedEventListener(actionButton, 'drop', dropHandler);
    });
}

function getFaviconUrl(siteUrl, size = 100) {
    const url = new URL(chrome.runtime.getURL("/_favicon/"));
    url.searchParams.set("pageUrl", siteUrl);
    url.searchParams.set("size", size.toString());
    console.log(url.toString());
    return url.toString();
}

async function previewUploadedImage() {
    const fileInput = document.getElementById('shortcut-icon-input');
    const shortcutURLInput = document.getElementById('shortcut-url');
    const filePreview = document.getElementById('icon-preview');
    const shortcutNameInput = document.getElementById('shortcut-name');
    const titlePreview = document.getElementById('shortcut-title-preview');
    let hasCustomIcon = false;

    checkIconOnload();

    async function checkIconOnload() {
        const inputtedURL = shortcutURLInput.value;
        const defaultFaviconURLAttempt = getFaviconUrl(inputtedURL);
        try {
            const response = await fetch(defaultFaviconURLAttempt);
            if (response.ok) {
                const blob = await response.blob();
                const iconToPreview = await convertBlobToBase64(blob);
                filePreview.src = iconToPreview;
                filePreview.style.display = 'block';
            } else {
                console.warn('Error in response fetching.');
            }
        } catch (error) {
            console.warn('Error in fetching favicon URL:', error);
        }
        const inputtedName = shortcutNameInput.value;
        titlePreview.textContent = inputtedName;
    }
    
    fileInput.addEventListener('change', (event) => {
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];
            if (file.type.startsWith('image/')) {
                hasCustomIcon = true;
                const reader = new FileReader();
                reader.onload = function(e) {
                    filePreview.src = e.target.result;
                    filePreview.style.display = 'block';
                }
                reader.readAsDataURL(file);
            } else {
                console.warn('File is not an image!');
            }
        } else {
            hasCustomIcon = false;
            console.warn('No files uploaded!');
        }
    });
    
    shortcutURLInput.addEventListener('input', async(event) => {
        if (hasCustomIcon) return;
        
        const inputtedURL = shortcutURLInput.value;
        const defaultFaviconURLAttempt = getFaviconUrl(inputtedURL);
        try {
            const response = await fetch(defaultFaviconURLAttempt);
            if (response.ok) {
                const blob = await response.blob();
                const iconToPreview = await convertBlobToBase64(blob);
                filePreview.src = iconToPreview;
                filePreview.style.display = 'block';
            } else {
                console.warn('Error in response fetching.');
            }
        } catch (error) {
            console.warn('Error in fetching favicon URL:', error);
        }
    });

    shortcutNameInput.addEventListener('input', (event) => {
        const inputtedName = shortcutNameInput.value;
        titlePreview.textContent = inputtedName;
    });
}

async function editShortcut(shortcutToEditName, shortcutToEditURL, shortcutIndex, shortcutToEditID) {
    const addShortcutContainer = document.getElementById('add-shortcut-container');
    const shortcutToEditElement = document.getElementById(shortcutToEditID);
    const shortcutToEditIcon = document.getElementById(`shortcutIcon${shortcutIndex}`);
    const shortcutToEditNameElement = document.getElementById(`shortcutName${shortcutIndex}`);

    if (document.querySelectorAll('.add-shortcut-panel').length === 0) {
        const handleClickOutside = (event) => {
            if (currentShortcutPanel &&
                !currentShortcutPanel.contains(event.target)) {
                currentShortcutPanel.classList.add('fade-out');

                currentShortcutPanel.addEventListener('transitionend', function handler(e) {
                    if (e.propertyName === 'opacity' || e.propertyName === 'transform') {
                        if (currentShortcutPanel && currentShortcutPanel.parentNode) {
                            currentShortcutPanel.parentNode.removeChild(currentShortcutPanel);
                        }
                        currentShortcutPanel = null;
                        document.removeEventListener('click', handleClickOutside);
                        e.currentTarget.removeEventListener('transitionend', handler);
                    }
                });
            }
        };

        if (currentShortcutPanel) {
            return;
        }
        const addShortcutPanel = document.createElement('div');
        addShortcutPanel.id = "add-shortcut-panel";
        addShortcutPanel.classList.add('add-shortcut-panel');
        addShortcutPanel.innerHTML = `
            <h2>Edit Shortcut</h2>
            <div class="shortcut-container-preview">
                <div class="shortcut-circle-preview">
                    <img src="../assets/unknown_icon.svg" id="icon-preview" class="shortcut-icon">
                </div>
                <p class="shortcut-title" id="shortcut-title-preview">New Shortcut</p>
            </div>
            <form id="add-shortcut-form">
                <label for="shortcut-name">Shortcut Name</label>
                <input type="text" id="shortcut-name" value="${shortcutToEditName}" placeholder="New Shortcut" name="shortcut-name" class="shortcut-input" autocomplete="off" required autofocus>
                <label for="shortcut-url">Shortcut URL</label>
                <input type="url" id="shortcut-url" value="${shortcutToEditURL}" placeholder="https://www.google.com" name="shortcut-url" class="shortcut-input" autocomplete="off" required>
                <label for="shortcut-icon-input">Custom Icon</label>
                <input type="file" accept=".png, .jpg, .jpeg, .svg, .webp" id="shortcut-icon-input" name="shortcut-icon-input" class="shortcut-input">
                <button type="submit" id="submit-shortcut-btn" class="button-style"><span class="material-symbols-outlined">check</span></button>
            </form>
        `;
        addShortcutContainer.appendChild(addShortcutPanel);
        previewUploadedImage();
        currentShortcutPanel = addShortcutPanel;

        const shortcutForm = document.getElementById('add-shortcut-form');
        shortcutForm.addEventListener('submit', async(event) => {
            event.preventDefault();
            const formData = new FormData(shortcutForm);

            const shortcutName = formData.get('shortcut-name');
            const shortcutURL = formData.get('shortcut-url');
            const fileInput = formData.get('shortcut-icon-input');

            shortcutToEditElement.dataset.shortcutName = shortcutName;
            shortcutToEditElement.dataset.href = shortcutURL;
            shortcutToEditNameElement.textContent = shortcutName;

            let newShortcut;
            let iconToSave = null;

            if (fileInput && fileInput.size > 0) {
                try {
                    iconToSave = await convertImageToString(fileInput);

                } catch (error) {
                    console.error("Error converting custom image to Base64:", error);
                    iconToSave = null;
                }
            }

            if (!iconToSave) {
                const defaultFaviconUrlAttempt = getFaviconUrl(shortcutURL);
                try {
                    const response = await fetch(defaultFaviconUrlAttempt);
                    if (response.ok) {
                        const blob = await response.blob();
                        iconToSave = await convertBlobToBase64(blob);
                    } else {
                        console.warn(`Could not fetch favicon for ${shortcutURL}. Status: ${response.status}`);
                    }
                } catch (error) {
                    console.error(`Error fetching or converting default favicon for ${shortcutURL}:`, error);
                }
            }

            if (iconToSave) {
                shortcutToEditIcon.src = iconToSave;
                newShortcut = {'name': shortcutName, 'href': shortcutURL, 'image': iconToSave};
            } else {
                shortcutToEditIcon.src = null;
                newShortcut = {'name': shortcutName, 'href': shortcutURL};
            }

            await saveAndCloseShortcutPanel(newShortcut, shortcutIndex);
        });

        async function saveAndCloseShortcutPanel(shortcut, indexToUpdate) {
            try {
                const result = await storageMode.get('shortcuts');
                const currentShortcuts = Array.isArray(result.shortcuts) ? result.shortcuts : [];
                
                if (indexToUpdate !== undefined && indexToUpdate > -1 && indexToUpdate < currentShortcuts.length) {
                    currentShortcuts[indexToUpdate] = shortcut;
                } else {
                    currentShortcuts.push(shortcut);
                }

                await storageMode.set({'shortcuts': currentShortcuts});

                if (currentShortcutPanel) {
                    currentShortcutPanel.classList.add('fade-out');
                    currentShortcutPanel.addEventListener('transitionend', function handler(e) {
                        if (e.propertyName === 'opacity' || e.propertyName === 'transform') {
                            if (currentShortcutPanel && currentShortcutPanel.parentNode) {
                                currentShortcutPanel.parentNode.removeChild(currentShortcutPanel);
                            }
                            currentShortcutPanel = null;
                            document.removeEventListener('click', handleClickOutside);
                            e.currentTarget.removeEventListener('transitionend', handler);
                        }
                    });
                }
            } catch (error) {
                console.error("Error saving shortcut:", error);
            }
        }

        setTimeout(() => {
            addShortcutPanel.classList.add('fade-in');
        }, 10);

        setTimeout(() => {
            document.addEventListener('click', handleClickOutside);
        }, 0);
    }
}

async function createShortcut() {
    const addButton = document.getElementById('create-shortcut');
    const addShortcutContainer = document.getElementById('add-shortcut-container');

    const handleClickOutside = (event) => {
        if (currentShortcutPanel &&
            !currentShortcutPanel.contains(event.target) &&
            !addButton.contains(event.target)) {
            currentShortcutPanel.classList.add('fade-out');

            currentShortcutPanel.addEventListener('transitionend', function handler(e) {
                if (e.propertyName === 'opacity' || e.propertyName === 'transform') {
                    if (currentShortcutPanel && currentShortcutPanel.parentNode) {
                        currentShortcutPanel.parentNode.removeChild(currentShortcutPanel);
                    }
                    currentShortcutPanel = null;
                    document.removeEventListener('click', handleClickOutside);
                    e.currentTarget.removeEventListener('transitionend', handler);
                }
            });
        }
    };

    addButton.addEventListener('click', (event) => {
        if (currentShortcutPanel) {
            return;
        }
        const addShortcutPanel = document.createElement('div');
        addShortcutPanel.id = "add-shortcut-panel";
        addShortcutPanel.classList.add('add-shortcut-panel');
        addShortcutPanel.innerHTML = `
            <h2>Add Shortcut</h2>
            <div class="shortcut-container-preview">
                <div class="shortcut-circle-preview">
                    <img src="../assets/unknown_icon.svg" id="icon-preview" class="shortcut-icon">
                </div>
                <p class="shortcut-title" id="shortcut-title-preview">New Shortcut</p>
            </div>
            <form id="add-shortcut-form">
                <label for="shortcut-name">Shortcut Name</label>
                <input type="text" id="shortcut-name" placeholder="New Shortcut" name="shortcut-name" class="shortcut-input" autocomplete="off" required autofocus>
                <label for="shortcut-url">Shortcut URL</label>
                <input type="url" id="shortcut-url" value="https://" placeholder="https://www.google.com" name="shortcut-url" class="shortcut-input" autocomplete="off" required>
                <label for="shortcut-icon-input">Custom Icon</label>
                <input type="file" accept=".png, .jpg, .jpeg, .svg, .webp" id="shortcut-icon-input" name="shortcut-icon-input" class="shortcut-input">
                <button type="submit" id="submit-shortcut-btn" class="button-style"><span class="material-symbols-outlined">check</span></button>
            </form>
        `;
        addShortcutContainer.appendChild(addShortcutPanel);
        previewUploadedImage();
        currentShortcutPanel = addShortcutPanel;

        const shortcutForm = document.getElementById('add-shortcut-form');
        shortcutForm.addEventListener('submit', async(event) => {
            event.preventDefault();
            const formData = new FormData(shortcutForm);

            const shortcutName = formData.get('shortcut-name');
            const shortcutURL = formData.get('shortcut-url');
            const fileInput = formData.get('shortcut-icon-input');

            let newShortcut;
            let iconToSave = null;

            if (fileInput && fileInput.size > 0) {
                try {
                    iconToSave = await convertImageToString(fileInput);
                } catch (error) {
                    console.error("Error converting custom image to Base64:", error);
                    iconToSave = null;
                }
            }

            if (!iconToSave) {
                const defaultFaviconUrlAttempt = getFaviconUrl(shortcutURL);
                try {
                    const response = await fetch(defaultFaviconUrlAttempt);
                    if (response.ok) {
                        const blob = await response.blob();
                        iconToSave = await convertBlobToBase64(blob);
                    } else {
                        console.warn(`Could not fetch favicon for ${shortcutURL}. Status: ${response.status}`);
                    }
                } catch (error) {
                    console.error(`Error fetching or converting default favicon for ${shortcutURL}:`, error);
                }
            }

            if (iconToSave) {
                newShortcut = {'name': shortcutName, 'href': shortcutURL, 'image': iconToSave};
            } else {
                newShortcut = {'name': shortcutName, 'href': shortcutURL};
            }

            await saveAndCloseShortcutPanel(newShortcut);
        });

        async function saveAndCloseShortcutPanel(shortcut) {
            try {
                const result = await storageMode.get('shortcuts');
                const currentShortcuts = Array.isArray(result.shortcuts) ? result.shortcuts : [];
                currentShortcuts.push(shortcut);
                await storageMode.set({'shortcuts': currentShortcuts});

                if (currentShortcutPanel) {
                    currentShortcutPanel.classList.add('fade-out');
                    currentShortcutPanel.addEventListener('transitionend', function handler(e) {
                        if (e.propertyName === 'opacity' || e.propertyName === 'transform') {
                            if (currentShortcutPanel && currentShortcutPanel.parentNode) {
                                currentShortcutPanel.parentNode.removeChild(currentShortcutPanel);
                            }
                            currentShortcutPanel = null;
                            document.removeEventListener('click', handleClickOutside);
                            e.currentTarget.removeEventListener('transitionend', handler);
                        }
                    });
                }
                initializeShortcuts();
            } catch (error) {
                console.error("Error saving shortcut:", error);
            }
        }

        setTimeout(() => {
            addShortcutPanel.classList.add('fade-in');
        }, 10);

        setTimeout(() => {
            document.addEventListener('click', handleClickOutside);
        }, 0);
    });
}

async function convertBlobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function convertImageToString(file) {
    return new Promise((resolve, reject) => {
        if (!file instanceof File || file.size === 0) {
            reject(new Error("Invalid or empty file provided."));
            return;
        }

        const reader = new FileReader();

        reader.onload = () => {
            resolve(reader.result);
        };

        reader.onerror = (error) => {
            reject(error);
        };

        reader.readAsDataURL(file);
    });
}

class Widget {
    constructor(options = {}) {
        this.id = options.id || `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.content = options.content || '';
        this.cssClass = options.cssClass || 'widget-container';
        this.draggable = options.draggable !== undefined ? options.draggable : true;
        this.updateInterval = options.updateInterval || null;
        this.intervalId = null;
        this.element = null;
        this.parentContainer = null;
        this.dragEventListeners = [];
    }

    createElement() {
        const widgetElement = document.createElement('div');
        widgetElement.id = this.id;
        widgetElement.classList.add(this.cssClass);
        widgetElement.style.overflow = 'hidden';
        widgetElement.draggable = this.draggable;
        widgetElement.innerHTML = this.content;
        
        this.element = widgetElement;
        return widgetElement;
    }

    render(parentContainer) {
        if (!parentContainer) {
            console.error('Parent container is required to render widget');
            return;
        }

        this.parentContainer = parentContainer;
        const widgetElement = this.createElement();
        parentContainer.appendChild(widgetElement);

        // Register this widget instance globally
        widgetInstances.set(this.id, this);

        if (this.updateInterval && typeof this.update === 'function') {
            this.startUpdateInterval();
        }

        if (this.draggable) {
            this.setupDragAndDrop();
        }

        this.onRender();
        return this;
    }

    addTrackedDragEventListener(element, event, handler) {
        element.addEventListener(event, handler);
        this.dragEventListeners.push({ element, event, handler });
    }

    cleanupDragEventListeners() {
        this.dragEventListeners.forEach(({ element, event, handler }) => {
            if (element && element.removeEventListener) {
                element.removeEventListener(event, handler);
            }
        });
        this.dragEventListeners = [];
    }

    setupDragAndDrop() {
        if (!this.element) return;

        const widget = this.element;

        const clickHandler = (e) => {
            // Prevent click during drag
            if (isWidgetDragging) {
                e.preventDefault();
                return;
            }
            console.log(`Widget ${this.id} clicked.`);
            this.onClick();
        };
        this.addTrackedDragEventListener(widget, 'click', clickHandler);

        const dragStartHandler = (e) => {
            console.log(`Widget ${this.id} started dragging.`);
            isWidgetDragging = true;
            e.dataTransfer.setData('text/plain', this.id);
            e.dataTransfer.setData('text/widget-id', this.id);
            e.dataTransfer.setData('text/widget-type', this.constructor.name);
            e.dataTransfer.effectAllowed = 'move';

            // Similar to shortcuts - add dragging class to area
            const shortcutsArea = document.getElementById('shortcuts-area');
            const gallery = document.getElementById('shortcut-gallery');
            if (shortcutsArea) {
                shortcutsArea.classList.add('dragging');
            }
            if (gallery) {
                gallery.style.border = '2px solid var(--primary-color)';
            }

            widget.classList.add('dragging-source');
            setTimeout(() => {
                widget.style.visibility = 'hidden';
            }, 0);

            this.onDragStart(e);
        };
        this.addTrackedDragEventListener(widget, 'dragstart', dragStartHandler);

        const dragEndHandler = (e) => {
            console.log(`Widget ${this.id} drag ended.`);
            isWidgetDragging = false;
            
            widget.classList.remove('dragging-source');
            widget.classList.add('returning');
            widget.style.visibility = '';
            
            setTimeout(() => {
                widget.classList.remove('returning');
            }, 500);

            const shortcutsArea = document.getElementById('shortcuts-area');
            const gallery = document.getElementById('shortcut-gallery');
            if (shortcutsArea) {
                shortcutsArea.classList.remove('dragging');
            }
            if (gallery) {
                gallery.style.borderColor = 'transparent';
            }

            // Clean up action button states
            const actionButtons = document.querySelectorAll('.action-button');
            const actionIcons = document.querySelectorAll('.action-icon');
            actionButtons.forEach((button, btnIndex) => {
                button.classList.remove('dragover');
                if (actionIcons[btnIndex]) { 
                    actionIcons[btnIndex].style.color = 'var(--primary-color)';
                }
            });

            this.onDragEnd(e);
        };
        this.addTrackedDragEventListener(widget, 'dragend', dragEndHandler);
    }

    // Static method to set up action buttons for all widgets
    static setupActionButtons() {
        console.log('Setup action buttons called!');
        const actionButtons = document.querySelectorAll('.action-button');
        const actionIcons = document.querySelectorAll('.action-icon');

        actionButtons.forEach((actionButton, index) => {
            const actionButtonId = actionButton.id;
            console.log('Action button ID:', actionButtonId);
            
            // Clean up existing widget-related listeners
            if (actionButton._widgetDragEnter) {
                actionButton.removeEventListener('dragenter', actionButton._widgetDragEnter);
            }
            if (actionButton._widgetDragOver) {
                actionButton.removeEventListener('dragover', actionButton._widgetDragOver);
            }
            if (actionButton._widgetDragLeave) {
                actionButton.removeEventListener('dragleave', actionButton._widgetDragLeave);
            }
            if (actionButton._widgetDrop) {
                actionButton.removeEventListener('drop', actionButton._widgetDrop);
            }
            
            const dragEnterHandler = (e) => {
                e.preventDefault();
                // Check if we're dragging a widget using the global flag
                if (isWidgetDragging) {
                    console.log('Widget drag entered action button.');
                    actionButton.classList.add('dragover');
                    if (actionIcons[index]) {
                        actionIcons[index].style.color = '#ffffff';
                    }
                }
            };
            actionButton._widgetDragEnter = dragEnterHandler;
            actionButton.addEventListener('dragenter', dragEnterHandler);

            const dragOverHandler = (e) => {
                e.preventDefault();
                // Check if we're dragging a widget using the global flag
                if (isWidgetDragging && !actionButton.classList.contains('dragover')) {
                    actionButton.classList.add('dragover');
                    if (actionIcons[index]) {
                        actionIcons[index].style.color = '#ffffff';
                    }
                }
            };
            actionButton._widgetDragOver = dragOverHandler;
            actionButton.addEventListener('dragover', dragOverHandler);

            const dragLeaveHandler = (e) => {
                if (isWidgetDragging && !actionButton.contains(e.relatedTarget) && e.relatedTarget !== actionButton) {
                    console.log('Widget drag left action button.');
                    actionButton.classList.remove('dragover');
                    if (actionIcons[index]) {
                        actionIcons[index].style.color = 'var(--primary-color)';
                    }
                }
            };
            actionButton._widgetDragLeave = dragLeaveHandler;
            actionButton.addEventListener('dragleave', dragLeaveHandler);

            const dropHandler = (e) => {
                e.preventDefault();
                if (!isWidgetDragging) return;
                
                console.log('Widget dropped on action button.');

                actionButton.classList.remove('dragover');
                if (actionIcons[index]) {
                    actionIcons[index].style.color = 'var(--primary-color)';
                }

                const draggedWidgetId = e.dataTransfer.getData('text/widget-id');
                const draggedWidgetType = e.dataTransfer.getData('text/widget-type');

                if (draggedWidgetId) {
                    console.log(`Dragged Widget ID: '${draggedWidgetId}'`);
                    console.log(`Dragged Widget Type: '${draggedWidgetType}'`);

                    const droppedWidgetElement = document.getElementById(draggedWidgetId);
                    const widgetInstance = widgetInstances.get(draggedWidgetId);

                    if (droppedWidgetElement && widgetInstance) {
                        console.log('Actual dropped widget element:', droppedWidgetElement);
                        
                        const actionType = actionButton.dataset.action || `action-button-${index}`;
                        console.log(`Action "${actionType}" triggered for widget '${draggedWidgetId}'`);
                        
                        // Handle different action types
                        if (actionButtonId === 'delete-widget' || actionButtonId === 'delete-shortcut') {
                            widgetInstance.deleteWidget(draggedWidgetId);
                        }
                        else if (actionButtonId === 'edit-widget' || actionButtonId === 'edit-shortcut') {
                            widgetInstance.editWidget(draggedWidgetId);
                        }
                        
                        widgetInstance.onActionButtonDrop(actionButtonId, draggedWidgetId, draggedWidgetType);
                    } else {
                        console.error(`Error: Dropped widget element with ID '${draggedWidgetId}' not found.`);
                    }
                } else {
                    console.warn('No widget ID was transferred with the drag data.');
                }
            };
            actionButton._widgetDrop = dropHandler;
            actionButton.addEventListener('drop', dropHandler);
        });
    }

    deleteWidget(widgetId) {
        const widgetElement = document.getElementById(widgetId);
        if (widgetElement) {
            const confirmDelete = confirm(`Are you sure you want to delete this widget?`);
            if (confirmDelete) {
                this.destroy();
                console.log(`Widget ${widgetId} deleted.`);
            }
        }
    }

    editWidget(widgetId) {
        const editWidgetContainer = document.getElementById('add-widget-container');
        const editWidgetPanel = document.createElement('div');
        editWidgetPanel.classList.add('add-widget-panel');
        editWidgetContainer.appendChild(editWidgetPanel);
    }

    onClick() {
        console.log(`Widget ${this.id} clicked - Override this method in subclass`);
    }

    onDragStart(e) {
        // Override in subclass
    }

    onDragEnd(e) {
        // Override in subclass
    }

    onActionButtonDrop(actionId, widgetId, widgetType) {
        console.log(`Action ${actionId} performed on widget ${widgetId} - Override this method in subclass`);
    }

    startUpdateInterval() {
        if (this.updateInterval) {
            this.intervalId = setInterval(() => {
                this.update();
            }, this.updateInterval);
        }
    }

    stopUpdateInterval() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    update() {
        // Override in subclass
    }

    onRender() {
        // Override in subclass
    }

    destroy() {
        this.stopUpdateInterval();
        this.cleanupDragEventListeners();
        
        // Remove from global registry
        widgetInstances.delete(this.id);
        
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
        this.parentContainer = null;
    }

    setContent(newContent) {
        this.content = newContent;
        if (this.element) {
            this.element.innerHTML = newContent;
        }
    }

    addClass(className) {
        if (this.element) {
            this.element.classList.add(className);
        }
    }

    removeClass(className) {
        if (this.element) {
            this.element.classList.remove(className);
        }
    }
}

class TimeWidget extends Widget {
    constructor(options = {}) {
        const defaultOptions = {
            cssClass: 'time-container',
            updateInterval: 500,
            timeFormat: options.timeFormat || '24hour',
            showSeconds: options.showSeconds || false,
            ...options
        };

        defaultOptions.content = TimeWidget.generateTimeHTML(
            defaultOptions.timeFormat, 
            defaultOptions.showSeconds
        );

        super(defaultOptions);
        this.timeFormat = defaultOptions.timeFormat;
        this.showSeconds = defaultOptions.showSeconds;
    }

    static generateTimeHTML(timeFormat = '24hour', showSeconds = false) {
        const time = TimeWidget.getCurrentTime(timeFormat, showSeconds);
        return `<h1 id="current-time-text">${time}</h1>`;
    }

    static getCurrentTime(timeFormat = '24hour', showSeconds = false) {
        const currentDate = new Date();
        let currentHour = currentDate.getHours();
        const currentMinute = currentDate.getMinutes();
        const currentSecond = currentDate.getSeconds();

        if (timeFormat === '12hour' && currentHour > 12) {
            currentHour = currentHour % 12;
        }
        if (timeFormat === '12hour' && currentHour === 0) {
            currentHour = 12;
        }

        let timeString = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
        
        if (showSeconds) {
            timeString += `:${currentSecond.toString().padStart(2, '0')}`;
        }

        if (timeFormat === '12hour') {
            const ampm = currentDate.getHours() >= 12 ? 'PM' : 'AM';
            timeString += ` ${ampm}`;
        }

        return timeString;
    }

    update() {
        const timeElement = this.element?.querySelector('#current-time-text');
        if (timeElement) {
            timeElement.textContent = TimeWidget.getCurrentTime(this.timeFormat, this.showSeconds);
        }
    }

    setTimeFormat(format) {
        this.timeFormat = format;
        this.update();
    }

    toggleSeconds() {
        this.showSeconds = !this.showSeconds;
        this.update();
    }

    onClick() {
        console.log(`Time widget ${this.id} clicked - toggling seconds`);
        this.toggleSeconds();
    }

    editWidget(widgetId) {
        const addWidgetContainer = document.getElementById('add-widget-container');
        let temporaryOptions = {'format': this.timeFormat || '24hour', 'seconds': this.showSeconds || false};
        let currentTime;

        if (twelvehclock === true) {
            currentTime = TimeWidget.getCurrentTime('12hour', temporaryOptions['seconds']);
            temporaryOptions['format'] = '12hour';
        } else {
            currentTime = TimeWidget.getCurrentTime('24hour', temporaryOptions['seconds']);
            temporaryOptions['format'] = '24hour';
        }
        
        if (document.querySelectorAll('.add-widget-panel').length === 0) {
            const handleClickOutside = (event) => {
                if (currentWidgetPanel &&
                    !currentWidgetPanel.contains(event.target)) {
                    currentWidgetPanel.classList.add('fade-out');

                    currentWidgetPanel.addEventListener('transitionend', function handler(e) {
                        if (e.propertyName === 'opacity' || e.propertyName === 'transform') {
                            if (currentWidgetPanel && currentWidgetPanel.parentNode) {
                                currentWidgetPanel.parentNode.removeChild(currentWidgetPanel);
                            }
                            currentWidgetPanel = null;
                            document.removeEventListener('click', handleClickOutside);
                            e.currentTarget.removeEventListener('transitionend', handler);
                        }
                    });
                }
            };

            if (currentWidgetPanel) {
                return;
            }
            
            const editWidgetPanel = document.createElement('div');
            editWidgetPanel.id = "edit-widget-panel";
            editWidgetPanel.classList.add('add-widget-panel'); // Uses shared panel styles
            editWidgetPanel.innerHTML = `
                <h2>Edit Widget</h2>
                <div class="widget-container-preview">
                    <div class="time-container-preview">
                        <h1 id="current-time-text-preview">${currentTime}</h1>
                    </div>
                </div>
                <form id="edit-widget-form">
                    <label for="widget-format">Time Format</label>
                    <select id="widget-format" name="widget-format" class="widget-input">
                        <option value="12hour" ${this.timeFormat === '12hour' ? 'selected' : ''}>12 Hour</option>
                        <option value="24hour" ${this.timeFormat === '24hour' ? 'selected' : ''}>24 Hour</option>
                    </select>
                    <div class="label-checkbox-group">
                        <label for="widget-seconds">Show Seconds</label>
                        <input type="checkbox" id="widget-seconds" name="widget-seconds" class="widget-input" ${this.showSeconds ? 'checked' : ''}>
                    </div>
                    <button type="submit" id="submit-widget-btn" class="button-style">
                        <span class="material-symbols-outlined">check</span>
                    </button>
                </form>
            `;
            addWidgetContainer.appendChild(editWidgetPanel);
            currentWidgetPanel = editWidgetPanel;

            const widgetFormatForm = document.getElementById('widget-format');
            widgetFormatForm.addEventListener('change', () => {
                const changedWidgetFormat = widgetFormatForm.value;
                const currentTimeText = document.getElementById('current-time-text-preview');
                if (changedWidgetFormat === '12hour') {
                    currentTime = TimeWidget.getCurrentTime('12hour', temporaryOptions['seconds']);
                    temporaryOptions['format'] = '12hour';
                } else {
                    currentTime = TimeWidget.getCurrentTime('24hour', temporaryOptions['seconds']);
                    temporaryOptions['format'] = '24hour';
                }
                currentTimeText.textContent = `${currentTime}`;
            });

            const widgetSecondsForm = document.getElementById('widget-seconds');
            widgetSecondsForm.addEventListener('change', () => {
                const widgetSecondsState = widgetSecondsForm.checked;
                const currentTimeText = document.getElementById('current-time-text-preview');
                if (widgetSecondsState) {
                    currentTime = TimeWidget.getCurrentTime(temporaryOptions['format'], true);
                    temporaryOptions['seconds'] = true;
                } else {
                    currentTime = TimeWidget.getCurrentTime(temporaryOptions['format'], false);
                    temporaryOptions['seconds'] = false;
                }
                currentTimeText.textContent = `${currentTime}`;
            });

            const widgetForm = document.getElementById('edit-widget-form');
            widgetForm.addEventListener('submit', (event) => {
                event.preventDefault();
                const formData = new FormData(widgetForm);
                
                const newFormat = formData.get('widget-format');
                const showSeconds = formData.has('widget-seconds');
                
                this.setTimeFormat(newFormat);
                this.showSeconds = showSeconds;
                this.update();

                if (currentWidgetPanel) {
                    currentWidgetPanel.classList.add('fade-out');
                    currentWidgetPanel.addEventListener('transitionend', function handler(e) {
                        if (e.propertyName === 'opacity' || e.propertyName === 'transform') {
                            if (currentWidgetPanel && currentWidgetPanel.parentNode) {
                                currentWidgetPanel.parentNode.removeChild(currentWidgetPanel);
                            }
                            currentWidgetPanel = null;
                            document.removeEventListener('click', handleClickOutside);
                            e.currentTarget.removeEventListener('transitionend', handler);
                        }
                    });
                }
            });

            setTimeout(() => {
                editWidgetPanel.classList.add('fade-in');
            }, 10);

            setTimeout(() => {
                document.addEventListener('click', handleClickOutside);
            }, 0);
        }
    }
}

function createTimeWidget(parentContainer, options = {}) {
    const timeWidget = new TimeWidget({
        timeFormat: twelvehclock ? '12hour' : '24hour',
        showSeconds: false,
        draggable: true,
        ...options
    });

    return timeWidget.render(parentContainer);
}

function showDynamicTabBriefContent() {
    const container = document.getElementById('dynamic-content-container');
    if (container) {
        const timeWidget = createTimeWidget(container, {
            id: 'main-time-widget',
            timeFormat: twelvehclock ? '12hour' : '24hour'
        });
    }
    makeWidgetsDynamic();
}

function makeWidgetsDynamic() {
    // Set up action buttons for all widgets
    Widget.setupActionButtons();
    
    // Add ripple effects for widgets
    buttonRippleEffect();
    
    console.log(`Set up drag and drop for ${widgetInstances.size} widgets`);
}

async function initializePage() {
    await initializeShortcuts();
    createShortcut();
    showDynamicTabBriefContent();
}

document.addEventListener('DOMContentLoaded', initializePage);