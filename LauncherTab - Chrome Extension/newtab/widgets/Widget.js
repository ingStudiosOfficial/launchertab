import { storageMode } from "../../global/globalVariables.js";
import { widgetInstances } from "../registry/widgetInstances.js";
let isWidgetDragging = false;
let isRearranging = false;
let rearrangeTarget = null;
let currentWidgetPanel = null;

export class Widget {
    constructor(options = {}) {
        this.id = options.id || this.generateId();
        this.content = options.content || '';
        this.cssClass = options.cssClass || 'widget-container';
        this.draggable = options.draggable !== undefined ? options.draggable : true;
        this.updateInterval = options.updateInterval || null;
        this.intervalId = null;
        this.element = null;
        this.parentContainer = null;
        this.dragEventListeners = [];
        this.isDestroyed = false;
        
        // Validation
        this.validateOptions(options);
    }

    generateId() {
        return `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    validateOptions(options) {
        if (options.updateInterval && typeof options.updateInterval !== 'number') {
            console.warn('updateInterval should be a number (milliseconds)');
        }
    }

    createElement() {
        if (this.isDestroyed) {
            console.error('Cannot create element for destroyed widget');
            return null;
        }

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
            return null;
        }

        if (this.isDestroyed) {
            console.error('Cannot render destroyed widget');
            return null;
        }

        this.parentContainer = parentContainer;
        const widgetElement = this.createElement();
        
        if (!widgetElement) {
            return null;
        }

        parentContainer.appendChild(widgetElement);

        // Register this widget instance globally
        widgetInstances.set(this.id, this);

        if (this.updateInterval && typeof this.update === 'function') {
            this.startUpdateInterval();
        }

        if (this.draggable) {
            this.setupDragAndDrop();
        }

        try {
            this.onRender();
        } catch (error) {
            console.error(`Error in widget ${this.id} onRender:`, error);
        }

        return this;
    }

    addTrackedDragEventListener(element, event, handler) {
        if (!element || !event || !handler) {
            console.warn('Invalid parameters for addTrackedDragEventListener');
            return;
        }

        element.addEventListener(event, handler);
        this.dragEventListeners.push({ element, event, handler });
    }

    cleanupDragEventListeners() {
        this.dragEventListeners.forEach(({ element, event, handler }) => {
            try {
                if (element && element.removeEventListener) {
                    element.removeEventListener(event, handler);
                }
            } catch (error) {
                console.warn('Error removing event listener:', error);
            }
        });
        this.dragEventListeners = [];
    }

    setupDragAndDrop() {
        if (!this.element || this.isDestroyed) return;

        const widget = this.element;

        const clickHandler = (e) => {
            if (isWidgetDragging) {
                e.preventDefault();
                return;
            }
            console.log(`Widget ${this.id} clicked.`);
            try {
                this.onClick();
            } catch (error) {
                console.error(`Error in widget ${this.id} onClick:`, error);
            }
        };
        this.addTrackedDragEventListener(widget, 'click', clickHandler);

        const dragStartHandler = (e) => {
            console.log(`Widget ${this.id} started dragging.`);
            isWidgetDragging = true;
            e.dataTransfer.setData('text/plain', this.id);
            e.dataTransfer.setData('text/widget-id', this.id);
            e.dataTransfer.setData('text/widget-type', this.constructor.name);
            e.dataTransfer.effectAllowed = 'move';

            this.addDraggingStyles();
            widget.classList.add('dragging-source');
            
            setTimeout(() => {
                widget.style.visibility = 'hidden';
            }, 0);

            try {
                this.onDragStart(e);
            } catch (error) {
                console.error(`Error in widget ${this.id} onDragStart:`, error);
            }
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

            this.removeDraggingStyles();

            try {
                this.onDragEnd(e);
            } catch (error) {
                console.error(`Error in widget ${this.id} onDragEnd:`, error);
            }
        };
        this.addTrackedDragEventListener(widget, 'dragend', dragEndHandler);
    }

    addDraggingStyles() {
        const shortcutsArea = document.getElementById('shortcuts-area');
        const gallery = document.getElementById('shortcut-gallery');
        
        if (shortcutsArea) {
            shortcutsArea.classList.add('dragging');
        }
        if (gallery) {
            gallery.style.border = '2px solid var(--primary-color)';
        }
    }

    removeDraggingStyles() {
        const shortcutsArea = document.getElementById('shortcuts-area');
        const gallery = document.getElementById('shortcut-gallery');
        const actionButtons = document.querySelectorAll('.action-button');
        const actionIcons = document.querySelectorAll('.action-icon');

        if (shortcutsArea) {
            shortcutsArea.classList.remove('dragging');
        }
        if (gallery) {
            gallery.style.borderColor = 'transparent';
        }

        actionButtons.forEach((button, btnIndex) => {
            button.classList.remove('dragover');
            if (actionIcons[btnIndex]) { 
                actionIcons[btnIndex].style.color = 'var(--primary-color)';
            }
        });
    }

    // Static method to set up action buttons - improved error handling
    static setupActionButtons() {
        console.log('Setting up action buttons for widgets');
        const actionButtons = document.querySelectorAll('.action-button');
        const actionIcons = document.querySelectorAll('.action-icon');

        actionButtons.forEach((actionButton, index) => {
            const actionButtonId = actionButton.id;
            
            // Clean up existing listeners
            Widget.cleanupActionButtonListeners(actionButton);
            
            const handlers = Widget.createActionButtonHandlers(actionButton, actionIcons[index]);
            
            // Store handlers for cleanup
            actionButton._widgetHandlers = handlers;
            
            // Add new listeners
            actionButton.addEventListener('dragenter', handlers.dragEnter);
            actionButton.addEventListener('dragover', handlers.dragOver);
            actionButton.addEventListener('dragleave', handlers.dragLeave);
            actionButton.addEventListener('drop', handlers.drop);
        });
    }

    static cleanupActionButtonListeners(actionButton) {
        if (actionButton._widgetHandlers) {
            const handlers = actionButton._widgetHandlers;
            actionButton.removeEventListener('dragenter', handlers.dragEnter);
            actionButton.removeEventListener('dragover', handlers.dragOver);
            actionButton.removeEventListener('dragleave', handlers.dragLeave);
            actionButton.removeEventListener('drop', handlers.drop);
            delete actionButton._widgetHandlers;
        }
    }

    static createActionButtonHandlers(actionButton, actionIcon) {
        const actionButtonId = actionButton.id;
        
        return {
            dragEnter: (e) => {
                e.preventDefault();
                if (isWidgetDragging) {
                    actionButton.classList.add('dragover');
                    if (actionIcon) {
                        actionIcon.style.color = '#ffffff';
                    }
                }
            },
            
            dragOver: (e) => {
                e.preventDefault();
                if (isWidgetDragging && !actionButton.classList.contains('dragover')) {
                    actionButton.classList.add('dragover');
                    if (actionIcon) {
                        actionIcon.style.color = '#ffffff';
                    }
                }
            },
            
            dragLeave: (e) => {
                if (isWidgetDragging && !actionButton.contains(e.relatedTarget) && e.relatedTarget !== actionButton) {
                    actionButton.classList.remove('dragover');
                    if (actionIcon) {
                        actionIcon.style.color = 'var(--primary-color)';
                    }
                }
            },
            
            drop: (e) => {
                e.preventDefault();
                if (!isWidgetDragging) return;
                
                actionButton.classList.remove('dragover');
                if (actionIcon) {
                    actionIcon.style.color = 'var(--primary-color)';
                }

                const draggedWidgetId = e.dataTransfer.getData('text/widget-id');
                const draggedWidgetType = e.dataTransfer.getData('text/widget-type');

                if (draggedWidgetId) {
                    const widgetInstance = widgetInstances.get(draggedWidgetId);
                    if (widgetInstance) {
                        Widget.handleWidgetAction(actionButtonId, widgetInstance, draggedWidgetId, draggedWidgetType);
                    } else {
                        console.error(`Widget instance not found for ID: ${draggedWidgetId}`);
                    }
                }
            }
        };
    }

    static handleWidgetAction(actionButtonId, widgetInstance, widgetId, widgetType) {
        try {
            console.log(`Action "${actionButtonId}" triggered for widget '${widgetId}'`);
            
            switch (actionButtonId) {
                case 'delete-widget':
                case 'delete-shortcut': // fallback
                    widgetInstance.deleteWidget(widgetId);
                    break;
                case 'edit-widget':
                case 'edit-shortcut': // fallback
                    widgetInstance.editWidget(widgetId);
                    break;
                default:
                    widgetInstance.onActionButtonDrop(actionButtonId, widgetId, widgetType);
            }
        } catch (error) {
            console.error(`Error handling widget action ${actionButtonId}:`, error);
        }
    }

    // Enhanced storage methods with better error handling
    static async saveWidget(widgetData, options = {}) {
        if (!widgetData || !widgetData.id) {
            throw new Error('Widget data must include an id');
        }

        try {
            const data = await storageMode.get('widgets');
            const widgets = data?.widgets || [];
            
            const existingIndex = widgets.findIndex(w => w.id === widgetData.id);
            
            if (existingIndex >= 0) {
                if (options.merge) {
                    widgets[existingIndex] = { ...widgets[existingIndex], ...widgetData };
                } else {
                    widgets[existingIndex] = widgetData;
                }
                console.log(`Widget ${widgetData.id} updated in storage`);
            } else {
                widgets.push(widgetData);
                console.log(`Widget ${widgetData.id} added to storage`);
            }
            
            await storageMode.set({ 'widgets': widgets });
            return true;
        } catch (error) {
            console.error('Error saving widget to storage:', error);
            throw error;
        }
    }

    static async loadWidgets(filterOptions = {}) {
        try {
            const data = await storageMode.get('widgets');
            const widgets = data?.widgets || [];
            
            let filteredWidgets = widgets;
            
            if (filterOptions.type) {
                filteredWidgets = filteredWidgets.filter(w => w.type === filterOptions.type);
            }
            if (filterOptions.id) {
                filteredWidgets = filteredWidgets.filter(w => w.id === filterOptions.id);
            }
            if (filterOptions.cssClass) {
                filteredWidgets = filteredWidgets.filter(w => w.cssClass === filterOptions.cssClass);
            }
            
            return filteredWidgets;
        } catch (error) {
            console.error('Error loading widgets from storage:', error);
            return [];
        }
    }

    static async removeWidget(widgetId) {
        if (!widgetId) {
            throw new Error('Widget ID is required');
        }

        try {
            const data = await storageMode.get('widgets');
            const widgets = data?.widgets || [];
            
            const filteredWidgets = widgets.filter(widget => widget.id !== widgetId);
            
            await storageMode.set({ 'widgets': filteredWidgets });
            console.log(`Widget ${widgetId} removed from storage`);
            return true;
        } catch (error) {
            console.error('Error removing widget from storage:', error);
            throw error;
        }
    }

    // Instance methods
    async saveToStorage(customData = {}, options = {}) {
        if (this.isDestroyed) {
            throw new Error('Cannot save destroyed widget');
        }
        
        const widgetData = { ...this.getStorageData(), ...customData };
        return await Widget.saveWidget(widgetData, options);
    }

    async removeFromStorage() {
        return await Widget.removeWidget(this.id);
    }

    getStorageData() {
        return {
            id: this.id,
            type: 'generic',
            cssClass: this.cssClass,
            draggable: this.draggable
        };
    }

    deleteWidget(widgetId) {
        const widgetInstance = widgetInstances.get(widgetId);
        
        if (widgetInstance) {
            const confirmDelete = confirm(`Are you sure you want to delete this widget?`);
            if (confirmDelete) {
                this.cleanupDraggingProperties();
                
                Widget.removeWidget(widgetId)
                    .then(() => {
                        widgetInstance.destroy();
                        console.log(`Widget ${widgetId} deleted and removed from storage.`);
                        // Refresh widgets in UI to prevent duplicates
                        if (typeof initializeWidgets === 'function') {
                            initializeWidgets();
                        }
                    })
                    .catch(error => {
                        console.error('Error removing widget from storage:', error);
                        widgetInstance.destroy(); // Still destroy even if storage fails
                        if (typeof initializeWidgets === 'function') {
                            initializeWidgets();
                        }
                    });
            }
        }
    }

    cleanupDraggingProperties() {
        isWidgetDragging = false;
        this.removeDraggingStyles();
        
        if (this.element) {
            this.element.classList.remove('dragging-source', 'returning');
            this.element.style.visibility = '';
        }
        
        // Clean up any other widgets
        document.querySelectorAll('.widget-container, .time-container').forEach(widget => {
            widget.classList.remove('dragging-source', 'returning');
            widget.style.visibility = '';
        });
    }

    destroy() {
        if (this.isDestroyed) {
            console.warn(`Widget ${this.id} is already destroyed`);
            return;
        }

        this.isDestroyed = true;
        this.cleanupDraggingProperties();
        this.stopUpdateInterval();
        this.cleanupDragEventListeners();
        
        // Remove from global registry
        widgetInstances.delete(this.id);
        
        // Remove element from DOM
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        
        // Clean up references
        this.element = null;
        this.parentContainer = null;
        this.content = '';
        this.dragEventListeners = [];
        
        console.log(`Widget ${this.id} destroyed`);
    }

    // Abstract methods - to be overridden
    editWidget(widgetId) {
        console.log(`Edit widget ${widgetId} - Override this method in subclass`);
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

    onRender() {
        // Override in subclass
    }

    // Update system
    startUpdateInterval() {
        if (this.updateInterval && typeof this.update === 'function') {
            this.intervalId = setInterval(() => {
                try {
                    if (!this.isDestroyed) {
                        this.update();
                    } else {
                        this.stopUpdateInterval();
                    }
                } catch (error) {
                    console.error(`Error updating widget ${this.id}:`, error);
                }
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

    // Utility methods
    setContent(newContent) {
        this.content = newContent;
        if (this.element && !this.isDestroyed) {
            this.element.innerHTML = newContent;
        }
    }

    addClass(className) {
        if (this.element && !this.isDestroyed) {
            this.element.classList.add(className);
        }
    }

    removeClass(className) {
        if (this.element && !this.isDestroyed) {
            this.element.classList.remove(className);
        }
    }
}