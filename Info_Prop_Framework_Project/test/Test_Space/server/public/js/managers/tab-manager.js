// tab-manager.js - Tab navigation management
export class TabManager {
    constructor(domManager) {
        this.dom = domManager;
    }

    initializeEventListeners() {
        // Tab navigation handlers
        this.dom.elements.tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.dataset.tab;
                this.switchTab(targetTab);
            });
        });
    }

    switchTab(tabName) {
        this.dom.elements.tabBtns.forEach(btn => btn.classList.remove('active'));
        this.dom.elements.tabContents.forEach(content => content.classList.remove('active'));
        
        const targetBtn = this.dom.querySelector(`[data-tab="${tabName}"]`);
        const targetContent = this.dom.querySelector(`#${tabName}-tab`);
        
        if (targetBtn) targetBtn.classList.add('active');
        if (targetContent) targetContent.classList.add('active');
        
        // Special handling for visualization tab
        if (tabName === 'visualization' && window.AppState && window.AppState.networkData) {
            setTimeout(() => {
                if (window.AppManagers && window.AppManagers.visualization) {
                    window.AppManagers.visualization.updateVisualization();
                }
            }, 100);
        }
    }

    enableAllTabs() {
        this.dom.elements.tabBtns.forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = '1';
        });
    }

    disableAllTabs() {
        this.dom.elements.tabBtns.forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.5';
        });
    }

    isTabActive(tabName) {
        const targetBtn = this.dom.querySelector(`[data-tab="${tabName}"]`);
        return targetBtn ? targetBtn.classList.contains('active') : false;
    }

    getActiveTab() {
        const activeBtn = this.dom.querySelector('.tab-btn.active');
        return activeBtn ? activeBtn.dataset.tab : null;
    }
}