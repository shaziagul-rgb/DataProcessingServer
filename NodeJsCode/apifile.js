const { timeStamp, debug } = require('console');
const express = require('express')
const app = express()
const port = 3001;
var rimraf = require("rimraf");
const session = require('express-session');
var fs = require("fs");
var cron = require('node-cron');
var lineReader = require('line-reader'); 
const readline = require('readline');
const path = require('path');
var filecounter = 1;
var userPath = "/home/shazia/";
var connectedUserID="";
var smartPhoneModel="";
var bodyParser = require('body-parser');
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));

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

app.post('/test', rawBody, function (req, res) {
  
      const rl = readline.createInterface({
        input: fs.createReadStream('/Users/shazia-gul/poses_esac_.txt'),
        crlfDelay: Infinity
      });
      
      rl.on('line', (line) => {

        if (line.startsWith("65.jpg")){
          console.log(`Display: ${line}`);

        }
       
      });
            
          
          
    });

 app.post('/send-PhoneModel', rawBody, function (req, res) {
  if (req.rawBody && req.bodyLength > 0) {
 
       smartPhoneModel = req.rawBody.toString();
        console.log("At Phone Model"+connectedUserID);
       
       const data=fs.readFile(userPath+'MobCalib.txt', 'utf8', function read(err, data) { if (err) { throw err; } 
      data = JSON.parse(data); 
       for (var key in data) { 
        console.log("User key"+data[0][smartPhoneModel]);
        smartPhoneModel=data[0][smartPhoneModel];
       
       }
     });
     res.send('Your Phone Model is '+smartPhoneModel);
   } else {
     res.send(500);
  }

 });

 app.post('/send-User', rawBody, function (req, res) {
      //sess=req.session;
      connectedUserID=req.rawBody.toString()
     // sess.connectedUserID=req.rawBody.toString();
      console.log(connectedUserID);
     CreateNewFolderIfNotExist("test_"+connectedUserID);
     CreateNewFolderIfNotExist("test_"+connectedUserID+"/calibration");
     CreateNewFolderIfNotExist("test_"+connectedUserID+"/poses");
     CreateNewFolderIfNotExist("test_"+connectedUserID+"/rgb");
 });

function DelFolderData() {

  const subdir1 = userPath + "esac/datasets/fbs/test_"+connectedUserID+"/rgb";
  const subdir2 = userPath + "esac/datasets/fbs/test_"+connectedUserID+"/poses";
  const subdir3 = userPath + "esac/datasets/fbs/test_"+connectedUserID+"/calibration";

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
  
     CreateNewFolderIfNotExist("test_"+connectedUserID);
     CreateNewFolderIfNotExist("test_"+connectedUserID+"/calibration");
     CreateNewFolderIfNotExist("test_"+connectedUserID+"/poses");
     CreateNewFolderIfNotExist("test_"+connectedUserID+"/rgb");
  //DelFolderData();
  res.status(200, { status: 'Folder Created Successfull' });
});

app.post('/upload-image', async (req, res)  =>  {
  try {


 console.log("On Image Upload "+connectedUserID);

 // if (req.rawBody && req.bodyLength > 0) {
    let json = req.body;

 var buffer = json["pngData"];
 var userid = json["userId"]
 console.log( "userid",userid);
 console.log( "buffer",buffer);
 const fileContents = new Buffer(buffer, 'base64')

    fs.writeFile(userPath + "esac/datasets/fbs/test_"+connectedUserID+"/rgb/" + filecounter + ".jpg", fileContents, err => {
      if (err) throw err;
     //filecounter++;
    })
    fs.writeFile(userPath + "esac/datasets/fbs/test_"+connectedUserID+"/calibration/" + filecounter + ".jpg" + ".calibration" + ".txt",smartPhoneModel, err => {
      if (err) throw err;

    })
    array = "1 0 0 0\n0 1 0 0\n0 0 1 0\n0 0 0 1";
    fs.writeFile(userPath + "esac/datasets/fbs/test_"+connectedUserID+"/poses/" + filecounter + ".jpg" + ".poses" + ".txt", array, err => {
      if (err) throw err;

    })
    res.send('Image Sent Successfully to the server, The counter is '+filecounter);
  }
  catch (err) {
    console.error(err);
  }
  
  

});

function CreateNewFolderIfNotExist(foldername){
  console.log("At Folder"+connectedUserID);
  try {
    if (!fs.existsSync(userPath+"esac/datasets/fbs/"+foldername)) {
      fs.mkdirSync(userPath+"esac/datasets/fbs/"+foldername)
    }
  
  }
  
   catch (err) {
    console.error(err)
  }
   
}

app.post('/runBatchFile', function (req, res) {
  var childProcess = require("child_process");
  // This line initiates bash
  var script_process = childProcess.exec(`"/home/shazia/ARscript.sh" "${connectedUserID}"`);
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
    const rl = readline.createInterface({
      input: fs.createReadStream(userPath + "esac/environments/fbs/poses_esac_"+connectedUserID+".txt"),
      crlfDelay: Infinity
    });
    
    rl.on('line', (line) => {

//      console.log(`Display: ${line}`);
      if (line.startsWith(filecounter+".jpg")){
        filecounter++;
        console.log(`Display: ${line}`);
        res.send(`${line}`)
        //return;

      }
     
    });

  //  fs.readFile(userPath + "esac/environments/fbs/poses_esac_"+connectedUserID+"+.txt", function (err, data) {
   //   res.end(data, { status: 'ESAC Executeeeeeeeeed Successfully' });
    
   //   const { exec } = require('child_process');
    //  exec(userPath+ "GVisBatch.sh");
   //   console.log("GVIS Batch File Executed");

    });

  });



app.get('/readPosesfile', function (req, res) {
  //fs.readFile(userPath + "esac/environments/fbs/poses_esac_"+connectedUserID+".txt", function (err, data) {
  //  res.send(data);

    const rl = readline.createInterface({
      input: fs.createReadStream(userPath + "esac/environments/fbs/poses_esac_"+connectedUserID+".txt"),
      crlfDelay: Infinity
    });
    
    rl.on('line', (line) => {
      console.log(filecounter+"filecounter");
      console.log(`Display: ${line}`);

      if (line.startsWith(filecounter+".jpg")){
        filecounter++;
        
        console.log(`Display: ${line}`);
        res.send(`${line}`);

      }
     
    });
  });

app.listen(port, () => {
  console.log(`Server app listening at http://localhost:${port}`)
})

app.get('/checkConnection', function (req, res) {
  //DelFolderData();
  res.send(200, { status: 'Connected' });
});
