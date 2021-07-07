const { timeStamp, debug } = require('console');
const express = require('express')
const app = express()
const port = 3001;
var rimraf = require("rimraf");

var fs = require("fs");
var cron = require('node-cron');
const path = require('path');
var filecounter = 1;
var foldername="/home/shazia/";


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
    cron.schedule("*/1 * * * * *", () => {
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
   
    // if(fs.existsSync("/home/shazia/esac/datasets/fbs/"+foldername))
    // {
    //     rimraf("/home/shazia/esac/datasets/fbs/"+foldername, function () { console.log("done"); });
    //    // fs.rmdirSync("/home/shazia/esac/datasets/fbs/"+foldername, { recursive: true });
    //     // fs.rmdir("/home/shazia/esac/datasets/fbs/"+foldername);
    //     console.log("Already Exist");
    // }
    // else
    // {

         fs.mkdirSync(foldername+"/home/shazia/esac/datasets/fbs/");
         console.log(foldername+"Created folder");
   // }
}

function DelFolderData()
{

//  if(fs.existsSync("/home/shazia/esac/datasets/fbs/"+"test"))
//      {
//         rimraf("/home/shazia/esac/datasets/fbs/"+"test", function () { console.log("done"); });
//     }    
   
//     CreateNewFolderIfNotExist("test");
//     CreateNewFolderIfNotExist("test/calibration");
//     CreateNewFolderIfNotExist("test/poses");
//     CreateNewFolderIfNotExist("test/rgb");

const subdir1 = foldername+"esac/datasets/fbs/test/rgb";
const subdir2= foldername+"esac/datasets/fbs/test/poses";
const subdir3 = foldername+"esac/datasets/fbs/test/calibration";




fs.readdir(subdir1, (err, files) => {
  if (err) throw err;

  for (const file of files) {
    fs.unlink(path.join(subdir1, file), err => {
      if (err) throw err;

    });
  }
});

fs.readdir(subdir2, (err, files) => {
    if (err) throw err;
  
    for (const file of files) {
      fs.unlink(path.join(subdir2, file), err => {
        if (err) throw err;
  
      });
    }
  });

  fs.readdir(subdir3, (err, files) => {
    if (err) throw err;
  
    for (const file of files) {
      fs.unlink(path.join(subdir3, file), err => {
        if (err) throw err;
  
      });
    }
  });



}

app.post('/createfolder',function(req,res)
{
    console.log("Create Folder API Called");
    DelFolderData();
    res.status(200, {status: 'Folder Created Successfull'});
});

app.post('/upload-image', rawBody, function (req, res) {

   if (req.rawBody && req.bodyLength > 0) {
    
     fs.writeFile( foldername+"esac/datasets/fbs/test/rgb/" + filecounter+".jpg", req.rawBody, err => {
    if (err) throw err;
    filecounter++;
   })
   fs.writeFile( foldername+"esac/datasets/fbs/test/calibration/" + filecounter+".jpg"+".calibration"+".txt","658.999", err => {
    if (err) throw err;

   })
   array = "1 0 0 0\n0 1 0 0\n0 0 1 0\n0 0 0 1";
   fs.writeFile( foldername+"esac/datasets/fbs/test/poses/" + filecounter+".jpg"+".poses"+".txt",array, err => {
    if (err) throw err;

   })
   
       // TODO save image (req.rawBody) somewhere

       // send some content as JSON
       res.send(200, {status: 'OK'});
   } else {
       res.send(500);
   }

});



       // TODO save image (req.rawBody) somewhere

   
app.post('/runBatchFile',function(req,res)
{
    const { exec } = require('child_process');
    fs.unlinkSync(foldername+"esac/environments/fbs/poses_esac_.txt")

    exec( foldername+"ARscript.sh");
    console.log("Batch FIle");
});
app.post('/runCronJob',function(req,res)
{
   RunCronJob();
});
app.get('/readPosesfile',function(req,res)
{
        fs.readFile(foldername+"esac/environments/fbs/poses_esac_.txt", function (err, data) {
        res.end(data);
    });
});
  app.listen(port, () => {
    console.log(`Server app listening at http://localhost:${port}`)
  })
