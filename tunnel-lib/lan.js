const net = require('net');

let _socketId = 0;

function createTunnelFactory(remoteServer, localServer, code) {
    return function createTunnel() {
        const socketId = _socketId++;
        let endProcessed = false;
        let firstData = true;
        let local;

        const remote = net.connect({
            host: remoteServer.host,
            port: remoteServer.port
        });
        remote.setKeepAlive(true);
        remote.once('connect', () => {
            console.log('[' + socketId + '] Connected to WAN ' + remoteServer.host + ':' + remoteServer.port);
        });
        remote.on('data', data => {
            //console.log('remote has data', data.toString())

            if (!firstData) {
                return;
            }
            firstData = false;
            createTunnel();

            console.log('[' + socketId + '] Contact proxy');
            local = net.connect({
                host: localServer.host,
                port: localServer.port
            });
            local.setKeepAlive(true);
            local.on('error', err => {
                console.log('[' + socketId + '] local error', err);
                if (endProcessed) {
                    return;
                }
                endProcessed = 'localError';
                remote.end();
                local.end();
            });
            local.on('connect', () => {
                console.log('[' + socketId + '] Proxy contacted, send data');

                local.write(data);

                remote.pipe(local).pipe(remote);
            });

            local.on('end', (data) => {
                if (endProcessed) {
                    return;
                }
                endProcessed = 'localEnd';
                remote.end();
            });
        });
        remote.on('error', function (error) {
            if (endProcessed) {
                return;
            }
            let timeout = 1000;
            if (error && (error.code === 'ECONNREFUSED')) {
                timeout = 1 * 60 * 1000;
                console.log('[' + socketId + '] Can not connect to WAN, wait for 1mn');
            } else {
                console.log('[' + socketId + '] remote connection error', error);
            }
            endProcessed = 'remoteError';
            remote.end();
            if (local) {
                local.end();
            }
            if (!firstData) {
                return;
            }
            firstData= false;
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
            if (local) {
                local.end();
            }
        });

    };
}

module.exports = (remoteServer, localServer, tunnels = 2) => {
    console.log('Requested tunnels=', tunnels);
    const createTunnel = createTunnelFactory(remoteServer, localServer);
    while (tunnels--) {
        createTunnel();
    }
};
