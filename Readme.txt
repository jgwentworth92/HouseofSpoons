For anyone that wants to test the functionality of the website, you will need to run the website on an local server.

I recommend Express node.js web application framework HTTP server.

how to install:

step 1: run the command (npm install express -- save) inside /// @title Staking Website
step 2: create a file in the staking website folder called server.js 
step 3: paste the following code inside the server.js:  
var express = require('express');
var app = express();
app.use(express.static(__dirname));
app.listen('3300');
console.log('Running at\nhttp://localhost:3300');
step 4: open cmd and navigate to the staking folder, as for example, cd desktop, cd staking website and run the command node server.js to start the server and test the website functionalities.
