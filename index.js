const { 
  Client, 
  GatewayIntentBits, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  EmbedBuilder,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
  REST,
  Routes
} = require('discord.js');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ==========================================
// Express Server สำหรับ UptimeRobot / Render 24/7
// ==========================================
app.get('/', (req, res) => {
  res.status(200).send('🤖 Anny the Helper is running and alive 24/7!');
});

app.get('/ping', (req, res) => {
  res.status(200).send('PONG');
});

app.listen(PORT, () => {
  console.log(`🌐 Web server & API is running on port ${PORT}`);
});

const BOT_TOKEN = process.env.BOT_TOKEN;
const GUILD_ID = process.env.GUILD_ID;

// ตัวแปรเก็บค่าคอนฟิก (รูปภาพทั้ง 2 รูปส่งแบบ setImage ด้านล่าง)
let configData = {
  ticketPanelChannelId: '', 
  ticketPanelImage: '',       // ลิงก์รูปภาพที่ 1 (Banner หลัก)
  ticketPanelImage2: '',      // ลิงก์รูปภาพที่ 2 (Banner ต่อท้าย)
  ticketLogChannelId: '',   
  ticketLogImage: '',         // ลิงก์รูปภาพที่ 1 (Banner หลัก Log)
  ticketLogImage2: ''         // ลิงก์รูปภาพที่ 2 (Banner ต่อท้าย Log)
};

const activeTickets = new Map();
const userReportCache = new Map();

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ] 
});

client.once('ready', async () => {
  console.log(`✅ บอทออนไลน์แล้วในชื่อ: ${client.user.tag}`);

  const commands = [
    {
      name: 'setup-ticket',
      description: '🛡️ ส่งแผงระบบช่วยเหลือ Anny the Helper (TH/EN Support Panel)',
      default_member_permissions: PermissionFlagsBits.Administrator.toString(),
    },
    {
      name: 'config-panel',
      description: '⚙️ แผงควบคุมตั้งค่าห้องและรูปภาพ (Admin Configuration Panel)',
      default_member_permissions: PermissionFlagsBits.Administrator.toString(),
    }
  ];

  if (!BOT_TOKEN || !GUILD_ID) {
    console.error('❌ กรุณาตั้งค่า BOT_TOKEN และ GUILD_ID ใน Environment Variables');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

  try {
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, GUILD_ID),
      { body: commands },
    );
    console.log('🎉 ลงทะเบียน Slash Commands ของ Anny สำเร็จเรียบร้อย!');
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการลงทะเบียนคำสั่ง:', error);
  }
});

// ==========================================
// ระบบตอบกลับผู้ใช้ผ่านการ Reply ข้อความ Ticket ในห้อง Log
// ==========================================
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;

  if (configData.ticketLogChannelId && message.channelId === configData.ticketLogChannelId) {
    if (message.reference && message.reference.messageId) {
      try {
        const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
        
        if (activeTickets.has(repliedMessage.id)) {
          const targetUserId = activeTickets.get(repliedMessage.id);
          const targetUser = await client.users.fetch(targetUserId);

          if (targetUser) {
            const replyEmbed = new EmbedBuilder()
              .setTitle('🛡️ [ Anny the Helper ] ข้อความตอบกลับจากทีมงาน / Staff Response')
              .setDescription(message.content)
              .setColor('#2ecc71')
              .setFooter({ text: `ตอบกลับโดย / Replied by Admin: ${message.author.tag}` })
              .setTimestamp();

            await targetUser.send({ embeds: [replyEmbed] });
            await message.react('✅'); 
          }
        }
      } catch (err) {
        console.error('❌ ไม่สามารถส่งข้อความหาผู้ใช้ผ่าน DM ได้:', err);
        await message.react('❌');
      }
    }
  }
});

// ==========================================
// Interaction Handling (Slash Commands & Controls)
// ==========================================
client.on('interactionCreate', async interaction => {

  // 1. คำสั่ง /setup-ticket (ส่งแผง Ticket)
  if (interaction.isChatInputCommand() && interaction.commandName === 'setup-ticket') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ เฉพาะ Admin เท่านั้นที่ใช้งานคำสั่งนี้ได้ค่ะ / Admin only!', ephemeral: true });
    }

    const targetChannelId = configData.ticketPanelChannelId || interaction.channelId;
    const targetChannel = interaction.guild.channels.cache.get(targetChannelId);

    if (!targetChannel) {
      return interaction.reply({ content: '❌ ยังไม่ได้ตั้งค่าห้องสำหรับส่งแผง Ticket กรุณาตั้งค่าผ่าน `/config-panel` ก่อนค่ะ! / Please setup via `/config-panel` first.', ephemeral: true });
    }

    // Embed ใบที่ 1: ภาษาไทย + ภาษาอังกฤษ
    const embed1 = new EmbedBuilder()
      .setTitle('🛡️ ──・[ Anny the Helper : Support Center / ศูนย์ช่วยเหลือ ]・── 🌸')
      .setDescription('✨ **สวัสดีค่ะคุณผู้เล่น! / Hello Players!**\nหากคุณพบปัญหาในการเล่นเกมหรือต้องการความช่วยเหลือ / If you encounter any issues:\n\n> 🖥️ **Launcher Issues / ปัญหา Launcher** (บัค, กดปุ่มไม่ได้, Fix system)\n> 🎮 **Game Errors / ตัวเกมมีปัญหา** (เกมบัค, Error 0, 3, 4)\n> 🚨 **Report Players / แจ้งผู้เล่นโกง** (ใช้โปรแกรมโกง, จงใจใช้บัค)\n\n🧸 **คลิกปุ่มด้านล่างเพื่อเปิดฟอร์มแจ้งปัญหาได้เลยค่ะ! / Click below to open a ticket!**')
      .setColor('#ff6b81')
      .setTimestamp();

    if (configData.ticketPanelImage && configData.ticketPanelImage.trim() !== '') {
      embed1.setImage(configData.ticketPanelImage.trim());
    }

    const embedsToSend = [embed1];

    if (configData.ticketPanelImage2 && configData.ticketPanelImage2.trim() !== '') {
      const embed2 = new EmbedBuilder()
        .setColor('#ff6b81')
        .setImage(configData.ticketPanelImage2.trim());
      embedsToSend.push(embed2);
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('open_anny_ticket_form')
        .setLabel('🎫 เปิดฟอร์มแจ้งปัญหา / Create Ticket')
        .setStyle(ButtonStyle.Success)
    );

    await targetChannel.send({ embeds: embedsToSend, components: [row] });
    return interaction.reply({ content: `✅ **ส่งแผงระบบ Anny the Helper ไปที่ห้อง <#${targetChannelId}> สำเร็จแล้วค่ะ!** 🌸`, ephemeral: true });
  }

  // 2. คำสั่ง /config-panel (แผงตั้งค่าสำหรับ Admin)
  if (interaction.isChatInputCommand() && interaction.commandName === 'config-panel') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ เฉพาะ Admin เท่านั้นที่เปิดแผงควบคุมนี้ได้ค่ะ! / Admin only!', ephemeral: true });
    }

    const panelChannelStatus = configData.ticketPanelChannelId ? `<#${configData.ticketPanelChannelId}>` : '❌ ยังไม่ได้ตั้งค่า / Not Set';
    const logChannelStatus = configData.ticketLogChannelId ? `<#${configData.ticketLogChannelId}>` : '❌ ยังไม่ได้ตั้งค่า / Not Set';
    const panelImgStatus = configData.ticketPanelImage ? '🖼️ Image 1: OK' : '❌ Image 1: None';
    const panelImg2Status = configData.ticketPanelImage2 ? '🖼️ Image 2: OK' : '❌ Image 2: None';
    const logImgStatus = configData.ticketLogImage ? '🖼️ Image 1: OK' : '❌ Image 1: None';
    const logImg2Status = configData.ticketLogImage2 ? '🖼️ Image 2: OK' : '❌ Image 2: None';

    const panelEmbed = new EmbedBuilder()
      .setTitle('⚙️ Anny the Helper - Admin Configuration Panel')
      .setDescription('เลือกปุ่มด้านล่างเพื่อตั้งค่าห้องและรูปภาพประกอบ (TH/EN Supported)')
      .setColor('#9b59b6')
      .addFields(
        { name: '📢 ห้องสำหรับส่งปุ่ม Ticket Panel', value: `${panelChannelStatus}\n└ ${panelImgStatus} | ${panelImg2Status}`, inline: false },
        { name: '📥 ห้องรับแจ้งปัญหาสำหรับแอดมิน (Log)', value: `${logChannelStatus}\n└ ${logImgStatus} | ${logImg2Status}`, inline: false }
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('config_set_panel_channel').setLabel('📢 ตั้งค่า Ticket Panel & รูปภาพ').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('config_set_log_channel').setLabel('📥 ตั้งค่า Ticket Log & รูปภาพ').setStyle(ButtonStyle.Success)
    );

    return interaction.reply({ embeds: [panelEmbed], components: [row], ephemeral: true });
  }

  // Modal ตั้งค่า Ticket Panel
  if (interaction.isButton() && interaction.customId === 'config_set_panel_channel') {
    const modal = new ModalBuilder().setCustomId('modal_set_panel_channel').setTitle('📢 Setup Ticket Panel & Images');
    
    const channelInput = new TextInputBuilder()
      .setCustomId('channel_id')
      .setLabel('Channel ID (ไอดีห้อง)')
      .setStyle(TextInputStyle.Short)
      .setValue(configData.ticketPanelChannelId)
      .setRequired(true);

    const imageInput = new TextInputBuilder()
      .setCustomId('image_url')
      .setLabel('รูปที่ 1 / Banner 1 URL')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('https://cdn.discordapp.com/...')
      .setValue(configData.ticketPanelImage)
      .setRequired(false);

    const image2Input = new TextInputBuilder()
      .setCustomId('image_url_2')
      .setLabel('รูปที่ 2 / Banner 2 URL')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('https://cdn.discordapp.com/...')
      .setValue(configData.ticketPanelImage2)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(channelInput),
      new ActionRowBuilder().addComponents(imageInput),
      new ActionRowBuilder().addComponents(image2Input)
    );
    return interaction.showModal(modal);
  }

  // Modal ตั้งค่า Ticket Log
  if (interaction.isButton() && interaction.customId === 'config_set_log_channel') {
    const modal = new ModalBuilder().setCustomId('modal_set_log_channel').setTitle('📥 Setup Ticket Log & Images');
    
    const channelInput = new TextInputBuilder()
      .setCustomId('channel_id')
      .setLabel('Admin Channel ID (ไอดีห้องแอดมิน)')
      .setStyle(TextInputStyle.Short)
      .setValue(configData.ticketLogChannelId)
      .setRequired(true);

    const imageInput = new TextInputBuilder()
      .setCustomId('image_url')
      .setLabel('รูปที่ 1 / Banner 1 URL')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('https://cdn.discordapp.com/...')
      .setValue(configData.ticketLogImage)
      .setRequired(false);

    const image2Input = new TextInputBuilder()
      .setCustomId('image_url_2')
      .setLabel('รูปที่ 2 / Banner 2 URL')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('https://cdn.discordapp.com/...')
      .setValue(configData.ticketLogImage2)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(channelInput),
      new ActionRowBuilder().addComponents(imageInput),
      new ActionRowBuilder().addComponents(image2Input)
    );
    return interaction.showModal(modal);
  }

  // Submit Modal Ticket Panel
  if (interaction.isModalSubmit() && interaction.customId === 'modal_set_panel_channel') {
    configData.ticketPanelChannelId = interaction.fields.getTextInputValue('channel_id').trim();
    configData.ticketPanelImage = interaction.fields.getTextInputValue('image_url').trim();
    configData.ticketPanelImage2 = interaction.fields.getTextInputValue('image_url_2').trim();
    return interaction.reply({ content: `✅ **บันทึกการตั้งค่า Ticket Panel สำเร็จแล้วค่ะ! / Saved successfully!**`, ephemeral: true });
  }

  // Submit Modal Ticket Log
  if (interaction.isModalSubmit() && interaction.customId === 'modal_set_log_channel') {
    configData.ticketLogChannelId = interaction.fields.getTextInputValue('channel_id').trim();
    configData.ticketLogImage = interaction.fields.getTextInputValue('image_url').trim();
    configData.ticketLogImage2 = interaction.fields.getTextInputValue('image_url_2').trim();
    return interaction.reply({ content: `✅ **บันทึกการตั้งค่า Ticket Log สำเร็จแล้วค่ะ! / Saved successfully!**`, ephemeral: true });
  }

  // ==========================================
  // ระบบสร้างฟอร์ม Ticket ของผู้ใช้ (TH/EN)
  // ==========================================
  if (interaction.isButton() && interaction.customId === 'open_anny_ticket_form') {
    const mainCategorySelect = new StringSelectMenuBuilder()
      .setCustomId('anny_select_main_category')
      .setPlaceholder('📌 เลือกประเภทปัญหาหลัก / Select Issue Category...')
      .addOptions([
        { label: '🖥️ Launcher มีปัญหา / Launcher Issues', value: 'cat_launcher', description: 'ตัวเปิดเกม, ปุ่มกดไม่ได้, Fix system' },
        { label: '🎮 ตัวเกม Game Error / Game Bugs', value: 'cat_game', description: 'เกมบัค, ตกแมพ, Error 0, 3, 4' },
        { label: '🚨 แจ้งผู้เล่นโกง / Report Cheater', value: 'cat_cheater', description: 'โปรแกรมโกง, ใช้บัคเอาเปรียบ (Hacks/Bugs)' }
      ]);

    const detailSelect = new StringSelectMenuBuilder()
      .setCustomId('anny_select_detail')
      .setPlaceholder('🔒 กรุณาเลือกหมวดหมู่หลักด้านบนก่อนค่ะ / Select main category above first')
      .setDisabled(true)
      .addOptions([
        { label: 'ยังไม่ได้เลือกหมวดหมู่ / Category not selected', value: 'none', description: 'Please select main category above first' }
      ]);

    const row1 = new ActionRowBuilder().addComponents(mainCategorySelect);
    const row2 = new ActionRowBuilder().addComponents(detailSelect);

    userReportCache.set(interaction.user.id, { mainCat: '', subCat: '' });

    return interaction.reply({
      content: `🛠️ **Anny the Helper - Support System / ระบบแจ้งปัญหา**\n\n> 1️⃣ **ขั้นตอนที่ 1 / Step 1:** เลือกประเภทปัญหาหลักด้านบน / Select main category first.\n> 2️⃣ **ขั้นตอนที่ 2 / Step 2:** ตัวเลือกอาการย่อยจะเปิดให้เลือกค่ะ / Sub-options will then unlock. 🌸`,
      components: [row1, row2],
      ephemeral: true
    });
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'anny_select_main_category') {
    const selectedValue = interaction.values[0];
    let cached = userReportCache.get(interaction.user.id) || {};
    cached.mainCat = selectedValue;
    cached.subCat = '';
    userReportCache.set(interaction.user.id, cached);

    let subOptions = [];
    if (selectedValue === 'cat_launcher') {
      subOptions = [
        { label: '🚀 Launcher บัค / Launcher Bug', value: 'Launcher บัค (Launcher Bug)', description: 'เปิดไม่ขึ้น, ค้าง, หรือเด้งดับ / Crashes or won\'t open' },
        { label: '🔘 กดปุ่มไม่ได้ / Buttons Unresponsive', value: 'กดปุ่มไม่ได้ (Buttons Not Working)', description: 'ปุ่ม Start หรือตั้งค่ากดไม่ติด / Start button not working' },
        { label: '🛠️ Fix system ไม่ทำงาน / Fix System Error', value: 'ตัว fix system ไม่ทำงาน (Fix System Failed)', description: 'กดซ่อมแซมไฟล์แล้วเกิดข้อผิดพลาด / Repair process failed' }
      ];
    } else if (selectedValue === 'cat_game') {
      subOptions = [
        { label: '🎮 เกมบัค / In-Game Bug', value: 'เกมบัค (Game Bug)', description: 'ติดบัคในแมพ, ตกแมพ, ขยับไม่ได้ / Stuck in map, glitches' },
        { label: '⚠️ Error 0', value: 'Error 0', description: 'พบปัญหา Error Code 0 / Encountered Error Code 0' },
        { label: '⚠️ Error 3', value: 'Error 3', description: 'พบปัญหา Error Code 3 / Encountered Error Code 3' },
        { label: '⚠️ Error 4', value: 'Error 4', description: 'พบปัญหา Error Code 4 / Encountered Error Code 4' }
      ];
    } else if (selectedValue === 'cat_cheater') {
      subOptions = [
        { label: '🐛 มีคนใช้บัค / Bug Exploiting', value: 'มีคนเล่นบัค (Bug Abuser)', description: 'ผู้เล่นอื่นจงใจใช้บัคเอาเปรียบ / Abusing in-game bugs' },
        { label: '💻 มีคนใช้โปร / Using Hacks/Cheats', value: 'มีคนใช้โปรแกรมโกง (Cheater/Hacker)', description: 'พบผู้ใช้โปรแกรมช่วยเล่น / Using third-party cheats' }
      ];
    }

    let mainCatTitle = selectedValue === 'cat_launcher' ? 'Launcher' : selectedValue === 'cat_game' ? 'Game Error' : 'Cheater Report';

    const mainCategorySelect = new StringSelectMenuBuilder()
      .setCustomId('anny_select_main_category')
      .setPlaceholder(`✔️ เลือกแล้ว / Selected: ${mainCatTitle}`)
      .addOptions([
        { label: '🖥️ Launcher มีปัญหา / Launcher Issues', value: 'cat_launcher', description: 'ตัวเปิดเกม, ปุ่มกดไม่ได้, Fix system' },
        { label: '🎮 ตัวเกม Game Error / Game Bugs', value: 'cat_game', description: 'เกมบัค, ตกแมพ, Error 0, 3, 4' },
        { label: '🚨 แจ้งผู้เล่นโกง / Report Cheater', value: 'cat_cheater', description: 'โปรแกรมโกง, ใช้บัคเอาเปรียบ (Hacks/Bugs)' }
      ]);

    const detailSelect = new StringSelectMenuBuilder()
      .setCustomId('anny_select_detail')
      .setPlaceholder('✨ เลือกอาการหรือรายละเอียด / Select specific detail...')
      .addOptions(subOptions);

    const row1 = new ActionRowBuilder().addComponents(mainCategorySelect);
    const row2 = new ActionRowBuilder().addComponents(detailSelect);

    const submitBtnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('anny_submit_final_report')
        .setLabel('📤 ยืนยันส่งแจ้งปัญหา / Submit Ticket')
        .setStyle(ButtonStyle.Success)
    );

    return interaction.update({
      content: `🛠️ **Anny the Helper - เลือกหัวข้อหลักแล้ว! / Category Selected!**\n\n> **ขั้นตอนที่ 2 / Step 2:** กรุณาเลือกอาการเฉพาะเจาะจงในช่องที่ 2 ด้านล่างได้เลยค่ะ / Select specific issue detail below. 🌸`,
      components: [row1, row2, submitBtnRow]
    });
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'anny_select_detail') {
    let cached = userReportCache.get(interaction.user.id) || {};
    cached.subCat = interaction.values[0];
    userReportCache.set(interaction.user.id, cached);

    return interaction.reply({ content: `✅ **บันทึกอาการเรียบร้อย! / Issue saved!**\nกรุณากดปุ่ม **"📤 ยืนยันส่งแจ้งปัญหา / Submit Ticket"** ด้านบนได้เลยค่ะ`, ephemeral: true });
  }

  if (interaction.isButton() && interaction.customId === 'anny_submit_final_report') {
    let cached = userReportCache.get(interaction.user.id);
    if (!cached || !cached.mainCat || !cached.subCat) {
      return interaction.reply({ content: '⚠️ กรุณาเลือกประเภทปัญหาและอาการให้ครบถ้วนก่อนค่ะ! / Please select both category and issue detail first!', ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId('anny_modal_submit_ticket')
      .setTitle('📝 Details / รายละเอียดเพิ่มเติม');

    const descInput = new TextInputBuilder()
      .setCustomId('anny_report_description')
      .setLabel('รายละเอียด / Details or Image/Video Links')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('อธิบายเพิ่มเติม หรือแนบลิงก์รูป/วิดีโอ (ถ้ามี) / Describe your issue or paste links...')
      .setRequired(false);

    modal.addComponents(new ActionRowBuilder().addComponents(descInput));
    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId === 'anny_modal_submit_ticket') {
    await interaction.deferReply({ ephemeral: true });

    const description = interaction.fields.getTextInputValue('anny_report_description');
    let cached = userReportCache.get(interaction.user.id) || { mainCat: 'ไม่ระบุ / Unspecified', subCat: 'ไม่ระบุ / Unspecified' };

    let mainText = cached.mainCat === 'cat_launcher' ? '🖥️ Launcher มีปัญหา / Launcher Issue' : cached.mainCat === 'cat_game' ? '🎮 ตัวเกม Game Error / Game Bug' : '🚨 แจ้งผู้เล่นโกง / Cheater Report';
    let subText = cached.subCat;

    const reportEmbed = new EmbedBuilder()
      .setTitle('🎫 [ Anny the Helper ] มีรายงานปัญหา Ticket ใหม่! / New Ticket Received!')
      .setColor('#e74c3c')
      .addFields(
        { name: '👤 ผู้แจ้งปัญหา / Reporter', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: false },
        { name: '📂 หมวดหมู่หลัก / Main Category', value: mainText, inline: true },
        { name: '🔍 อาการ / Issue Detail', value: subText, inline: true },
        { name: '📝 รายละเอียดเพิ่มเติม / Details & Media', value: description || 'ไม่มีรายละเอียดเพิ่มเติม / No details provided', inline: false }
      )
      .setFooter({ text: '💡 แอดมินสามารถ Reply (ตอบกลับ) ข้อความนี้เพื่อส่งคำตอบหาผู้เล่นทาง DM ได้ทันที' })
      .setTimestamp();

    if (configData.ticketLogImage && configData.ticketLogImage.trim() !== '') {
      reportEmbed.setImage(configData.ticketLogImage.trim());
    }

    const logEmbedsToSend = [reportEmbed];

    if (configData.ticketLogImage2 && configData.ticketLogImage2.trim() !== '') {
      const logEmbed2 = new EmbedBuilder()
        .setColor('#e74c3c')
        .setImage(configData.ticketLogImage2.trim());
      logEmbedsToSend.push(logEmbed2);
    }

    const logChannelId = configData.ticketLogChannelId || interaction.channelId;
    const logChannel = interaction.guild.channels.cache.get(logChannelId);

    if (logChannel) {
      const sentLogMsg = await logChannel.send({ embeds: logEmbedsToSend });
      activeTickets.set(sentLogMsg.id, interaction.user.id);
    }

    userReportCache.delete(interaction.user.id);

    return interaction.editReply({ content: '🎉 **ส่งรายงานปัญหา (Ticket) เรียบร้อยแล้วค่ะ! / Your ticket has been submitted!**\nAnny และทีมงานจะรีบตรวจสอบและติดต่อกลับทาง DM นะคะ 🌸' });
  }

});

client.login(BOT_TOKEN);
