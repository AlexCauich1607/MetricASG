
export type ReminderType = 'FIRST' | 'SECOND' | 'DUE';

export interface ReevaluationNotification {
  id: number;
  target_date: string;
  reminder_type: ReminderType;
  created_at: string;
}

export interface NotificationPreference {
  in_app_enabled: boolean;
  email_enabled: boolean;
}

export interface NotificationPreferenceUpdate {
  in_app_enabled: boolean;
  email_enabled: boolean;
}
