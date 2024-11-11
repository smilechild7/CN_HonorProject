/**
 * Author: Yun Kyeung Rok
 * MIR Lab WebRTC Assignment Solution
 * Email: onlys8@hanyang.ac.kr
 */

const mediasoupClient = require('mediasoup-client');
const io = require('socket.io-client');

let rtpCapabilities;
let dataproducer;

const socket = io();

socket.on('close', (error) => {
    console.log(error);
});

socket.on("connect_error", (err) => {
    console.log(err.message);
    console.log(err.description);
    console.log(err.context);
});

let Client;

/**
 * 클라이언트 관리를 위한 클래스
 * Class for managing client connection.
 */
class ClientConnection {
    socket = undefined;
    rtpCapabilities = undefined;
    producerTransport = undefined;
    consumerTransports = [];
    device;
    dataproducer;
    producer;
    consumers = [];
    params = undefined;

    constructor(_socket) {
        this.socket = _socket;
        this.params = {
            encodings: [
                {
                    rid: 'r0',
                    maxBitrate: 100000,
                },
                {
                    rid: 'r1',
                    maxBitrate: 300000,
                },
                {
                    rid: 'r2',
                    maxBitrate: 900000,
                },
            ],
            codecOptions: {
                videoGoogleStartBitrate: 1000
            }
        }
    }

    /**
     * Author: Yun Kyeung Rok
     * RTP 기능 가져오기
     * Get RTP capabilities.
     */
    getRTPcap = function () {
        return new Promise(resolve => {
            console.log(`sending RTP cap`)
            const localName = document.getElementById('local-name').value;
            socket.emit('getRTPcap', { localName, socketId: socket.id }, (data) => {
                console.log(`Router RTP Capabilities... ${data.rtpCapabilities}`)
                rtpCapabilities = data.rtpCapabilities
                resolve(rtpCapabilities);
            })
        });
    }

    /**
     * Author: Yun Kyeung Rok
     * 장치 생성
     * Create device.
     */
    createDevice = async function () {
        this.rtpCapabilities = await this.getRTPcap();
        this.device = new mediasoupClient.Device();

        await this.device.load({
            routerRtpCapabilities: this.rtpCapabilities
        })

        console.log(`===== Device created =====`)
        console.log(`cap : ${this.device.rtpCapabilities}`)
    }

    /**
     * Author: Yun Kyeung Rok
     * 리시브 트랜스포트 생성
     * Create receive transport.
     */
    createRecvTransport = function () {
        return new Promise(resolve => {
            socket.emit('createWebRtcTransport', { consumer: true, socketId: socket.id }, ({ params }) => {
                if (params.error) {
                    console.log(params.error)
                    return
                }
                let consumerTransport
                try {
                    consumerTransport = this.device.createRecvTransport(params)
                } catch (error) {
                    console.log(error)
                    return
                }

                consumerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
                    try {
                        await socket.emit('transport-recv-connect', {
                            dtlsParameters,
                            serverConsumerTransportId: params.id,
                        })
                        callback()
                    } catch (error) {
                        errback(error)
                    }
                })

                resolve({ consumerTransport, serverTransportId: params.id })
            })
        })
    }

    /**
     * Author: Yun Kyeung Rok
     * 소비 처리
     * Handle consume.
     */
    consume = function (consumerTransport, remoteProducerId, serverConsumerTransportId, url) {
        return new Promise(async resolve => {
            await socket.emit('consume', {
                rtpCapabilities: this.device.rtpCapabilities,
                remoteProducerId,
                serverConsumerTransportId,
            }, async ({ params }) => {
                if (params.error) {
                    console.log('Cannot Consume')
                    return
                }

                console.log(`Consumer Params ${params}`)

                const consumer = await consumerTransport.consume({
                    id: params.id,
                    producerId: params.producerId,
                    kind: params.kind,
                    rtpParameters: params.rtpParameters
                })

                consumer.on('transportclose', () => {
                    {
                        console.log(`consumer ${consumer.id} closed`)
                    }
                })

                consumer.on('trackended', () => {
                    console.log(`trackended ${consumer.id}`)
                })

                this.consumerTransports = [
                    ...this.consumerTransports,
                    {
                        consumerTransport,
                        serverConsumerTransportId: params.id,
                        producerId: remoteProducerId,
                        consumer,
                    },
                ]

                this.consumers = [
                    ...this.consumers,
                    {
                        consumer: consumer,
                        serverConsumerId: params.serverConsumerId
                    }
                ]

                resolve(consumer)
            })
        })
    }

    /**
     * Author: Yun Kyeung Rok
     * 데이터 소비 처리
     * Handle data consume.
     */
    consumeData = function (consumerTransport, remoteProducerId, serverConsumerTransportId, url) {
        return new Promise(async resolve => {
            await socket.emit('consume-data', {
                rtpCapabilities: this.device.rtpCapabilities,
                remoteProducerId,
                serverConsumerTransportId,
            }, async ({ params }) => {
                if (params.error) {
                    console.log(`Cannot Consume ${params.error}`)
                    return
                }

                console.log(`Data Consumer Params ${params}`)
                console.log(params.producerId)
                const consumer = await consumerTransport.consumeData({
                    id: params.id,
                    dataProducerId: params.producerId,
                    sctpStreamParameters: params.sctpStreamParameters,
                })

                consumer.on("open", () => {
                    console.log("new way dataChannel open")
                })

                consumer.on("error", (error) => {
                    console.log(error)
                })

                consumer.on('message', (data) => {
                    const message = data;
                    console.log(data);
                    if (message) {
                        const messagesDiv = document.getElementById('messages');
                        const messageElement = document.createElement('div');
                        messageElement.textContent = message;
                        messageElement.className = 'message-left';
                        messagesDiv.appendChild(messageElement);
                        messagesDiv.scrollTop = messagesDiv.scrollHeight;
                    }
                });

                this.consumerTransports = [
                    ...this.consumerTransports,
                    {
                        consumerTransport,
                        serverConsumerTransportId: params.id,
                        producerId: remoteProducerId,
                        consumer,
                    },
                ]
                resolve(consumer)
            })
        })
    }

    /**
     * Author: Yun Kyeung Rok
     * 소비자 재개 처리
     * Handle consumer resume.
     */
    consumer_resume = function (consumerId) {
        for (let i = 0; i < this.consumers.length; i++) {
            if (this.consumers[i].consumer.id === consumerId) {
                console.log("consumers= ", this.consumers[i])
                socket.emit('consumer-resume', { serverConsumerId: this.consumers[i].serverConsumerId })
            }
        }
    }

    /**
     * Author: Yun Kyeung Rok
     * 생산 트랜스포트 생성
     * Create produce transport.
     */
    createProduceTransport = function () {
        return new Promise(resolve => {
            socket.emit('createWebRtcTransport', { consumer: false, socketId: socket.id }, ({ params }) => {
                if (params.error) {
                    console.log(params.error)
                    return
                }
                this.producerTransport = this.device.createSendTransport(params)

                this.producerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
                    try {
                        console.log('transport-connect called')
                        await socket.emit('transport-connect', {
                            dtlsParameters,
                            socketId: this.socket.id,
                        })
                        callback()
                    } catch (error) {
                        errback(error)
                    }
                })

                this.producerTransport.on('producedata', async (parameters, callback, errback) => {
                    console.log("producer-data evoked")
                    try {
                        await socket.emit('transport-produce-data', {
                            sctpStreamParameters: parameters.sctpStreamParameters,
                            label: parameters.label,
                            protocol: parameters.protocol,
                            socketId: socket.id
                        }, ({ id, socketId }) => {
                            console.log(`data callback : ${id}`)
                            callback({ id })
                        })
                    } catch (error) {
                        errback(error)
                    }
                })

                this.producerTransport.on('produce', async (parameters, callback, errback) => {
                    console.log('produce called')
                    try {
                        await socket.emit('transport-produce', {
                            socketId: this.socket.id,
                            kind: parameters.kind,
                            rtpParameters: parameters.rtpParameters,
                            appData: parameters.appData,
                        }, ({ id, socketId }) => {
                            callback({ id })
                        })
                    } catch (error) {
                        errback(error)
                    }
                })
                resolve(this.producerTransport)
            })
        })
    }

    /**
     * Author: Yun Kyeung Rok
     * 로컬 스트림 가져오기
     * Get local stream.
     */
    getLocalStream = () => {
        return new Promise(async resolve => {
            let stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: {
                    width: {
                        min: 640,
                        max: 1920,
                    },
                    height: {
                        min: 400,
                        max: 1080,
                    }
                }
            })
            await this.streamSuccess(stream)
            resolve()
        })
    }

    /**
     * Author: Yun Kyeung Rok
     * 스트림 성공 처리
     * Handle stream success.
     */
    streamSuccess = (stream) => {
        return new Promise(resolve => {
            const track = stream.getVideoTracks()[0]
            this.params = {
                track,
                ...this.params
            }
            localVideo.srcObject = stream
            resolve()
        })
    }

    /**
     * Author: Yun Kyeung Rok
     * 생산자 생성
     * Create producer.
     */
    createProducer = async function () {
        return new Promise(async resolve => {
            this.producer = await this.producerTransport.produce(this.params)
            this.producer.on('trackended', () => {
                console.log('track ended')
            })
            this.producer.on('transportclose', () => {
                console.log('transport ended')
            })
            resolve(this.producer)
        })
    }

    /**
     * Author: Yun Kyeung Rok
     * 데이터 생산자 생성
     * Create data producer.
     */
    createDataProducer = async function () {
        return new Promise(async resolve => {
            console.log("making dataproducer")
            this.dataproducer = await this.producerTransport.produceData()
            this.dataproducer.on("open", () => {
                console.log("producer data channel opend")
            })
            this.dataproducer.on("error", (error) => {
                console.log(error)
            })
            resolve(this.dataproducer)
        })
    }

    /**
     * Author: Yun Kyeung Rok
     * 생산자 가져오기
     * Get producers.
     */
    getProducers = function () {
        this.socket.emit('getProducers', { remote_url, roomNumber, socketId: this.socket.id })
    }

    /**
     * Author: Yun Kyeung Rok
     * 데이터 생산자 가져오기
     * Get data producers.
     */
    getDataProducers = () => {
        this.socket.emit('getDataProducers', { remote_url, roomNumber, socketId: this.socket.id })
    }

    /**
     * Author: Yun Kyeung Rok
     * 서버 ID로 소비자 ID 가져오기
     * Get consumer ID by server ID.
     */
    getConsumerIdByServerId(serverConsumerId) {
        console.log(this.consumers)
        console.log(serverConsumerId)
        const consumerData = this.consumers.find(item => item.serverConsumerId === serverConsumerId);
        if (consumerData) {
            return consumerData.consumer.id;
        }
        return null;
    }
}

/**
 * 서버 연결 성공 시 처리
 * Handle connection success to server.
 */
socket.on('connection-success', async ({ socketId }) => {
    console.log("===== connection success ======")
    console.log(socketId)
    Client = new ClientConnection(socket);
    await Client.getLocalStream()
})

/**
 * 원격 생산자 처리
 * Handle remote producer.
 */
socket.on('remoteProducer', async ({ remoteProducerId }) => {
    let cTransport = await Client.createRecvTransport()
    let consumer = await Client.consume(cTransport.consumerTransport, remoteProducerId, cTransport.serverTransportId)
    console.log(consumer)
    const { track, id } = consumer
    var remoteVideoList = document.getElementById("remoteVideo");
    remoteVideoList.srcObject = new MediaStream([track])
    Client.consumer_resume(consumer.id)
})

/**
 * 원격 데이터 생산자 처리
 * Handle remote data producer.
 */
socket.on('remoteDataProducer', async ({ remoteDataProducerId }) => {
    let cTransport = await Client.createRecvTransport()
    let consumer = await Client.consumeData(cTransport.consumerTransport, remoteDataProducerId, cTransport.serverTransportId)
    console.log(remoteDataProducerId)
})

/**
 * RTP 기능 요청
 * Request RTP capabilities.
 */
async function getRTPcap() {
    await Client.createDevice();
}

/**
 * 생산 트랜스포트 생성 요청
 * Request create produce transport.
 */
async function makeProducerTransport() {
    await Client.createProduceTransport();
}

/**
 * 생산 요청
 * Request produce.
 */
async function doProduce() {
    await Client.createProducer()
    dataproducer = await Client.createDataProducer()
}

/**
 * 호출 요청
 * Request call.
 */
async function call() {
    const remoteName = document.getElementById('remote-name').value;
    socket.emit('call', { remoteName, socketId: socket.id })
}
/*
RTSP 스트림 요청과 수신을 처리
*/
async function requestRTSPStream() {
    console.log("Requesting RTSP stream from server..."); // 요청 시작 로그
    socket.emit('request-rtsp-stream'); // 서버에 RTSP 스트림 요청

    socket.on('rtsp-stream', async ({ remoteProducerId }) => {
        console.log("RTSP stream received from server."); // 수신 성공 로그
        let cTransport = await Client.createRecvTransport();
        let consumer = await Client.consume(cTransport.consumerTransport, remoteProducerId, cTransport.serverTransportId);
        const { track } = consumer;
        const remoteVideo = document.getElementById("remoteVideo");
        remoteVideo.srcObject = new MediaStream([track]);
        Client.consumer_resume(consumer.id);
    });

    socket.on("rtsp-stream-error", (error) => {
        console.error("Failed to receive RTSP stream:", error); // 수신 실패 로그
        alert("Error: Could not retrieve RTSP stream.");
    });

    console.log("RTSP stream request has been emitted."); // 요청 전송 완료 로그
}

/**
 * 기본 채팅 상호작용을 위한 JavaScript
 * JavaScript for basic chat interaction (placeholder).
 */
document.getElementById('send-button').addEventListener('click', function() {
    const message = document.getElementById('message').value;
    if (message) {
        const messagesDiv = document.getElementById('messages');
        const messageElement = document.createElement('div');
        messageElement.textContent = message;
        messageElement.className = 'message-right'; // 입력한 메시지는 오른쪽에 표시
        messagesDiv.appendChild(messageElement);
        document.getElementById('message').value = '';
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        dataproducer.send(message)
    }
});

document.getElementById('btnGetRTPcap').addEventListener('click', async () => {
    await getRTPcap()
})
document.getElementById('btnProducerTransport').addEventListener('click', async () => {
    await makeProducerTransport()
})
document.getElementById('btnProduce').addEventListener('click', async () => {
    await doProduce()
})
document.getElementById('btnCall').addEventListener('click', async () => {
    await call()
})
// requestRTSPStream 함수를 버튼 클릭 시 호출할 수 있도록 연결
document.getElementById('btnRequestRTSP').addEventListener('click', async () => {
    await requestRTSPStream();
});
