# Lynda Video Transcripts

一个批量抓取 [Lynda](http://www.lynda.com/) 视频字幕的爬虫脚本。

## Requirements

- Node.js
- Phantom.js 2.x

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

复制一份 `config.example.yaml` 并更名为 `config.yaml`，打开编辑：

- `detectNetworkCondition` 设置是否在开始时检查网络连接状况 `yes`/`no`
- `userAgent` 建议配置成与自己常用浏览器一致的 userAgent 可能好一些
- `captureScreenAutomatically` 设置爬虫运行过程中是否定时自动截图 `yes`/`no`
- `viewportSize` 设置爬虫使用的浏览器的可视区域大小，取值任意，不要太小即可
- `username` `password` lynda.com 账号名和密码
- `courses` 需要抓取的课程列表
- `intervalBetweenTutorialVisits` 设置每两节课程抓取时间的间隔，不建议设置得太短，避免被反作弊处理

#### `courses`

支持两种方式。可以同时指定输出目录和该课程起始抓取点：

```yaml
courses:
  - dirName: <COURSE_OUTPUT_DIR>
    startPoint: <START_POINT_URL>
  - dirName: ...
    startPoint: ...
  - dirName: ...
    startPoint: ...
```

也可以只指定每个课程的起始点，程序会自动根据课程名称确定输出目录：

```yaml
courses:
  - <START_POINT_URL>
  - <ANOTHER_START_POINT_URL>
  - ...
```

爬虫内部的运作逻辑是，会从指定的起始点开始抓取字幕，直到课程的最后一节。

## Note

每次启动爬虫脚本都会清空输出目录（`output/`），因此请注意及时转移文件。
