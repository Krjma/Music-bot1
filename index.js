// اجعل DisTube يستخدم ffmpeg-static تلقائياً (حل مشكلة Railway)
process.env.FFMPEG_PATH = require('ffmpeg-static');
// منع توقف البوت مع أي خطأ غير متوقع
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});


// --- كود الداشبورد (Express + EJS) ---
const express = require('express');
const app = express();
const port = 3000;
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.use(express.urlencoded({ extended: true }));

// API لإرجاع بيانات الأغنية الحالية (للجافاسكريبت)

// API لإرجاع بيانات الأغنية الحالية (للجافاسكريبت)
app.get('/api/song', (req, res) => {
  let song = null;
  if (global.currentSong && global.distubeQueue?.currentTime != null) {
    const duration = global.distubeQueue.songs[0]?.duration || 0;
    const currentTime = global.distubeQueue.currentTime || 0;
    song = {
      ...global.currentSong,
      duration,
      currentTime,
      progressPercent: duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0
    };
  }
  res.json({ song, volume: global.currentVolume || 50 });
});

// صفحة الداشبورد الرئيسية
app.get('/', (req, res) => {
  res.render('dashboard');
});

// نقاط تحكم إضافية
app.post('/pause', (req, res) => {
  if (global.distubeQueue) global.distubeQueue.pause();
  res.redirect('/');
});
app.post('/resume', (req, res) => {
  if (global.distubeQueue) global.distubeQueue.resume();
  res.redirect('/');
});
app.post('/skip', (req, res) => {
  if (global.distubeQueue) global.distubeQueue.skip();
  res.redirect('/');
});
app.post('/stop', (req, res) => {
  if (global.distubeQueue) global.distubeQueue.stop();
  res.redirect('/');
});

app.post('/volume/up', (req, res) => {
  if (global.distubeQueue) {
    global.distubeQueue.setVolume(Math.min(global.currentVolume + 10, 100));
    global.currentVolume = Math.min(global.currentVolume + 10, 100);
  }
  res.redirect('/');
});

app.post('/volume/down', (req, res) => {
  if (global.distubeQueue) {
    global.distubeQueue.setVolume(Math.max(global.currentVolume - 10, 0));
    global.currentVolume = Math.max(global.currentVolume - 10, 0);
  }
  res.redirect('/');
});

app.listen(port, () => {
  console.log(`Dashboard running at http://localhost:${port}`);
});
// index.js
require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionType } = require('discord.js');
const fetch = require('node-fetch');
const { DisTube } = require('distube');
const { YtDlpPlugin } = require('@distube/yt-dlp');
const { SpotifyPlugin } = require('@distube/spotify');
const { SoundCloudPlugin } = require('@distube/soundcloud');
const { joinVoiceChannel } = require('@discordjs/voice');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const distube = new DisTube(client, {
  plugins: [
    new YtDlpPlugin(),
    new SpotifyPlugin(),
    new SoundCloudPlugin()
  ],
  ffmpegPath: process.env.FFMPEG_PATH
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  const prefix = '!';
  if (!message.content.startsWith(prefix)) return;
  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'play') {
    if (!args[0]) return message.reply('اكتب اسم الأغنية أو الرابط!');
    if (!message.member.voice.channel) return message.reply('ادخل روم صوتي أولاً!');
    try {
      const query = args.join(' ');
      if (/^(https?:\/\/)/i.test(query)) {
        await distube.play(message.member.voice.channel, query, {
          textChannel: message.channel,
          member: message.member
        });
      } else {
        // البحث في يوتيوب باستخدام YouTube Data API
        const apiKey = process.env.YOUTUBE_API_KEY;
        if (!apiKey || apiKey === 'ضع_مفتاحك_هنا') {
          return message.reply('يرجى وضع مفتاح YouTube API في ملف .env');
        }
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(query)}&key=${apiKey}`;
        const res = await fetch(searchUrl);
        const data = await res.json();
        if (data.items && data.items.length > 0) {
          const videoId = data.items[0].id.videoId;
          const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
          await distube.play(message.member.voice.channel, videoUrl, {
            textChannel: message.channel,
            member: message.member
          });
        } else {
          return message.reply('لم أجد أي نتيجة لهذا البحث في يوتيوب.');
        }
      }
    } catch (err) {
      if (err.name === 'DisTubeError' && err.errorCode === 'NO_RESULT') {
        message.reply('لم أجد أي نتيجة لهذا البحث. جرب كتابة اسم الأغنية بشكل أوضح أو استخدم رابط مباشر.');
      } else if (err.name === 'DisTubeError' && err.errorCode === 'SOUNDCLOUD_PLUGIN_RATE_LIMITED') {
        message.reply('تم تجاوز الحد المسموح من SoundCloud. جرب استخدام رابط يوتيوب أو سبوتيفاي.');
      } else {
        message.reply('حدث خطأ أثناء محاولة تشغيل الأغنية.');
        console.error(err);
      }
    }
  }
});

// متغيرات عالمية للداشبورد
global.currentVolume = 50; // القيمة الافتراضية
global.currentSong = null;
global.distubeQueue = null;

// أزرار التحكم
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  const queue = distube.getQueue(interaction.guildId);
  if (!queue) return interaction.reply({ content: 'لا يوجد أغنية تعمل حالياً.', ephemeral: true });
  switch (interaction.customId) {
    case 'pause':
      queue.pause();
      await interaction.reply({ content: 'تم إيقاف الأغنية مؤقتاً.', ephemeral: true });
      break;
    case 'resume':
      queue.resume();
      await interaction.reply({ content: 'تم استئناف الأغنية.', ephemeral: true });
      break;
    case 'skip':
      queue.skip();
      await interaction.reply({ content: 'تم تخطي الأغنية!', ephemeral: true });
      break;
    case 'stop':
      queue.stop();
      await interaction.reply({ content: 'تم إيقاف الأغاني!', ephemeral: true });
      break;
    case 'volup': {
      const newVol = Math.min(queue.volume + 10, 100);
      queue.setVolume(newVol);
  global.currentVolume = newVol;
      await interaction.reply({ content: `تم رفع الصوت إلى ${queue.volume}%`, ephemeral: true });
      break;
    }
    case 'voldown': {
      const newVol = Math.max(queue.volume - 10, 0);
      queue.setVolume(newVol);
  global.currentVolume = newVol;
      await interaction.reply({ content: `تم خفض الصوت إلى ${queue.volume}%`, ephemeral: true });
      break;
    }
  }
});



distube.on('playSong', (queue, song) => {
  // ضبط مستوى الصوت المحفوظ تلقائياً
  queue.setVolume(global.currentVolume);
  global.currentSong = { name: song.name, url: song.url, thumbnail: song.thumbnail };
  global.distubeQueue = queue;

  const embed = new EmbedBuilder()
    .setTitle('يتم الآن تشغيل')
    .setDescription(`[${song.name}](${song.url})`)
    .addFields(
      { name: 'المدة', value: song.formattedDuration, inline: true },
      { name: 'بواسطة', value: song.user?.toString() || 'غير معروف', inline: true }
    )
    .setThumbnail(song.thumbnail)
    .setColor(0x1DB954);

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('pause').setLabel('⏸️ إيقاف مؤقت').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('resume').setLabel('▶️ استئناف').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('skip').setLabel('⏭️ تخطي').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('stop').setLabel('⏹️ إيقاف').setStyle(ButtonStyle.Danger)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('volup').setLabel('🔊 رفع الصوت').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('voldown').setLabel('🔉 خفض الصوت').setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setLabel('لوحة التحكم')
      .setStyle(ButtonStyle.Link)
      .setURL('http://localhost:3000/')
  );

  queue.textChannel.send({ embeds: [embed], components: [row1, row2] });
});

distube.on('addSong', (queue, song) => {
  queue.textChannel.send(`تمت إضافة: \`${song.name}\``);
});

// استخدم التوكن من ملف .env
client.login(process.env.DISCORD_TOKEN);
