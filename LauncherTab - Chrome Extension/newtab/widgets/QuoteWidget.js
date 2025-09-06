import { Widget } from "./Widget.js";
import { storageMode } from "../../global/globalVariables.js";
let currentWidgetPanel = null;

export class QuoteWidget extends Widget {
    constructor(options = {}) {
        const defaultOptions = {
            cssClass: 'quote-container',
            updateInterval: 60000,
            quotes: options.quotes || ['No quotes available.'],
            font: options.font || 'Google Sans',
            ...options
        };

        defaultOptions.content = QuoteWidget.generateQuoteHTML(defaultOptions.quotes);

        super(defaultOptions);

        this.font = defaultOptions.font;
        this.quotes = defaultOptions.quotes;
    }

    static getRandomQuote(quotes) {
        // Get a random index from the quotes array
        const randomIndex = Math.floor(Math.random() * quotes.length);

        // Return the quote at the random index
        return quotes[randomIndex];
    }

    static generateQuoteHTML(quotes) {
        const quote = QuoteWidget.getRandomQuote(quotes);
        return `<p class="quote-text">${quote}</p>`;
    }

    onRender() {
        this.setFont(this.font);
    }

    setFont(fontName) {
        if (this.isDestroyed) return;
        
        if (this.element) {
            const quoteElement = this.element.querySelector('.quote-text');
            if (quoteElement) {
                quoteElement.style.fontFamily = fontName;
            }
        }
        this.font = fontName;
    }

    getStorageData() {
        return {
            id: this.id,
            type: 'quote',
            quotes: this.quotes,
            font: this.font,
            cssClass: this.cssClass,
            draggable: this.draggable
        };
    }

    update() {
        if (this.isDestroyed) return;
        
        const quoteElement = this.element?.querySelector('.quote-text');
        if (quoteElement) {
            quoteElement.textContent = QuoteWidget.getRandomQuote(this.quotes);
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

    onClick() {
        console.log(`Quote widget ${this.id} clicked - changing quote`);
        this.update();
        //this.updateExistingWidget();
        this.updateWidgetInStorage();
    }

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
}