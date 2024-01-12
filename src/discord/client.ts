import { Client, GatewayIntentBits, Partials } from 'discord.js';
import dotenv from 'dotenv';
import { handleInteractionCreate, handleReactionAdd } from './interaction';
import { handleMessageCreate } from './message';

dotenv.config();

const options = {
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.ThreadMember,
    Partials.GuildMember,
  ],
};

// Discord を作成
export const discordClient = new Client(options);

if (process.env.DISCORD_BOT_TOKEN === undefined) {
  console.log('DISCORD_BOT_TOKEN is not defined');
  process.exit(1);
}

discordClient.login(process.env.DISCORD_BOT_TOKEN);

discordClient.on('ready', () => {
  if (discordClient.user) {
    console.log(`Logged in as ${discordClient.user.tag}!`);
  } else {
    console.log(`An error has occured on discord.js preparing`);
  }
});

discordClient.on('messageReactionAdd', handleReactionAdd);
discordClient.on('messageCreate', handleMessageCreate);
discordClient.on('interactionCreate', handleInteractionCreate);
