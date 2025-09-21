const express = require('express');
const app = express();
const port = 3000;

// إعداد EJS كـ view engine
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

// صفحة الداشبورد الرئيسية
app.get('/', (req, res) => {
  res.render('dashboard', {
    song: global.currentSong || null,
    volume: global.currentVolume || 50
  });
});

// نقطة تحكم (مثال: رفع الصوت)
app.post('/volume/up', (req, res) => {
  if (global.distubeQueue) {
    global.distubeQueue.setVolume(Math.min(global.currentVolume + 10, 100));
    global.currentVolume = Math.min(global.currentVolume + 10, 100);
  }
  res.redirect('/');
});

// نقطة تحكم (مثال: خفض الصوت)
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
