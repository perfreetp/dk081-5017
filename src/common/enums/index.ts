export enum DeviceType {
  CAMERA = 'camera',
  ACCESS_CONTROL = 'access_control',
}

export enum DeviceStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  MAINTENANCE = 'maintenance',
  FAULT = 'fault',
}

export enum SceneType {
  PEDIATRICS = 'pediatrics',
  EMERGENCY = 'emergency',
  OPERATING_ROOM = 'operating_room',
  PHARMACY = 'pharmacy',
  ICU = 'icu',
  NICU = 'nicu',
  WARD = 'ward',
  LOBBY = 'lobby',
  PARKING = 'parking',
  OTHER = 'other',
}

export enum EventLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum EventStatus {
  PENDING = 'pending',
  DISPATCHED = 'dispatched',
  PROCESSING = 'processing',
  ESCALATED = 'escalated',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
  FALSE_ALARM = 'false_alarm',
}

export enum NotificationTarget {
  MONITOR_ROOM = 'monitor_room',
  PATROL = 'patrol',
  NURSE_STATION = 'nurse_station',
  SECURITY_MANAGER = 'security_manager',
  HOSPITAL_ADMIN = 'hospital_admin',
  GROUP_ADMIN = 'group_admin',
}

export enum NotificationChannel {
  PLATFORM = 'platform',
  SMS = 'sms',
  PHONE = 'phone',
  WECHAT = 'wechat',
  EMAIL = 'email',
}

export enum FalseAlarmCategory {
  SYSTEM_ERROR = 'system_error',
  PERSONNEL_AUTHORIZED = 'personnel_authorized',
  ENVIRONMENT_FACTOR = 'environment_factor',
  RULE_MISCONFIGURATION = 'rule_misconfiguration',
  OTHER = 'other',
}

export enum SensitivityLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high',
}

export enum StrictModeType {
  MAJOR_EVENT = 'major_event',
  EMERGENCY = 'emergency',
  VISIT = 'visit',
  CUSTOM = 'custom',
}
