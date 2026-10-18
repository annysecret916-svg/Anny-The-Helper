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

// Express Server สำหรับ UptimeRobot 24/7
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

// ตัวแปรเก็บค่าคอนฟิก (เพิ่มช่องเก็บรูป 2 รูปต่อส่วน: Banner & Thumbnail)
let configData = {
  ticketPanelChannelId: '', 
  ticketPanelImage: '',       // ลิงก์รูปภาพที่ 1 (Banner)
  ticketPanelThumbnail: '',   // ลิงก์รูปภาพที่ 2 (Thumbnail/รูปเล็กลูกเล่น)
  ticketLogChannelId: '',   
  ticketLogImage: '',         // ลิงก์รูปภาพที่ 1 (Banner)
  ticketLogThumbnail: ''      // ลิงก์รูปภาพที่ 2 (Thumbnail/รูปเล็กลูกเล่น)
};

const activeTickets = new Map(); // เก็บแมปปิ้ง MessageID -> UserID สำหรับการ Reply ของแอดมิน
const userReportCache = new Map(); // เก็บสถานะตัวเลือกฟอร์ม Ticket

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
      description: '🛡️ ส่งแผงระบบช่วยเหลือ Anny the Helper ไปยังห้องที่ตั้งค่าไว้',
      default_member_permissions: PermissionFlagsBits.Administrator.toString(),
    },
    {
      name: 'config-panel',
      description: '⚙️ เปิดแผงควบคุมตั้งค่าห้อง Ticket, Log และรูปภาพ สำหรับ Admin',
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
              .setTitle('🛡️ [ Anny the Helper ] ข้อความตอบกลับจากทีมงาน')
              .setDescription(message.content)
              .setColor('#2ecc71')
              .setFooter({ text: `ตอบกลับโดยแอดมิน: ${message.author.tag}` })
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

  // 1. คำสั่ง /setup-ticket
  if (interaction.isChatInputCommand() && interaction.commandName === 'setup-ticket') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ เฉพาะ Admin เท่านั้นที่ใช้งานคำสั่งนี้ได้ค่ะ!', ephemeral: true });
    }

    const targetChannelId = configData.ticketPanelChannelId || interaction.channelId;
    const targetChannel = interaction.guild.channels.cache.get(targetChannelId);

    if (!targetChannel) {
      return interaction.reply({ content: '❌ ยังไม่ได้ตั้งค่าห้องสำหรับส่งแผง Ticket กรุณาตั้งค่าผ่าน `/config-panel` ก่อนค่ะ!', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('🛡️ ──・[ Anny the Helper : ศูนย์ช่วยเหลือผู้เล่น ]・── 🌸')
      .setDescription('✨ สวัสดีค่ะคุณผู้เล่น! หากคุณพบปัญหา:\n\n> 🖥️ **Launcher มีปัญหา** (บัค, กดปุ่มไม่ได้, Fix system ไม่ทำงาน)\n> 🎮 **ตัวเกม Game Error** (เกมบัค, Error 0, 3, 4)\n> 🚨 **แจ้งผู้เล่นโกง** (มีคนเล่นบัค, ใช้โปรแกรมโกง)\n\n🧸 **คลิกปุ่มด้านล่างเพื่อเปิดฟอร์มแจ้งปัญหา (Ticket) ได้เลยนะคะ!**')
      .setColor('#ff6b81')
      .setTimestamp();

    // ใส่อิมเมจ Banner
    if (configData.ticketPanelImage && configData.ticketPanelImage.trim() !== '') {
      embed.setImage(configData.ticketPanelImage.trim());
    }

    // ใส่รูป Thumbnail เพิ่มเติม
    if (configData.ticketPanelThumbnail && configData.ticketPanelThumbnail.trim() !== '') {
      embed.setThumbnail(configData.ticketPanelThumbnail.trim());
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('open_anny_ticket_form')
        .setLabel('🎫 เปิดฟอร์มแจ้งปัญหา (Ticket)')
        .setStyle(ButtonStyle.Success)
    );

    await targetChannel.send({ embeds: [embed], components: [row] });
    return interaction.reply({ content: `✅ **ส่งแผงระบบ Anny the Helper ไปที่ห้อง <#${targetChannelId}> สำเร็จแล้วค่ะ!** 🌸`, ephemeral: true });
  }

  // 2. คำสั่ง /config-panel แผงควบคุมของ Admin
  if (interaction.isChatInputCommand() && interaction.commandName === 'config-panel') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ เฉพาะ Admin เท่านั้นที่เปิดแผงควบคุมนี้ได้ค่ะ!', ephemeral: true });
    }

    const panelChannelStatus = configData.ticketPanelChannelId ? `<#${configData.ticketPanelChannelId}>` : '❌ ยังไม่ได้ตั้งค่า';
    const logChannelStatus = configData.ticketLogChannelId ? `<#${configData.ticketLogChannelId}>` : '❌ ยังไม่ได้ตั้งค่า';
    const panelImgStatus = configData.ticketPanelImage ? '🖼️ รูปหลัก: ตั้งค่าแล้ว' : '❌ รูปหลัก: ไม่มี';
    const panelThumbStatus = configData.ticketPanelThumbnail ? '🖼️ รูปที่ 2: ตั้งค่าแล้ว' : '❌ รูปที่ 2: ไม่มี';
    const logImgStatus = configData.ticketLogImage ? '🖼️ รูปหลัก: ตั้งค่าแล้ว' : '❌ รูปหลัก: ไม่มี';
    const logThumbStatus = configData.ticketLogThumbnail ? '🖼️ รูปที่ 2: ตั้งค่าแล้ว' : '❌ รูปที่ 2: ไม่มี';

    const panelEmbed = new EmbedBuilder()
      .setTitle('⚙️ Anny the Helper - Admin Configuration Panel')
      .setDescription('เลือกปุ่มด้านล่างเพื่อตั้งค่าห้องและใส่รูปภาพประกอบ (2 รูป) ของแต่ละส่วนได้เลยค่ะ')
      .setColor('#9b59b6')
      .addFields(
        { name: '📢 ห้องสำหรับส่งปุ่ม Ticket Panel', value: `${panelChannelStatus}\n└ ${panelImgStatus} | ${panelThumbStatus}`, inline: false },
        { name: '📥 ห้องรับแจ้งปัญหาสำหรับแอดมิน (Log)', value: `${logChannelStatus}\n└ ${logImgStatus} | ${logThumbStatus}`, inline: false }
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('config_set_panel_channel').setLabel('📢 ตั้งค่าห้องส่งปุ่ม Ticket & รูปภาพ').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('config_set_log_channel').setLabel('📥 ตั้งค่าห้องรับแจ้ง Log & รูปภาพ').setStyle(ButtonStyle.Success)
    );

    return interaction.reply({ embeds: [panelEmbed], components: [row], ephemeral: true });
  }

  // ปุ่มกดเพื่อเปิด Modal ตั้งค่า Ticket Panel (มี 3 ช่อง: ไอดีห้อง + รูปภาพ Banner + รูปภาพที่ 2)
  if (interaction.isButton() && interaction.customId === 'config_set_panel_channel') {
    const modal = new ModalBuilder().setCustomId('modal_set_panel_channel').setTitle('📢 ตั้งค่า Ticket Panel & รูปภาพ');
    
    const channelInput = new TextInputBuilder()
      .setCustomId('channel_id')
      .setLabel('Channel ID (ไอดีห้อง)')
      .setStyle(TextInputStyle.Short)
      .setValue(configData.ticketPanelChannelId)
      .setRequired(true);

    const imageInput = new TextInputBuilder()
      .setCustomId('image_url')
      .setLabel('ลิงก์รูปภาพที่ 1 Banner (รูปภาพใหญ่)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('https://cdn.discordapp.com/...')
      .setValue(configData.ticketPanelImage)
      .setRequired(false);

    const image2Input = new TextInputBuilder()
      .setCustomId('image_url_2')
      .setLabel('ลิงก์รูปภาพที่ 2 Thumbnail (รูปภาพขวาบน)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('https://cdn.discordapp.com/...')
      .setValue(configData.ticketPanelThumbnail)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(channelInput),
      new ActionRowBuilder().addComponents(imageInput),
      new ActionRowBuilder().addComponents(image2Input)
    );
    return interaction.showModal(modal);
  }

  // ปุ่มกดเพื่อเปิด Modal ตั้งค่า Ticket Log (มี 3 ช่อง: ไอดีห้อง + รูปภาพ Banner + รูปภาพที่ 2)
  if (interaction.isButton() && interaction.customId === 'config_set_log_channel') {
    const modal = new ModalBuilder().setCustomId('modal_set_log_channel').setTitle('📥 ตั้งค่า Ticket Log & รูปภาพ');
    
    const channelInput = new TextInputBuilder()
      .setCustomId('channel_id')
      .setLabel('Channel ID (ไอดีห้องแอดมิน)')
      .setStyle(TextInputStyle.Short)
      .setValue(configData.ticketLogChannelId)
      .setRequired(true);

    const imageInput = new TextInputBuilder()
      .setCustomId('image_url')
      .setLabel('ลิงก์รูปภาพที่ 1 Banner (รูปภาพใหญ่)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('https://cdn.discordapp.com/...')
      .setValue(configData.ticketLogImage)
      .setRequired(false);

    const image2Input = new TextInputBuilder()
      .setCustomId('image_url_2')
      .setLabel('ลิงก์รูปภาพที่ 2 Thumbnail (รูปภาพขวาบน)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('https://cdn.discordapp.com/...')
      .setValue(configData.ticketLogThumbnail)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(channelInput),
      new ActionRowBuilder().addComponents(imageInput),
      new ActionRowBuilder().addComponents(image2Input)
    );
    return interaction.showModal(modal);
  }

  // บันทึกข้อมูล Modal ตั้งค่า Ticket Panel
  if (interaction.isModalSubmit() && interaction.customId === 'modal_set_panel_channel') {
    configData.ticketPanelChannelId = interaction.fields.getTextInputValue('channel_id').trim();
    configData.ticketPanelImage = interaction.fields.getTextInputValue('image_url').trim();
    configData.ticketPanelThumbnail = interaction.fields.getTextInputValue('image_url_2').trim();
    return interaction.reply({ content: `✅ **บันทึกการตั้งค่า Ticket Panel และรูปภาพทั้ง 2 รูปสำเร็จแล้วค่ะ!**`, ephemeral: true });
  }

  // บันทึกข้อมูล Modal ตั้งค่า Ticket Log
  if (interaction.isModalSubmit() && interaction.customId === 'modal_set_log_channel') {
    configData.ticketLogChannelId = interaction.fields.getTextInputValue('channel_id').trim();
    configData.ticketLogImage = interaction.fields.getTextInputValue('image_url').trim();
    configData.ticketLogThumbnail = interaction.fields.getTextInputValue('image_url_2').trim();
    return interaction.reply({ content: `✅ **บันทึกการตั้งค่า Ticket Log และรูปภาพทั้ง 2 รูปสำเร็จแล้วค่ะ!**`, ephemeral: true });
  }

  // ==========================================
  // ระบบสร้างฟอร์ม Ticket ของผู้ใช้
  // ==========================================
  if (interaction.isButton() && interaction.customId === 'open_anny_ticket_form') {
    const mainCategorySelect = new StringSelectMenuBuilder()
      .setCustomId('anny_select_main_category')
      .setPlaceholder('📌 กรุณาเลือกประเภทปัญหาหลักก่อน...')
      .addOptions([
        { label: '🖥️ Launcher มีปัญหา', value: 'cat_launcher', description: 'ปัญหาเกี่ยวกับตัวเปิดเกม ตัวซ่อมแซมระบบ' },
        { label: '🎮 ตัวเกม Game Error', value: 'cat_game', description: 'ปัญหาเกมบัค, หน้าจอ Error โค้ดต่างๆ' },
        { label: '🚨 แจ้งผู้เล่นโกง (บัค/โปร)', value: 'cat_cheater', description: 'พบคนใช้โปรแกรมโกง หรือใช้บัคเอาเปรียบ' }
      ]);

    const detailSelect = new StringSelectMenuBuilder()
      .setCustomId('anny_select_detail')
      .setPlaceholder('🔒 กรุณาเลือกประเภทปัญหาหลักด้านบนก่อนนะคะ')
      .setDisabled(true)
      .addOptions([
        { label: 'ยังไม่ได้เลือกระบุปัญหาแรก', value: 'none', description: 'กรุณาเลือกหมวดหมู่ด้านบนก่อนค่ะ' }
      ]);

    const row1 = new ActionRowBuilder().addComponents(mainCategorySelect);
    const row2 = new ActionRowBuilder().addComponents(detailSelect);

    userReportCache.set(interaction.user.id, { mainCat: '', subCat: '' });

    return interaction.reply({
      content: `🛠️ **Anny the Helper - ระบบแจ้งปัญหาอัจฉริยะ**\nขั้นตอนที่ 1: เลือกหมวดหมู่ปัญหาหลักด้านล่างนี้ก่อน ตัวเลือกอาการจึงจะเปิดใช้งานค่ะ 🌸`,
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
        { label: '🚀 Launcher บัค', value: 'Launcher บัค', description: 'เปิด Launcher ไม่ขึ้น ค้าง หรือเด้ง' },
        { label: '🔘 กดปุ่มไม่ได้', value: 'กดปุ่มไม่ได้', description: 'ปุ่ม Start หรือปุ่มตั้งค่ากดไม่ติด' },
        { label: '🛠️ ตัว fix system ไม่ทำงาน', value: 'ตัว fix system ไม่ทำงาน', description: 'กดซ่อมไฟล์ระบบแล้วไม่เกิดผล' }
      ];
    } else if (selectedValue === 'cat_game') {
      subOptions = [
        { label: '🎮 เกมบัค', value: 'เกมบัค', description: 'ติดบัคในแมพ, ตกแมพ, ขยับไม่ได้' },
        { label: '⚠️ Error 0', value: 'error 0', description: 'พบปัญหา Error Code 0' },
        { label: '⚠️ Error 3', value: 'error 3', description: 'พบปัญหา Error Code 3' },
        { label: '⚠️ Error 4', value: 'error 4', description: 'พบปัญหา Error Code 4' }
      ];
    } else if (selectedValue === 'cat_cheater') {
      subOptions = [
        { label: '🐛 มีคนเล่นบัค', value: 'มีคนเล่นบัค', description: 'ผู้เล่นอื่นจงใจใช้บัคเกมเอาเปรียบ' },
        { label: '💻 มีคนใช้โปรแกรมโกง', value: 'มีคนใช้โปรแกรมโกง', description: 'พบผู้ใช้โปรแกรมช่วยเล่น / โปรโกง' }
      ];
    }

    const mainCategorySelect = new StringSelectMenuBuilder()
      .setCustomId('anny_select_main_category')
      .setPlaceholder(`✔️ เลือกแล้ว: ${selectedValue === 'cat_launcher' ? 'Launcher' : selectedValue === 'cat_game' ? 'Game' : 'ผู้เล่นโกง'}`)
      .addOptions([
        { label: '🖥️ Launcher มีปัญหา', value: 'cat_launcher', description: 'ปัญหาเกี่ยวกับตัวเปิดเกม ตัวซ่อมแซมระบบ' },
        { label: '🎮 ตัวเกม Game Error', value: 'cat_game', description: 'ปัญหาเกมบัค, หน้าจอ Error โค้ดต่างๆ' },
        { label: '🚨 แจ้งผู้เล่นโกง (บัค/โปร)', value: 'cat_cheater', description: 'พบคนใช้โปรแกรมโกง หรือใช้บัคเอาเปรียบ' }
      ]);

    const detailSelect = new StringSelectMenuBuilder()
      .setCustomId('anny_select_detail')
      .setPlaceholder('✨ เลือกอาการหรือรายละเอียดปัญหาของคุณที่นี่...')
      .addOptions(subOptions);

    const row1 = new ActionRowBuilder().addComponents(mainCategorySelect);
    const row2 = new ActionRowBuilder().addComponents(detailSelect);

    const submitBtnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('anny_submit_final_report')
        .setLabel('📤 ยืนยันการส่งแจ้งปัญหา (Submit)')
        .setStyle(ButtonStyle.Success)
    );

    return interaction.update({
      content: `🛠️ **Anny the Helper - เลือกหัวข้อหลักเรียบร้อย!**\nขั้นตอนที่ 2: กรุณาเลือกอาการเฉพาะเจาะจงในช่อง "เป็นอย่างไร" ด้านล่างนี้ต่อได้เลยค่ะ 🌸`,
      components: [row1, row2, submitBtnRow]
    });
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'anny_select_detail') {
    let cached = userReportCache.get(interaction.user.id) || {};
    cached.subCat = interaction.values[0];
    userReportCache.set(interaction.user.id, cached);

    return interaction.reply({ content: `✅ บันทึกอาการเรียบร้อย! กรุณากดปุ่ม **"📤 ยืนยันการส่งแจ้งปัญหา"** ด้านบนเพื่อส่งข้อมูลหาทีมงานได้เลยค่ะ`, ephemeral: true });
  }

  if (interaction.isButton() && interaction.customId === 'anny_submit_final_report') {
    let cached = userReportCache.get(interaction.user.id);
    if (!cached || !cached.mainCat || !cached.subCat) {
      return interaction.reply({ content: '⚠️ กรุณาเลือกประเภทปัญหาหลักและอาการ (เป็นอย่างไร) ให้ครบถ้วนก่อนกดยืนยันค่ะ!', ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId('anny_modal_submit_ticket')
      .setTitle('📝 รายละเอียดเพิ่มเติม (Anny Ticket)');

    const descInput = new TextInputBuilder()
      .setCustomId('anny_report_description')
      .setLabel('รายละเอียดเพิ่มเติม / ลิงก์รูปภาพหรือวิดีโอ')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('พิมพ์อธิบาย หรือวางลิงก์รูป/วิดีโอ (ถ้ามี)...')
      .setRequired(false);

    modal.addComponents(new ActionRowBuilder().addComponents(descInput));
    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId === 'anny_modal_submit_ticket') {
    await interaction.deferReply({ ephemeral: true });

    const description = interaction.fields.getTextInputValue('anny_report_description');
    let cached = userReportCache.get(interaction.user.id) || { mainCat: 'ไม่ระบุ', subCat: 'ไม่ระบุ' };

    let mainText = cached.mainCat === 'cat_launcher' ? '🖥️ Launcher มีปัญหา' : cached.mainCat === 'cat_game' ? '🎮 ตัวเกม Game Error' : '🚨 แจ้งผู้เล่นโกง';
    let subText = cached.subCat;

    const reportEmbed = new EmbedBuilder()
      .setTitle('🎫 [ Anny the Helper ] มีรายงานปัญหา Ticket ใหม่!')
      .setColor('#e74c3c')
      .addFields(
        { name: '👤 ผู้แจ้งปัญหา', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: false },
        { name: '📂 หมวดหมู่หลัก', value: mainText, inline: true },
        { name: '🔍 อาการ (เป็นอย่างไร)', value: subText, inline: true },
        { name: '📝 รายละเอียด / ลิงก์รูปหรือวิดีโอ', value: description || 'ไม่มีรายละเอียดเพิ่มเติม', inline: false }
      )
      .setFooter({ text: '💡 แอดมินสามารถ Reply (ตอบกลับ) ข้อความนี้เพื่อส่งคำตอบหาผู้เล่นทาง DM ได้ทันที' })
      .setTimestamp();

    if (configData.ticketLogImage && configData.ticketLogImage.trim() !== '') {
      reportEmbed.setImage(configData.ticketLogImage.trim());
    }

    if (configData.ticketLogThumbnail && configData.ticketLogThumbnail.trim() !== '') {
      reportEmbed.setThumbnail(configData.ticketLogThumbnail.trim());
    }

    const logChannelId = configData.ticketLogChannelId || interaction.channelId;
    const logChannel = interaction.guild.channels.cache.get(logChannelId);

    if (logChannel) {
      const sentLogMsg = await logChannel.send({ embeds: [reportEmbed] });
      activeTickets.set(sentLogMsg.id, interaction.user.id);
    }

    userReportCache.delete(interaction.user.id);

    return interaction.editReply({ content: '🎉 **ส่งรายงานปัญหา (Ticket) ไปยังทีมงานเรียบร้อยแล้วค่ะ!** Anny และทีมงานจะรีบตรวจสอบและติดต่อกลับทาง DM นะคะ 🌸' });
  }

});

client.login(BOT_TOKEN);
