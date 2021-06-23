const { timeStamp } = require('console');
const express = require('express')
const app = express()
const port = 3001;
Canvas = require('canvas');
var fs = require("fs");
var filecounter = 1;

function rawBody(req, res, next) {
   var chunks = [];

   req.on('data', function(chunk) {
       chunks.push(chunk);
   });

   req.on('end', function() {
       var buffer = Buffer.concat(chunks);

       req.bodyLength = buffer.length;
       req.rawBody = buffer;
       next();
   });

   req.on('error', function (err) {
       console.log(err);
       res.status(500);
   });
}
function getRandomFileName() {
   var timestamp = new Date().toISOString().replace(/[-:.]/g,"");  
   var random = ("" + Math.random()).substring(2, 8); 
   var random_number = timestamp+random;  
   return random_number;
   }

app.post('/upload-image', rawBody, function (req, res) {

   if (req.rawBody && req.bodyLength > 0) {
    
      // var data = req.rawBody.replace(/^data:image\/\w+;base64,/, "");
      // var buf = new Buffer.from(data, 'base64');
     /// var filename = 
     fs.writeFile(__dirname + "/" + filecounter+".png", req.rawBody, err => {
    if (err) throw err;
    console.log('Saved!');
    filecounter++;
   })
       // TODO save image (req.rawBody) somewhere

       // send some content as JSON
       res.send(200, {status: 'OK'});
   } else {
       res.send(500);
   }

});

app.get('/test',function(req,res)
{
   res.send(200, {status: 'OK'});
});

  app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
  })