# Lynda Video Transcripts

一个批量抓取 Lynda 视频字幕的爬虫脚本。

## Requirements

- Node.js
- Phantom.js

## Installation

```bash
$ git clone https://github.com/riophae/lynda-video-transcripts.git
$ cd lynda-video-transcripts
$ npm install # 安装依赖
$ # 配置 config
$ npm run build # 每次修改 config 后都要进行编译
$ npm start # 执行爬虫脚本
```

## Configuration

复制一份 `config.example.yaml`，更名为 `config.yaml`，打开编辑：

- `detectNetworkCondition` 设置是否在开始时检查网络连接状况 `yes`/`no`
- `userAgent` 建议配置成与自己常用浏览器一致的 userAgent 可能好一些
- `captureScreenAutomatically` 设置爬虫运行过程中是否定时自动截图 `yes`/`no`
- `viewportSize` 设置爬虫使用的浏览器的可视区域大小，取值任意，不要太小即可
- `username` `password` lynda.com 账号名和密码
- `startPoint` 爬虫内部执行的流程是，它会从 `startPoint` 参数指定的页面开始抓取字幕，当该节课程还有后续课程时，会持续自动抓取
- `intervalBetweenTutorialVisits` 设置每两节课程抓取时间的间隔，不建议设置得太短，避免被反作弊处理
