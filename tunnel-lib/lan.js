const net = require('net');

let _socketId = 0;

function createTunnelFactory(remoteServer, localServer, code) {
    return function createTunnel() {
        const socketId = _socketId++;
        let endProcessed = false;

        console.log('[' + socketId + '] Create a tunnel to WAN ' + localServer.host + ':' + localServer.port);
        const local = net.connect({
            host: localServer.host,
            port: localServer.port
        });
        local.setKeepAlive(true);
        local.on('error', err => {
            console.log('[' + socketId + '] local error', err);
        });

        const remote = net.connect({
            host: remoteServer.host,
            port: remoteServer.port
        });
        remote.setKeepAlive(true);
        remote.once('connect', function () {
            console.log('[' + socketId + '] Connected to WAN ' + localServer.host + ':' + localServer.port);
            if (code != undefined) {
                remote.write(code);
            }
        });
        remote.on('data', data => {
            //console.log('remote has data', data.toString())
        });
        remote.on('error', function (error) {
            if (endProcessed) {
                return;
            }
            let timeout = 1000;
            if (error && error.code === 'ECONNREFUSED') {
                timeout = 1 * 60 * 1000;
                console.log('[' + socketId + '] Can not connect to WAN, wait for 1mn');
            } else {
                console.log('[' + socketId + '] remote connection error', error);
            }
            endProcessed = 'remoteError';
            remote.end();
            local.end();
            setTimeout(() => {
                console.log('[' + socketId + '] retry WAN connexion');
                createTunnel();
            }, timeout);
        });
        remote.on('end', data => {
            if (endProcessed) {
                return;
            }
            endProcessed = 'remoteEnd';
            console.log('[' + socketId + '] connexion ended');
            local.end();
            createTunnel();
        });

        local.on('end', (data) => {
            if (endProcessed) {
                return;
            }
            endProcessed = 'localEnd';
            remote.end();
            createTunnel();
        });

        remote.pipe(local).pipe(remote);
    };
}

module.exports = (remoteServer, localServer, tunnels = 10) => {
    console.log('Requested tunnels=', tunnels);
    const createTunnel = createTunnelFactory(remoteServer, localServer);
    while (tunnels--) {
        createTunnel();
    }
};
