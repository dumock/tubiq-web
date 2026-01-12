/**
 * Expansion Engine - Fallback Mode (No Native Modules)
 * 
 * Since native modules require compilation, this version uses a simplified approach.
 * The snippet expansion feature is disabled until native modules are properly built.
 */

class ExpansionEngine {
    constructor() {
        this.isEnabled = false;
        this.isRunning = false;
        this.isAvailable = false; // Native modules not available
        this.hasHook = false;
        this.hasRobot = false;
        this.mode = 'disabled';
    }

    getStatus() {
        return {
            isEnabled: this.isEnabled,
            isRunning: this.isRunning,
            isAvailable: this.isAvailable,
            hasHook: this.hasHook,
            hasRobot: this.hasRobot,
            mode: this.mode
        };
    }

    start() {
        console.log('Expansion Engine: Native modules not available. Expansion disabled.');
        this.isRunning = false;
    }

    stop() {
        this.isRunning = false;
    }

    toggle() {
        // Cannot toggle if not available
        return this.isEnabled;
    }
}

module.exports = new ExpansionEngine();
