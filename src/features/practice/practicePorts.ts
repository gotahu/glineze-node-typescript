import type { Client } from '@notionhq/client';
import type { Practice } from '../../types/notion';

export interface PracticeRepository {
  retrievePracticesForRelativeDay(daysFromToday: number): Promise<Practice[]>;
}

export interface PracticeDependencies {
  notion: {
    client: Client;
    practiceService: PracticeRepository;
  };
  discord: {
    sendStringsToChannel(messages: string[], channelId: string): Promise<void>;
  };
}
