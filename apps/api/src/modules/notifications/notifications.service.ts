import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationType,
  type Notification,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FirebaseService } from '../firebase/firebase.service';
import {
  paginate,
  type PaginatedResult,
  type PaginationDto,
} from '../../common/dto/pagination.dto';

interface DispatchArgs {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
  channels?: NotificationChannel[];
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseService,
  ) {}

  async dispatch(args: DispatchArgs): Promise<Notification> {
    const channels = args.channels ?? [NotificationChannel.IN_APP];
    const record = await this.prisma.notification.create({
      data: {
        userId: args.userId,
        type: args.type,
        channel: channels[0],
        title: args.title,
        body: args.body,
        data: args.data,
        sentAt: new Date(),
      },
    });

    if (channels.includes(NotificationChannel.PUSH)) {
      const user = await this.prisma.user.findUnique({ where: { id: args.userId } });
      if (user?.fcmToken) {
        await this.firebase.sendPush(user.fcmToken, {
          title: args.title,
          body: args.body,
          data: args.data,
        });
      }
    }
    return record;
  }

  async list(userId: string, q: PaginationDto): Promise<PaginatedResult<Notification>> {
    const [total, data] = await Promise.all([
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.findMany({
        where: { userId },
        skip: q.skip,
        take: q.limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return paginate(data, total, q.page, q.limit);
  }

  async markAsRead(userId: string, id: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id, userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async unreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({ where: { userId, isRead: false } });
    return { count };
  }
}
