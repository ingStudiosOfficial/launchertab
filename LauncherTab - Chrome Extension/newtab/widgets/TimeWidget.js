import { Widget } from "./Widget.js";
import { storageMode } from "../../global/globalVariables.js";
let currentWidgetPanel = null;

export class TimeWidget extends Widget {
    constructor(options = {}) {
        const defaultOptions = {
            cssClass: 'time-container',
            updateInterval: 500,
            timeFormat: options.timeFormat || '12hour',
            showSeconds: options.showSeconds || false,
            font: options.font || 'Google Sans',
            ...options
        };

        defaultOptions.content = TimeWidget.generateTimeHTML(
            defaultOptions.timeFormat, 
            defaultOptions.showSeconds
        );

        super(defaultOptions);
        this.timeFormat = defaultOptions.timeFormat;
        this.showSeconds = defaultOptions.showSeconds;
        this.font = defaultOptions.font;
    }

    onRender() {
        this.setFont(this.font);
    }

    static generateTimeHTML(timeFormat = '24hour', showSeconds = false) {
        const time = TimeWidget.getCurrentTime(timeFormat, showSeconds);
        return `<h1 class="current-time-text">${time}</h1>`;
    }

    getStorageData() {
        return {
            id: this.id,
            type: 'digitalClock',
            timeFormat: this.timeFormat,
            showSeconds: this.showSeconds,
            font: this.font,
            cssClass: this.cssClass,
            draggable: this.draggable
        };
    }

    static getCurrentTime(timeFormat = '24hour', showSeconds = false) {
        const currentDate = new Date();
        let currentHour = currentDate.getHours();
        const currentMinute = currentDate.getMinutes();
        const currentSecond = currentDate.getSeconds();

        if (timeFormat === '12hour') {
            if (currentHour === 0) {
                currentHour = 12; // Midnight is 12 AM
            } else if (currentHour > 12) {
                currentHour = currentHour - 12; // Use subtraction instead of modulo
            }
            // currentHour === 12 stays as 12 (noon is 12 PM)
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
        if (this.isDestroyed) return;
        
        const timeElement = this.element?.querySelector('.current-time-text');
        if (timeElement) {
            timeElement.textContent = TimeWidget.getCurrentTime(this.timeFormat, this.showSeconds);
        }
    }

    setTimeFormat(format) {
        if (['12hour', '24hour'].includes(format)) {
            this.timeFormat = format;
            this.update();
        } else {
            console.warn('Invalid time format. Use "12hour" or "24hour"');
        }
    }

    toggleSeconds() {
        this.showSeconds = !this.showSeconds;
        this.update();
    }

    setFont(fontName) {
        if (this.isDestroyed) return;
        
        if (this.element) {
            const timeElement = this.element.querySelector('.current-time-text');
            if (timeElement) {
                timeElement.style.fontFamily = fontName;
            }
        }
        this.font = fontName;
    }

    // Async update methods with error handling
    async updateTimeFormat(newFormat) {
        try {
            this.setTimeFormat(newFormat);
            await this.saveToStorage({ timeFormat: newFormat }, { merge: true });
        } catch (error) {
            console.error('Failed to update time format:', error);
        }
    }

    async updateFont(newFont) {
        try {
            this.setFont(newFont);
            await this.saveToStorage({ font: newFont }, { merge: true });
        } catch (error) {
            console.error('Failed to update font:', error);
        }
    }

    async updateSeconds(showSeconds) {
        try {
            this.showSeconds = showSeconds;
            this.update();
            await this.saveToStorage({ showSeconds: showSeconds }, { merge: true });
        } catch (error) {
            console.error('Failed to update seconds setting:', error);
        }
    }

    onClick() {
        console.log(`Time widget ${this.id} clicked - toggling seconds`);
        this.toggleSeconds();
        
        this.updateSeconds(this.showSeconds).catch(error => {
            console.error('Failed to save widget changes after click:', error);
        });
    }

    // Enhanced editWidget method with better panel management
    editWidget(widgetId) {
        if (this.isDestroyed) {
            console.error('Cannot edit destroyed widget');
            return;
        }

        const addWidgetContainer = document.getElementById('add-widget-container');
        if (!addWidgetContainer) {
            console.error('Widget container not found');
            return;
        }

        // Enhanced panel checking - close any existing panels first
        this.closeAnyExistingPanels();

        // Nested function to close any existing panels
        const closeAnyExistingPanels = () => {
            // Remove any existing panels by class
            const existingPanels = document.querySelectorAll('.edit-widget-panel');
            existingPanels.forEach(panel => {
                if (panel.parentNode) {
                    panel.parentNode.removeChild(panel);
                }
            });

            // Clear the current panel reference
            if (currentWidgetPanel) {
                currentWidgetPanel = null;
            }

            // Remove any existing click listeners
            document.removeEventListener('click', this.boundClickHandler);
        };

        // Nested function to handle closing the edit panel
        const closePanel = () => {
            if (!currentWidgetPanel) return;
            
            currentWidgetPanel.classList.add('fade-out');
            // Remove grey-out class
            const addWidgetContainer = document.getElementById('add-widget-container');
            if (addWidgetContainer) {
                addWidgetContainer.classList.remove('grey-out');
            }

            const handleTransitionEnd = (e) => {
                if (e.propertyName === 'opacity' || e.propertyName === 'transform') {
                    if (currentWidgetPanel && currentWidgetPanel.parentNode) {
                        currentWidgetPanel.parentNode.removeChild(currentWidgetPanel);
                    }
                    currentWidgetPanel = null;
                    document.removeEventListener('click', this.boundClickHandler);
                    document.removeEventListener('keydown', this.boundKeyHandler); // ADD THIS
                    e.currentTarget.removeEventListener('transitionend', handleTransitionEnd);
                }
            };

            currentWidgetPanel.addEventListener('transitionend', handleTransitionEnd);
        };

        // Nested function to handle clicks outside the panel
        const handleClickOutside = (event) => {
            if (currentWidgetPanel && 
                !currentWidgetPanel.contains(event.target) && 
                !event.target.closest('.edit-widget-panel')) {
                closePanel();
            }
        };

        // Store the bound handler for proper cleanup
        this.boundClickHandler = handleClickOutside;

        const handleEscapeKey = (event) => {
            if (currentWidgetPanel && event.key === 'Escape') {
                closePanel();
            }
        };

        this.boundKeyHandler = handleEscapeKey;

        // Rest of your existing nested functions...
        const initializeTemporaryOptions = () => {
            return {
                'format': this.timeFormat || '24hour', 
                'seconds': this.showSeconds || false, 
                'font': this.font || 'Google Sans'
            };
        };

        const createPanelStructure = (temporaryOptions) => {
            const currentTime = TimeWidget.getCurrentTime(temporaryOptions.format, temporaryOptions.seconds);
            
            const editWidgetPanel = document.createElement('div');
            editWidgetPanel.classList.add('edit-widget-panel', `edit-panel-${this.id}`);
            editWidgetPanel.innerHTML = this.getEditPanelHTML(currentTime, temporaryOptions);
            
            // Add a data attribute to track which widget this panel belongs to
            editWidgetPanel.setAttribute('data-widget-id', this.id);
            
            return editWidgetPanel;
        };

        const getFormElements = () => {
            const formatId = `format-${this.id}`;
            const secondsId = `seconds-${this.id}`;
            const fontId = `font-${this.id}`;
            
            const elements = {
                formatSelect: document.getElementById(formatId),
                secondsCheckbox: document.getElementById(secondsId),
                fontSelect: document.getElementById(fontId),
                form: currentWidgetPanel.querySelector('.edit-widget-form'),
                preview: currentWidgetPanel.querySelector('.time-preview-text')
            };

            const missingElements = Object.keys(elements).filter(key => !elements[key]);
            if (missingElements.length > 0) {
                console.error('Required form elements not found:', missingElements);
                return null;
            }

            return elements;
        };

        const updatePreview = (temporaryOptions, elements) => {
            const currentTime = TimeWidget.getCurrentTime(temporaryOptions.format, temporaryOptions.seconds);
            elements.preview.textContent = currentTime;
            elements.preview.style.fontFamily = temporaryOptions.font;
        };

        const setupFormListeners = (temporaryOptions) => {
            const elements = getFormElements();
            if (!elements) return;

            elements.formatSelect.addEventListener('change', () => {
                temporaryOptions.format = elements.formatSelect.value;
                updatePreview(temporaryOptions, elements);
            });

            elements.secondsCheckbox.addEventListener('change', () => {
                temporaryOptions.seconds = elements.secondsCheckbox.checked;
                updatePreview(temporaryOptions, elements);
            });

            elements.fontSelect.addEventListener('change', () => {
                temporaryOptions.font = elements.fontSelect.value;
                updatePreview(temporaryOptions, elements);
            });

            elements.form.addEventListener('submit', async (event) => {
                event.preventDefault();
                await this.handleFormSubmit(elements.form, this.boundClickHandler);
            });
        };

        const showPanel = (panel) => {
            addWidgetContainer.appendChild(panel);
            currentWidgetPanel = panel;
            setTimeout(() => {
                panel.classList.add('fade-in');
                addWidgetContainer.classList.add('grey-out');
            }, 10);
        };

        const initializeEventListeners = () => {
            setTimeout(() => {
                document.addEventListener('click', this.boundClickHandler);
                document.addEventListener('keydown', this.boundKeyHandler); // ADD THIS
            }, 100);
        };

        // Main execution flow
        const executeEditWidget = () => {
            const temporaryOptions = initializeTemporaryOptions();
            const panel = createPanelStructure(temporaryOptions);
            showPanel(panel);
            setupFormListeners(temporaryOptions);
            initializeEventListeners();
        };

        executeEditWidget();
    }

    // Enhanced closeEditPanel method
    closeEditPanel(handleClickOutside) {
        const addWidgetContainer = document.getElementById('add-widget-container');
        const handleTransitionEnd = (e) => {
            if (e.propertyName === 'opacity' || e.propertyName === 'transform') {
                cleanupPanel();
            }
        };

        const cleanupPanel = () => {
            if (currentWidgetPanel && currentWidgetPanel.parentNode) {
                currentWidgetPanel.parentNode.removeChild(currentWidgetPanel);
            }
            currentWidgetPanel = null;
            
            // Clean up the specific handler passed to this method
            if (handleClickOutside) {
                document.removeEventListener('click', handleClickOutside);
            }
            
            // Also clean up the bound handler if it exists
            if (this.boundClickHandler) {
                document.removeEventListener('click', this.boundClickHandler);
                this.boundClickHandler = null;
            }

            if (this.boundKeyHandler) {  // ADD THIS BLOCK
                document.removeEventListener('keydown', this.boundKeyHandler);
                this.boundKeyHandler = null;
            }
        };

        if (currentWidgetPanel) {
            currentWidgetPanel.classList.add('fade-out');
            addWidgetContainer.classList.remove('grey-out');
            currentWidgetPanel.addEventListener('transitionend', function handler(e) {
                handleTransitionEnd(e);
                e.currentTarget.removeEventListener('transitionend', handler);
            });
        }
    }

    // Add method to close any existing panels
    closeAnyExistingPanels() {
        // Remove any existing panels by class
        const existingPanels = document.querySelectorAll('.edit-widget-panel');
        existingPanels.forEach(panel => {
            if (panel.parentNode) {
                panel.parentNode.removeChild(panel);
            }
        });

        // Remove any existing listeners
        if (this.boundClickHandler) {
            document.removeEventListener('click', this.boundClickHandler);
            this.boundClickHandler = null;
        }
        if (this.boundKeyHandler) {  // ADD THIS BLOCK
            document.removeEventListener('keydown', this.boundKeyHandler);
            this.boundKeyHandler = null;
        }
    }

    // Add a cleanup method that can be called when the widget is destroyed
    cleanup() {
        this.closeAnyExistingPanels();
        if (this.boundClickHandler) {
            document.removeEventListener('click', this.boundClickHandler);
            this.boundClickHandler = null;
        }
        if (this.boundKeyHandler) {
            document.removeEventListener('keydown', this.boundKeyHandler);
            this.boundKeyHandler = null;
        }
    }

    getEditPanelHTML(currentTime, options) {
        // Use unique identifiers based on widget ID to avoid collisions
        const panelId = `edit-panel-${this.id}`;
        const formId = `edit-form-${this.id}`;
        const previewId = `preview-${this.id}`;
        const formatId = `format-${this.id}`;
        const secondsId = `seconds-${this.id}`;
        const fontId = `font-${this.id}`;
        const submitId = `submit-${this.id}`;
        
        return `
            <h2>Edit Widget</h2>
            <div class="widget-container-preview">
                <div class="time-container-preview">
                    <h1 class="time-preview-text" style="font-family: ${options.font}">${currentTime}</h1>
                </div>
            </div>
            <form class="edit-widget-form">
                <label for="${formatId}">Time Format</label>
                <select id="${formatId}" name="widget-format" class="widget-input">
                    <option value="12hour" ${this.timeFormat === '12hour' ? 'selected' : ''}>12 Hour</option>
                    <option value="24hour" ${this.timeFormat === '24hour' ? 'selected' : ''}>24 Hour</option>
                </select>
                <div class="label-checkbox-group">
                    <label for="${secondsId}">Show Seconds</label>
                    <label class="switch">
                        <input type="checkbox" id="${secondsId}" name="widget-seconds" class="widget-input" ${this.showSeconds ? 'checked' : ''}>
                        <span class="slider round"></span>
                    </label>
                </div>
                <label for="${fontId}">Font</label>
                <select id="${fontId}" name="font-type" class="widget-input">
                    <option value="Google Sans" ${this.font === 'Google Sans' ? 'selected' : ''}>Google Sans (Default)</option>
                    <option value="Google Sans Code" ${this.font === 'Google Sans Code' ? 'selected' : ''}>Google Sans Code</option>
                    <option value="Bitcount Prop Single" ${this.font === 'Bitcount Prop Single' ? 'selected' : ''}>Bitcount Prop Single</option>
                    <option value="Roboto Flex" ${this.font === 'Roboto Flex' ? 'selected' : ''}>Roboto Flex</option>
                    <option value="Poppins" ${this.font === 'Poppins' ? 'selected' : ''}>Poppins</option>
                </select>
                <button type="submit" id="${submitId}" class="button-style">
                    <span class="material-symbols-outlined">check</span>
                </button>
            </form>
        `;
    }

    // Add this method to your TimeWidget class
    async handleFormSubmit(form, handleClickOutside) {
        try {
            const formData = new FormData(form);
            const newFormat = formData.get('widget-format');
            const showSeconds = formData.has('widget-seconds');
            const fontType = formData.get('font-type');

            // Update widget properties directly on THIS instance
            this.setTimeFormat(newFormat);
            this.showSeconds = showSeconds;
            this.setFont(fontType);
            this.update();

            // Find and update the widget in storage by index
            const data = await storageMode.get('widgets');
            let widgets = data?.widgets || [];
            const existingIndex = widgets.findIndex(w => w.id === this.id);
            if (existingIndex >= 0) {
                widgets[existingIndex] = {
                    ...widgets[existingIndex],
                    timeFormat: newFormat,
                    showSeconds: showSeconds,
                    font: fontType
                };
                await storageMode.set({ 'widgets': widgets });
                console.log(`Widget ${this.id} updated in storage at index ${existingIndex}`);
            } else {
                console.warn(`Widget with ID ${this.id} not found in storage.`);
            }

            this.closeEditPanel(handleClickOutside);
        } catch (error) {
            console.error('Failed to save widget changes:', error);
        }
    }

    // Also add this method to ensure proper updating without duplicates
    async updateExistingWidget(newProperties) {
        if (this.isDestroyed) {
            throw new Error('Cannot update destroyed widget');
        }
        
        try {
            // Update the instance properties
            Object.keys(newProperties).forEach(key => {
                if (this.hasOwnProperty(key)) {
                    this[key] = newProperties[key];
                }
            });
            
            // Apply the changes to the DOM element
            this.update();
            
            // Update storage by merging with existing data
            await this.saveToStorage(newProperties, { merge: true });
            
            console.log(`Widget ${this.id} updated successfully`);
            return true;
        } catch (error) {
            console.error(`Failed to update widget ${this.id}:`, error);
            throw error;
        }
    }

    async updateWidgetInStorage(newProperties) {
        if (this.isDestroyed) {
            throw new Error('Cannot update destroyed widget');
        }

        try {
            const data = await storageMode.get('widgets');
            let widgets = data?.widgets || [];

            const existingIndex = widgets.findIndex(w => w.id === this.id);

            if (existingIndex >= 0) {
                // Correctly update the properties of the existing widget
                widgets[existingIndex] = {
                    ...widgets[existingIndex],
                    ...newProperties
                };
                console.log(`Updated existing widget ${this.id} in storage`);
            } else {
                console.warn(`Widget with ID ${this.id} not found in storage. Adding as new.`);
                // In an edit scenario, it's safer to not add a new widget here,
                // but if you must, ensure it's a complete widget object.
                const newWidgetData = this.getStorageData();
                widgets.push({
                    ...newWidgetData,
                    ...newProperties
                });
            }
            
            await storageMode.set({ 'widgets': widgets });
            return true;
        } catch (error) {
            console.error(`Failed to update widget ${this.id} in storage:`, error);
            throw error;
        }
    }

    async checkForDuplicates() {
        try {
            const data = await storageMode.get('widgets');
            const widgets = data?.widgets || [];
            
            const duplicates = widgets.filter(w => w.id === this.id);
            if (duplicates.length > 1) {
                console.warn(`Found ${duplicates.length} widgets with ID ${this.id}:`, duplicates);
                return duplicates;
            }
            
            console.log(`No duplicates found for widget ${this.id}`);
            return [];
        } catch (error) {
            console.error('Error checking for duplicates:', error);
            return [];
        }
    }
}