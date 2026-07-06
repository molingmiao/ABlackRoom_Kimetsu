import express from 'express';

const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '0.0.0.0';

const app = express();

// 静态资源缓存策略：
// - HTML 不缓存，避免玩家拉不到新版本
// - 其它（js/css/音频/图片）短期缓存，开发期足够，生产可加 hash 后再调长
app.use(express.static('.', {
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=300');
    }
  }
}));

app.listen(PORT, HOST, () => console.log(`Listening on http://${HOST}:${PORT}`));
