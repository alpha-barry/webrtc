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

class Root extends React.Component {

    constructor(props) {
        super(props);

        this.peerConnection = null;
        this.localVideo = null;
        this.remoteVideo = null;
        this.localStream = null;
        this.remoteStream = null;

        this.state = {
            switchMenu: false,
        };
    }

    async componentDidMount() {

        // utilisation de la camera local
        this.localVideo = document.querySelector("video#localVideo");
        this.localStream = await navigator.mediaDevices.getUserMedia({ 'video': true, 'audio': true });
        this.localVideo.srcObject = this.localStream;
    }

    initTrack() {
        this.peerConnection = new RTCPeerConnection({
            iceServers: [
                {
                    urls: [
                        'stun:stun1.l.google.com:19302',
                        'stun:stun2.l.google.com:19302',
                    ],
                },
            ],
            iceCandidatePoolSize: 10,
        });

        this.localStream.getTracks().forEach(track => {
            this.peerConnection.addTrack(track, this.localStream);
        });

        this.peerConnection.addEventListener('track', async (event) => {
            this.remoteStream.addTrack(event.track, this.remoteStream);
        })
    }

    componentWillUnmount() {
        this.peerConnection.close();
    }


    addRemoteVideo() {
        this.remoteStream = new MediaStream();
        this.remoteVideo = document.createElement('video');
        this.remoteVideo.setAttribute("autoplay", "");
        this.remoteVideo.setAttribute("playsinline", "");
        document.querySelector("#videoCam").appendChild(this.remoteVideo);
        this.remoteVideo.srcObject = this.remoteStream;
    }

    async createRoom() {

        this.initTrack();
        this.addRemoteVideo();

        const callDoc = await db.collection('rooms').doc();
        const offerCanditates = callDoc.collection("offerCanditates");
        const answerCanditates = callDoc.collection("answerCanditates");
        const roomId = callDoc.id;

        this.peerConnection.addEventListener('icecandidate', event => {
            if (event.candidate) {
                const json = event.candidate.toJSON();
                offerCanditates.add(json);
            }
        });

        const offer = await this.peerConnection.createOffer();
        let roomWithOffer = {
            offer: {
                type: offer.type,
                sdp: offer.sdp
            }
        }

        await callDoc.set(roomWithOffer);
        document.querySelector("#roomIdJ").innerHTML = roomId;

        await this.peerConnection.setLocalDescription(offer);

        this.setState({
            switchMenu: !this.state.switchMenu,
        });

        callDoc.onSnapshot(async snapshot => {
            console.log('Got updated room:', snapshot.data());
            const data = snapshot.data();
            if (!this.peerConnection.currentRemoteDescription && data.answer) {
                console.log('Set remote description: ', data.answer);
                const answer = new RTCSessionDescription(data.answer)
                await this.peerConnection.setRemoteDescription(answer);
            }
        });

        answerCanditates.onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === "added") {
                    const candidate = new RTCIceCandidate(change.doc.data());
                    this.peerConnection.addIceCandidate(candidate);
                }
            });
        });
    }

    async joinRoom() {

        this.initTrack();
        this.addRemoteVideo();

        const roomId = document.querySelector('#roomId').value;
        var callDoc = db.collection("rooms").doc(roomId);
        const offerCanditates = callDoc.collection("offerCanditates");
        const answerCanditates = callDoc.collection("answerCanditates");
        let offer = await callDoc.get();

        this.peerConnection.addEventListener('icecandidate', event => {
            if (event.candidate) {
                const json = event.candidate.toJSON();
                answerCanditates.add(json);
            }
        });

        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer.data().offer));
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);

        const roomWithAnswer = {
            answer: {
                type: answer.type,
                sdp: answer.sdp
            }
        }

        console.log(roomWithAnswer);
        await callDoc.update(roomWithAnswer);

        this.setState({
            switchMenu: !this.state.switchMenu,
        });

        offerCanditates.onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === "added") {
                    const candidate = new RTCIceCandidate(change.doc.data());
                    this.peerConnection.addIceCandidate(candidate);
                }
            });
        })
    }

    handleClick() {
        this.peerConnection.close();
        this.remoteVideo.remove();
        this.setState({
            switchMenu: !this.state.switchMenu,
        });
    }

    render() {

        let element = (<div id="videoCam">
            <video id="localVideo" muted autoPlay></video>
        </div>);

        if (!this.state.switchMenu) {
            return (
                <div id="menu">
                    {element}
                    <div id="roomIdJ"></div>
                    <button id="createRoom" onClick={() => this.createRoom()}>Create</button>
                    <input id="roomId" type="text"></input>
                    <button id="joinRoom" onClick={() => this.joinRoom()}>Join</button>

                </div>
            );
        }

        return (
            <div id="menu">
                    {element}
                    <div id="roomIdJ"></div>
                    <button onClick={() => this.handleClick()}>Quit</button>
                </div>
        );
    }
}

ReactDOM.render(<Root />, document.querySelector("#root"));