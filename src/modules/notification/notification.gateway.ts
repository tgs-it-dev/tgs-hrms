import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtHelperService, JwtPayload } from 'src/common/jwt';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  tenantId?: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',').map(origin => origin.trim()) || [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:3001',
    ],
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);
  private readonly connectedClients = new Map<string, AuthenticatedSocket>();

  constructor(private readonly jwtHelper: JwtHelperService) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.query?.token;

      if (!token || typeof token !== 'string') {
        this.logger.warn(`Client ${client.id} disconnected: No token provided`);
        client.disconnect();
        return;
      }

      try {
        const payload = this.jwtHelper.verifyToken<JwtPayload>(token);
        const userId = payload.sub ?? payload.id;
        if (!userId || typeof userId !== 'string') {
          this.logger.warn(`Client ${client.id} disconnected: Token missing user ID`);
          client.disconnect();
          return;
        }

        client.userId = userId;
        client.tenantId = payload.tenant_id ?? undefined;
        this.connectedClients.set(userId, client);
        this.logger.log(`Client ${client.id} connected as user ${userId}`);
      } catch {
        this.logger.warn(`Client ${client.id} disconnected: Invalid token`);
        client.disconnect();
      }
    } catch (error) {
      this.logger.error(`Error handling connection for client ${client.id}:`, error);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      this.connectedClients.delete(client.userId);
      this.logger.log(`Client ${client.id} disconnected (user ${client.userId})`);
    } else {
      this.logger.log(`Client ${client.id} disconnected`);
    }
  }

  /**
   * Send notification to a specific user
   */
  sendToUser(userId: string, event: string, data: any) {
    const client = this.connectedClients.get(userId);
    if (client) {
      client.emit(event, data);
      this.logger.log(`Sent ${event} to user ${userId}`);
      return true;
    }
    this.logger.debug(`User ${userId} not connected, notification not sent`);
    return false;
  }

  /**
   * Send notification to multiple users
   */
  sendToUsers(userIds: string[], event: string, data: any) {
    let sentCount = 0;
    for (const userId of userIds) {
      if (this.sendToUser(userId, event, data)) {
        sentCount++;
      }
    }
    return sentCount;
  }

  @SubscribeMessage('ping')
  handlePing(client: AuthenticatedSocket) {
    return { event: 'pong', data: { timestamp: new Date().toISOString() } };
  }
}
