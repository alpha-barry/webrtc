var firebaseConfig = {
    apiKey: "AIzaSyD-p483kAnUrOEbINWvyQb5KFghD5vJIdg",
    authDomain: "alphatestwebprojet.firebaseapp.com",
    databaseURL: "https://alphatestwebprojet.firebaseio.com",
    projectId: "alphatestwebprojet",
    storageBucket: "alphatestwebprojet.appspot.com",
    messagingSenderId: "444055207145",
    appId: "1:444055207145:web:f01b99ff6564be1e6f4478",
    measurementId: "G-JKW1L76SQL"
};
// Initialize Firebase
firebase.initializeApp(firebaseConfig);
//firebase.analytics();

var db = firebase.firestore();

if (location.hostname === "localhost") {
    db.useEmulator("localhost", 8080);
}

const iceConfig = {
    iceServers: [
        {
            urls: [
                'stun:stun1.l.google.com:19302',
                'stun:stun2.l.google.com:19302',
            ],
        },
    ],
    iceCandidatePoolSize: 10,
}

let peerConnection = null;
let localVideo = null;
let remoteVideo = null;
let localStream = null;
let remoteStream = null;

class Room extends React.Component {
    render() {
        return (
            <div>
                <button></button>
                <input></input>
                <button></button>
            </div>
        );
    }
}

class MainMenu extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
            isMainMenu: true,
        };
    }

    handleClick() {
        this.setState({
            isMainMenu: !this.state.isMainMenu,
        });
    }

    render() {
        if (this.state.isMainMenu) {
            return (<div>
                <div id="roomIdJ"></div>
                <button id="createRoom" onClick={() => this.handleClick()}>Create</button>
                <input id="roomId" type="text"></input>
                <button id="joinRoom">Join</button>
            </div>);
        } else {
            return (<button onClick={() => this.handleClick()}>
                Close
            </button>);
        }
    }
}

ReactDOM.render(<MainMenu />, document.getElementById('mainMenu'));

let useCamera = async () => {
    localVideo = document.querySelector("video#localVideo");
    localStream = await navigator.mediaDevices.getUserMedia({ 'video': true, 'audio': true });
    localVideo.srcObject = localStream;
}

let addRemoteVideo = () => {
    remoteStream = new MediaStream();
    remoteVideo = document.createElement('video');
    remoteVideo.setAttribute("autoplay", "");
    remoteVideo.setAttribute("playsinline", "");
    document.querySelector("#video").appendChild(remoteVideo);
    remoteVideo.srcObject = remoteStream;
}


useCamera();

let initTracks = async () => {
    peerConnection = new RTCPeerConnection(iceConfig);

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.addEventListener('track', async (event) => {
        remoteStream.addTrack(event.track, remoteStream);
    });
}

document.querySelector("#createRoom").onclick = async () => {

    // hideRoomMenu();
    initTracks();
    addRemoteVideo();

    const callDoc = await db.collection('rooms').doc();
    const offerCanditates = callDoc.collection("offerCanditates");
    const answerCanditates = callDoc.collection("answerCanditates");
    const roomId = callDoc.id;

    peerConnection.addEventListener('icecandidate', event => {
        if (event.candidate) {
            const json = event.candidate.toJSON();
            offerCanditates.add(json);
        }
    });

    const offer = await peerConnection.createOffer();
    let roomWithOffer = {
        offer: {
            type: offer.type,
            sdp: offer.sdp
        }
    }

    await callDoc.set(roomWithOffer);
    document.querySelector("#roomIdJ").innerHTML = roomId;

    await peerConnection.setLocalDescription(offer);

    callDoc.onSnapshot(async snapshot => {
        console.log('Got updated room:', snapshot.data());
        const data = snapshot.data();
        if (!peerConnection.currentRemoteDescription && data.answer) {
            console.log('Set remote description: ', data.answer);
            const answer = new RTCSessionDescription(data.answer)
            await peerConnection.setRemoteDescription(answer);
        }
    });

    answerCanditates.onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === "added") {
                const candidate = new RTCIceCandidate(change.doc.data());
                peerConnection.addIceCandidate(candidate);
            }
        });
    });
}

document.querySelector("#joinRoom").onclick = async () => {

    //hideRoomMenu();
    initTracks();
    addRemoteVideo();

    const roomId = document.querySelector('#roomId').value;
    var callDoc = db.collection("rooms").doc(roomId);
    const offerCanditates = callDoc.collection("offerCanditates");
    const answerCanditates = callDoc.collection("answerCanditates");
    let offer = await callDoc.get();

    peerConnection.addEventListener('icecandidate', event => {
        if (event.candidate) {
            const json = event.candidate.toJSON();
            answerCanditates.add(json);
        }
    });

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer.data().offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    const roomWithAnswer = {
        answer: {
            type: answer.type,
            sdp: answer.sdp
        }
    }

    console.log(roomWithAnswer);
    await callDoc.update(roomWithAnswer);

    offerCanditates.onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === "added") {
                const candidate = new RTCIceCandidate(change.doc.data());
                peerConnection.addIceCandidate(candidate);
            }
        });
    })
}

class ToggleMic extends React.Component {

    constructor(props) {
        super(props);
        this.state = { isToggleOn: true };
    }

    handleClick() {
        this.setState({
            isToggleOn: !this.state.isToggleOn,
        });

        localStream.getAudioTracks()[0].enabled = !localStream.getAudioTracks()[0].enabled;
    }

    render() {
        return <button onClick={() => this.handleClick()}>
            <span className="material-icons-outlined">{this.state.isToggleOn ? "mic" : "mic_off"}</span>
        </button>;
    }
}

class ToggleCam extends React.Component {

    constructor(props) {
        super(props);
        this.state = { isToggleOn: true };
    }

    handleClick() {
        this.setState({
            isToggleOn: !this.state.isToggleOn,
        });

        localStream.getVideoTracks()[0].enabled = !localStream.getVideoTracks()[0].enabled;
    }

    render() {
        return (<button onClick={() => this.handleClick()}>
            <span className="material-icons-outlined">
                {this.state.isToggleOn ? "videocam" : "videocam_off"}
            </span>
        </button>);
    }
}

function Settings() {
    return <div>
        <ToggleCam/>
        <ToggleMic/>
    </div>
}

ReactDOM.render(<Settings />, document.getElementById('root'));
