### Socks5 Proxy example

- **!This Example only works with socks5 proxys!**

Make sure your proxy connection is working.

#### Testing proxy connections with curl on Unix systems or Command prompt on Windows:
```bash
curl -x "socks5://<proxyAddress>:<proxyPort>" "http://ifconfig.me"
```
If you see an ip address the proxy is working. If you see anything else it's not.


#### These Errors what do they mean????
```
FetchError: request to https://authserver.mojang.com/authenticate failed, reason: Socket closed
```
- The Proxy is not working


--------
```
SocksClientError: Socket closed
```
- General Socket error Bad Proxy/Proxy refuses the connection

--------
```
SocksClientError: connect ECONNREFUSED <some ip address>
```
- The Connection to the proxy Failed

--------
```
SocksClientError: Proxy connection timed out
```
- Destination Address is wrong/not reachable. Or the Proxy is not working.

--------
```
Connection Refused: Blocked by CloudFront/CloudFlare
```
- Proxy Ip has been banned/block by Cloudflare.
