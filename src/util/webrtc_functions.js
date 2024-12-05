/**
 * Author: Yun Kyeung Rok
 * MIR Lab WebRTC Assignment Solution
 * Email: onlys8@hanyang.ac.kr
 */

import mediasoup from 'mediasoup'
import { Debug, Log } from './Logger.js'

/**
 * 미디어 코덱 설정
 * Media codecs configuration
 */
const mediaCodecs = [
  {
    kind: "audio",
    mimeType: "audio/opus",
    clockRate: 48000,
    channels: 2
  },
  {
    kind: "video",
    mimeType: "video/H264",
    clockRate: 90000,
    parameters: {
      "packetization-mode": 1,
      "profile-level-id": "42e01f",
      "level-asymmetry-allowed": 1
    }
  }
];

/**
 * WebRTC SFU 서버 클래스
 * WebRTC SFU Server class
 */
export class WebRTC_SFU_Server {
    isDebug = false;

    transports = []
    peers = {}
    producers = []
    dataproducers = []
    consumers = []
    dataconsumers = []

    worker = undefined
    router = undefined
    webRtcServer = undefined

    webRtcServer_Ip = undefined
    webRtcServer_Port = undefined

    socket = undefined

    /**
     * Author: Yun Kyeung Rok
     * WebRTC 서버 생성
     * Create WebRTC server.
     */
    createWebRTCServer = async () => {
        this.webRtcServer = await this.worker.createWebRtcServer({
            listenInfos: [
                {
                  protocol: 'udp',
                  ip: this.webRtcServer_Ip,
                  port: this.webRtcServer_Port
                }
            ]
        });
    }

    /**
     * Author: Yun Kyeung Rok
     * Worker 생성
     * Create Worker.
     */
    createWorker = async () => {
        this.worker = await mediasoup.createWorker()
        this.worker.on('died', error => {
          Log(`Worker died by : ${error}`)  
        })
        await this.createRouter()
    }

    /**
     * Author: Yun Kyeung Rok
     * Router 생성
     * Create Router.
     */
    createRouter = async () => {
        if (this.router === undefined) {
            this.router = await this.worker.createRouter({ mediaCodecs })
            Log(`Router Created : ${this.router.id}`)
        }
        Debug('mediaserverEnrollRtpCap', this.isDebug)
        await this.createWebRTCServer()
    }

    /**
     * Author: Yun Kyeung Rok
     * RTP 송수신 정보 가져오기
     * Get RTP capabilities.
     */
    getRtpCap = () => {
        return this.router.rtpCapabilities
    }

    /**
     * Author: Yun Kyeung Rok
     * 초기화
     * Initialization.
     */
    init = async (_ip, _port, _isDebug) => {
        this.isDebug = _isDebug
        this.webRtcServer_Ip = _ip
        this.webRtcServer_Port = _port
        await this.createWorker()
    }

    /**
     * Author: Yun Kyeung Rok
     * 트랜스포트 추가
     * Add transport.
     */
    addTransport = (transport, consumer, socketId) => {
        this.transports = [
            ...this.transports,
            { socketId: socketId, transport, consumer }
        ]
    }

    /**
     * Author: Yun Kyeung Rok
     * 트랜스포트 가져오기
     * Get transport.
     */
    getTransport = (socketId) => {
        const [producerTransport] = this.transports.filter(transport => transport.socketId === socketId && !transport.consumer)
        return producerTransport.transport
    }

    /**
     * Author: Yun Kyeung Rok
     * 수신자 트랜스포트 가져오기
     * Get consumer transport.
     */
    getRecvTransport = (serverConsumerTransportId) => {
        const consumerTransport = this.transports.find(transportData => (
            transportData.consumer && transportData.transport.id == serverConsumerTransportId
        )).transport
        return consumerTransport
    }

    /**
     * Author: Yun Kyeung Rok
     * WebRTC 트랜스포트 생성
     * Create WebRTC transport.
     */
    createWebRtcTransport = async () => {
        return new Promise(async (resolve, reject) => {
            try {
                const webRtcServer_option = {
                    webRtcServer: this.webRtcServer,
                    enableUdp: true,
                    enableTcp: true,
                    preferUdp: true,
                    enableSctp: true,
                }
                let transport = await this.router.createWebRtcTransport(webRtcServer_option)
                console.log(`transport id: ${transport.id}`)

                transport.on('dtlsstatechange', dtlsState => {
                    if (dtlsState === 'closed') {
                        transport.close()
                    }
                })

                transport.on('close', () => {
                    // console.log('transport closed')
                })
                resolve(transport)
            } catch (error) {
                reject(error)
            }
        })
    }

    /**
     * Author: Yun Kyeung Rok
     * 트랜스포트 영상 송신 처리
     * Handle transport production.
     */
    produce = async (socketId, kind, rtpParameters, appData) => {
        Log(`transport-produce called`)
        const producer = await this.getTransport(socketId).produce({
            kind,
            rtpParameters,
        })

        producer.on('transportclose', () => {
            Log(`producer ${producer.id} closed by transportclose`)
            this.producers = this.producers.filter(item => item.producer.id !== producer.id)
            producer.close()

            for (const socketId in peers) {
                if (peers.hasOwnProperty(socketId)) {
                    peers[socketId].producers = peers[socketId].producers.filter(id => id !== producer.id);
                }
            }

            Debug(peers, isDebug)
            Debug(producers, isDebug)
        })

        this.addProducer(producer, socketId)
        return producer
    }

    /**
     * Author: Yun Kyeung Rok
     * 데이터 트랜스포트 생성 처리
     * Handle data transport production.
     */
    produceData = async (socketId, sctpStreamParameters, label, protocol) => {
        Log(`transport-produce-data called`)
        const producer = await this.getTransport(socketId).produceData({
            sctpStreamParameters,
            label,
            protocol
        })

        producer.on('transportclose', () => {
            Log(`dataproducer ${producer.id} closed by transportclose`)
            dataproducers = dataproducers.filter(item => item.producer.id !== producer.id)
            producer.close()

            for (const socketId in peers) {
                if (peers.hasOwnProperty(socketId)) {
                    peers[socketId].dataproducers = peers[socketId].dataproducers.filter(id => id !== producer.id);
                }
            }

            Debug(dataproducers, isDebug)
        })

        this.addDataProducer(producer, socketId)
        return producer
    }

    /**
     * Author: Yun Kyeung Rok
     * 영상 수신 처리
     * Handle consume.
     */
    consume = async (rtpCapabilities, remoteProducerId, serverConsumerTransportId, socketId) => {
        let consumerTransport = this.transports.find(transportData => (
            transportData.consumer && transportData.transport.id == serverConsumerTransportId
        )).transport

        if (this.router.canConsume({
            producerId: remoteProducerId,
            rtpCapabilities
        })) {
            const consumer = await consumerTransport.consume({
                producerId: remoteProducerId,
                rtpCapabilities,
                paused: true,
            })

            consumer.on('transportclose', () => {
                Log(`consumer ${consumer.id} closed by transportclose`)
                this.consumers = this.consumers.filter(item => item.consumer.id !== consumer.id)
                consumer.close()
                Debug(peers, isDebug)
                Debug(consumers, isDebug)
            })

            consumer.on('producerclose', () => {
                Log(`consumer ${consumer.id} closed by producerclose`)
                this.consumers = this.consumers.filter(item => item.consumer.id !== consumer.id)
                Debug(peers, isDebug)
                Debug(consumers, isDebug)
                consumer.close()
            })

            this.addConsumer(consumer, socketId)
            return consumer
        }
    }

    /**
     * Author: Yun Kyeung Rok
     * 영상 수신 재개 처리
     * Handle consumer resume.
     */
    consume_resume = async (serverConsumerId) => {
        const { consumer } = this.consumers.find(consumerData => consumerData.consumer.id === serverConsumerId)
        await consumer.resume()
    }

    /**
     * Author: Yun Kyeung Rok
     * 데이터 수신 처리
     * Handle data consume.
     */
    consumeData = async (rtpCapabilities, remoteProducerId, serverConsumerTransportId, socketId) => {
        let consumerTransport = this.transports.find(transportData => (
            transportData.consumer && transportData.transport.id == serverConsumerTransportId
        )).transport

        const consumer = await consumerTransport.consumeData({
            dataProducerId: remoteProducerId
        })

        consumer.on('transportclose', () => {
            Log(`dataconsumer ${consumer.id} closed by transportclose`)
            consumers = consumers.filter(item => item.consumer.id !== consumer.id)
            Debug(peers, isDebug)
            Debug(consumers, isDebug)
            consumer.close()
        })

        consumer.on('producerclose', () => {
            Log(`consumer ${consumer.id} closed by producerclose`)
            consumers = consumers.filter(item => item.consumer.id !== consumer.id)
            Debug(peers, isDebug)
            Debug(consumers, isDebug)
            consumer.close()
        })

        this.addConsumer(consumer, socketId)
        return consumer
    }

    /**
     * Author: Yun Kyeung Rok
     * 수신자 추가
     * Add consumer.
     */
    addConsumer = (consumer, socketId) => {
        this.consumers = [
            ...this.consumers,
            { socketId: socketId, consumer }
        ]

        if (this.peers[socketId] === undefined) {
            this.peers[socketId] = {
                ...this.peers[socketId],
                consumers: [consumer.id]
            }
        } else if (this.peers[socketId].consumers === undefined) {
            this.peers[socketId] = {
                ...this.peers[socketId],
                consumers: [consumer.id]
            }
        } else {
            this.peers[socketId] = {
                ...this.peers[socketId],
                consumers: [
                    ...this.peers[socketId].consumers,
                    consumer.id
                ]
            }
        }
    }

    /**
     * Author: Yun Kyeung Rok
     * 영상 생성자 추가
     * Add producer.
     */
    addProducer = (producer, socketId) => {
        this.producers = [
            ...this.producers,
            { socketId: socketId, producer }
        ]

        if (this.peers[socketId] === undefined) {
            this.peers[socketId] = {
                ...this.peers[socketId],
                producers: [producer.id]
            }
        } else if (this.peers[socketId].producers === undefined) {
            this.peers[socketId] = {
                ...this.peers[socketId],
                producers: [producer.id]
            }
        } else {
            this.peers[socketId] = {
                ...this.peers[socketId],
                producers: [
                    ...this.peers[socketId].producers,
                    producer.id,
                ]
            }
        }
    }

    /**
     * Author: Yun Kyeung Rok
     * 데이터 생산자 추가
     * Add data producer.
     */
    addDataProducer = (producer, socketId) => {
        this.dataproducers = [
            ...this.dataproducers,
            { socketId: socketId, producer }
        ]
    
        if (this.peers[socketId] === undefined) {
            this.peers[socketId] = {
                ...this.peers[socketId],
                dataproducers: [producer.id]
            }
        } else if (this.peers[socketId].dataproducers === undefined) {
            this.peers[socketId] = {
                ...this.peers[socketId],
                dataproducers: [producer.id]
            }
        } else {
            this.peers[socketId] = {
                ...this.peers[socketId],
                dataproducers: [
                    ...this.peers[socketId].dataproducers,
                    producer.id,
                ]
            }
        }
    }

    /**
     * Author: Yun Kyeung Rok
     * 생산자 ID 가져오기
     * Get producer ID.
     */
    getProducer = async (socketId) => {
        let producerId = undefined
        this.producers.forEach(producerData => {
            if (producerData.socketId === socketId) {
                producerId = producerData.producer.id
            }
        })
        return producerId
    }

    /**
     * Author: Yun Kyeung Rok
     * 데이터 생산자 ID 가져오기
     * Get data producer ID.
     */
    getDataProducer = async (socketId) => {
        let producerId = undefined
        this.dataproducers.forEach(producerData => {
            if (producerData.socketId === socketId) {
                producerId = producerData.producer.id
            }
        })
        return producerId
    }
}
