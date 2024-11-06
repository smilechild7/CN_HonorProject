/**
 * MIR Lab WebRTC Assignment Solution
 * Author : Yun Kyeung Rok
 * E-mail : onlys8@hanyang.ac.kr
 */

import express from 'express';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { Server } from 'socket.io'
import { WebRTC_SFU_Server } from './util/webrtc_functions.js'
import { error } from 'console';
import { Debug, Log } from './util/Logger.js'

const __dirname = path.resolve();
let clients = {}

/**
 * Author: Yun Kyeung Rok
 * 설정
 * Setting the HTTPS server port.
 */
let httpsServerPort = 443

/**
 * Author: Yun Kyeung Rok
 * HTTPs 웹 서버를 통한 WebRTC mediasoup 클라이언트 배포
 * HTTPs Web Server for distribution of WebRTC mediasoup client.
 */
const app = express();
app.use('/', express.static(path.join(__dirname, 'public')))

const options = {
    key: fs.readFileSync('./ssl/key.pem', 'utf-8'),
    cert: fs.readFileSync('./ssl/cert.pem', 'utf-8'),
    rejectUnauthorized: false,
};

const httpsServer = https.createServer(options, app);

/**
 * Author: Yun Kyeung Rok
 * WebRTC Mediasoup 서버와 클라이언트를 위한 신호 서버
 * Signaling Server for WebRTC Mediasoup Server and Client.
 */
const ios = new Server(httpsServer);
let RTC = new WebRTC_SFU_Server()

await RTC.init("192.168.179.130", 1522, true)

ios.on('connection', async socket => {
    console.log(`connection, Client connected ${socket.id}`)

    socket.emit('connection-success', {
        socketId: socket.id
    });

    /**
     * Author: Yun Kyeung Rok
     * 클라이언트가 RTP 기능을 요청할 때 처리
     * Handling client's RTP capability request.
     */
    socket.on('getRTPcap', async ({ localName, socketId }, callback) => {
        try {
            console.log('getRtpCap, client')
            clients[localName] = socket
            callback({ rtpCapabilities: await RTC.getRtpCap(), error: false })
        } catch (error) {
            callback({ error: true })
        }
    })

    /**
     * Author: Yun Kyeung Rok
     * WebRTC 트랜스포트를 생성할 때 처리
     * Handling WebRTC transport creation.
     */
    socket.on('createWebRtcTransport', async ({ consumer, socketId, isData }, callback) => {
        Log(`connection, on, createWebRtcTransport`)
        await RTC.createWebRtcTransport().then(
            async transport => {
                await callback({
                    params: {
                        id: transport.id,
                        iceParameters: transport.iceParameters,
                        iceCandidates: transport.iceCandidates,
                        dtlsParameters: transport.dtlsParameters,
                        sctpParameters: transport.sctpParameters,
                    },
                    isData
                })
                RTC.addTransport(transport, consumer, socketId)
            },
            error => {
                console.log(error)
            })
    })

    /**
     * Author: Yun Kyeung Rok
     * 트랜스포트 연결을 처리
     * Handling transport connection.
     */
    socket.on('transport-connect', async ({ dtlsParameters, socketId }) => {
        Log(`transport-connect : ${socketId}`)
        RTC.getTransport(socketId).connect({ dtlsParameters })
    });

    /**
     * Author: Yun Kyeung Rok
     * 트랜스포트 영상 송신을 처리
     * Handling transport production.
     */
    socket.on('transport-produce', async ({ socketId, kind, rtpParameters, appData }, callback) => {
        Log(`transport-producer called`)
        const producer = await RTC.produce(socketId, kind, rtpParameters, appData)
        callback({
            id: producer.id,
            socketId: socketId
        })
    });

    /**
     * Author: Yun Kyeung Rok
     * 데이터 트랜스포트 송신을 처리
     * Handling data transport production.
     */
    socket.on('transport-produce-data', async ({ sctpStreamParameters, label, protocol, socketId }, callback) => {
        Log('transport-produce-data')
        const producer = await RTC.produceData(socketId, sctpStreamParameters, label, protocol)
        callback({
            id: producer.id,
            socketId: socketId,
        })
    })

    /**
     * Author: Yun Kyeung Rok
     * 영상 수신 연결을 처리
     * Handling consumer connection.
     */
    socket.on('transport-recv-connect', async ({ dtlsParameters, serverConsumerTransportId }) => {
        Log(`transport-recv-connect`)
        const consumerTransport = await RTC.getRecvTransport(serverConsumerTransportId)
        await consumerTransport.connect({ dtlsParameters })
    })

    /**
     * Author: Yun Kyeung Rok
     * 전화 통화를 시작할 때 처리
     * Handling call initiation.
     */
    socket.on('call', async ({ remoteName, socketId }) => {
        Log(`on Call`)
        let remote_socketId = clients[remoteName].id
        let remoteProducerId = await RTC.getProducer(remote_socketId)
        let remoteDataProducerId = await RTC.getDataProducer(remote_socketId)
        socket.emit('remoteProducer', { remoteProducerId })
        socket.emit('remoteDataProducer', { remoteDataProducerId })
    })

    /**
     * Author: Yun Kyeung Rok
     * 영상 수신 요청을 처리
     * Handling consume request.
     */
    socket.on('consume', async ({ rtpCapabilities, remoteProducerId, serverConsumerTransportId, socketId }, callback) => {
        try {
            Log(`on consume`)
            let consumer = await RTC.consume(rtpCapabilities, remoteProducerId, serverConsumerTransportId, socketId)
            const params = {
                id: consumer.id,
                producerId: remoteProducerId,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
                serverConsumerId: consumer.id,
            }
            callback({ params })
        } catch (error) {
            console.log(error.message)
            callback({
                params: {
                    error: error
                }
            })
        }
    })

    /**
     * Author: Yun Kyeung Rok
     * 데이터 수신 요청을 처리
     * Handling data consume request.
     */
    socket.on('consume-data', async ({ rtpCapabilities, remoteProducerId, serverConsumerTransportId, socketId }, callback) => {
        try {
            Log(`on consume`)
            let consumer = await RTC.consumeData(rtpCapabilities, remoteProducerId, serverConsumerTransportId, socketId)
            const params = {
                id: consumer.id,
                producerId: remoteProducerId,
                sctpStreamParameters: consumer.sctpStreamParameters,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
                serverConsumerId: consumer.id,
                label: consumer.label,
                protocol: consumer.protocol
            }
            callback({ params })
        } catch (error) {
            console.log(error.message)
            callback({
                params: {
                    error: error
                }
            })
        }
    });

    /**
     * Author: Yun Kyeung Rok
     * 영상 수신 재개 요청을 처리
     * Handling consumer resume request.
     */
    socket.on('consumer-resume', async ({ serverConsumerId }) => {
        Log(`on consumer-resume`)
        await RTC.consume_resume(serverConsumerId)
    })
})

/**
 * Author: Yun Kyeung Rok
 * 서버 시작
 * Start the server.
 */
httpsServer.listen(httpsServerPort, () => {
    console.log(`Server is listening on port: ${httpsServerPort}`);
});
