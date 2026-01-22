import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

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

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extract token from handshake auth or query
      const token = client.handshake.auth?.token || client.handshake.query?.token;

      if (!token || typeof token !== 'string') {
        this.logger.warn(`Client ${client.id} disconnected: No token provided`);
        client.disconnect();
        return;
      }

      // Verify JWT token
      const secret = this.configService.get<string>('JWT_SECRET');
      if (!secret) {
        this.logger.error('JWT_SECRET not configured');
        client.disconnect();
        return;
      }

      try {
        const payload = this.jwtService.verify(token, { secret });
        if (!payload.id || typeof payload.id !== 'string') {
          this.logger.warn(`Client ${client.id} disconnected: Token missing user ID`);
          client.disconnect();
          return;
        }
        
        const userId: string = payload.id;
        client.userId = userId;
        client.tenantId = payload.tenant_id;

        // Store client by userId for easy lookup
        this.connectedClients.set(userId, client);

        this.logger.log(`Client ${client.id} connected as user ${userId}`);
      } catch (error) {
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
