const { timeStamp, debug } = require('console');
const express = require('express')
const app = express()
const port = 3001;
var rimraf = require("rimraf");

var fs = require("fs");
var cron = require('node-cron');
const path = require('path');
var filecounter = 1;
var foldername = "/home/shazia/";


function rawBody(req, res, next) {
  var chunks = [];

  req.on('data', function (chunk) {
    chunks.push(chunk);
  });

  req.on('end', function () {
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

function RunCronJob() {
  cron.schedule("*/1 * * * * *", () => {
    console.log('Cron Job Runing-------\n ');
    const { exec } = require('child_process');
    exec("/home/shazia/ARscript.sh");
  });

}

function getRandomFileName() {
  var timestamp = new Date().toISOString().replace(/[-:.]/g, "");
  var random = ("" + Math.random()).substring(2, 8);
  var random_number = timestamp + random;
  return random_number;
}


function DelFolderData() {

  //  if(fs.existsSync("/home/shazia/esac/datasets/fbs/"+"test"))
  //      {
  //         rimraf("/home/shazia/esac/datasets/fbs/"+"test", function () { console.log("done"); });
  //     }    

  //     CreateNewFolderIfNotExist("test");
  //     CreateNewFolderIfNotExist("test/calibration");
  //     CreateNewFolderIfNotExist("test/poses");
  //     CreateNewFolderIfNotExist("test/rgb");

  const subdir1 = foldername + "esac/datasets/fbs/test/rgb";
  const subdir2 = foldername + "esac/datasets/fbs/test/poses";
  const subdir3 = foldername + "esac/datasets/fbs/test/calibration";




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

app.post('/createfolder', function (req, res) {
  console.log("Create Folder API Called");
  CreateNewFolderIfNotExist("Sallman");
 // DelFolderData();
 // console.log("Data Deleted Sucessfully");
  res.status(200, { status: 'Folder Created Successfull' });
});

app.post('/upload-image', rawBody, function (req, res) {
  //658.999
  //3054.54 Iphone 12 focal length

 DelFolderData();

  if (req.rawBody && req.bodyLength > 0) {


    const data=fs.readFileSync(foldername + "esac/datasets/fbs/test.txt", 'utf8' , (err, data) => {
      if (err) {
        console.error(data)
        return
      }
      console.log(data)
    })
    
    fs.writeFile(foldername + "esac/datasets/fbs/test/rgb/" + filecounter + ".jpg", req.rawBody, err => {
      if (err) throw err;
      filecounter++;
    })
    fs.writeFile(foldername + "esac/datasets/fbs/test/calibration/" + filecounter + ".jpg" + ".calibration" + ".txt",data.toString(), err => {
      if (err) throw err;

    })
    array = "1 0 0 0\n0 1 0 0\n0 0 1 0\n0 0 0 1";
    fs.writeFile(foldername + "esac/datasets/fbs/test/poses/" + filecounter + ".jpg" + ".poses" + ".txt", array, err => {
      if (err) throw err;

    })

    // TODO save image (req.rawBody) somewhere

    // send some content as JSON
    res.send('Image Sent Successfully to the server');
   // res.send(200, { status: 'Image Stored Successfully in the server' });
  } else {
    res.send(500);
  }

});

function CreateNewFolderIfNotExist(foldername)
{
  try {
    if (!fs.existsSync("/home/shazia/esac/datasets/fbs/"+foldername)) {
      fs.mkdirSync("/home/shazia/esac/datasets/fbs/"+foldername)
    }

   else if (fs.existsSync("/home/shazia/esac/datasets/fbs/"+foldername)) {console.log("FOlder Exist");}
  }
  
  
  
    catch (err) {
    console.error(err)
  }
   
}


// TODO save image (req.rawBody) somewhere


app.post('/runBatchFile', function (req, res) {
  // const { exec } = require('child_process');
  //  fs.unlinkSync(foldername+"esac/environments/fbs/poses_esac_.txt")

  // exec( foldername+"ARscript.sh");
  // console.log("Batch FIle");

  // Child process is required to spawn any kind of asynchronous process
  var childProcess = require("child_process");
  // This line initiates bash
  var script_process = childProcess.spawn('/bin/bash', ['/home/shazia/ARscript.sh'], { env: process.env });
  // Echoes any command output 
  script_process.stdout.on('data', function (data) {
    console.log('stdout: ' + data);

  });
  // Error output
  script_process.stderr.on('data', function (data) {
    console.log('stderr: ' + data);
  });
  // Process exit
  script_process.on('close', function (code) {
    console.log('child process exited with code ' + code);

    fs.readFile(foldername + "esac/environments/fbs/poses_esac_.txt", function (err, data) {
      res.end(data, { status: 'ESAC Executeeeeeeeeed Successfully' });
    
      const { exec } = require('child_process');
      exec(foldername + "GVisBatch.sh");
      console.log("GVIS Batch File Executed");

    });

  });

});
app.post('/runCronJob', function (req, res) {
  RunCronJob();
});
app.get('/readPosesfile', function (req, res) {
  fs.readFile(foldername + "esac/environments/fbs/poses_esac_.txt", function (err, data) {
    res.send(data);
  });
});
app.listen(port, () => {
  console.log(`Server app listening at http://localhost:${port}`)
})

app.get('/checkConnection', function (req, res) {
  DelFolderData();
  res.send(200, { status: 'Connected' });
});
