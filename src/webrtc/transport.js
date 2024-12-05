export const createPlainRtpTransport = async (router) => {
    const transport = await router.createPlainTransport({
        listenIp: { ip: '0.0.0.0', announcedIp: null },
        rtcpMux: true, // RTP와 RTCP를 같은 포트에서 처리
        comedia: true, // 클라이언트가 데이터를 먼저 전송
    });

    console.log('Plain RTP Transport created:', {
        rtpPort: transport.tuple.localPort,
        rtcpPort: transport.rtcpTuple?.localPort,
    });

    return transport;
};

export const createProducer = async (transport, ssrc) => {
    const producer = await transport.produce({
        kind: 'video',
        rtpParameters: {
            codecs: [
                {
                    mimeType: 'video/H264',
                    clockRate: 90000,
                    payloadType: 96,
                },
            ],
            encodings: [{ ssrc }],
        },
    });

    console.log('Producer created:', producer.id);
    return producer;
};
