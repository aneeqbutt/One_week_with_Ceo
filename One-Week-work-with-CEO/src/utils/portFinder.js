import net from 'net';

/**
 * Check if a port is available on the system
 * @param {number} port - Port number to check
 * @returns {Promise<boolean>} - True if port is available, false otherwise
 */
async function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        resolve(false);
      }
    });
    
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    
    server.listen(port, '127.0.0.1');
  });
}

/**
 * Find an available port in a given range
 * @param {number} startPort - Starting port number (default: 40000)
 * @param {number} endPort - Ending port number (default: 50000)
 * @param {number} maxAttempts - Maximum number of attempts (default: 100)
 * @returns {Promise<number>} - Available port number
 */
export async function findAvailablePort(startPort = 40000, endPort = 50000, maxAttempts = 100) {
  console.log(`🔍 Searching for available port between ${startPort} and ${endPort}...`);
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Generate a random port in the range
    const port = Math.floor(Math.random() * (endPort - startPort + 1)) + startPort;
    
    const available = await isPortAvailable(port);
    
    if (available) {
      console.log(`✅ Found available port: ${port}`);
      return port;
    } else {
      console.log(`⚠️ Port ${port} is in use, trying another...`);
    }
  }
  
  throw new Error(`Could not find an available port after ${maxAttempts} attempts`);
}

/**
 * Get a list of commonly used ports to avoid
 */
export const RESERVED_PORTS = [
  80, 443, 3000, 3001, 5000, 5001, 8000, 8080, 8443, 8888, 9000
];

/**
 * Find multiple available ports at once
 * @param {number} count - Number of ports needed
 * @param {number} startPort - Starting port number (default: 40000)
 * @param {number} endPort - Ending port number (default: 50000)
 * @returns {Promise<number[]>} - Array of available port numbers
 */
export async function findMultipleAvailablePorts(count, startPort = 40000, endPort = 50000) {
  const ports = [];
  const usedPorts = new Set();
  
  console.log(`🔍 Searching for ${count} available ports...`);
  
  while (ports.length < count) {
    const port = await findAvailablePort(startPort, endPort);
    
    // Ensure we don't return duplicate ports
    if (!usedPorts.has(port)) {
      ports.push(port);
      usedPorts.add(port);
    }
  }
  
  console.log(`✅ Found ${count} available ports:`, ports);
  return ports;
}

/**
 * Check if a specific port is currently in use
 * @param {number} port - Port to check
 * @returns {Promise<boolean>} - True if port is in use, false if available
 */
export async function isPortInUse(port) {
  const available = await isPortAvailable(port);
  return !available;
}
