const Client = require('./src/client');
const config = require('./config.json');

new Client(config).start();
