const { timeStamp } = require('console');
const express = require('express')
const app = express()
const port = 3001;

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

function CreateNewFolderIfNotExit(foldername)
{
   
    if(fs.existsSync(__dirname+"/"+foldername+"/"))
    {
        console.log("Already Exit");
    }
    else
    {
        
         fs.mkdirSync(__dirname+"/"+foldername);
    }
}
function CreateFolderStructure()
{
    CreateNewFolderIfNotExit("test");
    CreateNewFolderIfNotExit("test/calibration");
    CreateNewFolderIfNotExit("test/poses");
    CreateNewFolderIfNotExit("test/rgb");
}
app.post('/createfolder',function(req,res)
{
    CreateFolderStructure();
  
        res.status(200, {status: 'Folder Created Successfull'});
});

app.post('/upload-image', rawBody, function (req, res) {

  
   if (req.rawBody && req.bodyLength > 0) {
    
     fs.writeFile(__dirname + "/test/rgb/" + filecounter+".jpg", req.rawBody, err => {
    if (err) throw err;
    console.log('Saved!');
    filecounter++;
   })
   fs.writeFile(__dirname + "/test/calibration/" + filecounter+".jpg"+".calibration"+".txt","658.999", err => {
    if (err) throw err;

   })
   array = "1 0 0 0\n0 1 0 0\n0 0 1 0\n0 0 0 1";
   fs.writeFile(__dirname + "/test/poses/" + filecounter+".jpg"+".poses"+".txt",array, err => {
    if (err) throw err;

   })
   
       // TODO save image (req.rawBody) somewhere

       // send some content as JSON
       res.send(200, {status: 'OK'});
   } else {
       res.send(500);
   }

});

app.get('/runBatchFile',function(req,res)
{
    const { exec } = require('child_process');

    exec(__dirname+ "/batch.bat");
});

  app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
  })