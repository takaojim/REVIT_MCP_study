import net from 'net';

const socket = new net.Socket();
socket.setTimeout(2000);

socket.on('connect', () => {
  console.log('CONNECTED_TO_REVIT_PORT_8964');
  socket.destroy();
  process.exit(0);
});

socket.on('error', (err) => {
  console.log('CONNECTION_FAILED:', err.message);
  process.exit(1);
});

socket.on('timeout', () => {
  console.log('CONNECTION_TIMEOUT');
  socket.destroy();
  process.exit(1);
});

socket.connect(8964, '127.0.0.1');
