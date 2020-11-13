const net = require('net');

const pipeSockets = (client, tunnel) => {
    //console.log('piping');
    client.pipe(tunnel).pipe(client);
};

function wan(config) {
    let tunnels = [];
    const waitingClients = [];
    let _portId = 0;

    const deleteAfterTimeout = client => {
        setTimeout(() => {
            const i = waitingClients.indexOf(client);
            if (i >= 0) {
                waitingClients.splice(i, 1);
            }
            client.end();
        }, config.timeout || 5000);
    };

    // Tunnel
    net.createServer((tunnel) => {
        const lanTunnelId = _portId++;
        tunnel.lanTunnelId = lanTunnelId;
        let size = 0;
        console.log('[' + lanTunnelId + '] LAN Get tunnel connexion request from WAN  (port=', tunnel.address().port + ')');
        tunnel.setKeepAlive(true, 2000);
        if (waitingClients.length) {
            const waitingTunnel = waitingClients.shift();

            console.log('[' + waitingTunnel.proxyId + '] PROXY uses LAN tunnel [' + tunnel.lanTunnelId + ']');
            pipeSockets(waitingTunnel, tunnel);
            return;
        }

        tunnel.on('data', data => {
            size += data.length;
//            console.log('[' + lanTunnelId + '] LAN tunnel received data', data.length);
        });
        tunnel.on('end', data => {
            console.log('[' + lanTunnelId + '] LAN tunnel end (' + size + ' bytes)');
        });
        tunnel.on('error', (error) => {
            console.log('[' + lanTunnelId + '] LAN tunnel connection error', error);
        });
        tunnel.on('close', data => {
            console.log('[' + lanTunnelId + '] LAN tunnel close');
            tunnels = tunnels.filter(_tunnel => _tunnel != tunnel);
        });

        tunnels.push(tunnel);
    }).listen(config.tunnelPort);

    // Proxy
    net.createServer(client => {
        let proxyId = _portId++;
        client.proxyId = proxyId;

        console.log('[' + proxyId + '] PROXY Get request from browser');

        client.setKeepAlive(true);
        client.on('error', (error) => {
            console.log('[' + proxyId + '] PROXY error handling', error);
        });
        if (tunnels.length) {
            const tunnel = tunnels.shift();
            console.log('[' + proxyId + '] PROXY uses LAN tunnel [' + tunnel.lanTunnelId + ']');
            pipeSockets(client, tunnel);
        } else {
            console.log('[' + proxyId + '] PROXY wait for an unused tunnel');
            waitingClients.push(client);
        }
        deleteAfterTimeout(client);
    }).listen(config.proxyPort);
}

module.exports = wan;
