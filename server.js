const express = require("express");
const fileUpload = require("express-fileupload");
const path = require("path");
const fs = require('fs');
var app = express();
var server = app.listen(3000, function() {
    console.log("Listen port 3000");
});

const io = require("socket.io")(server, {
    allowEIO3: true,
});

app.use(express.static(path.join(__dirname, "")));
var usersConnected = [];
io.on("connection", (socket) => {
    console.log("socket id la ", socket.id);
    socket.on("user-connect", (data) => {
        console.log("userinfo: ", data.userId, data.meetId);
        
        var otherUsers = usersConnected.filter(p => p.meet_Id == data.meetId);
        usersConnected.push({
            connectionId: socket.id,
            userId: data.userId,
            meet_Id: data.meetId
        });

        var userCount = otherUsers.length;
        otherUsers.forEach(u => {
            socket.to(u.connectionId).emit("inform-about-me", {
                otherUserID: data.userId,
                connId: socket.id,
                userNumber: userCount + 1
            })
        }
        )
        socket.emit("inform-me-about-other-user", otherUsers);
    });

    socket.on("SDPProcess", (data) => {
        socket.to(data.to_connectId).emit("SDPProcess", 
        {
            message: data.message,
            from_connid: socket.id,
        }
        )
    })

    socket.on("sendMessage", function(data){
        console.log(data);
        var usersend = usersConnected.find((u) => u.connectionId == socket.id);
        if(usersend)
        {
            var meetingId = usersend.meet_Id;
            var from = usersend.userId;
            var list = usersConnected.filter((p) => p.meet_Id == meetingId);
            list.forEach((u) => {
                socket.to(u.connectionId).emit("showMessage", {
                    from: from,
                    message: data
                })
            })
        }
    });

    socket.on("fileTransferOther", function(data){
        console.log(data);
        var usersend = usersConnected.find((u) => u.connectionId == socket.id);
        if(usersend)
        {
            var meetingId = data.meeting_Id;
            var list = usersConnected.filter((p) => p.meet_Id == meetingId);
            list.forEach((u) => {
                socket.to(u.connectionId).emit("showMessageFile", {
                    meetingId: data.meeting_Id,
                    username: data.username,
                    filePath: data.filePath,
                    fileName: data.fileName
                })
            })
        }
    });

    socket.on("disconnect", function(){
        console.log("Disconnected");
        var disUser = usersConnected.find(p => p.connectionId == socket.id);
        if(disUser)
        {
            var meetingId = disUser.meet_Id;
            usersConnected =  usersConnected.filter((p) => p.connectionId != socket.id);
            var list = usersConnected.filter((p) => p.meet_Id == meetingId);
            list.forEach((v) => {
                var userNumberAfLeave = usersConnected.length;
                socket.to(v.connectionId).emit("inform_about_disconnected_user", {
                    connId: socket.id,
                    userNumber: userNumberAfLeave
                });
            })
        }
    })
    app.use(fileUpload());
    app.post('/attachment', function(req, res){
        var data = req.body;
        var imageFile = req.files.zipfile;
        var dir = 'public/attachment/' + data.meeting_id + '/';
        if(!fs.existsSync(dir)){
            fs.mkdirSync(dir);
        }
        imageFile.mv('public/attachment/' + data.meeting_id + '/' + imageFile.name, function(error){
            if(error){
                console.log('Không tải được file, lỗi' + error);
            }
        });
    })
});