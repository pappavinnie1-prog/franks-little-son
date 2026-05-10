require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  Routes,
  REST,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
  ]
});

const ROLE_NAME = "Frank's Keys I Operations Director";
const LOG_CHANNEL_NAME = "📃sales-log";

const commands = [
  new SlashCommandBuilder()
    .setName("logsale")
    .setDescription("Log a new sale")
    .addUserOption(option =>
      option
        .setName("customer")
        .setDescription("Customer")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("package")
        .setDescription("Package purchased")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("amount")
        .setDescription("Amount charged")
        .setRequired(true)
    )
    .toJSON()
];

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );
    console.log("Slash command registered.");
  } catch (err) {
    console.error(err);
  }
})();

client.on("ready", () => {
  console.log(`${client.user.tag} is online.`);
});

client.on("interactionCreate", async interaction => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "logsale") {
      const customer = interaction.options.getUser("customer");
      const packageName = interaction.options.getString("package");
      const amount = interaction.options.getString("amount");

      const channel = interaction.guild.channels.cache.find(
        c => c.name === LOG_CHANNEL_NAME
      );

      if (!channel) {
        return interaction.reply({
          content: `Could not find ${LOG_CHANNEL_NAME}`,
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("📃 New Sale Pending Approval")
        .setDescription(
          `**Customer:** ${customer}\n` +
          `**Package:** ${packageName}\n` +
          `**Amount Charged:** ${amount}\n` +
          `**Logged By:** ${interaction.user}\n\n` +
          `**Status:** Pending ⏳`
        )
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`approve_${customer.id}`)
          .setLabel("Approve")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId(`decline_${customer.id}`)
          .setLabel("Decline")
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({
        embeds: [embed],
        components: [row]
      });

      await interaction.reply({
        content: "Sale logged successfully.",
        ephemeral: true
      });
    }
  }

  if (interaction.isButton()) {
    const member = interaction.member;

    if (!member.roles.cache.some(r => r.name === ROLE_NAME)) {
      return interaction.reply({
        content: "You cannot use these buttons.",
        ephemeral: true
      });
    }

    const [action, customerId] = interaction.customId.split("_");

    const oldEmbed = interaction.message.embeds[0];
    let description = oldEmbed.description;

    if (action === "approve") {
      description += `\n**Approved By:** ${interaction.user} ✅`;

      try {
        const user = await client.users.fetch(customerId);
        await user.send(
          "✅ Your Frank's Keys purchase has been approved. Thank you!"
        );
      } catch {}

    } else {
      description += `\n**Declined By:** ${interaction.user} ❌`;

      try {
        const user = await client.users.fetch(customerId);
        await user.send(
          "❌ Your Frank's Keys purchase was declined."
        );
      } catch {}
    }

    const updatedEmbed = EmbedBuilder.from(oldEmbed)
      .setDescription(
        description.replace(
          "**Status:** Pending ⏳",
          `**Status:** ${action === "approve" ? "Approved ✅" : "Declined ❌"}`
        )
      );

    const disabledRow = new ActionRowBuilder().addComponents(
      ButtonBuilder.from(interaction.message.components[0].components[0]).setDisabled(true),
      ButtonBuilder.from(interaction.message.components[0].components[1]).setDisabled(true)
    );

    await interaction.update({
      embeds: [updatedEmbed],
      components: [disabledRow]
    });
  }
});

client.login(process.env.TOKEN);