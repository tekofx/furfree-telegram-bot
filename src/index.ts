import "reflect-metadata";
import { Context, Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import { addBotCommands } from "./commands";
import { config } from "./config";
import { addCronJobs } from "./schedules";
import { AppDataSource } from "./typeorm.config";

AppDataSource.initialize()
  .then(() => {
    // here you can start to work with your database
  })
  .catch((error) => console.log(error));
const bot = new Telegraf(config.BOT_TOKEN);

bot.start((ctx) => ctx.reply("Welcome"));
addBotCommands(bot);
addCronJobs(bot);


function onNewMember(ctx: Context) {
  const newMembers = ctx.message.new_chat_members;

  if (!newMembers) {
    return;
  }
  newMembers.forEach((member:any) => {
    ctx.reply(
      `¡Bienvenido, @${member.username || member.first_name}!\n\n`+
      `PARA ENTRAR:\n`+ 
      `\t· Leer las [normas](${config.RULES_MESSAGE}) (y estar de acuerdo con ellas)\n`+
      `\t· Ser mayor de edad: por las nuevas políticas de Telegram no podemos aceptar a personas menores de 18 años.\n`+ 
      `\t· Presentarse: edad (obligatorio) de donde venís, pronombres, nombres etc. Podéis usar esta [plantilla](${config.PRESENTATION_TEMPLATE_MESSAGE})\n`+
      `\t· Breve descripción y con qué podrías aportar (arte, quedadas, etc) (opcional)\n`+
      `Una vez os leamos seréis admitidos y entraréis en el grupo. Cuando entréis abandonad el grupo de admisión, por favor. Un saludo! 💜🐺`
      , 
      
      {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    });
  });
}

// Añadir manejador de eventos para nuevos miembros usando filtros
bot.on(message("new_chat_members"), (ctx) => {
  if (ctx.chat.id === config.ADMISSION_GROUP_ID) {
    onNewMember(ctx);
  }
});


bot.launch();
console.log("Bot started");

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
