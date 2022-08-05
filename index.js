'use strict';

const express = require('express');
const socketIO = require('socket.io');
const storage = require("./storage.js");
const PORT = process.env.PORT || 4001;
const INDEX = './index.html';
let lastSocket = "";
let messages = [];
const clientData = {};
let socketsArr = [];
const allVotes = {};
let firstPlace="";
const server = express()
  .use("/storage", storage.router)
  .use((req, res) => {
    res.append('Access-Control-Allow-Origin', ['*'])
    res.append('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE')
    res.append('Access-Control-Allow-Headers', 'Content-Type')
    res.send(clientData)
  })
  .listen(PORT, () => console.log(`Listening on ${PORT}`));
const io = socketIO(server, {
  cors: {
    origin: '*',
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: 4e6 // 4Mb
});

const socketFunctions = {
  voterStructure: () => {
    const v = {};
    Object.keys(clientData).map((c) => {
      v[c] = 0;
    })
    return v;
  },
  sterilize: (id) => {
    delete clientData[id];
    delete allVotes[id]
    Object.keys(clientData).map((c) => {
      const temp = clientData[c].voters;
      delete temp[id];
      clientData[c].voters = temp;
    })
  },
}

io.on('connection', (socket) => {
  socket.on("connection", (data) => {
    if (lastSocket == "") {
      lastSocket = socket.id
    } else {
      lastSocket = Object.keys(clientData)[Object.keys(clientData).length - 1]
      socket.broadcast.to(lastSocket).emit("grabImage", socket.id);
    }
    sendClientData(socket.id)
    function sendClientData(id) {
      clientData[id] = {
        id: socket.id,
        username: "",
        karma: 0,
      };
      clientData[id].voters = socketFunctions.voterStructure()
      Object.keys(clientData).map((c) => {
        clientData[c].voters[socket.id] = 0;
      })
      for (let i = 0; i < Object.keys(clientData).length; i++) {
        const client = Object.keys(clientData)[i]
        allVotes[client] = clientData[client].voters
      }
      socket.emit("messages", messages)
      socket.broadcast.emit("newConnection", socket.id, allVotes)
      socketsArr = Object.keys(clientData)
      lastSocket = socket.id;
      io.emit("clientData", clientData)
    }
  })
  socket.on("img", async (data) => {
    await new Promise((resolve) => {
      resolve(data)
    }).then((res) => {
      storage.getStorage(res)
      socket.broadcast.to(lastSocket).emit("drawImage", "image");
    })
  })
  socket.on("message", (data) => {
    messages = [...messages, data];
    socket.broadcast.emit("message", data);
    if (messages.length >= 600) {
      messages = messages.splice(0, 300)
    }
    let str = data.from +" sent a message group"
    io.emit("alert", str)
  })
  socket.on("sendPrivateMsg", (data) => {
    socket.broadcast.to(data.to).emit("recievePrivateMsg", data);
    let str = clientData[data.sender].username+" sent you a message"
    socket.broadcast.to(data.to).emit("alert", str)
  })
  socket.on("changeUsername", (data) => {
    clientData[data.id].username = data.username;
    socket.broadcast.emit("usernameChange", data)
    let str = data.username+" has connected" 
   io.emit("alert",str )
  })
  socket.on("draw", (data) => {
   socket.broadcast.emit("sendDraw", data);
  })
  socket.on("vote", (data) => {
    let dir;
    let diff;
    if(data.vote > parseInt(allVotes[data.id][data.voter] )){
      dir = "up"
      diff =  (parseInt(allVotes[data.id][data.voter]) + (data.vote*-1))*-1
    }else{
      dir = "down"
      diff =  parseInt(allVotes[data.id][data.voter]) + (data.vote*-1)
    }
    Object.keys(allVotes).map((c) => {
      allVotes[data.id][data.voter] = data.vote;
      const karmaChart = {}
      Object.keys(clientData).map((person) => {
        let individual = clientData[person].voters;
        let individualSum = Object.entries(individual).reduce((accum, item) => accum + parseInt(item[1]), 0)
        clientData[person].karma = individualSum;
        karmaChart[person]= individualSum;
      })
      const sort = Object.entries(clientData).sort((a, b) => {
        return b[1].karma - a[1].karma;
    });

    if(firstPlace!==sort[0][1]){
      firstPlace = sort[0][1];
      let str = sort[0][1].username +" is ranked #1"
      firstPlace = sort[0][1];
      io.emit("alert", str)
    }
    let notifyVote = clientData[data.voter].username+" voted you "+dir+ " "+diff+" karma";
    socket.broadcast.to(data.id).emit("alert", notifyVote);
      io.emit("karma", karmaChart)
      io.emit("allVotes", allVotes)
    })
  })
  socket.on('disconnect', function () {
    socketsArr = Object.keys(clientData)
    lastSocket = socketsArr[socketsArr.length - 1]
    let str =clientData[socket.id].username +" has dissconnected"
    socketFunctions.sterilize(socket.id)
    io.emit("alert", str)
      io.emit("clientData", clientData)
      io.emit("deleteClient", socket.id)
  })
});

