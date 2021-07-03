const { timeStamp } = require('console');
const express = require('express')
const app = express()
const port = 3001;

var fs = require("fs");
var cron = require('node-cron');
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

function RunCronJob()
{
    cron.schedule("*/10 * * * * *", () => {
        console.log('Cron Job Runing-------\n ');
        const { exec } = require('child_process');
       exec( "/home/shazia/ARscript.sh");
      });
    
}

function getRandomFileName() {
   var timestamp = new Date().toISOString().replace(/[-:.]/g,"");  
   var random = ("" + Math.random()).substring(2, 8); 
   var random_number = timestamp+random;  
   return random_number;
   }

function CreateNewFolderIfNotExist(foldername)
{
   
    if(fs.existsSync("/home/shazia/esac/datasets/fbs/"+foldername))
    {
        fs.rmdirSync("/home/shazia/esac/datasets/fbs/"+foldername, { recursive: true });
        // fs.rmdir("/home/shazia/esac/datasets/fbs/"+foldername);
        console.log("Already Exit");
    }
    else
    {

         fs.mkdirSync("/home/shazia/esac/datasets/fbs/"+foldername);
    }
}

function CreateFolderStructure()
{
   
    CreateNewFolderIfNotExist("test");
    CreateNewFolderIfNotExist("test/calibration");
    CreateNewFolderIfNotExist("test/poses");
    CreateNewFolderIfNotExist("test/rgb");
}
app.post('/createfolder',function(req,res)
{
    CreateFolderStructure();
  
        res.status(200, {status: 'Folder Created Successfull'});
});

app.post('/upload-image', rawBody, function (req, res) {

  
   if (req.rawBody && req.bodyLength > 0) {
    
     fs.writeFile( "/home/shazia/esac/datasets/fbs/test/rgb/" + filecounter+".jpg", req.rawBody, err => {
    if (err) throw err;
    console.log('Saved!');
    filecounter++;
   })
   fs.writeFile( "/home/shazia/esac/datasets/fbs/test/calibration/" + filecounter+".jpg"+".calibration"+".txt","658.999", err => {
    if (err) throw err;

   })
   array = "1 0 0 0\n0 1 0 0\n0 0 1 0\n0 0 0 1";
   fs.writeFile( "/home/shazia/esac/datasets/fbs/test/poses/" + filecounter+".jpg"+".poses"+".txt",array, err => {
    if (err) throw err;

   })
   
       // TODO save image (req.rawBody) somewhere

       // send some content as JSON
       res.send(200, {status: 'OK'});
   } else {
       res.send(500);
   }

});

app.post('/runBatchFile',function(req,res)
{
    const { exec } = require('child_process');

    exec( "/home/shazia/ARscript.sh");
});
app.post('/runCronJob',function(req,res)
{
   RunCronJob();
});
app.get('/readPosesfile',function(req,res)
{
        fs.readFile("/home/shazia/esac/environments/fbs/poses_esac_.txt", function (err, data) {
            res.end(data);
    });
});
  app.listen(port, () => {
    console.log(`Server app listening at http://localhost:${port}`)
  })