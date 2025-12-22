import net from 'net';

/**
 * Checks if a port is currently in use
 * @param {number} port - The port number to check
 * @returns {Promise<boolean>} True if port is in use, false otherwise
 */
export function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net
      .createServer()
      .once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          resolve(true);
        } else {
          resolve(false);
        }
      })
      .once('listening', () => {
        server.close();
        resolve(false);
      })
      .listen(port, '127.0.0.1');
  });
}
