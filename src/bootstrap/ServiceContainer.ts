import type { SesameService } from '../features/sesame/SesameService';
import type { DiscordService } from '../services/discord/discordService';
import type { NotionService } from '../services/notion/notionService';

/** Concrete service graph. Construction is restricted to the bootstrap layer. */
export interface ServiceContainer {
  discord: DiscordService;
  notion: NotionService;
  sesame?: SesameService;
}
