try {
    console.log('Versions:', process.versions);
    if (process.electronBinding) {
        console.log('process.electronBinding exists');
        try {
            const app = process.electronBinding('app');
            console.log('Got app binding:', app);
            console.log('App name:', app.getConnectionName ? app.getConnectionName() : 'unknown');
        } catch (e) {
            console.log('Failed to get app binding:', e);
        }
    } else {
        console.log('process.electronBinding is undefined');
    }
} catch (e) {
    console.log('Critical error:', e);
}
