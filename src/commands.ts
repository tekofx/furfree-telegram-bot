// botCommands.ts
import { Context, Telegraf, type NarrowedContext } from "telegraf";
import { message } from "telegraf/filters";
import type { BotCommand, Message, Update } from "telegraf/types";
import { Birthday } from "./entities";
import { BirthdayRepo } from "./typeorm.config";

export const commands: BotCommand[] = [{ command: "hi", description: "hello" }];
export const groupCommands: BotCommand[] = [
  {
    command: "add_cumple",
    description: "Pon tu cumple para ser notificado",
  },
  { command: "next_cumple", description: "Ver siguiente cumpleaños" },
];

interface WaitingResponse {
  chatId: string;
  userId: string;
  messageId: string;
  command: string;
}

var waitingResponses: WaitingResponse[] = [];

function addWaitingResponse(response: WaitingResponse) {
  waitingResponses.push(response);
}

function removeWaitingResponse(
  chatId: string,
  userId: string,
  command: string
) {
  waitingResponses = waitingResponses.filter(
    (response) =>
      response.chatId !== chatId ||
      response.userId !== userId ||
      response.command !== command
  );
}

function getWaitingResponse(
  chatId: string,
  userId: string,
  command: string
): WaitingResponse | undefined {
  return waitingResponses.find(
    (response) =>
      response.chatId === chatId &&
      response.userId === userId &&
      response.command === command
  );
}

async function add_cumple(
  context: NarrowedContext<Context<Update>, Update.MessageUpdate<Message>>,
  bot: Telegraf
) {
  var previousWaitingResponse = getWaitingResponse(
    context.chat.id.toString(),
    context.from.id.toString(),
    "add_cumple"
  );

  if (previousWaitingResponse !== undefined) {
    const chatId = context.chat.id.toString().replace("-100", "");
    const link = `https://t.me/c/${chatId}/${previousWaitingResponse.messageId}`;
    return await context.reply(
      `Ya estas añadiendo un cumpleaños, responde al [mensaje anterior](${link}) para añadir tu cumpleaños`,
      {
        parse_mode: "Markdown",
        reply_to_message_id: context.message.message_id,
      }
    );
  }

  var botMessage = await context.reply(
    "Responde a este mensaje con tu cumpleaños en formato dd/mm/aaaa",
    {
      reply_to_message_id: context.message.message_id,
    }
  );
  waitingResponses.push({
    chatId: context.chat.id.toString(),
    userId: context.from.id.toString(),
    messageId: botMessage.message_id.toString(),
    command: "add_cumple",
  });
  bot.on(message("reply_to_message"), async (ctx) => {
    const waitingResponse = getWaitingResponse(
      ctx.chat.id.toString(),
      ctx.from.id.toString(),
      "add_cumple"
    );

    if (
      waitingResponse !== undefined &&
      ctx.message.reply_to_message !== undefined
    ) {
      const birthday = new Birthday();

      if (!ctx.message.text.includes("/")) {
        return await ctx.reply("Error: El mensaje no contiene una fecha", {
          reply_to_message_id: ctx.message.message_id,
        });
      }

      // Create date from string with format dd/mm/yyyy
      const message = ctx.message.text.split("/");
      var date = new Date(
        parseInt(message[2]),
        parseInt(message[1]) - 1,
        parseInt(message[0])
      );
      if (
        date.toString() === "Invalid Date" ||
        date.getDate() != parseInt(message[0]) ||
        date.getMonth() + 1 != parseInt(message[1])
      ) {
        return await ctx.reply("Fecha no válida", {
          reply_to_message_id: ctx.message.message_id,
        });
      }
      birthday.date = date;
      birthday.group = ctx.chat.id.toString();
      birthday.userId = ctx.from.id.toString();
      if (ctx.from.username === undefined) {
        await ctx.reply(
          "No tienes un username configurado. Establece uno para poder usar esta funcion",
          {
            reply_to_message_id: ctx.message.message_id,
          }
        );
        return;
      }

      birthday.username = ctx.from.username;
      await BirthdayRepo.save(birthday);

      await ctx.reply("Cumpleaños guardado", {
        reply_to_message_id: ctx.message.message_id,
      });
      removeWaitingResponse(
        ctx.chat.id.toString(),
        ctx.from.id.toString(),
        "add_cumple"
      );
    }
  });
}


async function next_cumple(
  ctx: NarrowedContext<Context<Update>, Update.MessageUpdate<Message>>
) {
  var today = new Date();
  var birthdays = await BirthdayRepo.find({
    where: { group: ctx.chat.id.toString() },
  });

  if (birthdays.length == 0) {
    return await ctx.reply("No hay ningun cumpleaños añadido");
  }
  var closestBirthday = birthdays[0];
  var minDiff = Infinity;

  birthdays.forEach((birthday) => {
    // Create a new date object for the birthday this year or next year
    var nextBirthday = new Date(
      today.getFullYear(),
      birthday.date.getMonth(),
      birthday.date.getDate()
    );
    if (nextBirthday < today) {
      nextBirthday.setFullYear(today.getFullYear() + 1);
    }

    // Calculate the difference in days
    var diff = Math.ceil(
      (nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Update closestBirthday if this birthday is closer
    if (diff < minDiff) {
      closestBirthday = birthday;
      minDiff = diff;
    }
  });

  return await ctx.reply(
    `El próximo cumpleaños es el de @${
      closestBirthday.username
    } el dia ${closestBirthday.date.getDate()}/${
      closestBirthday.date.getMonth() + 1
    }`
  );
}
export function addBotCommands(bot: Telegraf) {
  // Add commands
  bot.command("hi", (ctx) => ctx.reply("Hello"));
  bot.command("add_cumple", (ctx) => add_cumple(ctx, bot));
  bot.command("next_cumple", next_cumple);

  // Set commands list
  bot.telegram.setMyCommands(groupCommands, {
    scope: { type: "all_group_chats" },
  });
  bot.telegram.setMyCommands(commands);
}
