const electron = require('electron');
console.log('Test Startup Report');
console.log('Type:', typeof electron);
if (typeof electron === 'string') {
    console.log('Value:', electron);
    console.log('FAIL: electron is a string (path), meaning we are in Node mode.');
} else {
    console.log('SUCCESS: electron is an object.');
    console.log('Keys:', Object.keys(electron));
}
console.log('Process versions:', process.versions);
console.log('Env ELECTRON_RUN_AS_NODE:', process.env.ELECTRON_RUN_AS_NODE);
