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

    };

    // Tunnel
    net.createServer((tunnel) => {
        const lanTunnelId = _portId++;
        tunnel.lanTunnelId = lanTunnelId;
        let size = 0;
        console.log('[' + lanTunnelId + '] Get tunnel connexion from LAN', tunnel.remoteAddress + ':' + tunnel.remotePort);
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
            tunnels = tunnels.filter(_tunnel => _tunnel != tunnel);
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

        console.log('[' + proxyId + '] PROXY Get request from browser', client.remoteAddress + ':' + client.remotePort);

        client.setKeepAlive(true);
        client.on('error', (error) => {
            console.log('[' + proxyId + '] PROXY error handling', error);
        });
        if (tunnels.length) {
            const tunnel = tunnels.shift();
            console.log('[' + proxyId + '] PROXY uses LAN tunnel [' + tunnel.lanTunnelId + ']');
            pipeSockets(client, tunnel);
            return;
        }

        console.log('[' + proxyId + '] PROXY wait for an unused tunnel');
        waitingClients.push(client);

    }).listen(config.proxyPort);
}

module.exports = wan;
