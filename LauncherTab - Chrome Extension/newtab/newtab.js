// Import all global variables
import { storageMode } from "../global/globalVariables.js";

// Import quotes from quotes/quotes.js
import { quotes } from './quotes/quotes.js';
console.log('Test quote:', quotes[0]);

// Import alll the widgets
import { Widget } from './widgets/Widget.js';
import { TimeWidget } from './widgets/TimeWidget.js';
import { QuoteWidget } from './widgets/QuoteWidget.js';

// Import widget types
import { WIDGET_TYPES } from "./registry/WIDGET_TYPES.js";
import { widgetsTypesArray } from "./registry/widgetsTypesArray.js";

// Import widget instances
import { widgetInstances } from "./registry/widgetInstances.js";

// Widget functions
const widgetFunctions = {
    'DigitalClock': (container) => createTimeWidget(container),
    'Quote': (container) => createQuoteWidget(container)
};

let shortcutEventListeners = [];
let currentShortcutPanel = null;
let rearrangeTimeout = null;
let draggedShortcutData = null;
let isRearranging = false;
let rearrangeTarget = null;
let currentWidgetPanel = null;

function cleanupEventListeners() {
    shortcutEventListeners.forEach(({ element, event, handler }) => {
        if (element && element.removeEventListener) {
            element.removeEventListener(event, handler);
        }
    });
    shortcutEventListeners = [];
    resetRearrangementState();
    clearRearrangementTimeout();
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
    document.querySelectorAll('.widget-container, .time-container, .quote-container, .widget-carousel-image').forEach(button => {
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
        //widgetInstances.forEach(widget => widget.destroy());
        //widgetInstances.clear();
        
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
            initializeShortcutRearrangement();
            return;
        }

        const shortcutsToDisplay = allShortcuts.slice(0, 25);

        shortcutsToDisplay.forEach((shortcut, index) => {
            if (shortcut && shortcut.href && shortcut.name) {
                console.log(`Shortcut ${index + 1}:`, shortcut);

                const shortcutContainer = document.createElement('div');
                shortcutContainer.classList.add('shortcut-container');
                shortcutContainer.id = `shortcutContainer${index}`;

                const newShortcut = document.createElement('button');
                newShortcut.dataset.href = shortcut.href;
                newShortcut.dataset.shortcutName = shortcut.name;
                newShortcut.dataset.shortcutIndex = index;
                newShortcut.id = `shortcut${index}`;
                newShortcut.classList.add('shortcut-circle');
                newShortcut.draggable = true;
                newShortcut.dataset.hasCustomIcon = shortcut.hasCustomImage || false;

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
        initializeShortcutRearrangement();
    } catch (error) {
        console.error('Error initializing shortcuts:', error);
    }
}

async function loadAllWidgets(parentContainer, filterOptions = {}) {
    if (!parentContainer) {
        console.error('Parent container is required to load widgets');
        return;
    }

    try {
        const widgets = await Widget.loadWidgets(filterOptions);

        // Clear existing widgets from the container
        while (parentContainer.firstChild) {
            parentContainer.removeChild(parentContainer.firstChild);
        }

        // Destroy existing widget instances to prevent memory leaks
        widgetInstances.forEach(widget => {
            try {
                widget.destroy();
            } catch (error) {
                console.warn('Error destroying widget during reload:', error);
            }
        });
        widgetInstances.clear();

        // Create widgets from storage data using index as reference
        let successCount = 0;
        for (let i = 0; i < widgets.length; i++) {
            try {
                // Assign index-based id for DOM and reference
                const widgetOptions = { ...widgets[i], id: `${widgets[i].id}` };
                const widget = await createWidget(
                    widgetOptions.type,
                    parentContainer,
                    widgetOptions,
                    false // Don't auto-save when loading
                );
                if (widget && widget.element) {
                    widget.element.id = `${widgets[i].id}`;
                }
                if (widget) {
                    successCount++;
                } else {
                    console.warn(`Failed to create widget of type ${widgetOptions.type}`);
                }
            } catch (error) {
                console.error(`Error creating widget at index ${i}:`, error);
            }
        }

        console.log(`Successfully loaded ${successCount}/${widgets.length} widgets from storage.`);
    } catch (error) {
        console.warn('Error loading widgets:', error);
    }
}

async function createWidget(type, parentContainer, options = {}, autoSave = true) {
    const WidgetClass = WIDGET_TYPES[type];
    
    if (!WidgetClass) {
        console.error(`Unknown widget type: ${type}`);
        return null;
    }

    console.log('Widget options:', options);

    let widget;
    try {
        widget = new WidgetClass(options);
    } catch (error) {
        console.error(`Error creating ${type} widget:`, error);
        return null;
    }
    
    if (!widget || !parentContainer) {
        console.error('Failed to create widget or missing container');
        return null;
    }
    
    // Render the widget
    const renderedWidget = widget.render(parentContainer);
    buttonRippleEffect();
    
    // Auto-save to storage if enabled
    if (autoSave) {
        try {
            await widget.saveToStorage();
            console.log(`New ${type} widget saved to storage.`);
        } catch (error) {
            console.error(`Failed to save new ${type} widget to storage:`, error);
        }
    }
    
    return renderedWidget;
}

async function initializeWidgets() {
    const container = document.getElementById('dynamic-content-container');
    if (!container) {
        console.error('Dynamic content container not found');
        return;
    }

    try {
        await loadAllWidgets(container);
        makeWidgetsDynamic();
        console.log('Widgets initialized successfully.');
    } catch (error) {
        console.error('Error initializing widgets:', error);
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

            // Check if it's a widget or shortcut being dropped
            const draggedWidgetId = e.dataTransfer.getData('text/widget-id');
            const draggedShortcutId = e.dataTransfer.getData('text/plain');
            
            if (draggedWidgetId) {
                // This is a widget drop - let the Widget class handle it
                console.log('Widget dropped, letting Widget class handle it.');
                return; // Widget.setupActionButtons() will handle this
            }
            
            // This is a shortcut drop - handle it with existing shortcut logic
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

async function previewUploadedImage(elementToEdit = null, elementIcon = null) {
    const fileInput = document.getElementById('shortcut-icon-input');
    const shortcutURLInput = document.getElementById('shortcut-url');
    const filePreview = document.getElementById('icon-preview');
    const shortcutNameInput = document.getElementById('shortcut-name');
    const titlePreview = document.getElementById('shortcut-title-preview');
    let hasCustomIcon = false;

    console.log('Shortcut to edit:', elementToEdit);
    if (elementToEdit && elementToEdit.dataset.hasCustomIcon === 'true') {
        hasCustomIcon = true;
    }

    if (hasCustomIcon) {
        console.log('Shortcut has custom icon.');
    }

    checkIconOnload();

    async function checkIconOnload() {
        if (!hasCustomIcon) {
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
        } else {
            if (elementIcon && elementIcon.src) {
                filePreview.src = elementIcon.src;
            } else {
                filePreview.src = '../assets/unknown_icon.svg';
            }
            filePreview.style.display = 'block';
        }
        const inputtedName = shortcutNameInput.value;
        titlePreview.textContent = inputtedName;
    }
    
    fileInput.addEventListener('change', (event) => {
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];
            if (file.type.startsWith('image/')) {
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


async function editShortcut(shortcutToEditName, shortcutToEditURL, shortcutIndex, shortcutToEditID) {
    const addShortcutContainer = document.getElementById('add-shortcut-container');
    const shortcutToEditElement = document.getElementById(shortcutToEditID);
    const shortcutToEditIcon = document.getElementById(`shortcutIcon${shortcutIndex}`);
    const shortcutToEditNameElement = document.getElementById(`shortcutName${shortcutIndex}`);

    // Early validation and setup
    if (document.querySelectorAll('.add-shortcut-panel').length > 0 || currentShortcutPanel) {
        return;
    }

    // Nested function to determine if shortcut has custom icon
    function getCustomIconStatus() {
        return shortcutToEditElement.dataset.hasCustomIcon === 'true';
    }

    // Nested function to handle closing the edit panel
    function closePanel() {
        if (!currentShortcutPanel) return;
        
        currentShortcutPanel.classList.add('fade-out');
        addShortcutContainer.classList.remove('grey-out');

        const handleTransitionEnd = (e) => {
            if (e.propertyName === 'opacity' || e.propertyName === 'transform') {
                if (currentShortcutPanel && currentShortcutPanel.parentNode) {
                    currentShortcutPanel.parentNode.removeChild(currentShortcutPanel);
                }
                currentShortcutPanel = null;
                document.removeEventListener('click', handleClickOutside);
                document.removeEventListener('keydown', handleEscapeKey);
                e.currentTarget.removeEventListener('transitionend', handleTransitionEnd);
            }
        };

        currentShortcutPanel.addEventListener('transitionend', handleTransitionEnd);
    }

    // Nested function to handle clicks outside the panel
    function handleClickOutside(event) {
        if (currentShortcutPanel && !currentShortcutPanel.contains(event.target)) {
            closePanel();
        }
    }

    // Nested function to handle escape key press
    function handleEscapeKey(event) {
        if (currentShortcutPanel && event.key === 'Escape') {
            closePanel();
        }
    }

    // Nested function to create the edit panel HTML
    function createEditPanelHTML() {
        return `
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
    }

    // Nested function to create the panel structure
    function createPanelStructure() {
        const addShortcutPanel = document.createElement('div');
        addShortcutPanel.id = "add-shortcut-panel";
        addShortcutPanel.classList.add('add-shortcut-panel');
        addShortcutPanel.innerHTML = createEditPanelHTML();
        
        return addShortcutPanel;
    }

    // Nested function to update DOM elements with new shortcut data
    function updateShortcutDOM(shortcutName, shortcutURL, iconToSave) {
        shortcutToEditElement.dataset.shortcutName = shortcutName;
        shortcutToEditElement.dataset.href = shortcutURL;
        shortcutToEditNameElement.textContent = shortcutName;
        
        if (iconToSave) {
            shortcutToEditIcon.src = iconToSave;
        } else {
            shortcutToEditIcon.src = '../assets/unknown_icon.svg';
        }
    }

    // Nested function to process custom uploaded icon
    async function processCustomIcon(fileInput) {
        if (!fileInput || fileInput.size === 0) {
            return null;
        }

        try {
            return await convertImageToString(fileInput);
        } catch (error) {
            console.error("Error converting custom image to Base64:", error);
            return null;
        }
    }

    // Nested function to fetch favicon
    async function fetchFaviconIcon(shortcutURL) {
        const defaultFaviconUrlAttempt = getFaviconUrl(shortcutURL);
        
        try {
            const response = await fetch(defaultFaviconUrlAttempt);
            if (response.ok) {
                const blob = await response.blob();
                return await convertBlobToBase64(blob);
            } else {
                console.warn(`Could not fetch favicon for ${shortcutURL}. Status: ${response.status}`);
            }
        } catch (error) {
            console.error(`Error fetching or converting default favicon for ${shortcutURL}:`, error);
        }
        
        return null;
    }

    // Nested function to determine icon to use
    async function determineIconToUse(fileInput, shortcutURL, hasCustomIcon) {
        // First, try to use custom uploaded icon
        const customIcon = await processCustomIcon(fileInput);
        if (customIcon) {
            return customIcon;
        }

        // If no custom icon uploaded, decide based on existing icon status
        if (!hasCustomIcon) {
            // Try to fetch favicon for non-custom icons
            return await fetchFaviconIcon(shortcutURL);
        } else {
            // Keep existing custom icon if no new one uploaded
            return shortcutToEditIcon.src || '../assets/unknown_icon.svg';
        }
    }

    // Nested function to create updated shortcut object
    function createUpdatedShortcut(shortcutName, shortcutURL, iconToSave, hasCustomIcon) {
        const updatedShortcut = {
            'name': shortcutName,
            'href': shortcutURL,
            'hasCustomImage': hasCustomIcon
        };

        if (iconToSave) {
            updatedShortcut.image = iconToSave;
        }

        return updatedShortcut;
    }

    // Nested function to save shortcut and close panel
    async function saveAndCloseShortcutPanel(shortcut, indexToUpdate) {
        try {
            // Get current shortcuts from storage
            const result = await storageMode.get('shortcuts');
            const currentShortcuts = Array.isArray(result.shortcuts) ? result.shortcuts : [];
            
            // Update the specific shortcut at the given index
            if (indexToUpdate !== undefined && indexToUpdate > -1 && indexToUpdate < currentShortcuts.length) {
                currentShortcuts[indexToUpdate] = shortcut;
            } else {
                console.warn('Invalid shortcut index for update, appending instead');
                currentShortcuts.push(shortcut);
            }

            // Save updated shortcuts
            await storageMode.set({'shortcuts': currentShortcuts});

            // Close panel
            closePanel();
            
            console.log('Shortcut updated successfully:', shortcut);
        } catch (error) {
            console.error("Error saving shortcut:", error);
        }
    }

    // Nested function to handle form submission
    async function handleFormSubmission(event) {
        event.preventDefault();
        
        const shortcutForm = event.target;
        const formData = new FormData(shortcutForm);

        const shortcutName = formData.get('shortcut-name');
        const shortcutURL = formData.get('shortcut-url');
        const fileInput = formData.get('shortcut-icon-input');
        const hasCustomIcon = getCustomIconStatus();

        try {
            // Determine which icon to use
            const iconToSave = await determineIconToUse(fileInput, shortcutURL, hasCustomIcon);
            
            // Update DOM elements
            updateShortcutDOM(shortcutName, shortcutURL, iconToSave);
            
            // Create updated shortcut object
            const updatedShortcut = createUpdatedShortcut(shortcutName, shortcutURL, iconToSave, hasCustomIcon);
            
            // Save and close
            await saveAndCloseShortcutPanel(updatedShortcut, shortcutIndex);
        } catch (error) {
            console.error('Error processing shortcut edit:', error);
        }
    }

    // Nested function to initialize form listeners
    function initializeFormListeners() {
        const shortcutForm = document.getElementById('add-shortcut-form');
        if (shortcutForm) {
            shortcutForm.addEventListener('submit', handleFormSubmission);
        }
    }

    // Nested function to show the panel with animations
    function showPanel(panel) {
        addShortcutContainer.appendChild(panel);
        currentShortcutPanel = panel;

        // Initialize image preview with existing shortcut data
        previewUploadedImage(shortcutToEditElement, shortcutToEditIcon);
        
        // Initialize form listeners
        initializeFormListeners();

        // Trigger animations after a brief delay
        setTimeout(() => {
            panel.classList.add('fade-in');
            addShortcutContainer.classList.add('grey-out');
        }, 10);
    }

    // Nested function to initialize event listeners
    function initializeEventListeners() {
        // Add event listeners after a brief delay to avoid immediate triggering
        setTimeout(() => {
            document.addEventListener('click', handleClickOutside);
            document.addEventListener('keydown', handleEscapeKey);
        }, 0);
    }

    // Main execution flow
    function executeEditShortcut() {
        const hasCustomIcon = getCustomIconStatus();
        console.log('Custom icon:', hasCustomIcon);
        
        // Create the panel structure
        const panel = createPanelStructure();
        
        // Show the panel
        showPanel(panel);
        
        // Initialize event listeners
        initializeEventListeners();
    }

    // Execute the main flow
    executeEditShortcut();
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

// A single, self-contained function to handle all shortcut rearrangement logic.
// This function sets up all necessary drag-and-drop event listeners.
function initializeShortcutRearrangement() {
    const shortcutContainers = document.querySelectorAll('.shortcut-container');
    const gallery = document.getElementById('shortcut-gallery');

    // State variables for the drag-and-drop process
    let draggedShortcutData = null;
    let rearrangeTimeout = null;

    /**
     * Clears all rearrangement-related visual states and timeouts.
     */
    function resetRearrangementState() {
        if (rearrangeTimeout) {
            clearTimeout(rearrangeTimeout);
            rearrangeTimeout = null;
        }
        draggedShortcutData = null;

        document.querySelectorAll('.shortcut-container').forEach(container => {
            container.classList.remove(
                'hover-target',
                'hover-target-ready',
                'rearrange-preview'
            );
        });

        if (gallery) {
            gallery.classList.remove('rearrange-mode');
        }
    }

    /**
     * Saves the dragged shortcut's data to a state variable.
     * @param {HTMLElement} draggedElement - The shortcut being dragged.
     */
    function storeDraggedShortcutData(draggedElement) {
        if (draggedElement) {
            draggedShortcutData = {
                id: draggedElement.id,
                name: draggedElement.dataset.shortcutName,
                href: draggedElement.dataset.href,
                index: parseInt(draggedElement.dataset.shortcutIndex, 10)
            };
        }
    }

    /**
     * Handles updating the shortcut order in storage and re-rendering.
     * @param {number} fromIndex - The original index of the shortcut.
     * @param {number} toIndex - The new index for the shortcut.
     */
    async function rearrangeShortcutsInStorage(fromIndex, toIndex) {
        if (fromIndex === toIndex) {
            return;
        }
        try {
            const data = await storageMode.get('shortcuts');
            const shortcuts = Array.isArray(data?.shortcuts) ? data.shortcuts : [];

            if (fromIndex < 0 || fromIndex >= shortcuts.length || toIndex < 0 || toIndex >= shortcuts.length) {
                console.error('Invalid indices for rearrangement.');
                return;
            }

            const [movedShortcut] = shortcuts.splice(fromIndex, 1);
            shortcuts.splice(toIndex, 0, movedShortcut);

            await storageMode.set({ 'shortcuts': shortcuts });
            await initializeShortcuts();
        } catch (error) {
            console.error('Error rearranging shortcuts:', error);
        }
    }

    // Set up drag event listeners for each shortcut container
    shortcutContainers.forEach(container => {
        const shortcut = container.querySelector('.shortcut-circle');
        if (!shortcut) return;

        // Drag start event on the shortcut element
        addTrackedEventListener(shortcut, 'dragstart', (e) => {
            e.dataTransfer.setData('text/plain', e.target.id);
            storeDraggedShortcutData(e.target);
            container.classList.add('is-dragging');
            if (gallery) {
                gallery.classList.add('rearrange-mode');
            }
        });

        // Drag end event to clean up after the drag operation
        addTrackedEventListener(shortcut, 'dragend', () => {
            container.classList.remove('is-dragging');
            resetRearrangementState();
        });

        // Drop target event listeners on the containers
        addTrackedEventListener(container, 'dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (!container.classList.contains('is-dragging')) {
                container.classList.add('hover-target');
            }
        });

        addTrackedEventListener(container, 'dragleave', () => {
            container.classList.remove('hover-target');
        });

        addTrackedEventListener(container, 'drop', async (e) => {
            e.preventDefault();
            container.classList.remove('hover-target');

            if (!draggedShortcutData) {
                return;
            }

            const targetShortcut = container.querySelector('.shortcut-circle');
            if (!targetShortcut) {
                return;
            }

            const sourceIndex = draggedShortcutData.index;
            const targetIndex = parseInt(targetShortcut.dataset.shortcutIndex, 10);

            // Check if shortcut to re arrange is the source index
            if (sourceIndex !== targetIndex) {
                await rearrangeShortcutsInStorage(sourceIndex, targetIndex);
            }
            resetRearrangementState();
        });
    });

    // Gallery drop handler to reset state if a shortcut is dropped outside of a valid target.
    if (gallery) {
        addTrackedEventListener(gallery, 'drop', (e) => {
            e.preventDefault();
            resetRearrangementState();
        });
        addTrackedEventListener(gallery, 'dragover', (e) => {
            e.preventDefault();
        });
    }
}

function resetRearrangementState() {
    clearRearrangementTimeout();
    isRearranging = false;
    rearrangeTarget = null;
    draggedShortcutData = null;
    
    // Clear all visual states
    document.querySelectorAll('.shortcut-container').forEach(container => {
        container.classList.remove(
            'hover-target', 
            'hover-target-ready', 
            'insertion-point',
            'rearrange-preview'
        );
    });
    
    const gallery = document.getElementById('shortcut-gallery');
    if (gallery) {
        gallery.classList.remove('rearrange-mode');
    }
}

function clearRearrangementTimeout() {
    if (rearrangeTimeout) {
        clearTimeout(rearrangeTimeout);
        rearrangeTimeout = null;
    }
}

function makeWidgetsDynamic() {
    try {
        // Set up action buttons for all widgets
        Widget.setupActionButtons();
        
        // Add ripple effects for widgets (assuming buttonRippleEffect is defined elsewhere)
        if (typeof buttonRippleEffect === 'function') {
            buttonRippleEffect();
        }
        
        console.log(`Set up drag and drop for ${widgetInstances.size} widgets`);
    } catch (error) {
        console.error('Error making widgets dynamic:', error);
    }
}

function createTimeWidget(parentContainer, options = {}) {
    console.log('Create time widget called.');
    if (!parentContainer) {
        console.error('Parent container is required to create time widget');
        return null;
    }

    const timeOptions = {
        timeFormat: options.timeFormat || '12hour',
        showSeconds: options.showSeconds || false,
        font: options.font || 'Google Sans',
        ...options
    };

    return createWidget('timeWidget', parentContainer, timeOptions);
}

function createQuoteWidget(parentContainer, options = {}) {
    console.log('Create quote widget called.');
    if (!parentContainer) {
        console.error('Parent container is required to create quote widget');
        return null;
    }

    const quoteOptions = {
        quotes: options.quotes || quotes,
        font: options.font || 'Google Sans',
        ...options
    };

    console.log(quoteOptions);

    return createWidget('quote', parentContainer, quoteOptions);
}

function createItemDropdownMenu() {
    const createItemButton = document.getElementById('create-item');
    const createItemIcon = document.getElementById('create-item-icon');

    createItemButton.addEventListener('click', () => {
        const dropdownMenu = document.getElementById('dropdown-menu');

        // Check if the dropdown menu exists.
        if (dropdownMenu) {
            // It exists, so we're closing it.
            // First, remove the slide-in class to start the slide-out animation.
            dropdownMenu.classList.remove('slide-in');

            // Now, remove the 'dropdown-open' class from the icon to rotate it back.
            createItemIcon.classList.remove('dropdown-open');

            // Wait for the slide-out transition to finish before removing the element.
            dropdownMenu.addEventListener('transitionend', () => {
                dropdownMenu.remove();
            }, { once: true });
            
        } else {
            // It doesn't exist, so we're opening it.
            // Create the new dropdown menu element.
            const newDropdownMenu = document.createElement('div');
            newDropdownMenu.classList.add('dropdown-menu');
            newDropdownMenu.id = 'dropdown-menu';
            newDropdownMenu.innerHTML = `
                <button class="button-style" id="create-shortcut">
                    <span class="material-symbols-outlined">switch_access_shortcut</span>
                </button>
                <button class="button-style" id="create-widget">
                    <span class="material-symbols-outlined">widgets</span>
                </button>
            `;
            createItemButton.before(newDropdownMenu);
            buttonRippleEffect();

            // Use a slight delay to allow the element to be rendered
            // before adding the slide-in class. This ensures the transition works.
            setTimeout(() => {
                newDropdownMenu.classList.add('slide-in');
            }, 10);

            // Add the 'dropdown-open' class to the icon to rotate it.
            createItemIcon.classList.add('dropdown-open');

            // ADD EVENT LISTENERS FOR THE NEWLY CREATED BUTTONS
            setupDropdownEventListeners();
        }
    });
}

// NEW FUNCTION: Set up event listeners for dropdown buttons
function setupDropdownEventListeners() {
    const createShortcutButton = document.getElementById('create-shortcut');
    const createWidgetButton = document.getElementById('create-widget');

    if (createShortcutButton) {
        createShortcutButton.addEventListener('click', () => {
            // Close the dropdown first
            closeDropdownMenu();
            // Then trigger the shortcut creation
            triggerCreateShortcut();
        });
    }

    if (createWidgetButton) {
        createWidgetButton.addEventListener('click', () => {
            // Close the dropdown first
            closeDropdownMenu();
            // Then trigger the widget creation
            triggerCreateWidget();
        });
    }
    document.addEventListener('click', (event) => {
        // Get references to the button and the dropdown menu.
        const createItemButton = document.getElementById('create-item');
        const dropdownMenu = document.getElementById('dropdown-menu');

        // Check if the dropdown menu exists and the click was outside of it.
        if (dropdownMenu && !dropdownMenu.contains(event.target) && !createItemButton.contains(event.target)) {
            // The click was outside the dropdown and the button, so close the dropdown.
            closeDropdownMenu();
        }
    });
}

// HELPER FUNCTION: Close dropdown menu
function closeDropdownMenu() {
    const dropdownMenu = document.getElementById('dropdown-menu');
    const createItemIcon = document.getElementById('create-item-icon');
    
    if (dropdownMenu) {
        dropdownMenu.classList.remove('slide-in');
        if (createItemIcon) {
            createItemIcon.classList.remove('dropdown-open');
        }
        
        dropdownMenu.addEventListener('transitionend', () => {
            if (dropdownMenu.parentNode) {
                dropdownMenu.remove();
            }
        }, { once: true });
    }
}

// HELPER FUNCTION: Trigger shortcut creation
function triggerCreateShortcut() {
    const addShortcutContainer = document.getElementById('add-shortcut-container');
    
    // Early validation and return
    if (!addShortcutContainer) {
        console.error('Add shortcut container not found');
        return;
    }
    
    if (currentShortcutPanel) {
        return;
    }

    // Nested function to handle closing the shortcut panel
    function closePanel() {
        if (!currentShortcutPanel) return;
        
        currentShortcutPanel.classList.add('fade-out');
        addShortcutContainer.classList.remove('grey-out');

        const handleTransitionEnd = (e) => {
            if (e.propertyName === 'opacity' || e.propertyName === 'transform') {
                if (currentShortcutPanel && currentShortcutPanel.parentNode) {
                    currentShortcutPanel.parentNode.removeChild(currentShortcutPanel);
                }
                currentShortcutPanel = null;
                document.removeEventListener('click', handleClickOutside);
                e.currentTarget.removeEventListener('transitionend', handleTransitionEnd);
            }
        };

        currentShortcutPanel.addEventListener('transitionend', handleTransitionEnd);
    }

    // Nested function to handle clicks outside the panel
    function handleClickOutside(event) {
        if (currentShortcutPanel && !currentShortcutPanel.contains(event.target)) {
            closePanel();
        }
    }

    // Nested function to handle escape key press
    function handleEscapeKey(event) {
        if (currentShortcutPanel && event.key === 'Escape') {
            closePanel();
        }
    }

    // Nested function to create the panel HTML structure
    function createPanelHTML() {
        return `
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
    }

    // Nested function to create the main panel structure
    function createPanelStructure() {
        const addShortcutPanel = document.createElement('div');
        addShortcutPanel.id = "add-shortcut-panel";
        addShortcutPanel.classList.add('add-shortcut-panel');
        addShortcutPanel.innerHTML = createPanelHTML();
        
        return addShortcutPanel;
    }

    // Nested function to handle icon processing
    async function processShortcutIcon(formData, shortcutURL) {
        const fileInput = formData.get('shortcut-icon-input');
        let iconToSave = null;
        let shortcutCustomImage = false;

        // Try to use custom uploaded image first
        if (fileInput && fileInput.size > 0) {
            try {
                iconToSave = await convertImageToString(fileInput);
                shortcutCustomImage = true;
                console.log('Custom image processed successfully');
            } catch (error) {
                console.error("Error converting custom image to Base64:", error);
            }
        }

        // Fall back to favicon if no custom image or custom image failed
        if (!iconToSave) {
            iconToSave = await fetchFaviconIcon(shortcutURL);
            shortcutCustomImage = false;
        }

        return { iconToSave, shortcutCustomImage };
    }

    // Nested function to fetch favicon
    async function fetchFaviconIcon(shortcutURL) {
        const defaultFaviconUrlAttempt = getFaviconUrl(shortcutURL);
        
        try {
            const response = await fetch(defaultFaviconUrlAttempt);
            if (response.ok) {
                const blob = await response.blob();
                return await convertBlobToBase64(blob);
            } else {
                console.warn(`Could not fetch favicon for ${shortcutURL}. Status: ${response.status}`);
            }
        } catch (error) {
            console.error(`Error fetching or converting default favicon for ${shortcutURL}:`, error);
        }
        
        return null;
    }

    // Nested function to create shortcut object
    function createShortcutObject(shortcutName, shortcutURL, iconToSave, shortcutCustomImage) {
        const baseShortcut = {
            'name': shortcutName,
            'href': shortcutURL,
            'hasCustomImage': shortcutCustomImage
        };

        if (iconToSave) {
            baseShortcut.image = iconToSave;
        }

        return baseShortcut;
    }

    // Nested function to save shortcut and close panel
    async function saveAndCloseShortcutPanel(shortcut) {
        try {
            // Save to storage
            const result = await storageMode.get('shortcuts');
            const currentShortcuts = Array.isArray(result.shortcuts) ? result.shortcuts : [];
            currentShortcuts.push(shortcut);
            await storageMode.set({'shortcuts': currentShortcuts});

            // Close panel and refresh UI
            closePanel();
            initializeShortcuts();
            
            console.log('Shortcut saved successfully:', shortcut);
        } catch (error) {
            console.error("Error saving shortcut:", error);
        }
    }

    // Nested function to handle form submission
    async function handleFormSubmission(event) {
        event.preventDefault();
        
        const shortcutForm = event.target;
        const formData = new FormData(shortcutForm);

        const shortcutName = formData.get('shortcut-name');
        const shortcutURL = formData.get('shortcut-url');

        try {
            // Process icon (custom or favicon)
            const { iconToSave, shortcutCustomImage } = await processShortcutIcon(formData, shortcutURL);
            
            // Create shortcut object
            const newShortcut = createShortcutObject(shortcutName, shortcutURL, iconToSave, shortcutCustomImage);
            
            // Save and close
            await saveAndCloseShortcutPanel(newShortcut);
        } catch (error) {
            console.error('Error processing shortcut form:', error);
        }
    }

    // Nested function to initialize form event listeners
    function initializeFormListeners() {
        const shortcutForm = document.getElementById('add-shortcut-form');
        if (shortcutForm) {
            shortcutForm.addEventListener('submit', handleFormSubmission);
        }
    }

    // Nested function to show the panel with animations
    function showPanel(panel) {
        addShortcutContainer.appendChild(panel);
        currentShortcutPanel = panel;

        // Initialize image preview functionality
        previewUploadedImage();
        
        // Initialize form listeners
        initializeFormListeners();

        // Trigger animations after a brief delay
        setTimeout(() => {
            panel.classList.add('fade-in');
            addShortcutContainer.classList.add('grey-out');
        }, 10);
    }

    // Nested function to initialize event listeners
    function initializeEventListeners() {
        // Add click outside listener after a brief delay to avoid immediate triggering
        setTimeout(() => {
            document.addEventListener('click', handleClickOutside);
            document.addEventListener('keydown', handleEscapeKey);
        }, 0);
    }

    // Main execution flow
    function executeCreateShortcut() {
        // Create the panel structure
        const panel = createPanelStructure();
        
        // Show the panel
        showPanel(panel);
        
        // Initialize event listeners
        initializeEventListeners();
    }

    // Execute the main flow
    executeCreateShortcut();
}

function triggerCreateWidget() {
    const addWidgetContainer = document.getElementById('add-widget-container');
    let carouselIndex = 0;
    const carouselItems = [];
    
    // Early return if panel already exists
    if (currentWidgetPanel) {
        return;
    }

    // Nested function to handle closing the widget panel
    function closePanel() {
        if (!currentWidgetPanel) return;
        
        currentWidgetPanel.classList.add('fade-out');
        addWidgetContainer.classList.remove('grey-out');

        const handleTransitionEnd = (e) => {
            if (e.propertyName === 'opacity' || e.propertyName === 'transform') {
                if (currentWidgetPanel && currentWidgetPanel.parentNode) {
                    currentWidgetPanel.parentNode.removeChild(currentWidgetPanel);
                }
                currentWidgetPanel = null;
                document.removeEventListener('click', handleClickOutside);
                e.currentTarget.removeEventListener('transitionend', handleTransitionEnd);
            }
        };

        currentWidgetPanel.addEventListener('transitionend', handleTransitionEnd);
    }

    // Nested function to handle clicks outside the panel
    function handleClickOutside(event) {
        if (currentWidgetPanel && !currentWidgetPanel.contains(event.target)) {
            closePanel();
        }
    }

    function handleEscapeKey(event) {
        if (currentWidgetPanel && event.key === 'Escape') {
            closePanel();
        }
    }

    // Nested function to create individual carousel items
    function createCarouselItem(widget) {
        console.log('Adding widget to carousel:', widget);
        
        // Create the main carousel item container
        const carouselItem = document.createElement('div');
        carouselItem.id = `${widget.replace(/\s/g, "-")}-carousel-item`;
        carouselItem.classList.add('widget-carousel-item');
        
        // Wrapper button for the image
        const warpperButton = document.createElement('button');
        warpperButton.classList.add('image-wrapper-button');

        // Create and configure the image
        const image = document.createElement('img');
        image.classList.add('widget-carousel-image');
        image.draggable = false;
        image.src = `../assets/widget_previews/${widget}.png`;
        warpperButton.appendChild(image);

        // Append the button to the carousel item
        carouselItem.appendChild(warpperButton);
        
        // Create and configure the text
        const text = document.createElement('h2');
        text.classList.add('widget-carousel-text');
        text.textContent = widget;
        carouselItem.appendChild(text);
        
        return carouselItem;
    }

    // Nested function to create the widget carousel
    function createWidgetCarousel(widgets) {
        // Create and append each carousel item to an array
        widgets.forEach(widget => {
            const carouselItem = createCarouselItem(widget);
            carouselItems.push(carouselItem);
        });
    }

    function createNavigationIndicators(widgets) {
        const navigationIndicatorDiv = document.createElement('div');
        navigationIndicatorDiv.id = 'navigation-indicator-div';
        navigationIndicatorDiv.classList.add('navigation-indicator-div');

        // Create the navigation dots
        widgets.forEach(widget => {
            // Create the circle indicator
            const widgetIndicatorCircle = document.createElement('button');
            widgetIndicatorCircle.classList.add('widget-indicator-circle');
            navigationIndicatorDiv.appendChild(widgetIndicatorCircle);
        });

        return navigationIndicatorDiv;
    }

    function displayWidgetCarousel() {
        const widgetCarousel = document.getElementById('add-widget-carousel');
        
        // Clear any existing carousel items
        widgetCarousel.innerHTML = '';

        // Append the current index to the carousel
        widgetCarousel.appendChild(carouselItems[carouselIndex]);
    }

    // Nested function to create the main panel structure
    function createPanelStructure() {
        const addWidgetPanel = document.createElement('div');
        addWidgetPanel.id = 'add-widget-panel';
        addWidgetPanel.classList.add('add-widget-panel');
        
        // Create the left nav arrow
        const leftNavArrowContainer = document.createElement('div');
        leftNavArrowContainer.classList.add('nav-arrow-container');
        const leftNavArrowButton = document.createElement('button');
        leftNavArrowButton.id = 'left-nav-arrow-button';
        leftNavArrowButton.classList.add('button-style', 'nav-arrow-button');
        leftNavArrowButton.innerHTML = `
        <span class="material-symbols-outlined">chevron_left</span>
        `;
        leftNavArrowContainer.appendChild(leftNavArrowButton);
        addWidgetPanel.appendChild(leftNavArrowContainer);

        // Create the center container
        const centerContentContainer = document.createElement('div');
        centerContentContainer.classList.add('create-widget-main-content');
        // Create and add the title
        const widgetText = document.createElement('h2');
        widgetText.textContent = 'Add Widget';
        centerContentContainer.appendChild(widgetText);
        // Create and add the carousel container
        const widgetCarousel = document.createElement('div');
        widgetCarousel.id = 'add-widget-carousel';
        widgetCarousel.classList.add('add-widget-carousel');
        centerContentContainer.appendChild(widgetCarousel);
        // Create the navigation indicators
        const navigationIndicators = createNavigationIndicators(widgetsTypesArray);
        centerContentContainer.appendChild(navigationIndicators);
        // Append the center content to the widget panel
        addWidgetPanel.appendChild(centerContentContainer);
        
        // Create the right nav arrow
        const rightNavArrowContainer = document.createElement('div');
        rightNavArrowContainer.classList.add('nav-arrow-container');
        const rightNavArrowButton = document.createElement('button');
        rightNavArrowButton.id = 'right-nav-arrow-button';
        rightNavArrowButton.classList.add('button-style', 'nav-arrow-button');
        rightNavArrowButton.innerHTML = `
        <span class="material-symbols-outlined">chevron_right</span>
        `;
        rightNavArrowContainer.appendChild(rightNavArrowButton);
        addWidgetPanel.appendChild(rightNavArrowContainer);

        return addWidgetPanel;
    }

    // Nested function to show the panel with animations
    function showPanel(panel) {
        addWidgetContainer.appendChild(panel);
        currentWidgetPanel = panel;

        // Trigger animations after a brief delay
        setTimeout(() => {
            panel.classList.add('fade-in');
            addWidgetContainer.classList.add('grey-out');
        }, 10);
    }

    // Nested function to initialize event listeners
    function initializeEventListeners() {
        // Add event listeners after a brief delay to avoid immediate triggering
        setTimeout(() => {
            document.addEventListener('click', handleClickOutside);
            document.addEventListener('keydown', handleEscapeKey);
        }, 0);
    }

    function changeWidgetPreview() {
        console.log('Carousel index:', carouselIndex);
        console.log('Carousel items length:', carouselItems.length);
        const leftNavArrow = document.getElementById('left-nav-arrow-button');
        const rightNavArrow = document.getElementById('right-nav-arrow-button');
        const widgetIndicators = document.querySelectorAll('.widget-indicator-circle');

        leftNavArrow.addEventListener('click', () => {
            console.log('Left nav arrow clicked.');
            if (carouselIndex > 0) {
                carouselIndex = carouselIndex - 1;
                displayWidgetCarousel();
                changeNavigationIndicators();
            }
        });

        rightNavArrow.addEventListener('click', () => {
            console.log('Right nav arrow clicked.');
            if (carouselIndex < carouselItems.length - 1) {
                carouselIndex = carouselIndex + 1;
                displayWidgetCarousel();
                changeNavigationIndicators();
            }
        });

        widgetIndicators.forEach((indicator, index) => {
            indicator.addEventListener('click', () => {
                console.log('Switching to widget index:', index);
                carouselIndex = index;
                displayWidgetCarousel();
                changeNavigationIndicators();
            });
        });
    }

    function changeNavigationIndicators() {
        const navigationIndicators = document.querySelectorAll('.widget-indicator-circle');
        // Ensure everything else is set to the default color
        navigationIndicators.forEach(navigationIndicator => {
            navigationIndicator.style.backgroundColor = 'var(--light-background-color)';
        });
        // Set the current navigation indicator to the primary color
        navigationIndicators[carouselIndex].style.backgroundColor = 'var(--primary-color)';
    }

    function redirectOnceClicked() {
        const itemClicked = carouselItems[carouselIndex];
        console.log('Carousel item clicked:', itemClicked);
        const itemClickedString = itemClicked.id.slice(0, -'-carousel-item'.length).split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
        console.log(itemClickedString);
        const functionToCall = widgetFunctions[itemClickedString];
        // Check if the function to call is a function defined in the file
        if (typeof functionToCall === 'function') {
            console.log('Function to call:', functionToCall);
            functionToCall(document.getElementById('dynamic-content-container'));
            closePanel();
        } else {
            console.log(`Error: Function '${functionToCall}' not found.`);
            alert('An unexpected error occurred.');
        }
    }

    function redirectToWidgetCreation() {
        const widgetCarousel = document.getElementById('add-widget-carousel');

        // Attach only once
        if (!widgetCarousel.dataset.listenerAttached) {
            widgetCarousel.addEventListener('click', (e) => {
                const button = e.target.closest('.image-wrapper-button');
                if (!button) return;

                // Current index will always be correct since it's updated on navigation
                console.log('Carousel item clicked:', carouselItems[carouselIndex]);
                redirectOnceClicked();
            });

            // Mark as attached so we don't double-bind
            widgetCarousel.dataset.listenerAttached = 'true';
        }
    }

    // Main execution flow
    function executeCreateWidget() {
        // Create the panel structure
        const panel = createPanelStructure();
        
        // Show the panel
        showPanel(panel);
        
        // Create the widget carousel
        createWidgetCarousel(widgetsTypesArray);

        // Display a single widget preview and the ability to change the displayed widget
        displayWidgetCarousel();
        changeWidgetPreview();
        changeNavigationIndicators();
        redirectToWidgetCreation();
        
        // Initialize event listeners
        initializeEventListeners();
        buttonRippleEffect();
    }

    // Execute the main flow
    executeCreateWidget();
}

async function initializePage() {
    await initializeShortcuts();
    await initializeWidgets();
    createItemDropdownMenu();
}

document.addEventListener('DOMContentLoaded', initializePage);