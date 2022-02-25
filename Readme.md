# House of Spoons

For anyone that wants to test the functionality of the website, you will need to run the website on an local server.

I recommend Express node.js web application framework HTTP server[^1].

[^1]: You can also you your own local server but to run it quickly you can use the provided server .js.

## How to install

step 1: run the command ```npm install express -- save``` inside [Staking Website](https://github.com/KaranConcave/HouseofSpoons/tree/main/Staking%20Website)

step 2: create a file in the staking website folder called [server.js](https://github.com/KaranConcave/HouseofSpoons/blob/main/Staking%20Website/server.js) 

step 3: paste the following code inside the [server.js](https://github.com/KaranConcave/HouseofSpoons/blob/main/Staking%20Website/server.js):
```
var express = require('express');
var app = express();
app.use(express.static(__dirname));
app.listen('3300');
console.log('Running at\nhttp://localhost:3300');
```

step 4: 
- [x] open cmd and navigate to the staking folder
- [x] run the command ```node server.js``` to start the server and test the website functionalities

#### Optional

step 5: This step is optional but if you want to test all the functionalities of the website you need to request a NFT from me. To request a NFT you can send me a dm on discord Karan#8060.
