import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class ContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const userId = req.headers['x-user-id'] as string;
    const userName = req.headers['x-user-name'] as string;
    const userRole = req.headers['x-user-role'] as string;
    const hospitalId = req.headers['x-hospital-id'] as string;

    (req as any).context = {
      userId: userId || 'system',
      userName: userName || '系统用户',
      userRole: userRole || 'admin',
      hospitalId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };
    next();
  }
}

export class ContextHelper {
  static get(req: any) {
    return req.context || {
      userId: 'system',
      userName: '系统用户',
      userRole: 'admin',
    };
  }
}
