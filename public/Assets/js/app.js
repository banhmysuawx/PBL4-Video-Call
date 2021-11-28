
var AppProcess = (function () {
    var peers_connection_ids = [];
    var peers_connection = [];
    var remote_vid_stream = [];
    var remote_aud_stream = [];
    var local_div;
    var serverProcess;
    var audio;
    var isAudioMute = true;
    var rtp_aud_senders = [];
    var video_states = {
        None: 0,
        Camera: 1,
        ScreenShare: 2
    }
    var video_st = video_states.None;
    var videoCamTrack;
    var rtp_vid_senders = [];



    async function _init(SDP_function, my_connId) {
        serverProcess = SDP_function;
        my_connection_id = my_connId;
        eventProcess();
        local_div = document.getElementById("localVideoPlayer");

    }
    function eventProcess() {
        $("#miceMuteUnmute").on("click", async function () {
            if (!audio) {
                await loadAudio();
            }
            if (!audio) {
                alert("Audio permission has not granted");
                return;
            }
            if (isAudioMute) {
                audio.enabled = true;
                $(this).html('<span class="material-icons" style = "width: 85%">mic</span>');
                updateMediaSenders(audio, rtp_aud_senders);
            }
            else {
                audio.enabled = false;
                $(this).html('<span class="material-icons" style = "width: 85%">mic_off</span>');
                removeMediaSenders(rtp_aud_senders);
            }
            isAudioMute = !isAudioMute;

        });

        $("#videoCamOnOff").on("click", async function () {
            if (video_st == video_states.Camera) {
                await videoProcess(video_states.None);
            }
            else {
                await videoProcess(video_states.Camera);
            }
        });


        $("#btnScreenShareOnOff").on("click", async function () {
            if (video_st == video_states.ScreenShare) {
                await videoProcess(video_states.None);
            }
            else {
                await videoProcess(video_states.ScreenShare);
            }
        });

    }
    async function loadAudio() {
        try {
            var astream = await navigator.mediaDevices.getUserMedia({
                video: false,
                audio: true
            });
            audio = astream.getAudioTracks()[0];
            audio.enabled = false;
        }
        catch (e) {
            console.log(e);
        }
    }

    function connection_status(connection) {
        if (connection && (connection.connectionState == "new" ||
            connection.connectionState == "connecting" || connection.connectionState == "connected")) {
            return true;
        }
        else {
            return false;
        }
    }
    async function updateMediaSenders(track, rtp_senders) {
        for (var con_id in peers_connection_ids) {
            if (connection_status(peers_connection[con_id])) {
                if (rtp_senders[con_id] && rtp_senders[con_id].track) {
                    rtp_senders[con_id].replaceTrack(track);
                }
                else {
                   rtp_senders[con_id] = peers_connection[con_id].addTrack(track);
                }
            }
        }
    }
    function removeMediaSenders(rtp_senders) {
        for (var con_id in peers_connection_ids) {
            if (rtp_senders[con_id] && connection_status(peers_connection[con_id])) {
                peers_connection[con_id].removeTrack(rtp_senders[con_id]);
                rtp_senders[con_id] = null;
            }
        }
    }

    function removeVideoStream(rtp_vid_senders) {
        if (videoCamTrack) {
            videoCamTrack.stop();
            videoCamTrack = null;
            local_div.srcObject = null;
            removeMediaSenders(rtp_vid_senders);
        }
    }

    async function videoProcess(newVideoState) {
        if (newVideoState == video_states.None) {
            $("#videoCamOnOff").html("<span class='material-icons' style='width: 85%'>videocam_off</span>");
            $('#btnScreenShareOnOff').html('<span class="material-icons">present_to_all</span><div>Trình bày ngay</div>')
            video_st = newVideoState;
            removeVideoStream(rtp_vid_senders);
            return;
        }
        if (newVideoState == video_states.Camera) {
            $("#videoCamOnOff").html("<span class='material-icons' style='width: 85%'>videocam_on</span>");
        }
        try {
            var vstream = null;
            if (newVideoState == video_states.Camera) {
                vstream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: 1920,
                        height: 1080
                    },
                    audio: false
                })
            }
            else if (newVideoState == video_states.ScreenShare) {
                vstream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        width: 1920,
                        height: 1080
                    },
                    audio: false
                });
                vstream.oninactive = (e) => {
                    removeVideoStream(rtp_vid_senders);
                    $('btnScreenShareOnOff').html('<span class="material-icons">present_to_all</span><div>Present Now</div>');
                }

            }
            if (vstream && vstream.getVideoTracks().length > 0) {
                videoCamTrack = vstream.getVideoTracks()[0];
                if (videoCamTrack) {
                    local_div.srcObject = new MediaStream([videoCamTrack]);
                    updateMediaSenders(videoCamTrack, rtp_vid_senders);
                }
            }
        }
        catch (e) {
            console.log(e);
            return;
        }
        video_st = newVideoState;
        if (newVideoState == video_states.Camera) {
            $('#videoCamOnOff').html('<span class="material-icons">videocam</span>');
            $('#btnScreenShareOnOff').html('<span class="material-icons">present_to_all</span><div>Trình bày ngay</div>');
        }
        else if (newVideoState == video_states.ScreenShare) {
            $('#videoCamOnOff').html('<span class="material-icons">videocam_off</span>');
            $('#btnScreenShareOnOff').html('<span class="material-icons text-danger">present_to_all</span><div class="text-danger">Dừng trình bày</div>')
        }

    }

    var iceConfiguration = {
        iceServers: [
            {
                urls: "stun:stun.l.google.com:19302",
            },
            {
                urls: "stun:stun1.l.google.com:19302",
            }
        ]
    }
    async function setConnection(connId) {
        var connection = new RTCPeerConnection(iceConfiguration);
        connection.onnegotiationneeded = async function (event) {
            await setOffer(connId)
        }
        connection.onicecandidate = function (event) {
            if (event.candidate) {
                serverProcess(JSON.stringify({ icecandidate: event.candidate }), connId)
            }
        }
        connection.ontrack = function (event) {
            if (!remote_vid_stream[connId]) {
                remote_vid_stream[connId] = new MediaStream();
            }
            if (!remote_aud_stream[connId]) {
                remote_aud_stream[connId] = new MediaStream();
            }
            if (event.track.kind == "video") {
                remote_vid_stream[connId]
                    .getVideoTracks().forEach((t) => remote_vid_stream[connId].removeTrack(t));
                remote_vid_stream[connId].addTrack(event.track);
                var remoteVideoPlayer = document.getElementById("v_" + connId)
                remoteVideoPlayer.srcObject = null;
                remoteVideoPlayer.srcObject = remote_vid_stream[connId];
                remoteVideoPlayer.load();
            }
            else if (event.track.kind == "audio") {
                remote_aud_stream[connId]
                    .getAudioTracks().forEach((t) => remote_aud_stream[connId].removeTrack(t));
                remote_aud_stream[connId].addTrack(event.track);
                var remoteAudioPlayer = document.getElementById("a_" + connId)
                remoteAudioPlayer.srcObject = null;
                remoteAudioPlayer.srcObject = remote_aud_stream[connId];
                remoteAudioPlayer.load();
            }
        }

        peers_connection_ids[connId] = connId;
        peers_connection[connId] = connection;
        if (video_st == video_states.Camera || video_st == video_states.ScreenShare) {
            if (videoCamTrack) {
                updateMediaSenders(videoCamTrack, rtp_vid_senders);
            }
        }
        return connection;
    }

    async function setOffer(connId) {
        var connection = peers_connection[connId];
        var offer = await connection.createOffer();
        await connection.setLocalDescription(offer);
        serverProcess(JSON.stringify({
            offer: connection.localDescription,
        }), connId);
    }

    async function SDPProcess(message, from_connid) {
        message = JSON.parse(message);
        if (message.answer) {
            await peers_connection[from_connid].setRemoteDescription(new
                RTCSessionDescription(message.answer))
        }
        else if (message.offer) {
            if (!peers_connection[from_connid]) {
                await setConnection(from_connid);
            }
            await peers_connection[from_connid].setRemoteDescription(new
                RTCSessionDescription(message.offer))
            var answer = await peers_connection[from_connid].createAnswer();
            await peers_connection[from_connid].setLocalDescription(answer);
            serverProcess(
                JSON.stringify({
                    answer: answer,
                }),
                from_connid
            );
        }
        else if (message.icecandidate) {
            if (!peers_connection[from_connid]) {
                await setConnection(from_connid);
            }
            try {
                await peers_connection[from_connid].addIceCandidate(message.icecandidate);
            }
            catch (e) {
                console.log(e);
            }
        }
    }

    async function closeConnection(connid) {
        peers_connection_ids[connid] = null;
        if (peers_connection[connid]) {
            peers_connection[connid].close();
            peers_connection[connid] = null;
        }
        if (remote_aud_stream[connid]) {
            remote_aud_stream[connid].getTracks().forEach((t) => {
                if (t.stop) t.stop();
            })
            remote_aud_stream[connid] = null;
        }
        if (remote_vid_stream[connid]) {
            remote_vid_stream[connid].getTracks().forEach((t) => {
                if (t.stop) t.stop();
            })
            remote_vid_stream[connid] = null;
        }
    }

    return {
        setNewConnection: async function (connId) {
            await setConnection(connId)
        },
        init: async function (SDP_function, my_connId) {
            await _init(SDP_function, my_connId)
        },
        processClientFunc: async function (data, from_connid) {
            await SDPProcess(data, from_connid)
        },
        closeConnectionCall: async function (connid) {
            await closeConnection(connid)
        }
    }
})();

var App = (function () {
    var socket = null;
    var user_Id = "";
    var meeting_Id = "";

    function init(uid, mid) {
        user_Id = uid;
        meeting_Id = mid;
        $("#meetingContainer").show();
        $("#me h2").text(user_Id + "(Me)");
        document.title = user_Id;
        event_server();
        eventHandling();
    }

    function event_server() {
        socket = io.connect();
        var SDP_function = function (data, to_connectId) {
            socket.emit("SDPProcess", {
                message: data,
                to_connectId: to_connectId
            });
        }
        socket.on("connect", () => {
            AppProcess.init(SDP_function, socket.id);
            socket.emit("user-connect", {
                userId: user_Id,
                meetId: meeting_Id,
            });
        });

        socket.on("inform_about_disconnected_user", function (data) {
            $("#" + data.connId).remove();
            $('.participant-count').text(data.userNumber);
            $('#participant_' + data.connId).remove();
            AppProcess.closeConnectionCall(data.connId);
        });

        socket.on("inform-about-me", (data) => {
            addUser(data.otherUserID, data.connId, data.userNumber);
            AppProcess.setNewConnection(data.connId);
        });

        socket.on("inform-me-about-other-user", (otherUsers) => {
            var userNumber = otherUsers.length + 1;
            if (otherUsers) {
                for (var i = 0; i < otherUsers.length; i++) {
                    addUser(otherUsers[i].userId, otherUsers[i].connectionId, userNumber);
                    AppProcess.setNewConnection(otherUsers[i].connectionId);
                }
            }
        });

        socket.on("showMessage", function (data) {
            var time = new Date();
            var Time = time.toLocaleDateString('en-US', {
                hour: "numeric",
                minute: "numeric",
                hour12: true
            });
            var div = $('<div>').html('<span class="font-weight-bold mr-3" style="color: black">' + data.from + '</span>'
                + '<i style="font-size: 10px; opacity: 7;">' + Time + '</i>' + '</br>' + data.message);
            $('#message').append(div);
        });

        socket.on("showMessageFile", function (data) {
            var time = new Date();
            var Time = time.toLocaleDateString('en-US', {
                hour: "numeric",
                minute: "numeric",
                hour12: true
            });
            var div = $('<div>').html('<span class="font-weight-bold mr-3" style="color: black">' + data.username + '</span>'
                + '<i style="font-size: 10px; opacity: 7;">' + Time + '</i>' + '</br><a href="' + data.filePath + '" download>' + data.fileName + '</a>');
            $('#message').append(div);
        });


        socket.on("SDPProcess", async function (data) {
            await AppProcess.processClientFunc(data.message, data.from_connid);
        });

    }

    function eventHandling() {
        $('#btnsend').on("click", function () {
            var msg = $('#msbox').val();
            socket.emit("sendMessage", msg);
            $('#msbox').val('');
            var time = new Date();
            var Time = time.toLocaleDateString('en-US', {
                hour: "numeric",
                minute: "numeric",
                hour12: true
            });
            var div = $('<div>').addClass('text-right mr-3').html('<i style="font-size: 10px; opacity: 7;">' + Time + '</i>' + '<span class="font-weight-bold ml-3" style="color: black">' + user_Id + '</span>'
                + '</br>' + msg);
            $('#message').append(div);
        });
        $('#msbox').keypress(function (e) {
            if (e.keyCode == 13 || e.which == 13) {
                $('#btnsend').click();
            }
        })

        var meeting_url = window.location.href;
        $('.meeting-url').text(meeting_url);

    }
    function addUser(otherUserID, connId, userNumber) {
        var newDivOther = $('#otherTemplate').clone();
        newDivOther = newDivOther.attr('id', connId).addClass('other');
        newDivOther.find('h2').text(otherUserID);
        newDivOther.find('video').attr('id', 'v_' + connId);
        newDivOther.find('audio').attr('id', 'a_' + connId);
        newDivOther.show();
        $('#divUsers').append(newDivOther);
        $('.in-call-wrap-up').append('<div class="in-call-wrap d-flex justify-content-between align-items-center mb-3" id="participant_' + connId + '"> <div class="paticipant-img-name-wrap display-center cursor-pointer"> <div class="paticipant-img"> <img class="border border-secondary" style="height: 40px; width: 40px; border-radius: 50%;" src="./public/Assets/images/other.jpg" alt=""> </div> <div class="paticypant-name ml-3">' + otherUserID + '</div> </div> <div class="paticipant-action-wrap display-center"> <div class="paticipant-action-doc-wrap display-center cursor-pointer"> <span class="material-icons">more_vert</span> </div> <div class="paticipant-action-doc-wrap display-center cursor-pointer"> <span class="material-icons">push_pin</span> </div> </div> </div>')
        $('.participant-count').text(userNumber);
    }

    $(document).on('click', '.people-heading', function () {
        $(".chat-show-wrap").hide(300);
        $(".in-call-wrap-up").show(300);
        $(".people-heading").addClass('active');
        $(".chat-heading").removeClass('active');
    })

    $(document).on('click', '.chat-heading', function () {
        $(".chat-show-wrap").show(300);
        $(".in-call-wrap-up").hide(300);
        $(".chat-heading").addClass('active');
        $(".people-heading").removeClass('active');
    })

    $(document).on('click', '.meeting-heading-cross', function () {
        $('.app-right-detail-wrap').hide(300);
    })

    $(document).on('click', '.top-left-participant-icon', function () {
        $('.app-right-detail-wrap').show(300);
        $('.in-call-wrap-up').show();
        $('.chat-show-wrap').hide();
        $(".people-heading").addClass('active');
        $(".chat-heading").removeClass('active');
    })

    // $(document).mouseup(function (e) {
    //     var container = new Array();
    //     container.push($('.app-right-detail-wrap'));
    //     $.each(container, function (key, value) {
    //         if (!(value).is(e.target) && $(value).has(e.target).length == 0) {
    //             $(value).hide(300);
    //         }
    //     })
    // })

    $(document).on('click', '.top-left-chat-wrap', function () {
        $('.app-right-detail-wrap').show(300);
        $('.in-call-wrap-up').hide();
        $('.chat-show-wrap').show();
        $(".chat-heading").addClass('active');
        $(".people-heading").removeClass('active');
    })

    $(document).on("click", ".copy-btn-wrap", function () {
        var temp = $('<input>');
        $('body').append(temp);
        temp.val($('.meeting-url').text()).select();
        document.execCommand('copy');
        temp.remove();
        $('.copy-inform').fadeIn(300);
        setTimeout(function () {
            $('.copy-inform').fadeOut('slow')
        }, 3000);
    })

    $(document).on('click', '.meeting-details-btn', function () {
        if ($('.app-details').is(":visible")) {
            $('.app-details').hide();
        }
        else {
            $('.app-details').show();
            $('.app-details-heading-detail').addClass('active');
            $('.app-details-heading-attachment').removeClass('active');
            $('.app-details-heading-show-attchment').hide();
            $('.app-details-heading-show').show();
        }
    })

    $(document).on("click", '.app-details-heading-attachment', function () {
        $('.app-details-heading-show').hide();
        $('.app-details-heading-show-attchment').show();
        $('.app-details-heading-attachment').addClass('active');
        $('.app-details-heading-detail').removeClass('active');
    })

    $(document).on("click", '.app-details-heading-detail', function () {
        $('.app-details-heading-show').show();
        $('.app-details-heading-show-attchment').hide();
        $('.app-details-heading-attachment').removeClass('active');
        $('.app-details-heading-detail').addClass('active');
    })

    var base_urls = window.location.origin;
    $(document).on('click', '.share-attach', function (e) {
        e.preventDefault();
        if ($('#customFile')[0].files.length == 0) {
            alert('chọn file');
        }
        else {

            var att_img = $('#customFile').prop('files')[0];
            var formData = new FormData();
            formData.append('zipfile', att_img);
            formData.append('meeting_id', meeting_Id);
            formData.append('username', user_Id);
            $.ajax({
                url: base_urls + '/attachment',
                data: formData,
                type: 'POST',
                contentType: false,
                processData: false,
            }).fail(function (err) {
                console.log(err);
            });

            var attFileName = $('#customFile').val().split('\\').pop();
            var attFilePath = 'public/attachment/' + meeting_Id + "/" + attFileName;
            $('.custom-file-label').text('');
            var time = new Date();
            var Time = time.toLocaleDateString('en-US', {
                hour: "numeric",
                minute: "numeric",
                hour12: true
            });
            var div = $('<div>').addClass('text-right mr-3').html('<i style="font-size: 10px; opacity: 7;">' + Time + '</i>' + '<span class="font-weight-bold ml-3" style="color: black">' + user_Id + '</span>'
                + '</br><a href="' + attFilePath + '" download>' + attFileName + '</a>');
            $('#message').append(div);
            $('.app-right-detail-wrap').show(300);
            $('.in-call-wrap-up').hide();
            $('.chat-show-wrap').show();
            $(".chat-heading").addClass('active');
            $(".people-heading").removeClass('active');
            socket.emit('fileTransferOther', {
                username: user_Id,
                meeting_Id: meeting_Id,
                filePath: attFilePath,
                fileName: attFileName
            });
            $('#customFile').val('F');

        }
    });

    $(document).on('change', '.custom-file-input', function () {
        var filename = $('.custom-file-input').val().split('\\').pop();
        $(this).next('.custom-file-label').addClass('selected').html(filename);
    })

    $(document).on('click', '.option-icon', function () {
        $('.record-show').toggle(300);
    })

    $(document).on('click', '.start-record', function () {
        $(this).removeClass().addClass('stop-record btn').text('Dừng ghi');
        startRecording();
    })
    $(document).on('click', '.stop-record', function () {
        $(this).removeClass().addClass('start-record btn').text('Bắt đầu ghi');
        mediaRecorder.stop();
    })

    async function captureScreen(mediaContrains = {
        video: true
    }) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia(mediaContrains);
        return screenStream;
    }

    async function captureAudio(mediaContrains = {
        video: false,
        audio: true
    }) {
        const audioStream = await navigator.mediaDevices.getUserMedia(mediaContrains);
        return audioStream;
    }

    var mediaRecorder;
    var chunks = [];

    async function startRecording() {
        const screenStream = await captureScreen();
        const audioStream = await captureAudio();
        // var track = [];
        // track = track.concat(screenStream.getTracks());
        // track = track.concat(audioStream.getTracks());
        // const stream = new MediaStream(track);
        const stream = new MediaStream([...screenStream.getTracks(), ...audioStream.getTracks()]);
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.start();

        mediaRecorder.ondataavailable = function (e) {
            chunks.push(e.data);
        }

        mediaRecorder.onstop = function () {
            var clipName = prompt('Nhập tên bản ghi');
            stream.getTracks().forEach((track) => track.stop());
            const blob = new Blob(chunks, { type: 'video/webm' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = clipName + '.webm';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }, 100)
        }
    }

    return {
        _init: function (uid, mid) {
            init(uid, mid);
        }
    };
})();