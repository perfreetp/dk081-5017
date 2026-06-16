import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ContextMiddleware } from './common/middleware/context.middleware';
import { AccessPointModule } from './modules/access-point/access-point.module';
import { RuleOrchestrationModule } from './modules/rule-orchestration/rule-orchestration.module';
import { EventRoutingModule } from './modules/event-routing/event-routing.module';
import { NotificationModule } from './modules/notification/notification.module';
import { AuditModule } from './modules/audit/audit.module';
import * as entities from './infrastructure/entities';
import { join } from 'path';
import * as fs from 'fs';
import initSqlJs from 'sql.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const dataDir = join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
        const dbPath = join(dataDir, 'security-events.db');
        const SQL = await initSqlJs();
        let dbFile: Uint8Array | undefined;
        if (fs.existsSync(dbPath)) {
          dbFile = fs.readFileSync(dbPath);
        }
        return {
          type: 'sqljs',
          driver: SQL,
          database: dbFile,
          location: dbPath,
          autoSave: true,
          entities: Object.values(entities),
          synchronize: true,
          logging: false,
        };
      },
    }),
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 20,
      verboseMemoryLeak: true,
      ignoreErrors: false,
    }),
    AccessPointModule,
    RuleOrchestrationModule,
    EventRoutingModule,
    NotificationModule,
    AuditModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ContextMiddleware).forRoutes('*');
  }
}
