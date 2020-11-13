const program = require('commander');
const lan = require('./tunnel-lib/lan');
const wan = require('./tunnel-lib/wan');
const AnyProxy = require('anyproxy');

program.option('--tunnel-port <port>', 'Tunnel port', 8010);
program.option('--wan-port <port>', 'Tunnel port', 8002);
program.option('--wan-host <hostname>', 'WAN hostname');
program.option('--lan-port <port>', 'Lan port', 8011); // Anyproxy
program.option('--wan-proxy-port <port>', 'WAN proxy port  (Proxy to configure in your browser)', 8001); // Proxy to set
program.option('--tunnel-count <count>', 'Tunnel count', 10);


program.command('lan <wanHost>').action((wanHost) => {
    lan(
        {
            host: wanHost,
            port: program.tunnelPort,
        },
        {
            host: 'localhost',
            port: program.lanPort,
        },
        program.tunnelCount,
    );

    const proxyServer = new AnyProxy.ProxyServer({
        port: program.lanPort,
        webInterface: {
            enable: false,
        },
        throttle: 10000,
        forceProxyHttps: false,
        wsIntercept: false,
        silent: false,
    });
    proxyServer.on('ready', () => {
        console.log('Web proxy is listening on port ', program.lanPort);
    });
    proxyServer.on('error', (e) => {
        console.error('Web proxy error=', e);
    });
    proxyServer.start();
});

program.command('wan').action(() => {
    wan({
        proxyPort: program.wanProxyPort,
        tunnelPort: program.tunnelPort,
    });
    console.log('WAN side is enabled');
});

program.parse(process.argv);
