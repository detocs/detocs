import * as WebSocket from 'ws';

// TODO: Figure out how to refer to the client type directly
interface WebSocketClient {
  readyState: WebSocket['readyState'];
  send: WebSocket['send'];
}

export function broadcastData(server: WebSocket.Server, data: unknown): void {
  broadcastAllData(server, [data]);
}

export function broadcastAllData(server: WebSocket.Server, data: unknown[]): void {
  if (data.length === 0 || server.clients.size === 0) {
    return;
  }
  server.clients.forEach(client => {
    sendAllData(client as WebSocket, data);
  });
}

export function sendData(client: WebSocketClient, data: unknown): void {
  sendAllData(client, [data]);
}

export function sendAllData(client: WebSocketClient, data: unknown[]): void {
  if (data.length === 0 || client.readyState !== WebSocket.OPEN) {
    return;
  }
  for (const datum of data) {
    const json = typeof datum === 'string' ? datum : JSON.stringify(datum);
    client.send(json);
  }
}
