require("dotenv").config();
const fs = require("fs");

const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  Routes,
  REST,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
});

const ROLE_NAME = "Frank's Keys | Owner";
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

client.once("ready", () => {
  console.log(`${client.user.tag} is online.`);
});

client.on("interactionCreate", async interaction => {

  // SLASH COMMAND
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

  // BUTTONS
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

      // SALES TRACKING
      const sellerMatch = oldEmbed.description.match(/\*\*Logged By:\*\* <@!?(\d+)>/);
      const packageMatch = oldEmbed.description.match(/\*\*Package:\*\* (.+)/);
      const amountMatch = oldEmbed.description.match(/\*\*Amount Charged:\*\* (.+)/);

      const sellerId = sellerMatch ? sellerMatch[1] : "Unknown";
      const savedPackage = packageMatch ? packageMatch[1] : "Unknown";
      const savedAmount = amountMatch ? amountMatch[1] : "Unknown";

      let salesData = [];

      try {
        salesData = JSON.parse(fs.readFileSync("sales.json", "utf8"));
      } catch {
        salesData = [];
      }

      salesData.push({
        sellerId: sellerId,
        sellerTag:
          interaction.guild.members.cache.get(sellerId)?.user.tag || "Unknown",
        customerId: customerId,
        package: savedPackage,
        amount: savedAmount,
        approvedBy: interaction.user.tag,
        approvedAt: new Date().toISOString()
      });

      fs.writeFileSync(
        "sales.json",
        JSON.stringify(salesData, null, 2)
      );

      console.log("Sale saved to sales.json");

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
          `**Status:** ${action === "approve"
            ? "Approved ✅"
            : "Declined ❌"}`
        )
      );

    const disabledRow = new ActionRowBuilder().addComponents(
      ButtonBuilder
        .from(interaction.message.components[0].components[0])
        .setDisabled(true),

      ButtonBuilder
        .from(interaction.message.components[0].components[1])
        .setDisabled(true)
    );

    await interaction.update({
      embeds: [updatedEmbed],
      components: [disabledRow]
    });
  }
});

// !BUY COMMAND
client.on("messageCreate", async (message) => {

  if (message.author.bot) return;

  if (message.content.toLowerCase() !== "!buy") return;

  if (!message.member.roles.cache.some(r => r.name === "Sales Team")) {
    return;
  }

  await message.channel.send(
`📌 **How To Buy**

• Go To The Store
• Sign In / Connect Your Account On The Website
• Go To The Gift Cards Category And Select **Custom Gift Card**
• Select Your **Budget / Amount**
• Copy And Paste My Email In The Recipient Field
• **Send Proof Once Purchased**
• Once Received, **Your Key Will Be Sent**

**Email:** franklinskeys@gmail.com

— **Frank's Keys 🔑**`
  );
});

client.login(process.env.TOKEN);
