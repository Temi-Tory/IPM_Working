// tab-manager.js - Enhanced tab navigation management with three-tier analysis support
export class TabManager {
    constructor(domManager) {
        this.dom = domManager;
        this.analysisMode = null; // 'structure', 'diamond', 'full', null
        this.availableTabs = new Set(['analysis']); // Start with only analysis tab available
        this.tabHierarchy = {
            'analysis': 0,
            'structure': 1,
            'diamonds': 2, 
            'visualization': 2,
            'results': 3
        };
    }

    initializeEventListeners() {
        // Tab navigation handlers
        this.dom.elements.tabBtns.forEach(btn => {
            btn.addEventListener('click', (event) => {
                const targetTab = btn.dataset.tab;
                
                // Update tab availability first to ensure current state
                this.updateTabAvailability();
                
                // Check if tab is available
                if (!this.isTabAvailable(targetTab)) {
                    event.preventDefault();
                    console.log(`Tab ${targetTab} is not available, showing requirements message`);
                    this.showTabRequirementsMessage(targetTab);
                    return;
                }
                
                console.log(`Tab ${targetTab} is available, switching to it`);
                this.switchTab(targetTab);
            });
        });
        
        // Initialize tab states
        this.updateTabAvailability();
    }

    switchTab(tabName) {
        // Validate tab is available
        if (!this.isTabAvailable(tabName)) {
            console.warn(`Tab ${tabName} is not available in current analysis mode`);
            return false;
        }
        
        // Remove active class from all tabs
        this.dom.elements.tabBtns.forEach(btn => btn.classList.remove('active'));
        this.dom.elements.tabContents.forEach(content => content.classList.remove('active'));
        
        // Add active class to target tab
        const targetBtn = this.dom.querySelector(`[data-tab="${tabName}"]`);
        const targetContent = this.dom.querySelector(`#${tabName}-tab`);
        
        if (targetBtn) {
            targetBtn.classList.add('active');
            console.log(`Switched to tab: ${tabName}`);
        }
        if (targetContent) {
            targetContent.classList.add('active');
        }
        
        // Special handling for different tabs
        this.handleTabSpecialBehavior(tabName);
        
        return true;
    }

    handleTabSpecialBehavior(tabName) {
        switch (tabName) {
            case 'visualization':
                // Update visualization when switching to viz tab
                if (window.AppState && (window.AppState.networkData || window.AppState.structureData)) {
                    setTimeout(() => {
                        if (window.AppManagers && window.AppManagers.visualization) {
                            window.AppManagers.visualization.updateVisualization();
                        }
                    }, 100);
                }
                break;
                
            case 'structure':
                // Update structure display if needed
                if (window.AppState && window.AppState.structureData) {
                    setTimeout(() => {
                        if (window.AppManagers && window.AppManagers.structure) {
                            window.AppManagers.structure.displayStructureAnalysis();
                        }
                    }, 100);
                }
                break;
                
            case 'diamonds':
                // Update diamond analysis display
                if (window.AppState && window.AppState.diamondData) {
                    setTimeout(() => {
                        if (window.AppManagers && window.AppManagers.diamond) {
                            window.AppManagers.diamond.displayDiamondAnalysis();
                        }
                    }, 100);
                }
                break;
                
            case 'results':
                // Update results display  
                if (window.AppState && window.AppState.analysisResults) {
                    setTimeout(() => {
                        if (window.AppManagers && window.AppManagers.analysis) {
                            window.AppManagers.analysis.updateResultsTable();
                        }
                    }, 100);
                }
                break;
        }
    }

    // Three-tier analysis mode management
    setAnalysisMode(mode, data = null) {
        console.log(`Setting analysis mode: ${mode}`);
        this.analysisMode = mode;
        
        switch (mode) {
            case 'structure':
                this.enableStructureMode(data);
                break;
            case 'diamond':
                this.enableDiamondMode(data);
                break;
            case 'full':
                this.enableFullMode(data);
                break;
            case null:
                this.resetAllTabs();
                break;
            default:
                console.warn(`Unknown analysis mode: ${mode}`);
        }
        
        this.updateTabAvailability();
    }

    enableStructureMode(structureData) {
        // Tier 1: Structure analysis completed
        this.availableTabs = new Set(['analysis', 'structure', 'visualization']);
        
        // Show structure analysis badge
        this.addAnalysisBadge('structure', 'Structure Analysis Complete');
        
        // Enable structure tab if not already active
        if (!this.isTabActive('structure')) {
            this.switchTab('structure');
        }
        
        console.log('Tier 1 enabled - Tabs: analysis, structure, visualization');
    }

    enableDiamondMode(diamondData) {
        // Tier 2: Diamond analysis completed (includes structure)
        this.availableTabs = new Set(['analysis', 'structure', 'diamonds', 'visualization']);
        
        // Show both structure and diamond analysis badges since Tier 2 includes Tier 1
        this.addAnalysisBadge('structure', 'Structure Analysis Complete');
        this.addAnalysisBadge('diamond', 'Diamond Analysis Complete');
        
        // Enable diamonds tab if not already active
        if (!this.isTabActive('diamonds')) {
            this.switchTab('diamonds');
        }
        
        console.log('Tier 2 enabled - Tabs: analysis, structure, diamonds, visualization (includes Tier 1)');
    }

    enableFullMode(fullData) {
        // Tier 3: Full belief propagation completed (includes all)
        this.availableTabs = new Set(['analysis', 'structure', 'diamonds', 'visualization', 'results']);
        
        // Show all analysis badges since Tier 3 includes Tiers 1 & 2
        this.addAnalysisBadge('structure', 'Structure Analysis Complete');
        this.addAnalysisBadge('diamond', 'Diamond Analysis Complete');
        this.addAnalysisBadge('full', 'Full Analysis Complete');
        
        // Enable results tab
        if (!this.isTabActive('results')) {
            this.switchTab('results');
        }
        
        console.log('Tier 3 enabled - All tabs available (includes Tiers 1 & 2)');
    }

    resetAllTabs() {
        // Reset to initial state
        this.availableTabs = new Set(['analysis']);
        this.analysisMode = null;
        
        // Remove all analysis badges
        this.removeAllAnalysisBadges();
        
        // Switch back to analysis tab
        this.switchTab('analysis');
        
        console.log('All tabs reset - Only analysis tab available');
    }

    // Tab availability management
    isTabAvailable(tabName) {
        return this.availableTabs.has(tabName);
    }

    updateTabAvailability() {
        this.dom.elements.tabBtns.forEach(btn => {
            const tabName = btn.dataset.tab;
            const isAvailable = this.isTabAvailable(tabName);
            
            // Update button appearance
            if (isAvailable) {
                btn.disabled = false;
                btn.classList.remove('tab-disabled');
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
                btn.title = ''; // Clear any tooltip
            } else {
                btn.disabled = true;
                btn.classList.add('tab-disabled');
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
                btn.title = this.getTabRequirementMessage(tabName);
            }
        });
    }

    getTabRequirementMessage(tabName) {
        switch (tabName) {
            case 'structure':
                return 'Run Tier 1: Structure Analysis first';
            case 'diamonds':
                return 'Run Tier 2: Diamond Analysis first';
            case 'visualization':
                return 'Run Tier 1: Structure Analysis first';
            case 'results':
                return 'Run Tier 3: Full Analysis first';
            default:
                return 'Analysis required';
        }
    }

    showTabRequirementsMessage(tabName) {
        // Double-check if tab is actually available before showing warning
        if (this.isTabAvailable(tabName)) {
            console.log(`Tab ${tabName} is actually available, skipping warning message`);
            return;
        }
        
        const message = this.getTabRequirementMessage(tabName);
        
        // Create temporary notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #dc3545;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            font-weight: 600;
            animation: slideInRight 0.3s ease-out;
        `;
        notification.textContent = message;
        
        // Add slide-in animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'fadeOut 0.3s ease-out forwards';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
                if (style.parentNode) {
                    style.parentNode.removeChild(style);
                }
            }, 300);
        }, 3000);
        
        // Add fadeOut animation
        style.textContent += `
            @keyframes fadeOut {
                from { opacity: 1; transform: translateX(0); }
                to { opacity: 0; transform: translateX(100%); }
            }
        `;
    }

    // Analysis progress badges
    addAnalysisBadge(type, message) {
        const targetBtn = this.dom.querySelector(`[data-tab="${this.getTargetTabForBadge(type)}"]`);
        if (!targetBtn) return;
        
        // Remove existing badge
        const existingBadge = targetBtn.querySelector('.analysis-badge');
        if (existingBadge) {
            existingBadge.remove();
        }
        
        // Create new badge
        const badge = document.createElement('span');
        badge.className = `analysis-badge badge-${type}`;
        badge.style.cssText = `
            position: absolute;
            top: -8px;
            right: -8px;
            background: ${this.getBadgeColor(type)};
            color: white;
            font-size: 10px;
            font-weight: bold;
            padding: 2px 6px;
            border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            z-index: 10;
            animation: badgePulse 0.6s ease-out;
        `;
        badge.textContent = '✓';
        badge.title = message;
        
        // Position tab button relatively for badge positioning
        targetBtn.style.position = 'relative';
        targetBtn.appendChild(badge);
        
        // Add pulse animation
        if (!document.getElementById('badge-animations')) {
            const style = document.createElement('style');
            style.id = 'badge-animations';
            style.textContent = `
                @keyframes badgePulse {
                    0% { transform: scale(0); opacity: 0; }
                    50% { transform: scale(1.3); opacity: 1; }
                    100% { transform: scale(1); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
    }

    getTargetTabForBadge(type) {
        switch (type) {
            case 'structure': return 'structure';
            case 'diamond': return 'diamonds';
            case 'full': return 'results';
            default: return 'analysis';
        }
    }

    getBadgeColor(type) {
        switch (type) {
            case 'structure': return '#28a745';
            case 'diamond': return '#fd79a8';
            case 'full': return '#667eea';
            default: return '#6c757d';
        }
    }

    removeAllAnalysisBadges() {
        document.querySelectorAll('.analysis-badge').forEach(badge => {
            badge.remove();
        });
    }

    // Progressive enablement methods
    enableStructureTabs() {
        this.setAnalysisMode('structure');
    }

    enableDiamondTabs() {
        this.setAnalysisMode('diamond');
    }

    enableAllTabs() {
        this.setAnalysisMode('full');
    }

    disableAllTabs() {
        this.setAnalysisMode(null);
    }

    // State queries
    isTabActive(tabName) {
        const targetBtn = this.dom.querySelector(`[data-tab="${tabName}"]`);
        return targetBtn ? targetBtn.classList.contains('active') : false;
    }

    getActiveTab() {
        const activeBtn = this.dom.querySelector('.tab-btn.active');
        return activeBtn ? activeBtn.dataset.tab : null;
    }

    getCurrentAnalysisMode() {
        return this.analysisMode;
    }

    getAvailableTabs() {
        return Array.from(this.availableTabs);
    }

    // Tab progression helpers
    canProgressToTab(tabName) {
        const currentMode = this.analysisMode;
        const targetHierarchy = this.tabHierarchy[tabName] || 999;
        
        switch (currentMode) {
            case null:
                return targetHierarchy <= 0; // Only analysis
            case 'structure':
                return targetHierarchy <= 2; // Up to visualization/diamonds
            case 'diamond':
                return targetHierarchy <= 2; // Up to visualization/diamonds  
            case 'full':
                return targetHierarchy <= 3; // All tabs
            default:
                return false;
        }
    }

    getNextAvailableTab() {
        const currentTab = this.getActiveTab();
        const availableTabsArray = Array.from(this.availableTabs);
        const currentIndex = availableTabsArray.indexOf(currentTab);
        
        if (currentIndex >= 0 && currentIndex < availableTabsArray.length - 1) {
            return availableTabsArray[currentIndex + 1];
        }
        
        return null;
    }

    // Analysis workflow helpers
    suggestNextAction() {
        const currentMode = this.analysisMode;
        
        switch (currentMode) {
            case null:
                return 'Upload a CSV file and run Tier 1: Structure Analysis to begin';
            case 'structure':
                return 'Run Tier 2: Diamond Analysis to identify complex structures, or skip to Tier 3: Full Analysis';
            case 'diamond':
                return 'Run Tier 3: Full Analysis to calculate node probabilities with belief propagation';
            case 'full':
                return 'Analysis complete! Explore results, visualization, and diamond structures';
            default:
                return 'Upload a CSV file to start analysis';
        }
    }

    displayAnalysisProgress() {
        const progressInfo = {
            mode: this.analysisMode,
            availableTabs: this.getAvailableTabs(),
            activeTab: this.getActiveTab(),
            suggestion: this.suggestNextAction()
        };
        
        console.log('Analysis Progress:', progressInfo);
        return progressInfo;
    }
}